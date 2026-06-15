# Ralph Loop Prompt — Chloris

You are running inside a **Ralph loop**: this same prompt is fed to you on every
iteration. You can see your previous work through the file system and git history.
Each iteration, make **one bounded, safe step** toward the OBJECTIVE, leave the repo
green (build/lint passing), record what you did, then stop. The loop will re-invoke
you to continue.

## OBJECTIVE (edit this section to point the loop at a task)

Build the **꽃 입고·폐기 관리 (inventory) module** for 보로플라워마켓, per
`docs/inventory-stockin-disposal.md` (spec confirmed 2026-06-15). New module `modules/inventory`
(Borough-only), screens `/work/disposal` + `/work/stock-in` + admin master management. Build the
six phases below in order, **one bounded step per iteration**:

1. **Data model** — add models (`FlowerItem`, `DisposalCause`, `StockInDelivery`/`StockInLine`
   with `lotId`, `DisposalBatch`/`DisposalLine`, `NewItemRequest`) to BOTH `prisma/schema.prisma`
   (sqlite) and `prisma/schema.postgres.prisma`; hand-write the migration (CRM convention:
   scalar cross-module ids, intra-module FK only). Money=Int(원), quantity=Float(소수). Migration
   created locally only — NOT applied to prod.
2. **Master + lookup/validation APIs** — module skeleton + manifests in `modules/registry.js`,
   brand gating in `lib/brand.js`, route pages + dashboard stubs; `GET /api/work/inventory/items`
   (autocomplete + exact-match validation), `/reasons`, `/lots` (4-day lot suggestion). Admin
   master screens + `NewItemRequest` approval. All degrade-to-empty when tables absent.
3. **Disposal form** — table grid, Enter/Tab keyboard nav (IME-safe), item combobox, category +
   cause dropdowns, lot picker, save-time validation gate (block on any error), 임시저장/최종제출.
   Submit API → DisposalBatch/Line.
4. **Stock-in + 거래명세서 OCR** — inbound table, 발주/영수증/실입고 3-way reconciliation, lotId
   auto-numbering, Vision extraction via `lib/agents/openaiClient.js` (degrade if no key).
5. **Sheet sync + historical import** — create a NEW Google Sheet (do not touch the existing one),
   one-way append on 최종제출; import past lots + disposals from the existing sheet into the new
   sheet + DB so past disposals link to past lots. Google Sheets API + import = run only after
   explicit approval (Service Account keys live in env, never in repo).
6. **Metrics → 지점 인사이트** — 폐기율·폐기가액·사유 비중·입고 불일치율, byBranch (metrics registry).

DO NOT do without explicit human approval (if you reach these, STOP and write the request in
HANDOFF.md instead of guessing):
- Apply any migration to prod / `db push` to prod / `vercel deploy`.
- Connect/write to the live Google Sheet, or run the historical import against prod.
- Resolve `branchId` attribution for imported past rows (unresolved — needs a human decision).

This objective is complete when phases 1–4 + 6 are implemented (phase 5's sheet/import code exists
but stays human-gated for the live connection), `npm run lint` + `next build` pass, and the tracking
docs are updated. Create migrations locally only; never apply to prod without explicit approval.

## Every iteration, in order

1. **Read context first**: `AGENTS.md`, `HANDOFF.md`, `TODO.md`, `DECISIONS.md`, `BUG_LOG.md`,
   and for this objective `docs/templates-and-crm.md` + `docs/platform-architecture.md`.
2. **Check git** (`git log --oneline -10`, `git status`, `git diff`) to see what previous
   iterations already did. Do not redo finished work.
3. **Pick the single smallest next step** toward the OBJECTIVE. One concern per iteration
   (one model, one API route, one UI piece). Prefer existing project patterns and helpers.
4. **Implement** that step only. Keep changes scoped — no broad rewrites or flow refactors.
5. **Verify**: run `npm run lint` (includes module-boundary check) and any relevant test
   script (`npm run *:test`). Fix what you broke. Never report progress on unverified code.
6. **Record**: update `TODO.md` (check off / add sub-tasks), `HANDOFF.md` (current state),
   `DECISIONS.md` (if a decision was made), `BUG_LOG.md` (if a bug was found/fixed/deferred).
7. **Commit** the iteration to the current feature branch with a clear message
   (never to `main`). Then stop — the loop re-invokes you.

## Hard guardrails (the loop runs unattended — these are absolute)

- **NEVER** run production DB migrations (`prisma migrate deploy`), `db push` to prod,
  or `npx vercel deploy`. Migrations are created locally only; production apply needs the
  human. If a step requires prod migration/deploy, STOP and write the request into HANDOFF.md.
- **NEVER** implement final payment/purchase automation. That stays a human-reviewed step.
- **NEVER** delete data, send real emails, or perform real external orders.
- **NEVER** write secrets, API keys, DB URLs, customer/payroll data, or session data into
  any repository file or commit (AGENTS.md).
- **NEVER** import one module from another module. Cross-module flows go through platform
  events. Keep `modules/<slug>/` boundaries (enforced by `npm run lint`).
- Do not add module data to `/api/state`; modules fetch via `/api/work/<module>/...`.
- If you are blocked, uncertain about scope, or about to do anything on this list,
  STOP and record the question in HANDOFF.md instead of guessing.

## Completion

When the OBJECTIVE above is fully complete — implemented, `npm run lint` clean, relevant
tests passing, tracking docs updated, and changes committed to the feature branch —
output exactly:

    <promise>RALPH-DONE</promise>

Do not output that string for any other reason. If the objective is not fully met, end the
iteration normally (without the promise) so the loop continues.
