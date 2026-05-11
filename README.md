# Trashlab Payables

A small, opinionated payables product inspired by [Ramp Bill Pay](https://support.ramp.com/hc/en-us/articles/27579228841875-Managing-bills-and-payments-on-Bill-Pay). Built in one sitting as a takehome.

> **The bet:** the spine of any AP product is one loop — *invoice arrives → becomes a bill → gets reviewed and approved → gets paid → shows up in aging*. Everything else (CSV upload, AP email forwarding, recurring bills, line-item splits, multi-approver workflows, GL coding) is a variation on that loop. So I built the spine end-to-end with one real magical feature — AI extraction — and called the rest scope.

---

## What it does

Upload a PDF or image invoice → Claude vision extracts the vendor, dates, amounts, and line items into a structured draft → you review and edit anything the model got wrong → approve → schedule a payment → mark paid. Every state transition lands in an audit log; the bills list shows aging, totals, and lets you filter by status or search by vendor.

The "wow" moment is the upload-to-extracted-bill flow: drop a PDF, watch it become a fully-populated draft in ~6 seconds. The rest is sturdy CRUD wrapped in a clean UI — and that proportion is the whole point.

## Workflows I prioritized

In rough order of build effort:

1. **Bill ingestion via Claude vision OCR** — the differentiator. Drop a PDF or image, Claude Sonnet 4.6 extracts vendor, invoice number, dates, subtotal/tax/total, line items, and notes into a strict JSON schema (enforced with Anthropic tool-use). New vendors are deduped by case-insensitive name and auto-created.
2. **Review and edit** — inline editor on the bill detail page with vendor combobox, dates, totals, and a fully editable line-items table (add/remove rows, auto-compute amount from qty × unit). Saves write a `bill_events` audit row.
3. **Approve → schedule → pay** — three explicit transitions, each with the right action button shown only when the bill is in the right state. Scheduling opens a small dialog (date, method, amount). Mark-paid finalizes.
4. **Bills list with summary + filtering** — overdue, due-in-7-days, scheduled, and total outstanding stat cards (computed in SQL with FILTER aggregates). Search, status filter, and sortable columns. Per-row aging signal in the Due column ("4 days overdue", "in 6 days").
5. **Per-bill activity timeline** — every state transition logged as a `bill_events` row, rendered as a vertical timeline on the detail page. Doubles as audit trail.
6. **Vendors view** — companion list with bill counts, outstanding totals, and lifetime paid per vendor.

## What I left out and why

| Skipped | Why |
|---|---|
| **Auth / multi-tenant** | Single demo workspace. The `organizations` FK is in the schema, so adding auth becomes a session-derived scope filter — no schema migration. |
| **Real payment rails (ACH/check/card)** | "Mark paid" mutates state without moving money. Real rails (Modern Treasury, Stripe ACH, Increase) are an integration project, not a product project. |
| **AP email forwarding (`@ap.ramp.com` inbox)** | Same backend, different ingestion source — receive email via Postmark/SES → invoke the same upload pipeline. ~2 hours, not magic. |
| **CSV bulk upload** | Same backend, different parser. Trivial to add against the existing schema. |
| **Recurring bills** | Pure CRUD on a `recurring_templates` table + a cron worker. Boring. |
| **Multi-approver workflows / approval policies** | Interesting product surface (rules, thresholds, escalations) but a deep UI rabbit hole that wouldn't fit. |
| **GL coding / class/department splits** | Needs a chart-of-accounts model and a split editor — at least 3 hours on its own. |
| **Accounting integrations (QBO, Xero, Netsuite)** | Each is a multi-day project. Out of scope for a takehome. |
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
git clone <repo>
cd trashlab-takehome
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
| `test:extract` | One-shot extraction test against any local file: `npm run test:extract -- samples/01-acme-cloud.pdf` |

## Architecture decisions

- **Single Next.js 16 app, App Router, server components by default.** No API/frontend split. Server actions for mutations, one real route handler (`POST /api/bills/upload`) only because it needs multipart and is awkward inside RSC.
- **Drizzle ORM** over Prisma — leaner generated types, no separate `prisma generate` step, plays well with serverless Postgres.
- **Money as integer cents.** Never floats. The model returns dollars (it's better at human-readable units) and we round to cents at the boundary.
- **`bill_events` audit table** instead of a state machine. Every transition writes one row; the UI reads them in order to render the timeline. Simpler, debuggable, queryable, no library.
- **AI extraction is the only "magic."** Everything else is intentionally boring CRUD. This proportion is the design.
- **`extracted_json` jsonb column** keeps the raw model response for debugging, audit, and the "this is what the AI saw" UX you'd want in v2.
- **Strict tool-use schema for extraction** (Anthropic SDK `tool_choice: { type: "tool", name: "save_invoice" }`). The model can't return free text; it must call our tool with our schema. Output is then re-validated with Zod before any DB write.
- **Vendor dedup on extraction** — case-insensitive name match against existing vendors in the same org; create-on-miss. Prevents the "Acme Inc." vs "Acme, Inc" duplication that real AP products fight.
- **Storage is pluggable.** Vercel Blob in production, local filesystem in dev when no Blob token is set. Same `storeFile()` signature; the caller doesn't know.
- **No auth in the MVP.** Single demo org. The `organizations` FK is everywhere so adding auth becomes a session-derived `WHERE org_id = ...` filter — no migration.
- **`db:push` would be simpler than `db:generate` + `db:migrate`** for greenfield, but Drizzle's push command requires a TTY (broken in CI/non-interactive shells), so I went with explicit migrations.

## Data model

```
organizations             ← single demo org
└── vendors               ← unique (org_id, lower(name)) for dedup
└── bills                 ← status FSM: draft → needs_review → approved → scheduled → paid
    ├── bill_line_items   ← qty × unit_price = amount, all in cents
    ├── payments          ← scheduled_for, paid_at, method, amount, status
    └── bill_events       ← append-only audit log: created/extracted/edited/approved/scheduled/paid
```

Six tables. Six. Money is integers. Dates are dates. Statuses are Postgres enums. Indexes on `(org_id, status)` and `due_date` for the queries that actually run on the bills page.

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

A successful upload+extract puts the bill in `needs_review`. If extraction fails, the bill stays as `draft` with empty fields and the UI prompts manual entry. Edits while in `draft` or `needs_review` keep the bill in `needs_review`. The forward path (`approve → schedule → pay`) only allows transitions from the immediately preceding state — every action checks status before mutating.

## Production hardening I deliberately skipped

This is a demo. Before this product touches a real customer, the following needs to happen — and not piecemeal, since several depend on each other:

- **Auth.** Right now `/bills/[id]` is publicly accessible to anyone with the bill ID. Bill IDs are UUIDs (unguessable), but that's not a security model. Need session-based auth scoped to `org_id`, with the `WHERE org_id = ...` filter applied on every query.
- **Private file storage + signed URLs.** Today, uploaded invoices live in a *public* Vercel Blob store — the URLs include unguessable random suffixes, but the files are world-readable to anyone who sees the URL (which can leak via referer, logs, or a shared bill link). The right setup is a *private* Blob store, with the server generating short-lived signed URLs in `getBillById` and refreshing them per request. **Doing this without auth first would be cosmetic** — anyone who could fetch the bill page would still get a fresh signed URL. Auth must come first.
- **CSRF protection on server actions.** Next.js server actions have built-in protections, but a real product should also enforce origin checks for the upload endpoint.
- **Rate limiting on the upload endpoint.** A single Anthropic vision call costs ~1¢; without limits, an attacker could run up an API bill quickly.
- **PII redaction in logs.** The `extracted_json` column stores raw model output including vendor info; logs should never include it.
- **File scanning.** Real AP products run uploads through ClamAV-equivalent before storing. Skipped here.
- **Audit log immutability.** `bill_events` is append-only by convention but not by constraint. A real audit log would be in a separate, write-only table with a hash chain.
- **Backup + retention policy.** Neon has PITR but the storage layer doesn't. Files should have a retention/legal hold story.

None of this is hard individually, but doing them in the wrong order produces false security. The first step is always auth.

## What I'd build next

In rough order of impact:

1. **Real approval rules** — thresholds (amounts ≥ $X require approver Y), routing by category, multi-step approvals.
2. **Recurring bills** — schema is the same as bills but with a recurrence template; cron worker creates instances.
3. **AP email forwarding** — Postmark inbound webhook → same upload pipeline. 2 hours.
4. **CSV bulk upload** — small parser feeding the same insert path.
5. **Vendor pages** — drill-in showing all bills, payment history, contact info, default payment method, 1099 data.
6. **GL coding & line-item splits** — chart of accounts, per-line allocation editor, sync to QBO/Xero.
7. **Real payment rails** — Modern Treasury for ACH, Increase for checks, Stripe for cards. Becomes async with payment status callbacks.
8. **Tests** — server actions deserve real DB integration tests. Skipped here for time.

## Honest things I'd change with another day

- The line-items editor doesn't enforce that line totals == bill total. Today it shows a small warning if they differ. I'd add a one-click "set total from line items" or a "subtotal/tax/total" auto-recalculation.
- Payments are 1:1 with bills today (one bill, one or more payments). A real product allows split payments and partial payments. Easy schema change, more UI.
- I serve uploaded files inline via `<object>` for PDFs. On some browsers this triggers a download instead. A real product would render PDFs to images server-side or use PDF.js.
- No keyboard shortcuts (j/k navigation between bills, `e` to edit, `a` to approve). Quick add.
- The "Demo workspace" pill could click through to a (mocked) workspace switcher. It's a single useful affordance away from feeling multi-tenant-ready.

## Stack

- **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript**
- **Tailwind 4** + a small CSS-vars design system (no UI kit; everything is hand-rolled but boringly consistent)
- **Drizzle ORM** + **postgres-js** against **Neon Postgres**
- **Anthropic Claude Sonnet 4.6** for vision-based invoice extraction
- **Vercel Blob** (or local fs fallback) for invoice file storage
- **Zod** for runtime validation at every boundary
- **sonner** for toasts, **lucide-react** for icons

No tests, no Storybook, no monorepo, no `shadcn/ui`. Just the shape of the thing.
