# Payables

A small, opinionated payables product inspired by [Ramp Bill Pay](https://support.ramp.com/hc/en-us/articles/27579228841875-Managing-bills-and-payments-on-Bill-Pay).

> **The bet:** the spine of any AP product is one loop — *invoice arrives → becomes a bill → gets reviewed and approved → gets paid → shows up in aging*. Everything else (CSV upload, AP email forwarding, recurring bills, line-item splits, multi-approver workflows, GL coding) is a variation on that loop. So I built the spine end-to-end with one real magical feature — AI extraction — and called the rest scope.

## Try it in 30 seconds

Run the [setup](#setup) steps below, then:

1. Open `http://localhost:3000` → click around the seeded bills, try filtering by status
2. Click **New bill** → tap one of the **sample invoice chips** (Acme Cloud / Northwind Logistics / Globex Supplies) for a one-click demo, or drop your own PDF / one from the [`samples/`](./samples) folder
3. Watch the form populate from Claude vision in ~6 seconds — edit anything, approve, schedule a payment, mark paid
4. Hit **Import CSV** in the bills header → tap the **8-bill sample** chip (or drop [`samples/bulk-import.csv`](./samples/bulk-import.csv)) to import 8 bills at once
5. Open **Aging** in the nav to see overdue bills bucketed by vendor; the red callout offers **Export CSV** and a **Review overdue** deep-link into the bills filter
6. Open **Vendors** → click any row to drill into a vendor (outstanding/paid/total stats and every bill they've ever sent). The "Back" button on those bills returns you to the vendor, not to the list — works as you'd expect on mobile too

---

## Contents

- [Ramp Bill Pay feature coverage](#ramp-bill-pay-feature-coverage)
- [What it does](#what-it-does)
- [Workflows I prioritized](#workflows-i-prioritized)
- [Line-item splits & allocation templates](#line-item-splits--allocation-templates)
- [What I left out and why](#what-i-left-out-and-why)
- [Setup](#setup)
- [Tech stack and rationale](#tech-stack-and-rationale)
- [Patterns](#patterns)
- [Folder layout](#folder-layout)
- [Data model](#data-model)
- [Bill status lifecycle](#bill-status-lifecycle)
- [End-to-end: how an upload becomes a bill](#end-to-end-how-an-upload-becomes-a-bill)
- [The model contract](#the-model-contract)
- [Production hardening I deliberately skipped](#production-hardening-i-deliberately-skipped)
- [What I'd build next](#what-id-build-next)

---

## Ramp Bill Pay feature coverage

I used 11 Ramp Bill Pay help-center articles as a feature checklist while scoping this project. Here's the explicit scoping decision for each:

| # | Prompt feature | Status | Where |
|---|---|---|---|
| 1 | Ramp Bill Pay OCR | ✅ Shipped | Claude Sonnet 4.6 vision; `/bills/new` → upload PDF/image |
| 2 | Bill Pay Line Item Splits and Allocation Templates | ✅ Shipped | Multi-dimension per-line allocation (category + department + GL + location) with live cents preview; reusable templates managed from a bill, from **Settings → Allocation templates**, or via CSV import. See [Line-item splits & allocation templates](#line-item-splits--allocation-templates) |
| 3 | Bill Pay AP Email Forwarding | ❌ Skipped | Postmark/SES inbound webhook → same upload pipeline. ~2h, didn't fit. |
| 4 | Bill Pay spreadsheet upload (CSV) | ✅ Shipped | `/bills/import` with drag-drop, preview table, per-row validation |
| 5 | Managing bills and payments | ✅ Shipped | `/bills` with summary cards, filter, search, sortable columns |
| 6 | Creating draft bills | ✅ Shipped | "Create a bill without an invoice" → empty draft + editor |
| 7 | Uploading invoices and bills | ✅ Shipped | Same as #1 — drag-drop with mime/size validation |
| 8 | Invoice line items: Expense vs. item | ❌ Skipped | Needs an accounting backend (item = inventory, expense = GL). Without sync it's just metadata. |
| 9 | Creating and managing recurring bill payments | ✅ Shipped | "Repeat" any bill into N future drafts (monthly / quarterly / yearly) |
| 10 | Bill lifecycle | ✅ Shipped | Status FSM: `draft → needs_review → approved → scheduled → paid`. See [Bill status lifecycle](#bill-status-lifecycle) |
| 11 | AP Aging Report | ✅ Shipped | `/aging` — per-vendor table bucketed by days overdue |

**Score: 9 shipped / 2 skipped, with explicit reasoning on the skips.** The skipped items (#3 AP email forwarding, #8 expense-vs-item) are documented in [What I left out and why](#what-i-left-out-and-why). Allocation Templates (#2) — originally deferred — shipped in a follow-up PR alongside multi-dimension splits; the design rationale is in [Line-item splits & allocation templates](#line-item-splits--allocation-templates).

## What it does

Upload a PDF or image invoice → Claude vision extracts the vendor, dates, amounts, and line items into a structured draft → you review and edit anything the model got wrong → approve → schedule a payment → mark paid. Every state transition lands in an audit log; the bills list shows aging, totals, and lets you filter by status or search by vendor.

The "wow" moment is the upload-to-extracted-bill flow: drop a PDF, watch it become a fully-populated draft in ~6 seconds. The rest is sturdy CRUD wrapped in a clean UI — and that proportion is the whole point.

## Workflows I prioritized

In rough order of build effort:

1. **Bill ingestion via Claude vision OCR** — the differentiator. Drop a PDF or image, Claude Sonnet 4.6 extracts vendor, invoice number, dates, subtotal/tax/total, line items, and notes into a strict JSON schema (enforced with Anthropic tool-use). New vendors are deduped by case-insensitive name and auto-created. The Zod schema is intentionally lenient on optional fields so a partial extraction (missing tax line, no invoice number, etc.) still lands in `needs_review` with whatever Claude *did* recover — paired with a transient info toast naming the gaps and a persistent warn banner inside the editor that auto-clears as the user fills them in. Built-in sample chips on `/bills/new` let reviewers try a known-good invoice in one click before bringing their own.
2. **Manual bill creation** — when there's no invoice (recurring bills, email-only mentions, back-fill). One-click "Create a bill without an invoice" → empty draft, fill in the editor, same approval flow.
3. **CSV bulk import** (`/bills/import`) — drop a spreadsheet, get a preview table, hit Import. Per-row validation (skips bad rows with an error list). Vendor dedup runs against the existing org so no duplicates are created. Common header aliases accepted (`vendor` → `vendor_name`, `amount` → `total`, `invoice_no` → `invoice_number`); the page surfaces the canonical column set + aliases up front so users don't have to read code to find them.
4. **Review and edit** — inline editor on the bill detail page with vendor combobox, dates, totals, and a fully editable line-items table (add/remove rows, auto-compute amount from qty × unit). Saves write a `bill_events` audit row.
5. **Line item splits & allocation templates** — every line item can be allocated across multiple accounting dimensions (category + department + GL account + location), e.g. "AWS hosting: 60% R&D / Engineering, 40% Marketing." Inline editor with a "distribute evenly" helper, "fill remaining %" wand, and a live cents preview per split (≤150 splits/line). Allocations save as **reusable templates** appliable to any line in one click — managed from a bill ("Save for future use"), from **Settings → Allocation templates**, or via CSV bulk import (≤200 templates/org). The bill detail page aggregates splits into a "Category breakdown" table. Full rationale: [Line-item splits & allocation templates](#line-item-splits--allocation-templates).
6. **Approve → schedule → pay** — three explicit transitions, each with the right action button shown only when the bill is in the right state. Scheduling opens a small dialog (date, method, amount). Mark-paid finalizes.
7. **Recurring bills** — "Repeat" any bill into N future drafts (monthly / quarterly / yearly). Children link back to the template via `parent_bill_id`. The bills list shows a small repeat icon; the detail page shows a "Recurring (view source)" pill.
8. **Bills list with summary + filtering** — overdue, due-in-7-days, scheduled, and total outstanding stat cards (computed in SQL with FILTER aggregates). Search, status filter, and sortable columns. Per-row aging signal in the Due column ("4 days overdue", "in 6 days").
9. **AP aging report** (`/aging`) — per-vendor table bucketed by days overdue (Current, 1–30, 31–60, 61–90, 90+), with a totals row and headline summary cards. Single SQL query using `SUM(CASE WHEN ...)` per bucket.
10. **Per-bill activity timeline** — every state transition logged as a `bill_events` row, rendered as a vertical timeline on the detail page. Doubles as audit trail.
11. **Vendors view + drill-down** — `/vendors` lists every supplier with bill counts, outstanding, and lifetime paid (with monogram avatars, default-method pill, and inline search). Click a row → `/vendors/[id]` shows that vendor's contact info + outstanding/paid/total stats + a scoped table of every bill they've sent. Each bill row links into `/bills/[id]?from=vendor:<id>` so the bill detail's Back button returns to the vendor (not the list). The **+ New vendor** button opens a dialog to manually create one (name + email + default payment method) — augments the auto-create-on-extraction path.
12. **Responsive layouts under sm:** — every list page (bills, vendors, aging, vendor detail) renders a real card layout on phones rather than a horizontally-scrolled desktop table. Bill detail's hero, lifecycle stepper, and payment table reflow; the aging callout's actions become a 2-col button grid.

## Line-item splits & allocation templates

Splits and reusable allocation templates shipped as a follow-up PR (Ramp feature #2). This is the one area where the implementation deliberately diverges from the source doc, so the reasoning is worth recording.

**What shipped**

- **Multi-dimension splits** — each split carries a required `category` plus optional `department`, `glAccount`, and `location`. The dimension lists are hardcoded (same posture as the category list) pending a real chart of accounts.
- **Allocation templates** — named, reusable split configs. Create/apply from a bill, manage at `/settings/allocation-templates`, or bulk-load via CSV (one row per split line, rows grouped by `template_name`). Limits mirror Ramp: **150 splits/line, 200 templates/org**.
- **Role seam** — Ramp restricts template management to Admin/AP roles. There's no auth yet, so `canManageTemplates()` returns `true` for the demo org and gates the save/manage UI plus every template mutation. When auth lands, only that function's body changes.

**Why it's built this way**

- **Kept the basis-points allocation model, not Ramp's "replace one line with N lines."** Ramp's doc says applying a split *replaces* the original line with new individual lines. We instead keep one line item carrying a `splits` jsonb array of `percentageBps`, reusing the existing `allocateCents()` math (floor each split, drop the rounding remainder on the largest so cents always reconcile). It's functionally identical for "where the money went," but it honors the money-as-integer-cents rule, avoids a parent/child line-grouping model, and reuses already-tested code. A split is **accounting allocation metadata** — it never changes the bill total or the payment amount.
- **One shared validation schema.** `lineItemSplitSchema` (in `lib/categories.ts`) is the single source of truth for a split's shape and validity — category/dimension values must exist in the lists, bps in range. Both the bill-editor save path (`updateBill`) and the template actions import it, so they can't drift.
- **The jsonb shape change needed no migration; only the new table did.** Widening a split from one dimension to four is an app-enforced jsonb change, so the lone DB migration is the additive `allocation_templates` table.
- **Concurrency-safe caps.** The 200-template cap is enforced under a per-org `pg_advisory_xact_lock` inside the create/import transactions, so a naive count-then-insert can't race past the limit; the unique `(org_id, lower(name))` index backstops name dedup.
- **Extraction left untouched.** Splits are user-entered, never model-extracted, so the AI tool-use contract didn't change.

The honest trade-off: a reviewer comparing against Ramp's doc will see we represent a split as percentages on one line rather than as N expanded lines. We chose fidelity to the existing data model and money rules over literal fidelity to the doc's wording.

## What I left out and why

| Skipped | Why |
|---|---|
| **Auth / multi-tenant** | Single demo workspace. The `organizations` FK is in the schema, so adding auth becomes a session-derived scope filter — no schema migration. |
| **Real payment rails (ACH/check/card)** | "Mark paid" mutates state without moving money. Real rails (Modern Treasury, Stripe ACH, Increase) are an integration project, not a product project. |
| **AP email forwarding (`@ap.ramp.com` inbox)** | Same backend, different ingestion source — receive email via Postmark/SES → invoke the same upload pipeline. ~2 hours, not magic. |
| **Multi-approver workflows / approval policies** | Interesting product surface (rules, thresholds, escalations) but a deep UI rabbit hole that wouldn't fit. |
| **Accounting integrations (QBO, Xero, Netsuite)** | Each is a multi-day project. Categories live in the app today (hardcoded list); v2 syncs them from a chart of accounts. |
| **Real-time collaboration / comments** | Nice-to-have. The audit log gets you 80% of the visibility benefit. |

The interesting choices are mostly about **what got shipped in detail vs. what was acknowledged but skipped**. I'd rather hand off one loop that feels finished than five half-built features.

## Setup

### Prerequisites

- Node 18+ (tested on 22)
- A free [Neon](https://neon.tech) Postgres database (or any other Postgres; just paste the URL)
- An [Anthropic API key](https://console.anthropic.com)
- Optional: a [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) token for production-ready file storage. Without it, uploads are stored in `public/uploads/` (works locally, doesn't survive a serverless redeploy).

### One-shot

```bash
git clone https://github.com/Kevinrx/payables.git
cd payables
cp .env.example .env.local      # then fill in DATABASE_URL and ANTHROPIC_API_KEY
npm install
npm run db:generate             # generate Drizzle migration files
npm run db:migrate              # apply to your Postgres
npm run db:seed                 # 9 demo bills across all statuses
npm run samples                 # generate 3 sample invoices in ./samples/ for upload testing
npm run dev                     # http://localhost:3000
```

Open the app and either:
- click around the seeded bills (try filtering by status, scheduling a payment, marking one paid), or
- click **New bill** and upload one of the PDFs in `./samples/` to watch the extraction flow.

### Useful npm scripts

| Script | What it does |
|---|---|
| `db:generate` | Generate Drizzle migration SQL from `src/db/schema.ts` |
| `db:migrate` | Apply migrations to the database |
| `db:seed` | Wipe + reseed the demo data |
| `db:reset` | `migrate` then `seed` |
| `db:studio` | Open Drizzle Studio (DB browser) |
| `samples` | Generate sample invoice PDFs into `./samples/` |
| `test` | Run Vitest unit tests (pure helpers: money formatting, aging buckets, split allocation) |
| `test:extract` | One-shot extraction test against any local file: `npm run test:extract -- samples/01-acme-cloud.pdf` |
| `smoke` | HTTP smoke test against a running app. Default: `localhost:3000`. Pass a URL to hit prod: `npm run smoke -- https://your.vercel.app` |

---

## Tech stack and rationale

Each row is **chose / considered / why** so the trade-offs are explicit.

| Concern | Chose | Considered | Why |
|---|---|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) | Remix, Astro, plain Vite + Hono | One repo for FE + BE, server components remove API plumbing for read paths, server actions remove API plumbing for mutations, Vercel-native deploy. Net: less boilerplate per feature than any alternative. |
| **Language** | TypeScript (strict) | JavaScript | Free correctness; the model output is `unknown` until validated, and TS catches schema drifts the moment they happen. |
| **Database** | Postgres (Neon, serverless) | SQLite, MySQL, MongoDB | Postgres because: enums, jsonb, conditional aggregates, composite indexes, mature serverless story. Neon because: free tier, branching, plays well with Vercel cold starts. |
| **ORM** | Drizzle | Prisma, Kysely, raw SQL | Drizzle compiles to plain SQL with great types, no separate codegen step (Prisma's `prisma generate` is annoying in serverless), and lets me drop into raw SQL via `db.execute(sql\`...\`)` for the conditional aggregates on the dashboard. |
| **UI library** | Hand-rolled with Tailwind 4 | shadcn/ui, Radix, MUI | Wanted full control over a coherent visual language for a product evaluated on UI taste. shadcn would have been ~30 min faster initially but adds a vocabulary I'd have to override. The whole component set is ~10 small files. |
| **AI provider** | Anthropic Claude Sonnet 4.6 | OpenAI GPT-4o, GPT-4o-mini, Gemini | Strongest at structured output via tool-use (forces the model to call our function with our schema, no parsing fragility). Vision quality is excellent on PDFs. Sonnet is the right cost/quality knee for invoices. |
| **File storage** | Vercel Blob | S3, Supabase Storage, base64 in Postgres | Vercel-native, one env var to wire up, public store with timestamp + random suffix URLs. Falls back to local fs in dev so you can run end-to-end without provisioning Blob. |
| **Validation** | Zod | Yup, io-ts, ArkType | Standard, ergonomic, lets the same schema validate both API input and model output. |
| **Toasts** | sonner | react-hot-toast, react-toastify | Better defaults, less ceremony, top-center positioning out of the box. |
| **Icons** | lucide-react | Heroicons, Phosphor | 1500+ icons, consistent stroke weight, tree-shakeable. |
| **Migrations** | `drizzle-kit generate` + tsx migrator script | `drizzle-kit push` | Push needs a TTY (broken in non-interactive shells / CI), so explicit migration files committed to the repo it is. Bonus: I can read the SQL before applying. |
| **Forms** | React local state + server actions | react-hook-form, Formik, TanStack Form | The bill editor has maybe 15 fields. A form library would add 8KB and a layer of indirection for no win. |
| **Tests** | Vitest (pure helpers) + HTTP smoke script | Playwright e2e, DB integration tests | Vitest covers the deterministic logic (money math, aging buckets, multi-dimension split allocation + validation, CSV template grouping, percentage round-tripping — 78 tests). The smoke script validates that every route returns 200 + expected content against any deploy. **Not** covered: server-action integration tests against a real DB (the most valuable remaining tests; would need a throwaway Postgres + 2-3h of infra). |

## Patterns

The codebase is small enough to read end-to-end, but a few intentional patterns make it consistent:

**Server components by default, client components only when interactive.** Pages are server components (`/bills/page.tsx`, `/bills/[id]/page.tsx`, `/vendors/page.tsx`) — they fetch via Drizzle and pass data down. Client components carry the `"use client"` directive only when they need state (`bills-table.tsx` for filter/sort, `bill-editor.tsx` for the form, `bill-actions.tsx` for the action buttons). This keeps shipped JS small and lets RSC streaming work.

**Server actions for mutations, one route handler for the upload.** All mutations live in `src/app/bills/actions.ts` as `"use server"` functions. They're called directly from client components via `startTransition`. The single REST-ish endpoint is `POST /api/bills/upload` because it accepts multipart, which is awkward in RSC. After upload, control returns to RSC + actions for everything else.

**Append-only event log instead of a state machine.** Every state transition writes a row to `bill_events` (`created` / `extracted` / `edited` / `approved` / `scheduled` / `paid` / `voided`). The activity timeline reads them in order. There's no XState or library — just `await tx.insert(billEvents).values(...)` inside the same DB transaction as the mutation. Adding a new event type is a 1-line enum change.

**Money as integer cents, money math in the DB.** Cents are stored in `integer` columns. The Anthropic SDK returns dollars (it's better at human-readable units), and we round to cents at the boundary in `runExtraction`. Display uses `Intl.NumberFormat` with the bill's currency. Aggregate sums for the dashboard cards are computed in SQL with `SUM(...) FILTER (WHERE ...)` — one query, no app-side reduce.

**Strict tool-use for AI output.** The Anthropic SDK call uses `tool_choice: { type: "tool", name: "save_invoice" }`, which forces the model to call our function with our schema. No JSON parsing of free-form text. The result is then re-validated with Zod before any DB write — so even if the model's tool args drift, we catch it at the boundary and surface a clean error.

**Vendor dedup at extraction time.** When the model returns `vendor_name`, we look for an existing vendor in the same org with a case-insensitive name match (`lower(name) = lower($1)`); if none, we insert a new one. The `vendors` table has a unique index on `(org_id, lower(name))` to enforce it. This prevents the "Acme Inc." vs "Acme, Inc" duplication every real AP product fights.

**Status as a Postgres enum, transitions checked server-side.** `bill_status` is a Postgres enum (`draft | needs_review | approved | scheduled | paid | void`). Every server action checks the current status before mutating — `approveBill` rejects anything not in `draft` or `needs_review`, `schedulePayment` rejects anything not `approved`, etc. The UI hides the wrong buttons for the current state, but the server is the source of truth.

**Storage abstraction for env parity.** `storeFile()` in `src/lib/storage.ts` takes (buffer, filename, mime) and returns a URL. Production uses Vercel Blob; local dev uses `public/uploads/` so you don't need to provision Blob to demo. On Vercel without `BLOB_READ_WRITE_TOKEN`, it throws a clear error instead of silently failing on the read-only filesystem.

**`extracted_json` jsonb column as audit trail of the model.** The full Claude response is stored alongside the parsed fields. Useful for debugging extraction failures, building a "this is what the AI saw" UX in v2, or training/eval on real invoices later.

**Loading skeletons via `loading.tsx`.** Each route segment that fetches data has a sibling `loading.tsx` exporting a skeleton matching its layout. Next.js renders it during the server fetch, so transitions feel instant instead of blank.

**Optimistic UI is on the edit path, not the action path.** `BillEditor` updates local state immediately as you type. The Approve/Schedule/MarkPaid buttons disable + spin and wait for the server, because their visual change (status badge, available actions) requires a server round-trip anyway. Faking optimism on a status transition would just confuse users when it fails.

## Folder layout

```
src/
├── app/
│   ├── layout.tsx              ← root layout: header + Toaster
│   ├── page.tsx                ← redirect to /bills
│   ├── globals.css             ← Tailwind 4 + design tokens (colors as CSS vars)
│   ├── api/
│   │   └── bills/upload/route.ts ← multipart POST → Blob → insert draft bill
│   ├── bills/
│   │   ├── page.tsx            ← list (server component): summary cards + filter table
│   │   ├── loading.tsx         ← skeleton for /bills
│   │   ├── actions.ts          ← all server actions: runExtraction, updateBill,
│   │   │                         approveBill, schedulePayment, markBillPaid,
│   │   │                         createManualBill, repeatBill
│   │   ├── new/page.tsx        ← upload UI + manual create + CSV import entry points
│   │   ├── import/page.tsx     ← CSV bulk upload page
│   │   └── [id]/
│   │       ├── page.tsx        ← detail (server): editor + payments + timeline
│   │       └── loading.tsx     ← skeleton for /bills/[id]
│   ├── aging/
│   │   ├── page.tsx            ← AP aging report bucketed by days overdue
│   │   └── loading.tsx
│   ├── vendors/
│   │   ├── page.tsx            ← list with monogram avatars, search, method pills
│   │   ├── actions.ts          ← createVendor server action
│   │   ├── loading.tsx
│   │   └── [id]/page.tsx       ← drill-in: stats + scoped bills table
│   └── settings/
│       ├── page.tsx            ← settings hub
│       ├── loading.tsx
│       ├── actions.ts          ← allocation-template actions: create / delete / importFromCsv
│       └── allocation-templates/
│           ├── page.tsx        ← templates list (server) + loading.tsx
│           └── import/page.tsx ← CSV bulk-import page
├── components/                 ← all client components, lowercase-with-dashes, flat
│   │  (shared primitives)
│   ├── app-header.tsx          ← sticky nav: Bills · Aging · Vendors
│   ├── status-badge.tsx        ← color-coded status pill (draft/review/approved/…)
│   ├── vendor-avatar.tsx       ← monogram avatar (sm/md/lg), driven by getInitials()
│   ├── method-pill.tsx         ← uppercase mono pill for payment methods (ach/check/card)
│   │  (bills list)
│   ├── bills-table.tsx         ← filter/search/sort shell around BillRow
│   ├── bill-row.tsx            ← one bill row, desktop + mobile layouts, overdue stripe
│   ├── bills-empty-state.tsx   ← empty/filtered-empty state for /bills
│   ├── summary-cards.tsx       ← 4 dashboard cards w/ aging-mix sparkline on Outstanding
│   │  (bill detail)
│   ├── bill-hero.tsx           ← detail-page hero band: title, status, totals, meta
│   ├── bill-actions.tsx        ← Approve / Schedule / MarkPaid / Repeat buttons
│   ├── bill-editor.tsx         ← inline editable form for draft/needs_review bills
│   ├── bill-readonly.tsx       ← read-only details + line-items tables (paid/approved/etc.)
│   ├── bill-event-timeline.tsx ← vertical activity timeline
│   ├── lifecycle-stepper.tsx   ← Draft → Review → Approved → Scheduled → Paid stepper
│   ├── payments-table.tsx      ← scheduled/paid rows for a single bill
│   ├── category-breakdown.tsx  ← GL allocation aggregated across line-item splits
│   ├── file-preview.tsx        ← <embed>/<img> for PDF or image invoices
│   ├── extraction-pending.tsx  ← skeleton + Claude trigger on first load
│   │  (aging)
│   ├── aging-bucket.tsx        ← BucketCard + BucketCell + tone palette
│   │  (upload / import)
│   ├── file-uploader.tsx       ← drag-and-drop with mime/size validation
│   ├── csv-importer.tsx        ← drag-drop CSV, parse + preview + bulk import
│   ├── expected-columns-panel.tsx ← required/optional/aliases pills + Show template
│   ├── create-manual-bill-link.tsx ← surface card: creates empty draft, redirects to editor
│   │  (vendors)
│   ├── vendors-list.tsx        ← search + dialog launcher; desktop table + mobile cards
│   │  (dialogs)
│   ├── split-rows-editor.tsx   ← shared multi-dimension split row editor (presentational; reused by both dialogs)
│   ├── line-item-splits-dialog.tsx ← per-line allocation: apply-template picker + save-for-future (must sum to 100%)
│   ├── new-allocation-template-dialog.tsx ← modal: name + splits (reuses split-rows-editor)
│   ├── allocation-templates-list.tsx ← Settings list: search, delete, dialog launcher
│   ├── allocation-template-csv-importer.tsx ← drag-drop CSV, grouped preview, bulk import
│   ├── new-vendor-dialog.tsx   ← modal: name + email + default payment method
│   ├── repeat-bill-dialog.tsx  ← modal: frequency + count, generates child bills
│   └── schedule-payment-dialog.tsx ← modal: date, method, amount
├── db/
│   ├── schema.ts               ← Drizzle schema: 7 tables, enums, indexes
│   ├── index.ts                ← single Drizzle client (HMR-safe)
│   └── queries.ts              ← shared read queries: listBills, getBillById,
│                                  getBillSummary, listVendors, getVendorById,
│                                  listAllocationTemplates
└── lib/
    ├── categories.ts           ← category + dimension lists, split helpers (alloc, fmt), lineItemSplitSchema
    ├── categories.test.ts      ← Vitest unit tests for split allocation + validation
    ├── allocation-template-csv.ts ← pure CSV→templates grouper/validator (+ .test.ts)
    ├── permissions.ts          ← canManageTemplates() role seam (RBAC lands here with auth)
    ├── extract.ts              ← Anthropic SDK call + Zod validation
    ├── storage.ts              ← Vercel Blob OR local fs fallback
    ├── aging-csv.ts            ← AP aging → CSV data: URL builder
    ├── utils.ts                ← cn, formatMoney, formatDate, daysUntilDue, agingBucket,
    │                             getDueState, getInitials
    └── utils.test.ts           ← Vitest unit tests for money/date/aging helpers

scripts/
├── load-env.ts                 ← loads .env.local for standalone scripts
├── migrate.ts                  ← drizzle-orm migrator (avoids drizzle-kit's TTY)
├── seed.ts                     ← demo bills across all statuses + 3 allocation templates + sample line-item splits
├── generate-samples.ts         ← writes 3 PDF invoices into ./samples/
├── smoke.ts                    ← HTTP smoke test: hits each route, asserts 200 + content
├── test-extract.ts             ← npm run test:extract -- <file>
└── peek.ts                     ← inspect a bill row by id

drizzle/                        ← committed migration SQL + meta
samples/                        ← PDFs for the upload demo
```

## Data model

```
organizations             ← single demo org
├── vendors               ← unique (org_id, lower(name)) for dedup
├── allocation_templates  ← reusable split configs; unique (org_id, lower(name)), ≤200/org
└── bills                 ← status FSM: draft → needs_review → approved → scheduled → paid
    ├── bill_line_items   ← qty × unit_price = amount, all in cents; optional splits jsonb
    ├── payments          ← scheduled_for, paid_at, method, amount, status
    └── bill_events       ← append-only audit log: created/extracted/edited/approved/scheduled/paid
```

Seven tables. Money is integers. Dates are dates. Statuses are Postgres enums. Indexes on `(org_id, status)` and `due_date` for the queries that actually run on the bills page, plus unique `(org_id, lower(name))` on both vendors and allocation templates.

### Why each table

- **`organizations`** — pure FK target. There's a single seeded org. Every other table has `org_id` so adding multi-tenancy is a `WHERE org_id = ...` filter, not a schema migration.
- **`vendors`** — separate from bills so dedup works (one Acme, many bills). Unique index on `(org_id, lower(name))` enforces case-insensitive uniqueness.
- **`bills`** — the spine. Stores extracted fields (`invoice_number`, dates, money), denormalized status, `extracted_json` (the raw model response) so we never lose information during the parse, and an optional `parent_bill_id` self-FK pointing at the template a recurring bill was generated from (NULL for non-recurring or for the template itself).
- **`bill_line_items`** — `qty × unit_price = amount_cents`, all integers. Soft-deleted via re-insert on edit (the editor wipes + re-inserts inside one transaction, simpler than diffing). Each line carries an optional `splits` jsonb array (`[{category, department?, glAccount?, location?, percentageBps}]`) for multi-dimension allocation; the ≤150 count and sum-to-100% are enforced in the action layer via the shared `lineItemSplitSchema`.
- **`allocation_templates`** — named, reusable split configs (a `splits` jsonb mirroring a line item's). Org-scoped with a unique `(org_id, lower(name))` index; count capped at 200/org under an advisory lock. Decoupled from bills so a template outlives any single line item, and carries no event log (like `vendors`).
- **`payments`** — 1:N with bills today, but the schema supports split/partial payments (just create more rows). `paid_at` is nullable; non-null means it's actually paid.
- **`bill_events`** — append-only. One row per state transition with a `payload` jsonb for context (approver email, payment id, model confidence). Powers the timeline UI and the audit story without a separate event-sourcing library.

## Bill status lifecycle

```
                           ┌──── (extraction
                           │       failed)
                           ▼
upload ─► draft ─► needs_review ─► approved ─► scheduled ─► paid
                ▲                                              │
                └────── edit ─────────────────────────┐        │
                                                       │        │
                                                       └────────┘
                                                  (via "Mark paid")
```

Any upload+extract that yields *any* parseable fields puts the bill in `needs_review` — the lenient schema means a partial extraction (Claude missed the invoice number, the document had no tax line, etc.) still lands in the editor with whatever was recovered, surfaced by a persistent banner naming the gaps. Only a catastrophic failure (no tool-use block, totally unparseable output) leaves the bill in `draft` with the failure recorded in `bill_events` and a "Fill in manually" banner. Edits while in `draft` or `needs_review` keep the bill in `needs_review`. The forward path (`approve → schedule → pay`) only allows transitions from the immediately preceding state — every action checks status before mutating.

## End-to-end: how an upload becomes a bill

The upload-to-extracted-bill flow touches almost every layer. Worth walking through:

```
1. Browser
   └─► User drops PDF into FileUploader
   └─► Validates mime/size client-side
   └─► POST /api/bills/upload (multipart, 10MB cap)
       │
2. Route handler (src/app/api/bills/upload/route.ts)
   └─► getDemoOrgId()                  ← single seeded org
   └─► storeFile(buffer, name, mime)   ← Vercel Blob or local fs
   └─► INSERT bills (status='draft', source='upload', file_url, file_mime)
   └─► INSERT bill_events (event='created')
   └─► return { billId }
       │
3. Browser
   └─► router.push(`/bills/${billId}`)
       │
4. Page render (src/app/bills/[id]/page.tsx, server component)
   └─► getBillById(id, orgId)
   └─► Detects: status=draft + has file + no extracted_json
   └─► Renders <ExtractionPending /> instead of normal detail view
       │
5. ExtractionPending (client, src/components/extraction-pending.tsx)
   └─► useEffect: calls runExtraction(billId) server action
   └─► Shows skeleton + rotating hint text
       │
6. Server action runExtraction (src/app/bills/actions.ts)
   └─► Re-fetches bill (auth/state check)
   └─► Loads file bytes (fetch from Blob URL or readFile from fs)
   └─► extractInvoice(buffer, mime) ← src/lib/extract.ts
       └─► Anthropic SDK: claude-sonnet-4-6, vision input,
           tool_choice forces save_invoice tool call
       └─► Zod-validates the tool args
       └─► Returns ExtractedInvoice (typed)
   └─► Vendor dedup: lower(name) match in same org → reuse or create
   └─► One transaction:
       ├─► UPDATE bills (vendor_id, dates, amounts, extracted_json, status='needs_review')
       ├─► DELETE then INSERT bill_line_items
       └─► INSERT bill_events (event='extracted')
   └─► revalidatePath(`/bills/${billId}`)
       │
7. ExtractionPending
   └─► router.refresh() ← triggers RSC re-render with fresh data
       │
8. Page re-render
   └─► getBillById now returns extracted_json + line items
   └─► needsExtraction = false
   └─► Renders <BillBody /> with editor, payments, timeline
```

Total wall time on a 2-page PDF: ~6 seconds (upload ~500ms, extract ~5s, RSC refresh ~300ms).

## The model contract

We do not let the model return free text. The Anthropic SDK call defines a tool with a JSONSchema and forces the model to call it:

```ts
tool_choice: { type: "tool", name: "save_invoice" }
```

The full schema (in `src/lib/extract.ts`):

```ts
{
  vendor_name: string | null,    // The seller, NOT the buyer
  invoice_number: string | null,
  invoice_date: string | null,   // YYYY-MM-DD
  due_date: string | null,
  currency: string,              // ISO 4217, defaults to USD
  subtotal: number | null,       // dollars (model is better at major units)
  tax: number | null,
  total: number | null,
  line_items: Array<{
    description: string,
    quantity: number | null,
    unit_price: number | null,
    amount: number,              // required
  }>,
  notes: string | null,          // memo / PO number / disputed flag
}
```

The system prompt explicitly tells the model:
- The seller (vendor) is who issued the invoice — not the buyer
- Money is in major units (1234.56, not 123456)
- Dates are ISO 8601
- Skip header/summary rows in line items
- Use null for missing fields, do not invent
- If the document is clearly not an invoice, return nulls

After the model returns, we run the args through `ExtractedInvoiceSchema.safeParse()` (Zod). The schema is intentionally lenient: every non-required field is `nullish + catch(null)`, so when the model legitimately omits something (e.g. a tax line on a no-tax invoice) the user still lands in the editor with every field the model *did* return populated and only the genuinely-missing ones blank. Only catastrophic failures (no tool call, schema fully unparseable) flip the bill to draft with the error recorded in `bill_events` and a "Fill in manually" banner.

The partial-extraction UX is two layers: `runExtraction` returns a `missingFields[]` list (vendor / invoice number / invoice date / due date / total / line items — the things you'd expect on a normal invoice), which `ExtractionPending` turns into a one-shot info toast right after the scan animation. `BillEditor` then recomputes the same list against *live form state* and renders a warn-toned banner above the form that auto-clears as the user fills the gaps — so the cue stays visible long after the toast is gone, but disappears the moment the bill is review-ready.

## Production hardening I deliberately skipped

Operational/security gaps a real product would need to close (separate from product-feature scope):

- **Auth must come first.** `/bills/[id]` is currently open to anyone with the UUID. Session-based auth scoped to `org_id` is the prerequisite for everything else here.
- **Private file storage + signed URLs.** Invoices today live in a *public* Vercel Blob store. Real product: private store, short-lived signed URLs per request. **Cosmetic without auth**, so auth ships first.
- **Rate limiting on upload.** Each Anthropic vision call costs ~1¢. Without a per-IP/per-user limit, the API quota is a DoS vector.
- **Audit log immutability + file scanning + PII redaction in logs.** `bill_events` is append-only by convention but not constraint; uploads aren't scanned; raw model output (including vendor info) can land in logs. Each is a half-day fix in the right order.

## What I'd build next

In rough order of impact:

1. **Real approval rules** — thresholds (amounts ≥ $X require approver Y), routing by category, multi-step approvals.
2. **AP email forwarding** — Postmark inbound webhook → same upload pipeline. 2 hours.
3. **Allocation export to the ledger** — splits + reusable templates [ship today](#line-item-splits--allocation-templates); the next step is pushing those allocations into QBO/Xero/Netsuite so the GL coding flows through to the books instead of living in the app (pairs with #6).
4. **Recurring bills v2** — today the user clicks "Repeat" and we eagerly clone N copies. v2 should be a real schedule (cron worker creates the next instance N days before due) and a `/recurring` page to manage active series.
5. **Vendor pages v2** — the drill-in (`/vendors/[id]`) ships today with bills, totals, and contact display. Still missing: edit-in-place for email/default method, lifetime payment history (currently inferred from bill rows), and 1099 metadata (TIN, W-9 file).
6. **Chart of accounts + accounting sync** — replace the hardcoded category list with a per-org CoA, and push categorized bills to QBO/Xero/Netsuite.
7. **Real payment rails** — Modern Treasury for ACH, Increase for checks, Stripe for cards. Becomes async with payment status callbacks.
8. **Server-action integration tests** — the Vitest suite today covers pure helpers and an HTTP smoke script covers route liveness, but the mutation paths (approve, schedule, mark paid, extract, repeat, import) deserve real DB tests against a throwaway Postgres.

