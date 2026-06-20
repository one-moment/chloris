# CLAUDE_HANDOFF.md

## Purpose

This file is a transfer note for continuing the Chloris project with Claude or another coding agent.

Read this before making changes:
- `AGENTS.md`
- `HANDOFF.md`
- `TODO.md`
- `DECISIONS.md`
- `BUG_LOG.md`
- `ENV_CHECKLIST.md`
- `docs/agent-bot-framework.md`

## Local Repository

- Local repo path: `/Users/user/Documents/Codex/2026-05-28/github/mattermost`
- Parent workspace: `/Users/user/Documents/Codex/2026-05-28/github`
- Current branch: `feature/purchase-bot-mvp`
- Git remote: `https://github.com/one-moment/chloris.git`
- GitHub repo: `https://github.com/one-moment/chloris`
- Production URL: `https://mattermost-project-mvp.vercel.app`

Important: verify `git status --short --branch` before Claude starts.
If the local branch is ahead of GitHub, push or otherwise provide the local commits first.
The recent handoff-critical commits are:
- `e22e6b9 Add purchase agent workflow`
- `2bdfda2 Restrict auth user list exposure`
- `4069393 Document agent framework and stabilize bulk parser`
- `8a30831 Add Claude handoff guide`

Useful GitHub links:
- Branch: `https://github.com/one-moment/chloris/tree/feature/purchase-bot-mvp`
- Agent rules: `https://github.com/one-moment/chloris/blob/feature/purchase-bot-mvp/AGENTS.md`
- Main handoff: `https://github.com/one-moment/chloris/blob/feature/purchase-bot-mvp/HANDOFF.md`
- TODO: `https://github.com/one-moment/chloris/blob/feature/purchase-bot-mvp/TODO.md`
- Decisions: `https://github.com/one-moment/chloris/blob/feature/purchase-bot-mvp/DECISIONS.md`
- Bug log: `https://github.com/one-moment/chloris/blob/feature/purchase-bot-mvp/BUG_LOG.md`
- Claude handoff: `https://github.com/one-moment/chloris/blob/feature/purchase-bot-mvp/CLAUDE_HANDOFF.md`
- Agent/Bot framework: `https://github.com/one-moment/chloris/blob/feature/purchase-bot-mvp/docs/agent-bot-framework.md`

## Environment And Secrets

Do not copy raw secrets into chat, docs, or commits.

Local env files exist here:
- `/Users/user/Documents/Codex/2026-05-28/github/mattermost/.env`
- `/Users/user/Documents/Codex/2026-05-28/github/mattermost/.env.local`
- `/Users/user/Documents/Codex/2026-05-28/github/mattermost/.env.example`
- `/Users/user/Documents/Codex/2026-05-28/github/mattermost/.env.vercel.example`
- `/Users/user/Documents/Codex/2026-05-28/github/mattermost/.env.production.example`

Important environment notes:
- `.env` may point at production Supabase PostgreSQL.
- DB-writing tests must not run against production by accident.
- Use explicit local/staging `DATABASE_URL` and `DIRECT_URL` before DB-writing tests.
- Do not run production migrations without explicit user approval.
- Do not send real email, perform real payment, or delete production data without explicit user approval.

## App Structure

Primary app:
- Next.js App Router app in `app/`
- Main UI: `app/page.jsx`
- API routes: `app/api/**/route.js`
- Global styles: `app/globals.css`

Data layer:
- Prisma client singleton: `lib/prisma.js`
- PostgreSQL schema: `prisma/schema.postgres.prisma`
- SQLite/dev schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/`

Core communication features:
- State helpers: `lib/serverState.js`
- Permissions: `lib/permissions.js`
- Auth: `lib/auth.js`
- Mentions: `lib/mentions.js`
- API performance logging: `lib/apiPerf.js`

Bot layer:
- Bot integration service: `lib/botIntegrations/service.js`
- Purchase bot parser: `lib/purchaseBot/parser.js`
- Purchase bot service: `lib/purchaseBot/service.js`
- Purchase bot messages/constants: `lib/purchaseBot/messages.js`, `lib/purchaseBot/constants.js`

Agent layer:
- Agent gateway: `lib/agentGateway/service.js`
- Agent admin/service helpers: `lib/agents/service.js`
- Purchase Agent service: `lib/agents/purchaseAgent/service.js`
- Purchase Agent parser: `lib/agents/purchaseAgent/bulkOrderParser.js`
- Purchase Agent prompt/rule helpers: `lib/agents/purchaseAgent/prompts.js`
- Purchase Agent tools: `lib/agents/purchaseAgent/tools.js`
- Draft-to-vendor task logic: `lib/agents/purchaseAgent/draftTasks.js`
- OpenAI client placeholder: `lib/agents/openaiClient.js`

Local purchase worker:
- Entry point: `scripts/purchase-worker/index.ts`
- Config: `scripts/purchase-worker/config.ts`
- API client: `scripts/purchase-worker/client.ts`
- Run single task: `scripts/purchase-worker/run-task.ts`
- Browser helpers: `scripts/purchase-worker/browser.ts`
- Login helper: `scripts/purchase-worker/login.ts`
- Screenshot helper: `scripts/purchase-worker/capture.ts`
- Vendor handlers:
  - Coupang: `scripts/purchase-worker/handlers/coupang.ts`
  - Sungwon Adpia skeleton: `scripts/purchase-worker/handlers/swadpia.ts`
  - Handoff/shared: `scripts/purchase-worker/handlers/handoff.ts`, `scripts/purchase-worker/handlers/shared.ts`

Local purchase worker artifacts:
- Screenshots and browser artifacts may exist under `/Users/user/.purchase-bot/`
- Do not commit these artifacts unless explicitly requested and sanitized.

## Important API Routes

Communication:
- `POST /api/channels/:channelId/messages`
- `POST /api/channels/:channelId/posts`
- `POST /api/posts/:postId/comments`
- `GET /api/state`
- `GET /api/health`

Bot and agent management:
- `GET /api/bots`
- `POST /api/bots/:botId/install`
- `GET /api/channels/:channelId/bots`
- `POST /api/channels/:channelId/bots/:botId/enable`
- `POST /api/channels/:channelId/bots/:botId/disable`
- `PATCH /api/channels/:channelId/bots/:botId/config`
- `GET /api/agents`
- `GET /api/channels/:channelId/agents`
- `POST /api/channels/:channelId/agents/:agentId/enable`
- `POST /api/channels/:channelId/agents/:agentId/disable`
- `PATCH /api/channels/:channelId/agents/:agentId/config`

Purchase workflow:
- `PATCH /api/purchase-order-drafts/:draftId`
- `POST /api/purchase-order-drafts/:draftId/approve`
- `POST /api/purchase-bot/requests/:requestId/approve`
- `POST /api/purchase-bot/requests/:requestId/reject`
- `POST /api/purchase-bot/requests/:requestId/run`
- `GET /api/purchase-bot/worker/tasks`
- `GET /api/purchase-bot/worker/tasks/:taskId`
- `POST /api/purchase-bot/worker/tasks/:taskId/result`

## Current Product Direction

Chloris is evolving from an internal chat tool into a work automation platform:

```text
Chloris chat
  -> Agent Gateway
  -> Role Agent, e.g. Purchase Agent
  -> Agent tools
  -> Vendor/internal/external bots
  -> Local Mac/PC worker where browser sessions are needed
  -> Human approval and audit logs
```

Purchase Agent direction:
- Users mention `@구매에이전트`.
- Agent structures single or bulk purchase orders into editable drafts.
- Approved drafts split into vendor tasks.
- Coupang URL lines can queue local worker tasks.
- Non-Coupang vendors currently need vendor bots or manual handoff.
- Final payment automation is forbidden.

Team-built agent/bot direction:
- Team members should eventually register agents/bots as apps.
- Apps must declare capabilities, events, permissions, config schema, credential needs, and audit requirements.
- External apps must use API tokens/webhooks/local worker queues, not direct DB access.
- Channel UI should install agents first, then show child bots/tools under the selected agent.

## Latest Known Production State

- Production URL: `https://mattermost-project-mvp.vercel.app`
- Vercel function region observed: `icn1`
- Supabase/Postgres production DB is configured through env vars.
- Production migrations applied as of 2026-06-08:
  - `20260608121000_add_agent_layer`
  - `20260608143000_add_purchase_order_drafts`
  - `20260608152000_add_purchase_order_vendor_tasks`
- Latest parser fix deployment noted in `HANDOFF.md`:
  - `dpl_5mTgUYhYp3Ein2CX5M4R1nYTWKbW`
- Latest deployment log Ideas post:
  - `post-deploy-log-20260609-purchase-agent-prod-test-parser-fix`

## What Was Last Verified

Passed locally:
- `npm run lint`
- `npm run build`
- `npm run agent-gateway:test`
- `npm run purchase-bot:test`

Verified in production:
- Purchase Agent bulk order message in `#구매요청`
- Draft creation
- Draft edit
- Draft approval
- Vendor task split
- Coupang `PurchaseRequest` and `PurchaseWorkerTask` queued
- Metadata/title line parsing bug fixed and re-tested

Not re-run at the final wrap-up:
- DB-writing tests such as `npm run agent-layer:test` and `npm run bot-integrations:test`, because the default `.env` can point at production.

## Next Recommended Work

1. Confirm GitHub is current if Claude will work from GitHub:
   - `git status --short --branch`
   - `git push origin feature/purchase-bot-mvp`
2. Stabilize Coupang worker using artifacts, not selector guesses:
   - existing cart items
   - multiple products
   - duplicate product URLs
   - quantity correction
   - row/container detection
3. Add row-level debug artifact capture for Coupang quantity failures:
   - full screenshot
   - product row screenshot
   - page HTML
   - row `outerHTML`
   - selector match counts
   - selected element index
   - environment details
4. Add first non-Coupang vendor workflow:
   - Sungwon Adpia skeleton first
   - Gmarket/Hyundai Deco can remain handoff-style initially
5. Improve admin UX:
   - compact agent list
   - child bots/tools under selected agent
   - vendor task status
   - channel-specific vendor settings
6. Add team-built app registry skeleton:
   - draft/submitted/review/active/disabled/revoked lifecycle
   - declared capabilities/scopes
   - token/webhook credential handling
   - audit log integration

## Commands

Install dependencies if needed:

```bash
cd /Users/user/Documents/Codex/2026-05-28/github/mattermost
npm install
```

Run local server:

```bash
cd /Users/user/Documents/Codex/2026-05-28/github/mattermost
PORT=3020 npm run dev
```

Run safe non-DB-writing checks:

```bash
cd /Users/user/Documents/Codex/2026-05-28/github/mattermost
npm run lint
npm run build
npm run agent-gateway:test
npm run purchase-bot:test
```

Run local purchase worker only when the target server and worker token are confirmed:

```bash
cd /Users/user/Documents/Codex/2026-05-28/github/mattermost
npm run purchase-worker
```

Before DB-writing tests, override DB URLs explicitly:

```bash
cd /Users/user/Documents/Codex/2026-05-28/github/mattermost
DATABASE_URL="postgresql://LOCAL_OR_STAGING_URL" \
DIRECT_URL="postgresql://LOCAL_OR_STAGING_DIRECT_URL" \
npm run agent-layer:test
```

## Hard Safety Rules

- Do not apply production DB migrations unless the user explicitly approves.
- Do not run data deletion in production unless the user explicitly approves.
- Do not send real emails unless the user explicitly approves.
- Do not implement or perform final payment automation.
- Do not commit raw `.env` values, API keys, DB URLs, customer data, payroll data, or browser session details.
- Do not change Coupang selectors by guessing. Collect artifacts first.
- Do not continue a purchase worker task after quantity mismatch.
- Deployment logs belong in the `#배포로그` Ideas board, not chat messages.
