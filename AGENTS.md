<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project conventions for agents

The full product narrative lives in [`README.md`](./README.md). This file is the agent-facing cheat sheet — the rules that, if ignored, will produce broken or inconsistent code.

## Read these first
- `README.md` § *Patterns* — server components, server actions, event log, FSM, model contract.
- `README.md` § *Data model* — six tables, money as integer cents.
- `src/lib/utils.ts` — shared helpers (`formatMoney`, `formatDate`, `daysUntilDue`, `agingBucket`, `getDueState`, `getInitials`). Use these before writing inline versions.

## Iron rules

1. **Money is integer cents.** Storage, app code, and SQL aggregates all use `integer` cents. Dollar strings (from inputs, the AI model, or CSV) are converted at the boundary via `dollarsToCents`. Display uses `formatMoney(cents, currency)`.
2. **Dates are ISO 8601 strings (`YYYY-MM-DD`)** at the DB and model contract. Use `formatDate()` for display, `daysUntilDue()` / `getDueState()` for "is this bill overdue?" logic — never reinvent these.
3. **Bill status is a Postgres enum and a server-enforced FSM** (`draft → needs_review → approved → scheduled → paid`, plus `void`). Every server action checks current status before mutating. The UI hides wrong actions but the server is the source of truth. See `src/app/bills/actions.ts`.
4. **Mutations are server actions**, not API routes. The lone REST endpoint is `POST /api/bills/upload` because multipart is awkward in RSC. Add new mutations as `"use server"` functions in `src/app/<segment>/actions.ts`.
5. **Server components by default.** Add `"use client"` only when a file actually needs state, refs, or event handlers. Pages should fetch via Drizzle and pass data down.
6. **Every state transition writes a `bill_events` row** in the same transaction as the mutation. The append-only log powers the activity timeline and the audit story.
7. **AI output is validated twice.** The Anthropic call uses `tool_choice: { type: "tool", name: "save_invoice" }` to force schema-conformant JSON; the result is re-validated with Zod (`ExtractedInvoiceSchema.safeParse`) before any DB write. Don't skip the Zod step.
8. **Vendor dedup is case-insensitive** (`lower(name) = lower($1)` with a unique index on `(org_id, lower(name))`). Anywhere a new vendor is created, route through the same dedup path.

## File layout & naming

- Components are flat, lowercase-with-dashes under `src/components/` (e.g. `bills-table.tsx`, `bill-hero.tsx`). No nested folders.
- Server components stay in `src/app/**`. Client components live in `src/components/**`.
- Shared queries: `src/db/queries.ts`. Shared helpers: `src/lib/utils.ts`. Categories + split allocation: `src/lib/categories.ts`. CSV: `src/lib/aging-csv.ts`.
- Pure helpers get a sibling `*.test.ts` (Vitest).

## Shared primitives (don't reinvent)

| Need | Use |
|---|---|
| Vendor monogram avatar | `<VendorAvatar name={...} size="sm|md|lg" />` from `@/components/vendor-avatar` |
| Payment-method pill | `<MethodPill method={...} size="sm|md" />` from `@/components/method-pill` |
| Bill status pill | `<StatusBadge status={...} />` from `@/components/status-badge` |
| "Is this bill overdue / due soon, label, color" | `getDueState(dueDate, status)` from `@/lib/utils` |
| Vendor name → initials | `getInitials(name)` from `@/lib/utils` |
| Aging bucket from a due date | `agingBucket(dueDate)` from `@/lib/utils` |

## Verifying changes

Always run before claiming done:
```
npm run lint
npm test
npm run build
```
The smoke script (`npm run smoke -- <url>`) is useful after deploys but not required for local edits.

## Don't do this

- Don't add a UI library (shadcn/ui, MUI, Radix). The hand-rolled component set is intentional. Extend it instead.
- Don't add a form library. Local state + server actions is the pattern.
- Don't store money as floats anywhere, ever.
- Don't bypass the FSM by writing directly to `bills.status` — always go through the corresponding server action so the audit event lands.
- Don't add `console.log` for permanent diagnostics; if you need a real signal, write to `bill_events` with a `payload`.
