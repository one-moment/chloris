# HANDOFF.md

## Current Goal

Build Chloris into an internal communication and work automation platform.

The current priority is Purchase Agent stabilization:
- employees can request purchases naturally in the chat tool
- Purchase Agent structures requests into editable drafts
- approved drafts are split into vendor-specific tasks
- Coupang tasks can be queued for the local purchase worker
- final payment remains human-reviewed

## Completed Work

- Internal communication MVP:
  - projects
  - channels
  - messages
  - Ideas board
  - comments
  - files
  - user login/account creation
- Vercel + Supabase production deployment.
- PostgreSQL Prisma schema and migrations.
- Bot Integration structure:
  - `BotApp`
  - `BotInstallation`
  - `ChannelBotInstallation`
  - `BotCredential`
  - `BotEventLog`
- Agent layer:
  - `AgentApp`
  - `ChannelAgentInstallation`
  - `AgentTool`
  - `AgentRun`
  - `AgentToolCall`
  - `ApprovalRequest`
- Purchase Agent v1:
  - rule-based natural language command parsing
  - single-item purchase request creation
  - bulk purchase order parsing
  - `PurchaseOrderDraft`
  - `PurchaseOrderDraftLine`
  - draft confirm/edit/approve UI
  - `PurchaseOrderVendorTask`
  - Coupang URL line to `PurchaseRequest` + `PurchaseWorkerTask`
- Admin automation panel:
  - channel bot ON/OFF
  - channel agent ON/OFF
  - purchase bot configuration form
- Production migrations applied as of 2026-06-08:
  - `20260608121000_add_agent_layer`
  - `20260608143000_add_purchase_order_drafts`
  - `20260608152000_add_purchase_order_vendor_tasks`
- Production deployment completed:
  - production URL: `https://mattermost-project-mvp.vercel.app`
  - latest noted deployment: `dpl_J111xQJPY6MSDnDC2xMgAtDugrdw`
- Security fix completed:
  - `/api/auth/me` no longer exposes user list to unauthenticated users.
- Deployment logs were moved to the `#배포로그` Ideas board:
  - `2026-06-08 Purchase Agent workflow 운영 배포`
  - `2026-06-08 운영 점검 및 사용자 목록 노출 수정`
  - `2026-06-09 Purchase Agent 운영 반영 상태 정리`
- 2026-06-09 production Purchase Agent test:
  - created a real test bulk purchase message in `#구매요청`
  - confirmed draft creation through production HTTP API
  - confirmed draft edit through production HTTP API
  - confirmed draft approval through production HTTP API
  - confirmed vendor task split
  - confirmed Coupang line creates `PurchaseRequest` and `PurchaseWorkerTask` in queued state
  - found and fixed metadata-title parsing bug
- Added `docs/agent-bot-framework.md` for team-built agent/bot framework direction.
- 2026-06-10 employee UI/UX batches 1-2 deployed to production:
  - migration `20260610100000_add_post_pinned` applied to production (user approved)
  - deployment `dpl_7zyeR6fQmTMYUE9g1DRBTnPH2jym`, health ok/database ok/icn1
  - deploy log Ideas post: `post-deploy-log-20260610-uiux-batch1-2-post-pin`
- 2026-06-10 batches 3-4 implemented locally (NOT yet deployed):
  - threaded replies (`Comment.parentId`, 1-level threads), search dialog + `/api/search`
  - per-channel unread badges (`ChannelReadState` + `/api/channels/:id/read`), Topbar notification bell (mention/comment/notice)
  - migration `20260610150000_add_comment_threads_and_read_state` created, NOT applied — needs user approval before deploy
- 2026-06-10 employee UI/UX proposal batches 1-2 implemented locally:
  - post readability (typography hierarchy, 더보기 truncation, `**bold**` rendering via `components/RichText.jsx`)
  - mention autocomplete extended to post/message composers; mention filter token bug fixed
  - channel list shows latest activity preview
  - post pin (`Post.pinnedAt`) implemented; migration `20260610100000_add_post_pinned` created but NOT applied to production (needs user approval)
  - verified: `npm run lint`, `npm run build`, `agent-gateway:test`, `purchase-bot:test` all passed; DB-writing tests not run (default `.env` may point at production)
- Added `CLAUDE_HANDOFF.md` so Claude or another coding agent can continue from local path, GitHub branch, project structure, safety rules, and next-work context.

## Current State

- Branch: `feature/purchase-bot-mvp`
- Local repo path: `/Users/user/Documents/Codex/2026-05-28/github/mattermost`
- GitHub remote: `https://github.com/one-moment/chloris.git`
- Claude handoff file: `CLAUDE_HANDOFF.md`
- Check `git status --short --branch` before handoff; push `feature/purchase-bot-mvp` if local commits are ahead of origin.
- Latest local commits known:
  - `4069393 Document agent framework and stabilize bulk parser`
  - `2bdfda2 Restrict auth user list exposure`
  - `e22e6b9 Add purchase agent workflow`
- Production health was verified after deployment.
- Production DB migration status was verified as up to date.
- Recent Vercel logs showed no application errors during smoke checks.
- Latest parser fix deployment noted:
  - deployment: `dpl_5mTgUYhYp3Ein2CX5M4R1nYTWKbW`
  - production URL alias: `https://mattermost-project-mvp.vercel.app`
  - health/database: ok
  - function region observed via health header: `icn1`
- Latest `#배포로그` Ideas post:
  - `post-deploy-log-20260609-purchase-agent-prod-test-parser-fix`
  - title: `2026-06-09 Purchase Agent 운영 테스트 및 파서 수정`
  - status: `완료됨`
- Local automated tests passed:
  - `npm run lint`
  - `npm run build`
  - `npm run agent-gateway:test`
  - `npm run purchase-bot:test`
  - DB-writing tests were not re-run in this wrap-up because `.env` points at production. Run them only with an explicit local/staging `DATABASE_URL`.

## Next Work

0. Platform architecture design approved 2026-06-10: `docs/platform-architecture.md` v2 (chat core / work modules / automation platform separation, UX standards, branch insights + metrics registry, agent-bot open platform plan). Decision recorded in `DECISIONS.md`. Remaining open items in doc section 16.
0-1. Before architecture Phase 1: apply employee UI/UX proposal (2026-06-10) per the "Today" section in `TODO.md` — readability, mention extension, pin, then search/threads/notifications. Reviewed as no structural conflict.
1. Push local commits before continuing from GitHub-only environments if needed.
2. Stabilize Coupang worker for:
   - existing cart items
   - multiple items
   - repeated URLs
   - quantity correction
   - cart row detection
3. Add first non-Coupang vendor workflow:
   - likely Sungwon Adpia skeleton first
4. Improve Agent/Bot admin UX:
   - installed agents
   - connected bots
   - channel-specific settings
   - vendor task status
5. Add external/team-built app registration skeleton after the admin UX is clearer.

## Team-Built Agent/Bot Framework Direction

The next implementation should make Chloris a small internal automation platform rather than a collection of hardcoded bots.

Target model:
- Team members can submit an agent/bot registration.
- Admin reviews and activates the app.
- Activated apps declare:
  - type: agent, bot, tool, webhook, local worker adapter
  - allowed events
  - required scopes
  - required configuration
  - credential requirements
  - audit log target
- Channels install agents first.
- Agent detail shows child tools/bots, so the channel UI does not become crowded.
- External apps use API tokens/webhooks only.
- Local worker bots use task queues and do not expose browser/session details to the server.

## Known Production Test Artifacts

- A first production test draft incorrectly included an `unknown` vendor line from `[운영 테스트] 2026-06-09 ...`.
- The parser fix was deployed, and a second production test confirmed:
  - line count: 2
  - `hasUnknown`: false
  - Coupang task status: `queued`
  - Sungwon Adpia task status: `vendor_bot_needed`

## Cautions

- Do not apply production DB migrations without explicit user approval.
- Do not send real emails without explicit user approval.
- Do not perform real payments.
- Do not delete production data without explicit user approval.
- Do not store raw secrets or sensitive data in docs.
- Debug Coupang automation only from artifacts, not selector guesswork.
- Keep deployment logs in the Ideas board for `#배포로그`.
