# AGENTS.md

## Project Rules

- Start every work session by reading `HANDOFF.md`, `TODO.md`, `DECISIONS.md`, and `BUG_LOG.md`.
- Before ending a work session, update `HANDOFF.md` and `TODO.md`.
- If a new decision is made, update `DECISIONS.md`.
- If a bug is found, debugged, fixed, or intentionally deferred, update `BUG_LOG.md`.
- Do not store raw API keys, DB URLs, passwords, customer data, payroll data, browser session data, or other sensitive data in repository documents.
- Do not run production DB migrations, send real emails, perform real payments, or delete data unless the user explicitly approves that exact action.
- Do not implement final payment automation. Final purchase/payment must remain a human-reviewed step.
- Keep changes scoped. Do not perform broad rewrites or full flow refactors unless explicitly approved.
- When asked to update deployment logs, write them to the `#배포로그` channel's Ideas board, not to chat messages.

## Module Rules

- Work features live in `modules/<slug>/` (vertical slice: server, ui, manifest). Register manifests in `modules/registry.js`.
- Modules may import `lib/` (core/platform) only. Modules must NEVER import other modules — cross-module flows go through platform events. Enforced by `scripts/check-module-boundaries.mjs` in `npm run lint`.
- Do not add module/work data to `/api/state`. It serves communication core data only; modules fetch through `/api/work/<module>/...`.
- Manifest contract fields may only be added when two or more modules need them.
- See `docs/platform-architecture.md` for the full design.

## Engineering Rules

- Prefer existing project patterns and helper APIs.
- Use Prisma migrations for schema changes. Do not use `db push` for production.
- Apply production migrations only after explicit user approval.
- Keep `DATABASE_URL` and `DIRECT_URL` usage aligned with Prisma/Supabase pooler guidance.
- Run relevant tests before reporting completion.
- If deploying to production, verify:
  - health endpoint
  - database status
  - migration status
  - Vercel deployment readiness
  - recent Vercel logs
  - sensitive API protection

## Browser Automation Rules

- Do not modify browser automation selectors by guesswork.
- Before selector changes, collect debug artifacts:
  - full screenshot
  - target row/container screenshot
  - `page.content()`
  - target row `outerHTML`
  - selector match counts
  - selected element index
  - trace/log if available
- Do not search page-wide for input/button when a target row/container can be scoped first.
- Clicks must be followed by state verification.
- If quantity correction fails, stop the worker task and require human review.

## Purchase Automation Rules

- Purchase Agent may structure purchase requests, create drafts, route vendor tasks, and enqueue local worker jobs.
- Purchase Agent must not complete final payment.
- Coupang automation is allowed only up to cart/handoff flow.
- Local worker can use the user's local browser/session, but secrets and session details must not be written to repository docs.
- For vendor bots not implemented yet, mark the task as requiring a vendor bot or manual handoff.

## Reporting Format

Before risky code changes:
- Cause candidates
- Evidence in code
- Minimum change scope
- Risk
- Test method

After implementation:
- Changed files
- Changed behavior
- Test results
- Remaining risk
- Deployment/migration status
