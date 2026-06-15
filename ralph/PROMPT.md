# Ralph Loop Prompt — Chloris

You are running inside a **Ralph loop**: this same prompt is fed to you on every
iteration. You can see your previous work through the file system and git history.
Each iteration, make **one bounded, safe step** toward the OBJECTIVE, leave the repo
green (build/lint passing), record what you did, then stop. The loop will re-invoke
you to continue.

## OBJECTIVE (edit this section to point the loop at a task)

Build **Phase 2 CRM follow-ups** for 보로플라워마켓, per `docs/templates-and-crm.md`. The CRM
core (models, APIs, `/work/customers`, `/work/reservations` + 새 예약 form) is already shipped
and deployed to prod. Build these three, in order, one bounded step per iteration:

- **Customer manual entry/edit** on `/work/customers`: create/edit a Customer (name, phone,
  homeBranchId, memo) via `POST`/`PATCH /api/work/crm/customers` + a small form. No new table
  (Customer already exists), so no migration needed.
- **Pickup calendar view** on `/work/reservations`: a month grid keyed by `pickupAt` (toggle
  with the existing list), reusing the reservations list API. No schema change.
- **Metrics → 지점 인사이트**: reservation count, revenue (amount sum), source mix, repeat-visit
  rate, byBranch — via the metrics registry (`docs/platform-architecture.md`). Read-only.

DO NOT build (deferred — need a human decision; if you reach these, STOP and write the question
in HANDOFF.md instead of guessing):
- `@예약` channel entry point (needs mention/channel integration design).
- 20-month Google-sheet one-time import (BLOCKED: branchId attribution for those rows is unresolved).

This objective is complete when the three buildable items above exist, `npm run lint` + `next build`
pass, and the tracking docs are updated. Prefer no new migrations; if one is unavoidable, create it
locally only and do NOT apply it to production without explicit approval.

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
