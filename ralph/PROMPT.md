# Ralph Loop Prompt — Chloris

You are running inside a **Ralph loop**: this same prompt is fed to you on every
iteration. You can see your previous work through the file system and git history.
Each iteration, make **one bounded, safe step** toward the OBJECTIVE, leave the repo
green (build/lint passing), record what you did, then stop. The loop will re-invoke
you to continue.

## OBJECTIVE (edit this section to point the loop at a task)

Build **@예약 #지점방 진입 v1 (버튼 방식)** for 보로플라워마켓, per
`docs/crm-reservation-mention.md`. Phase-2 CRM follow-ups (customer manual entry, calendar,
지점 인사이트) are done and deployed. Confirmed decisions (2026-06-15): **trigger = "예약" 버튼
v1 (route-navigation, 경계 안전)**, 폼 = 모달, 활성 채널 = branchId 연결된 채널만, 제출 후 #지점방
요약 카드 = 켬, 권한 = 인증 사용자 누구나(CRM 활성 브랜드 한정). Build in order, one bounded step
per iteration:

1. **Form extraction**: pull the "새 예약" form out of `modules/crm/ui/ReservationsDashboard.jsx`
   into a reusable `modules/crm/ui/ReservationForm.jsx` (props: fixed `branchId`, `channelId`,
   `onSubmitted`, `branches`); `/work/reservations` uses it. No behavior change.
2. **Deep-link open**: `/work/reservations` reads `?new=1&channel=<id>&branch=<id>` → opens the
   form modal with branch pre-fixed + channelId set. (Core button passes both ids.)
3. **Core "예약" button**: in the channel view (core chat UI), for channels with a `branchId`,
   render a "예약" button linking to `/work/reservations?new=1&channel=<id>&branch=<branchId>`.
   Boundary-safe: a Link only — core does NOT import the CRM module.
4. **Channel summary card (선택, 켬)**: after a reservation is created via this flow (channelId
   present), post a short summary to the channel (reuse existing message/post API).

Boundary rule is critical: core (channel UI) must NOT import `modules/`. The button is a plain
`next/link` to a `/work/...` route; all CRM logic stays in the module.

This objective is complete when the four steps exist, `npm run lint` + `next build` pass, and the
tracking docs are updated. No new migration (Reservation already has `channelId`). v2 (`@예약`
action-mention) is OUT OF SCOPE here — deferred to the agent-platform work.

DEFERRED (do NOT build; if reached, STOP and note in HANDOFF.md):
- v2 `@예약` action-mention (needs core mention-system extension + manifest contract).
- 20-month sheet import (waiting on sheet access key/CSV from the user).

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
