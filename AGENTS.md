<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project conventions for agents

The full product narrative lives in [`README.md`](./README.md). This file is the agent-facing cheat sheet — the rules that, if ignored, will produce broken or inconsistent code.

## Read these first
- `README.md` § *Patterns* — server components, server actions, event log, FSM, model contract.
- `README.md` § *Data model* — six tables, money as integer cents.
- `src/lib/utils.ts` — shared helpers; see the catalog below before writing inline versions.
- `src/lib/extract.ts` — model contract; the Zod schema, the tool JSONSchema, and the system prompt update in lockstep.

## Git workflow (mandatory)

**Never commit directly to `main`.** Every change — code, docs, migrations, one-liners — ships through a topic branch and a PR. Squash-merge into `main`.

```bash
git switch main && git pull --ff-only            # always branch from up-to-date main
git switch -c <kebab-case-branch>                # e.g. fix-aging-rounding, docs-update-agents
# ...make changes...
npm run lint && npm test && npm run build        # verify trio (mirrors CI)
git add <files> && git commit                    # follow the one-line subject style in `git log`
git push -u origin <branch>
gh pr create --base main --fill                  # then wait for CI green before merge
```

- Branch names are kebab-case and scoped (`fix-*`, `docs-*`, `feat-*`, `chore-*`).
- PRs target `main`. Do not force-push to `main`. Do not skip hooks or signing.
- CI (`.github/workflows/ci.yml`) runs `lint + test + build` with placeholder env vars on Node 22. Match it locally before pushing.

## Iron rules

1. **Money is integer cents.** Storage, app code, and SQL aggregates all use `integer` cents. Dollar strings (from inputs, the AI model, or CSV) are converted at the boundary via `dollarsToCents`. Display uses `formatMoney(cents, currency)`.
2. **Dates are ISO 8601 strings (`YYYY-MM-DD`)** at the DB and model contract. Use `formatDate()` for display, `daysUntilDue()` / `getDueState()` for "is this bill overdue?" logic — never reinvent these.
3. **Bill status is a Postgres enum and a server-enforced FSM** (`draft → needs_review → approved → scheduled → paid`, plus `void`). Every server action checks current status before mutating. The UI hides wrong actions but the server is the source of truth. See `src/app/bills/actions.ts`.
4. **Mutations are server actions**, not API routes. The lone REST endpoint is `POST /api/bills/upload` because multipart is awkward in RSC. Add new mutations as `"use server"` functions in `src/app/<segment>/actions.ts`.
5. **Server components by default.** Add `"use client"` only when a file actually needs state, refs, or event handlers. Pages should fetch via Drizzle and pass data down.
6. **Every state transition writes a `bill_events` row** in the same transaction as the mutation. The append-only log powers the activity timeline and the audit story.
7. **AI output is validated twice.** The Anthropic call uses `tool_choice: { type: "tool", name: "save_invoice" }` to force schema-conformant JSON; the result is re-validated with Zod (`ExtractedInvoiceSchema.safeParse`) before any DB write. Don't skip the Zod step.
8. **Vendor dedup is case-insensitive** (`lower(name) = lower($1)` with a unique index on `(org_id, lower(name))`). Anywhere a new vendor is created, route through the same dedup path.
9. **All queries filter by `org_id`.** Use `getDemoOrgId()` from `src/db/queries.ts` at the entry point and thread `orgId` into every read/write. Single-tenant today, multi-tenant schema — don't write queries that would leak across orgs once auth lands.
10. **Splits are basis points, not percent.** `LineItemSplit.percentageBps` uses `10000 = 100%`. Valid splits sum to exactly `10000`. Use `allocateCents(totalCents, splits)` from `src/lib/categories.ts` to convert to cents — it dumps rounding drift onto the largest split so the total reconciles exactly. Never round each split independently.
11. **Extraction schema changes are lockstep.** If you add/remove/rename a field on the AI extraction, update all three in the same commit: `ExtractedInvoiceSchema` (Zod), `TOOL_INPUT_SCHEMA` (the JSONSchema we hand to Anthropic, including the `required` array), and the `SYSTEM_PROMPT`. They drift silently otherwise.

## Server actions

All mutations live in `src/app/<segment>/actions.ts` as `"use server"` functions. Each checks the current FSM state, performs the mutation plus the corresponding `bill_events` row inside one transaction, then calls `revalidatePath()` on affected routes.

| Action | File | FSM precondition → result | Event written |
|---|---|---|---|
| `runExtraction(billId)` | `bills/actions.ts` | `draft` w/ file, no `extracted_json` → `needs_review` (or stays `draft` on catastrophic failure) | `extracted` |
| `updateBill(billId, …)` | `bills/actions.ts` | `draft` or `needs_review` → `needs_review` | `edited` |
| `approveBill(billId)` | `bills/actions.ts` | `draft` or `needs_review` → `approved` | `approved` |
| `schedulePayment(billId, …)` | `bills/actions.ts` | `approved` → `scheduled` (inserts `payments` row) | `scheduled` |
| `markBillPaid(billId)` | `bills/actions.ts` | `scheduled` → `paid` (flips all scheduled payments to `paid`) | `paid` |
| `createManualBill()` | `bills/actions.ts` | entry → `draft` with `source='manual'` | `created` |
| `importBillsFromCsv(rows)` | `bills/actions.ts` | entry → `needs_review`, event payload tag `csv_import` | `created` per row |
| `repeatBill(billId, freq, count)` | `bills/actions.ts` | any (template stays put) → N child `draft` bills linked via `parent_bill_id`, event payload tag `recurring` | `created` per child |
| `createVendor(…)` | `vendors/actions.ts` | entry → vendor row, dedup by `lower(name)` | n/a (vendor table has no event log) |

### Payment actions (`payments/actions.ts`)

Payment-centric mutations for the Payments screen. Keyed off `paymentId` (org scoped through the parent bill — `payments` has no `org_id`). Each has a single-payment form and a bulk form taking `paymentIds: string[]` (capped at 200); both share the private `apply*` transition helpers, so single and bulk can't diverge. Bulk forms apply to FSM-eligible rows and **skip** the rest, returning `{ succeeded, skipped }`.

| Action (single / bulk) | Payment precondition → result | Bill effect | Event written |
|---|---|---|---|
| `releasePayment` / `releasePayments` | `scheduled` → `processing` | stays `scheduled` | `released` |
| `cancelPayment` / `cancelPayments` | `scheduled`\|`processing`\|`failed` → `canceled` | `scheduled` → `approved` | `canceled` `{action:'cancel'}` |
| `unschedulePayment` / `unschedulePayments` | `scheduled` → `canceled` | `scheduled` → `approved` | `canceled` `{action:'unschedule'}` |
| `editPaymentDate` / `editPaymentDates` | `scheduled` (date change) | stays `scheduled` | `scheduled` `{action:'rescheduled'}` |
| `retryPayment` / `retryPayments` | `failed` → `scheduled` (re-queued today) | stays `scheduled` | `scheduled` `{action:'retried'}` |
| `markPaymentPaid` / `markPaymentsPaid` | `scheduled`\|`processing` → `paid` | `scheduled` → `paid` | `paid` |

**Payment FSM:** `payment_status` is `scheduled → processing → paid`, with `failed` (retry/cancel) and `canceled` as off-ramps. `scheduled → approved` is the one **reverse** bill transition in the app (cancel/unschedule return a bill to the active queue). Tab bucketing (Overview / Needs review / Pending / History) is derived by `paymentBucket()` in `src/lib/payments.ts`; `eligibleActions()` there is the single source of truth for which actions a status allows.

## Client ↔ server interaction pattern

- **No form library.** Local state + server action + `useTransition()`. Pattern:
  ```ts
  const [isPending, startTransition] = useTransition();
  // ...
  startTransition(async () => {
    const res = await someAction(...);
    // handle result, toast, etc.
    router.refresh();
  });
  ```
  The submit button reads `isPending` for its disabled/spinning state. We do **not** use `useFormStatus()` or `<form action={...}>`.
- **After a mutation succeeds, call `router.refresh()`.** The server action's `revalidatePath()` invalidates the RSC cache; `router.refresh()` triggers the re-render. Both are needed.
- **No optimistic UI on status transitions.** Approve / Schedule / Mark Paid wait for the server because their visual change requires a round-trip anyway. Optimistic updates are fine on free-form text inputs in the editor.
- **`?from=…` back-button.** Bill rows linked from a vendor detail page carry `?from=vendor:<id>` and rows from the Payments screen carry `?from=payments`; the bill detail page (`resolveBackTarget`) parses these and points Back to the vendor / `/payments` instead of `/bills`. Preserve this when adding new entry points to the bill detail.

## Routes

All under `src/app/`. Pages are server components by default; interactive sub-trees come from `src/components/`.

| Route | Loading? | Notes |
|---|---|---|
| `/` | — | Redirect to `/bills` |
| `/bills` | `loading.tsx` | List + filters + summary cards |
| `/bills/new` | — | Upload, sample chips, manual create, CSV entry |
| `/bills/import` | — | CSV bulk upload |
| `/bills/[id]` | `loading.tsx` | Detail + editor; renders `<ExtractionPending />` (client) when bill is `draft` with file and no `extracted_json` — that component kicks off `runExtraction` from a `useEffect`, then `router.refresh()`s |
| `/payments` | `loading.tsx` | Payment-centric list (Ramp-style). Tabs Overview/Needs review/Pending/History (`paymentBucket`), search, sort, per-row + bulk actions, CSV export. Rows link to `/bills/[id]?from=payments` |
| `/aging` | `loading.tsx` | AP aging report; one SQL query with `SUM(CASE WHEN …)` per bucket |
| `/vendors` | `loading.tsx` | Vendor list + `+ New vendor` dialog |
| `/vendors/[id]` | — | Vendor stats + scoped bills (links carry `?from=vendor:<id>`) |
| `POST /api/bills/upload` | — | Only REST endpoint (multipart, 10 MB cap) |

Every list-page route segment that fetches data has a sibling `loading.tsx` exporting a skeleton matching its layout. New routes should follow suit.

## Database

Schema in `src/db/schema.ts`. Migrations committed under `drizzle/`. Six tables (see [README § Data model](./README.md#data-model)). Things to know beyond the README:

- **Enums:**
  - `bill_status` — `draft | needs_review | approved | scheduled | paid | void`
  - `bill_source` — `upload | manual` (only). Workflow tags like `csv_import` / `recurring` live in `bill_events.payload.source` (jsonb), not the column enum.
  - `bill_event` — `created | extracted | edited | approved | scheduled | paid | voided`
  - `payment_method` — `ach | check | card`
  - `payment_status` — `scheduled | paid | failed | canceled`
- **Key indexes:** `(org_id, status)` and `due_date` on `bills`; `parent_bill_id` for recurring; unique `(org_id, lower(name))` on `vendors`.
- **FK cascade rules:** `bill_line_items`, `payments`, and `bill_events` cascade-delete with their bill. `bills.vendor_id` is `ON DELETE SET NULL` (a bill survives vendor deletion). `bills.parent_bill_id` is a plain uuid column with no FK constraint — recurring templates can be deleted without cascading children.
- **`extracted_json` jsonb** preserves the raw model response. Don't blank it on edits — it's debugging fuel and a future "what the AI saw" surface.
- **Line-item edits are delete-then-reinsert**, not a diff. The whole `bill_line_items` set for that bill is replaced inside one transaction. Simpler than diffing, and `sort_order` is rewritten on each save.

### Shared queries (`src/db/queries.ts`)

All take `orgId` and filter by it. Reuse before writing new SQL:

- `getDemoOrgId()` — entry-point org resolution (throws if none). Call once per request/action.
- `listBills(orgId)` — bill list rows with vendor join.
- `getBillSummary(orgId)` — `{ overdue, dueSoon, scheduled, outstanding }` via `SUM(...) FILTER (WHERE ...)` / `COUNT(*) FILTER (WHERE ...)`. Reuse this for any cross-status aggregate — don't write JS reduces over the bill list.
- `getBillById(billId, orgId)` — full detail including line items, payments, events.
- `listVendors(orgId)` / `getVendorById(vendorId, orgId)` — vendor list + drill-in with stats.

## File layout & naming

- Components are flat, lowercase-with-dashes under `src/components/` (e.g. `bills-table.tsx`, `bill-hero.tsx`). No nested folders.
- Server components stay in `src/app/**`. Client components live in `src/components/**`.
- Shared queries: `src/db/queries.ts`. Shared helpers: `src/lib/utils.ts`. Categories + split allocation: `src/lib/categories.ts`. Aging-report CSV export: `src/lib/aging-csv.ts`. File storage: `src/lib/storage.ts`. AI extraction: `src/lib/extract.ts`.
- Path alias `@/*` → `./src/*` (from `tsconfig.json`). Import via `@/components/...`, `@/lib/...`, `@/db/...`. Don't use relative paths to escape `src/`.
- Pure helpers get a sibling `*.test.ts` (Vitest, node environment).

## Shared primitives (don't reinvent)

| Need | Use |
|---|---|
| Vendor monogram avatar | `<VendorAvatar name={...} size="sm|md|lg" />` from `@/components/vendor-avatar` |
| Payment-method pill | `<MethodPill method={...} size="sm|md" />` from `@/components/method-pill` |
| Bill status pill | `<StatusBadge status={...} />` from `@/components/status-badge` |
| Class-name merge | `cn(...)` from `@/lib/utils` (clsx + tailwind-merge) |
| Dollar → cents at boundary | `dollarsToCents(n)` from `@/lib/utils` |
| Money display | `formatMoney(cents, currency)` from `@/lib/utils` |
| Date display | `formatDate(iso)` from `@/lib/utils` |
| Days until due (signed) | `daysUntilDue(iso)` from `@/lib/utils` |
| "Is this bill overdue / due soon, label, color" | `getDueState(dueDate, status)` from `@/lib/utils` |
| Aging bucket from due date | `agingBucket(dueDate)` + `AGING_BUCKET_LABELS` from `@/lib/utils` |
| Vendor name → initials | `getInitials(name)` from `@/lib/utils` |
| Split allocation (cents math) | `allocateCents(totalCents, splits)` from `@/lib/categories` |
| Splits valid? (sum to 10000 bps) | `isSplitsValid(splits)` from `@/lib/categories` |
| Splits → human summary | `formatSplitSummary(splits)` from `@/lib/categories` |
| Org id at entry point | `getDemoOrgId()` from `@/db/queries` |
| Store an uploaded file | `storeFile(buffer, filename, mime)` from `@/lib/storage` |

## UI conventions

- **Design tokens live in `src/app/globals.css`** as CSS custom properties (`--paper`, `--ink`, `--brand`, `--danger`, `--warn`, `--approve`, `--success`, `--info`, plus `-soft` / `-strong` / `-fg` variants in `oklch()`). Use them via `style={{ background: "var(--surface)" }}` or via Tailwind classes that the `@theme inline` block maps onto them. **Never hardcode a hex.**
- **Reuse the component classes** defined under `@layer components` in `globals.css`: `.btn` (+ `-brand` / `-primary` / `-secondary` / `-ghost` / `-success` / `-sm` / `-lg`), `.input`, `.select`, `.textarea`, `.surface`, `.pill` (status badges), `.tabs` / `.tab[data-active="true"]`, `.shimmer`, `.fade-up`, `.scan-line` (extraction animation), `.dot-grid`, `.micro` (mono uppercase micro-label), `.tabular` (tabular-nums).
- **Tailwind 4 is PostCSS-only.** There is no `tailwind.config.ts` — config lives in `globals.css` via `@import "tailwindcss"` + `@theme inline { ... }`. Don't add a Tailwind config file.
- **Dialogs are hand-rolled, no library.** Pattern (see `src/components/new-vendor-dialog.tsx`): take `open` + `onOpenChange` props, return `null` when closed (so internal state resets), fixed backdrop + `grid place-items-center` modal box, `role="dialog"` + `aria-modal="true"`, `.fade-up` animation, footer with secondary (Cancel) + primary buttons. Wire submit with `useTransition()` + `router.refresh()`.
- **Mobile is dual-render, not `hidden`-toggled content.** List pages render two separate JSX trees — a desktop table/grid (`hidden sm:grid` / `hidden sm:block`) and a mobile card list (`sm:hidden`). The mobile layout typically shows different content density than the desktop one. See `bills-table.tsx`, `bill-row.tsx`, `vendors-list.tsx` for the canonical shape.

## File storage

`src/lib/storage.ts` exports `storeFile(buffer, filename, mime) → { url }`. Production uses Vercel Blob (`BLOB_READ_WRITE_TOKEN` env var). Local dev writes to `public/uploads/`. On Vercel without the token, `storeFile` throws a clear error rather than silently failing on the read-only filesystem. Don't bypass it to write uploads anywhere else.

## Tests

- Vitest, node environment. `vitest.config.ts` includes `src/**/*.test.ts`.
- Sibling tests: `utils.test.ts` next to `utils.ts`, `categories.test.ts` next to `categories.ts`.
- Today's coverage: money math, aging buckets, date helpers, split allocation, percentage round-tripping.
- **No DB integration tests yet** — adding one for the server actions is the most valuable remaining test work.
- `npm run smoke -- <url>` hits each route and asserts 200 + expected content; useful after deploys, not required for local edits.
- `npm run test:extract -- <file>` runs a one-shot extraction against Claude on a specific PDF/image; needs `ANTHROPIC_API_KEY`. Use it to validate the API key or debug a specific invoice.

## Verifying changes

Run the trio before opening a PR (mirrors CI):
```
npm run lint
npm test
npm run build
```

After schema changes: `npm run db:generate`, commit the new `drizzle/<timestamp>_*.sql`, then `npm run db:reset` locally to refresh seed data.

## Environment variables

| Var | Required for | Notes |
|---|---|---|
| `DATABASE_URL` | dev, build, CI | Any Postgres; tested with Neon. CI uses a placeholder string. |
| `ANTHROPIC_API_KEY` | dev runtime, `test:extract`, prod | Build accepts a placeholder for type-checking. |
| `BLOB_READ_WRITE_TOKEN` | prod uploads on Vercel | Without it, `storeFile` throws on Vercel; local dev writes to `public/uploads/`. |
| `DISCORD_WEBHOOK_URL` | optional | Discord webhook for new bill/vendor activity alerts (`src/lib/discord.ts`); unset = notifications silently skipped. |

CI runs lint + test + build on Node 22 with placeholders for the API-dependent vars — no real Anthropic calls during CI.

## Useful npm scripts

| Script | Purpose |
|---|---|
| `dev` | `next dev` (Turbopack) |
| `build` | `next build` — type-checks all routes |
| `lint` | ESLint (`eslint-config-next` core-web-vitals + typescript) |
| `db:generate` | Drizzle migration SQL from `src/db/schema.ts` into `drizzle/` |
| `db:migrate` | Apply migrations via `scripts/migrate.ts` (avoids drizzle-kit's TTY requirement) |
| `db:seed` | Wipe + reseed demo data |
| `db:reset` | `db:migrate && db:seed` |
| `db:studio` | Open Drizzle Studio |
| `samples` | Generate sample invoice PDFs into `./samples/` and `./public/samples/` |
| `test` / `test:watch` | Vitest |
| `test:extract` | One-shot extraction test against any local file |
| `smoke` | HTTP smoke test against a running app (`npm run smoke -- <url>`) |

## Don't do this

- Don't commit directly to `main`. Branch + PR, every time. CI must be green before merge.
- Don't add a UI library (shadcn/ui, MUI, Radix). The hand-rolled component set is intentional. Extend it instead.
- Don't add a form library. Local state + server actions + `useTransition()` is the pattern.
- Don't use `useFormStatus()` or `<form action={...}>`; we use `useTransition()` explicitly.
- Don't add a `tailwind.config.ts`. Tailwind 4 is configured in `globals.css`.
- Don't store money as floats anywhere, ever.
- Don't bypass the FSM by writing directly to `bills.status` — always go through the corresponding server action so the audit event lands.
- Don't write queries that skip `org_id`. Single-tenant today, multi-tenant schema — auth will land on top of these queries.
- Don't round each split independently — use `allocateCents()` so the total reconciles.
- Don't drift the extraction schema — Zod + tool JSONSchema + system prompt update together or not at all.
- Don't add `console.log` for permanent diagnostics; if you need a real signal, write to `bill_events` with a `payload`.
- Don't blank `extracted_json` on edits; preserve the raw model response.
