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
