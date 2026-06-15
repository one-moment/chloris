# Ralph Loop Prompt — Chloris

You are running inside a **Ralph loop**: this same prompt is fed to you on every
iteration. You can see your previous work through the file system and git history.
Each iteration, make **one bounded, safe step** toward the OBJECTIVE, leave the repo
green (build/lint passing), record what you did, then stop. The loop will re-invoke
you to continue.

## OBJECTIVE (edit this section to point the loop at a task)

Build **CRM Phase 3** on the merged deploy line (inventory + CRM are both live). Two parts,
one bounded step per iteration. No new migration expected (uses existing tables).

### Part A — `@예약` v2 (action-mention)
Per `docs/crm-reservation-mention.md` (해법 A). Core `components/MentionInput.jsx` today only
suggests USER mentions (`filterMentionUsers`). Extend it to ALSO offer module-declared ACTION
mentions (e.g. `@예약`) that, on select, do NOT insert text but trigger an action — open the
reservation form for the channel's branch (navigate to
`/work/reservations?new=1&channel=<id>&branch=<branchId>`).
- **Boundary is critical**: core must NOT import `modules/`. Modules declare actions via a
  manifest contract (e.g. `module.mentionActions = [{ token, label, minRole?, hrefFor(channel) }]`)
  surfaced through `modules/registry.js`; the core composer reads the contract (data only).
- **Never regress normal @user mentions**: keep IME-safety + arrow/Enter/Tab nav + send behavior.
  Add tests/manual reasoning. Keep the v1 "예약" button until v2 is verified.

### Part B — reservation → Google Sheet sync (code only; DISABLED until ops)
On final reservation submit (`POST /api/work/crm/reservations`), append a row to a NEW Google Sheet
(separate from the import-source sheet). Implement a small shared Sheets helper (service-account JWT
+ Sheets API v4 append). **Gated behind env** (e.g. `CRM_RESERVATION_SHEET_ID` +
`GOOGLE_APPLICATION_CREDENTIALS`); if unset → **no-op (degrade)**. Best-effort: a sheet failure must
NOT fail the reservation create. Do NOT connect to a live sheet, do NOT set prod env, do NOT commit
any key (that GCP/Vercel ops is the user's). 

Complete when both parts exist, `npm run lint` + `next build` pass, and the tracking docs are updated.
The live Sheets connection stays human-gated (env not set here).

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
