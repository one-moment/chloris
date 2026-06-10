# DECISIONS.md

## 2026-06-01: MVP Deployment Stack

- Use Vercel for app hosting.
- Use Supabase PostgreSQL for production DB.
- Defer AWS-heavy infrastructure until the MVP proves usage.

## 2026-06-03: Responsiveness

- Use optimistic UI for message/post/comment creation.
- Avoid full refresh after create APIs.
- Prefer Vercel function region close to Supabase DB.

## 2026-06-07: Purchase Worker Safety

- Use handoff/worker flow instead of trying to fully automate checkout.
- Final payment is never automated.
- Browser automation failures must collect artifacts before selector changes.

## 2026-06-08: Bot Integration Model

- Bots must be installable per channel.
- Purchase Bot is no longer a global hardcoded bot.
- External bot support should be designed through webhooks/tokens, not direct DB access.

## 2026-06-08: Agent Layer

- Add Agent Gateway inside the Chloris server.
- Add Purchase Agent as the first role agent.
- Keep OpenAI intent classification out of v1 production flow.
- Use rule-based parsing for Purchase Agent v1.

## 2026-06-08: Bulk Purchase Flow

- Bulk purchase requests are first converted into editable drafts.
- Draft approval splits work into vendor tasks.
- Coupang URL lines can become `PurchaseRequest` and `PurchaseWorkerTask`.
- Non-Coupang vendors are marked as needing vendor bots or manual handoff.

## 2026-06-09: Deployment Log Location

- Deployment logs must be written as Ideas posts in the `#배포로그` channel.
- Do not treat deployment logs as chat-only messages.

## 2026-06-09: Handoff Documents

- Keep `AGENTS.md`, `HANDOFF.md`, `DECISIONS.md`, `TODO.md`, `ENV_CHECKLIST.md`, and `BUG_LOG.md` current.
- Update `HANDOFF.md` and `TODO.md` before ending every future work session.

## 2026-06-11: Phase 1 Start and Work Ordering

- Architecture Phase 1 starts now as the main thread; Coupang worker stabilization runs in parallel, driven by real failure artifacts as they occur (worker work is artifact-gated per AGENTS.md, so waiting on it blocks nothing).
- Branch default: schema supports multi-branch, but channel linkage (`Channel.branchId`) is nullable and unset initially. Work records will inherit branch from their channel once linked.
- 2026-06-11 user confirmed initial branches: 강남1호점, 강남2호점, 잠실점 (seeded in `20260611090000_add_branch_layer`). Future branches: create Branch record, then link channels to it.
- Module boundary enforcement is a lint-stage script (`scripts/check-module-boundaries.mjs`), verified to fail on cross-module imports.

## 2026-06-10: Platform Architecture v2

- Sidebar splits into communication / work / admin sections; work features get dedicated routes under `/work/*`, not channel tabs.
- Work features are vertical-slice modules under `modules/<slug>/`, registered through a code-level manifest registry.
- Modules may import core and platform only. Module-to-module imports are forbidden (ESLint-enforced); cross-module flows go through a platform event bus.
- Entities used by two or more modules move to core master data. `Branch` and `BranchAssignment` are added early (Phase 1).
- A global approval inbox at `/work/inbox` aggregates all `ApprovalRequest` records across modules.
- Field input happens in chat (agent mention + photo); managers process in dashboards/inbox. No per-module input forms.
- Branch insights module aggregates KPIs through a platform metrics registry; modules declare metrics in their manifests.
- Per-module "team lead" agents orchestrate unit-task bots; employee-built bots integrate only via app registry + scoped tokens/webhooks/local worker queues, never direct DB access.
- Status vocabulary and chip colors are defined once in core; modules may not invent their own.
- Module data must not be added to `/api/state`.
- Full design: `docs/platform-architecture.md` (v2). Open items in its section 16.

## 2026-06-09: Team-Built Agent/Bot Framework

- Chloris should support agents and bots created by team members, not only bots built directly inside the core app.
- Team-built integrations must be registered as apps before they can run in channels.
- Registration flow should be:
  - draft registration
  - admin review
  - capability declaration
  - channel installation
  - channel-specific configuration
  - event subscription
  - execution logging
  - disable/revoke path
- External integrations must not access the DB directly.
- External integrations must communicate through approved APIs, webhooks, or local worker task queues.
- Tokens/secrets must be hashed or stored outside source-controlled documents.
- Every agent/tool/bot invocation should leave an audit trail through `AgentRun`, `AgentToolCall`, or `BotEventLog`.
- The initial framework should be registry-first and permission-first; marketplace-style UI can come later.
- For Purchase Agent, vendor bots are tools under the Purchase Agent rather than global channel clutter.
