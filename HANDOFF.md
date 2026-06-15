# HANDOFF.md

## Current Goal

Build Chloris into an internal communication and work automation platform.

The current priority is Purchase Agent stabilization:
- employees can request purchases naturally in the chat tool
- Purchase Agent structures requests into editable drafts
- approved drafts are split into vendor-specific tasks
- Coupang tasks can be queued for the local purchase worker
- final payment remains human-reviewed

## In progress — Inventory (입고·폐기) module (Ralph loop, started 2026-06-15)

Building the flower stock-in + disposal module (`docs/inventory-stockin-disposal.md`, spec confirmed
2026-06-15) via the Ralph loop. Runbook OBJECTIVE in `ralph/PROMPT.md` repointed at this work; loop
completion promise = `RALPH-DONE` (max_iterations 30 safety cap). One bounded step per iteration on
`feature/purchase-bot-mvp`. Six phases: ①data model ②master+lookup APIs ③disposal form ④stock-in+OCR
⑤sheet sync+import ⑥metrics.

Key confirmed decisions (doc §3): Chloris = system of record; lot-cost tracking with 4-day
auto-lot-mapping (daily fresh-flower price variance); category fixed 3 (기타/제작폐기_꽃다발/제작폐기_오늘의꽃);
item-name validation gate + "신규 품목 등록 요청" approval; 임시저장/최종제출; one-way sync to a NEW
Google Sheet (existing sheet untouched); import past lots+disposals so past disposals link to past lots.

- Iteration 1 (done): spec doc `docs/inventory-stockin-disposal.md` + repointed `ralph/PROMPT.md`
  OBJECTIVE + set loop completion promise. No code/schema change yet (docs only → repo stays green).
- Iteration 2 (done, Phase 1): six models added to BOTH schemas (`FlowerItem`, `DisposalCause`,
  `StockInDelivery`/`StockInLine` with unique `lotId`, `DisposalBatch`/`DisposalLine`, `NewItemRequest`)
  + hand-written migration `20260615140000_add_inventory_module`. **NOT applied to prod** (`.env` →
  Boro prod; needs approval). Scalar cross-module ids, intra-module FK (delivery→line, batch→line,
  ON DELETE CASCADE); money=Int(원), quantity=Float(소수). Both schemas `prisma validate` ✓,
  `generate` ✓, `npm run lint` ✓ (module boundaries ok).
- Iteration 3 (done, Phase 2a): module skeleton. `modules/inventory/index.js` (manifests
  `disposalModule` slug disposal→/work/disposal, `stockInModule` slug stockin→/work/stock-in)
  registered in `modules/registry.js`; brand gating in `lib/brand.js` (borough += disposal, stockin);
  route pages `app/(workspace)/work/disposal|stock-in/page.jsx` with `isModuleEnabled` guard; stub
  dashboards (`modules/inventory/ui/DisposalDashboard|StockInDashboard.jsx`). `npm run lint` +
  `next build` pass (both routes compile static, sidebar nav renders them).
- Iteration 4 (done, Phase 2b): lookup/validation APIs + `lib/inventory.js` (constants:
  `DISPOSAL_CATEGORIES` 3-fixed, `DEFAULT_LOT_WINDOW_DAYS=4`). `GET /api/work/inventory/items?q=`
  (autocomplete + `exactMatch` for save-gate), `/reasons` (fixed categories + active causes),
  `/lots?item=&date=&window=` (same-item lots in [date-N, date], newest first — 4-day auto-mapping).
  Auth + brand guard + missing-table degrade-to-empty. `npm run lint` + `next build` pass (3 routes register).
- Iteration 5 (done, Phase 2c-1): master CRUD write APIs (admin-gated, `user.role==="admin"`).
  `GET/POST /api/work/inventory/admin/items` + `PATCH .../items/[itemId]` (name dup-check, 활성여부);
  `GET/POST .../admin/causes` + `PATCH .../causes/[causeId]`. Auth+admin+degrade. lint+build pass.
- Iteration 6 (done, Phase 2c-2): `NewItemRequest` API. `POST /api/work/inventory/item-requests`
  (member; dedups vs existing item + pending request), `GET` (admin, status filter),
  `PATCH .../[requestId]` (admin: approve→find-or-create FlowerItem + link / reject). Degrade. lint+build pass.
- Iteration 7 (done, Phase 2c-3): admin master UI. `inventoryMasterModule` (slug inventory-master,
  nav minRole admin → /work/inventory/masters) + route page + `modules/inventory/ui/
  InventoryMastersDashboard.jsx` (client): pending 신규 품목 요청 승인/반려, 품목 마스터 추가/활성토글,
  폐기원인 마스터 추가/활성토글. Consumes admin + item-requests APIs. lint+build pass.
  **Phase 2 COMPLETE** (skeleton + lookup/validation + master management).
- Iteration 8 (done, Phase 3-1): disposal write API + `lib/inventoryServer.js` (prisma helpers:
  serialize/resolveLotPrices/buildLineData/validateForSubmit, shared by routes — boundary-safe core lib).
  `POST /api/work/inventory/disposals` (draft|submitted; **server validation gate** → 422 on any line
  error, no save; lot unitPrice snapshot → amount=round(price*qty)), `GET` (list, branch/status/date
  filters), `GET/PATCH .../[batchId]` (resume draft: replace lines + draft→submitted transition in a
  tx; submitted records locked). Degrade. lint+build pass.
- Iteration 9 (done, Phase 3-2): disposal form UI (`DisposalDashboard.jsx` now a full form, replaces
  stub). Table grid; Enter=next cell / last-cell Enter=new row (IME-safe via `nativeEvent.isComposing`);
  품목 combobox (`/items`, debounced, free-input); 구분/폐기원인 dropdowns (`/reasons`); 지점·폐기일 header
  (branches from `disposals` GET); 임시저장(POST draft → keeps batchId)/최종제출(PATCH submitted);
  server 422 errors shown per-row (red) + list; 엑셀 복사(TSV clipboard). `apiClient` now attaches
  `.status`+`.data` to thrown errors (for 422 body); `.work-suggest`/cell-input CSS added. lint+build pass.
- Iteration 11 (done, Phase 3-3): lot picker in the disposal form. Picking an item from the combobox
  auto-fetches `/lots?item=&date=` and preselects the newest lot (4-day auto-mapping); 출처(lot) column
  shows unitPrice + 변경/해제, popover lists candidates (날짜·거래처·단가·D-n, newest=추천) + 출처 없음.
  Lot mapping clears when item text changes. unitPrice flows to server → 폐기가액 snapshot. **Phase 3 DONE.**
  lint+build pass.
- Next: Phase 4 — stock-in form + lotId auto-numbering + 발주/영수증/실입고 3-way + 거래명세서 OCR
  (Vision via `lib/agents/openaiClient.js`, degrade if no key). Then Phase 6 (metrics). Phase 5
  (sheet sync + import) is human-gated — build code, STOP before live connection/import.
- Pending human decisions (do NOT guess): branchId attribution for imported past rows; live Google
  Sheets connection + historical import run (approval-gated); 4-day window default.

## Done — CRM module (Ralph loop, 2026-06-15)

Building the Borough CRM + reservations module (`docs/templates-and-crm.md`) via a Ralph
loop driven by `ralph/PROMPT.md`. One bounded step per iteration on `feature/purchase-bot-mvp`.

- Iteration 1 (done): `Customer`/`Reservation` Prisma models (both schemas) + hand-written
  migration `20260615103000_add_crm_module`. **Migration NOT applied to prod** (`.env` points
  at Boro prod; applying needs explicit approval). No FK (PostTemplate convention).
  `prisma validate` + `generate` + `npm run lint` pass.
- Iteration 2 (done): module skeleton. `modules/crm/` with two manifests (crm→/work/customers,
  reservations→/work/reservations), stub dashboards, registered in `modules/registry.js`;
  route pages with `isModuleEnabled` brand guard. `npm run lint` + `next build` pass.
- Iteration 3 (done): lookup API `GET /api/work/crm/customers?q=`
  (`app/api/work/crm/customers/route.js`) — name/phone search → customer + reservationCount,
  totalAmount, recentReservations. Auth + `isModuleEnabled("crm")` guard + missing-table
  degrade-to-empty. Lint + build pass.
- Iteration 4 (done): real `/work/customers` screen (`modules/crm/ui/CustomersDashboard.jsx`,
  now a client component) — debounced name/phone search hitting the lookup API, customer cards
  with 단골 badge + counts, click-to-expand recent reservation history. Added CSS
  `.work-list/.work-list-row/.work-badge` in `app/globals.css`. Lint + build pass.
- Iteration 5 (done): reservations list API `GET /api/work/crm/reservations`
  (`app/api/work/crm/reservations/route.js`) — branchId/status/from/to filters → reservations
  with customerName + branchName, plus a `branches` list for the filter UI. Auth + brand guard
  + degrade. Lint + build pass.
- Iteration 6 (done): `/work/reservations` screen (`modules/crm/ui/ReservationsDashboard.jsx`,
  client component) — branch + status filters, summary metrics (count / total amount),
  pickup-date-sorted reservation table consuming the list API. Added `.work-filter-row` CSS.
  Lint + build pass. (Pickup calendar view split out as a later step.)
- Iteration 7 (done): reservation create API `POST /api/work/crm/reservations` (added to the
  same route file) — field validation → Customer upsert by phone + Reservation create
  (status 예약접수). No payment/external order; customer data only persisted, never logged.
  Missing-table → 503. Lint + build pass.
- Iteration 8 (done): reservation "새 예약" form on `/work/reservations` — typed fields +
  validation + customer-lookup autofill (debounced; click an existing customer to fill) +
  submit → POST + list reload. Added `.work-header-actions` CSS. Lint + build pass.

**Ralph loop OBJECTIVE complete (2026-06-15, 8 iterations).** Borough CRM + reservations
module shipped end-to-end on `feature/purchase-bot-mvp`: models + local migration, lookup API,
`/work/customers` search screen, `/work/reservations` list + 새 예약 form, reservation
create/list APIs, brand-gated. All iterations lint + build green; commits are local (not pushed).

- DEPLOYED to prod (2026-06-15, user-approved): migration `20260615103000_add_crm_module`
  applied to Boro prod (ref rodzysyxieneykcuokwh) via `prisma migrate deploy`; Vercel prod
  deploy `dpl_4kuqaGPSdpkomjt7VhwAqifUSvsc` (mattermost-project-mvp.vercel.app). Health ok /
  database ok; new CRM APIs return 401 unauthenticated; `/work/customers` + `/work/reservations`
  return 200. CRM features are now live for Borough; data appears as reservations are entered.
- PENDING: #배포로그 Ideas post (배포봇, `post-deploy-log-20260615-crm-module`) — held off
  (prod DB write beyond approved migration/deploy scope); create via app or with explicit ok.
- STILL OPEN: branchId attribution for the 20-month sheet import (decision needed before import).
- Beyond OBJECTIVE (future iterations): customer manual entry/edit, pickup calendar view,
  `@예약` channel entry point, metrics → 지점 인사이트, one-time sheet CSV import.
- NOTE: all CRM data screens stay empty until migration `20260615103000_add_crm_module` is
  applied to Boro prod (deferred, needs approval) and reservations are entered.
- Pending human action: apply `20260615103000_add_crm_module` to Boro prod when the CRM
  feature is ready to ship (and decide branchId attribution for the 20-month sheet import).

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
- 2026-06-10 batches 3-4 deployed to production (user approved):
  - threaded replies (`Comment.parentId`, 1-level threads), search dialog + `/api/search`
  - per-channel unread badges (`ChannelReadState` + `/api/channels/:id/read`), Topbar notification bell (mention/comment/notice)
  - migration `20260610150000_add_comment_threads_and_read_state` applied to production
  - deployment `dpl_9biuBJtMetSJoKqpyskYGgCLZPqB`, health ok/database ok
  - deploy log: `post-deploy-log-20260610-uiux-batch3-4-threads-search-notifications`
  - branch pushed to origin (`cfca075`); employee UI/UX proposal priorities 1-3 fully live
- 2026-06-10 employee UI/UX proposal batches 1-2 implemented locally:
  - post readability (typography hierarchy, 더보기 truncation, `**bold**` rendering via `components/RichText.jsx`)
  - mention autocomplete extended to post/message composers; mention filter token bug fixed
  - channel list shows latest activity preview
  - post pin (`Post.pinnedAt`) implemented; migration `20260610100000_add_post_pinned` created but NOT applied to production (needs user approval)
  - verified: `npm run lint`, `npm run build`, `agent-gateway:test`, `purchase-bot:test` all passed; DB-writing tests not run (default `.env` may point at production)
- Added `CLAUDE_HANDOFF.md` so Claude or another coding agent can continue from local path, GitHub branch, project structure, safety rules, and next-work context.

- 2026-06-11 architecture Phase 1 first increment deployed:
  - sidebar 업무 section from `modules/registry.js`; `/work/purchase` dashboard v0
  - module boundary guardrail in `npm run lint`; AGENTS.md module rules
  - migration `20260611090000_add_branch_layer` applied: Branch/BranchAssignment tables, `Channel.branchId`, seeded 강남1호점/강남2호점/잠실점
  - deployment `dpl_2ttnSDBiRsERD2vV7QDVPK8dXXwN`, health ok, deploy log `post-deploy-log-20260611-phase1-module-registry-branches`
- 2026-06-11 architecture Phase 1 COMPLETE and deployed:
  - `/chat/[channelId]` URL routing; `WorkspaceShell` layout-level provider (`components/workspace/`), `ChatView`, `app/(workspace)` route group
  - `/work/purchase` inside the workspace shell (sidebar persists)
  - deployment `dpl_w7vuu8Niz6RERfC3sacYTGBXXyTx`, health ok, all routes 200, deploy log `post-deploy-log-20260611-phase1-complete-chat-routing`
- 2026-06-11 channel-branch linking UI deployed:
  - branch select on channel creation, Topbar branch badge, admin inline branch change
  - deployment `dpl_2aFqqchMxHh9JMd3QkGh5Bs1CtxZ`, health ok, deploy log `post-deploy-log-20260611-channel-branch-linking`

- 2026-06-14 combined deploy `dpl_7kUQ3YMhfM8yxtsqtZ64cvUA4WyJ` (health ok):
  - Borough design 2nd pass (style-only: status tokens/chips, card spacing; rail/drawer/Lucide deferred per leader)
  - channel-scoped post templates + migration `20260614120000_add_post_templates` applied to Boro prod DB
  - mention keyboard nav (`ddf4696`)
  - design source vendored at `docs/design/borough/`; deploy log `post-deploy-log-20260614-borough-design-templates-mention`
  - deferred: image-upload compression, structural design (rail/drawer/Lucide), CRM+reservations modules

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

0-0. FIRST: discuss the usage-model rethink recorded in `TODO.md` ("Usage Model Rethink 2026-06-11") — channel = branch room + task = agent mention (fixes channel explosion), action-first work screens, intuitiveness quick wins. User wants the product to feel simple and intuitive as an ERP; get decisions, then fold into `docs/platform-architecture.md` and Phase 2 scope.

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
