# TODO.md

## Today (2026-06-10): Employee UI/UX Proposal First

Reviewed: no structural conflict with the platform architecture plan. All items touch core communication UI (`components/`), which stays core UI after Phase 1. Apply in this order, then proceed to architecture phase ordering decision.

Batch 1 (priority 1, no migration):
- [x] Post readability: spacing/typography hierarchy in post cards, long-post truncation with "더보기", bold text support (markdown-lite `**bold**` via new `components/RichText.jsx`).
- [x] Extend mention autocomplete (`MentionInput`) from comments to post composer and message composer; mention highlighting in post/message bodies (text-based matching, no schema change). Also fixed the mention filter to match `@name` tokens (see BUG_LOG).
- [x] Channel list: show latest post/message preview per channel (existing data, no read tracking).

Batch 2 (priority 1, additive migration created but NOT applied to production):
- [x] Pin posts implemented: `Post.pinnedAt` in both schemas, migration `20260610100000_add_post_pinned` (file only), PATCH `/api/posts/:id` accepts `pinned` (admin only), pinned section on top of Ideas view.
- [ ] Apply `20260610100000_add_post_pinned` to production — REQUIRES explicit user approval before `prisma migrate deploy`.

Batch 3 (priority 2):
- [x] Threaded replies: `Comment.parentId` (1-level threads, reply composer, indented rendering) + comment count on post header.
- [x] Search/filter: GET `/api/search` (q/author/from/to) + `SearchDialog` with result navigation.

Batch 4 (priority 3):
- [x] Unread counts per channel (`ChannelReadState` + client-side counting from `state.readStates`), sidebar badges (amber when mentioned), auto mark-read on channel view.
- [x] In-app notifications: Topbar bell with mention/comment(on my post)/pinned-notice items, click navigates to source channel (architecture principle 9.5).

Deployment for batches 3-4 (completed 2026-06-10, user approved):
- [x] Migration `20260610150000_add_comment_threads_and_read_state` applied to production.
- [x] Deployed `dpl_9biuBJtMetSJoKqpyskYGgCLZPqB`, health ok/database ok.
- [x] Deploy log: `post-deploy-log-20260610-uiux-batch3-4-threads-search-notifications`.
- [x] Branch pushed to origin (`cfca075`).

Employee UI/UX proposal: ALL priority 1-3 items are now live in production.

## Architecture Phase 1 (2026-06-11, in progress)

Decided: Phase 1 is the main thread; Coupang worker runs in parallel on failure artifacts (see DECISIONS 2026-06-11).

- [x] `lib/core/apiClient.js` extraction (page.jsx fetch util moved).
- [x] `modules/registry.js` + `modules/purchase/index.js` manifest; sidebar 업무 section renders from registry.
- [x] `/work/purchase` dashboard v0 (`modules/purchase/ui/PurchaseDashboard.jsx`): metrics, vendor tasks, drafts, requests.
- [x] Module boundary guardrail: `scripts/check-module-boundaries.mjs` wired into `npm run lint` (verified to catch violations); AGENTS.md module rules added.
- [x] `Branch` + `BranchAssignment` schema in both Prisma schemas; `Channel.branchId` nullable; migration `20260611090000_add_branch_layer` created, NOT applied (needs user approval).
- [x] Branch migration applied to production with 3 seeded branches (강남1호점 `branch-gangnam-1`, 강남2호점 `branch-gangnam-2`, 잠실점 `branch-jamsil`); future branches are added then linked to channels per user decision.
- [x] Phase 1 code deployed: `dpl_2ttnSDBiRsERD2vV7QDVPK8dXXwN`, health ok, `/work/purchase` 200. Deploy log: `post-deploy-log-20260611-phase1-module-registry-branches`.
- [x] Channel-branch linking UI deployed (`dpl_2aFqqchMxHh9JMd3QkGh5Bs1CtxZ`): branch select on channel creation, Topbar branch badge, admin inline branch change (PATCH `/api/channels/:id`). Deploy log: `post-deploy-log-20260611-channel-branch-linking`.
- [x] `/chat/[channelId]` URL routing complete: `WorkspaceShell` (layout-level provider, state persists across navigation) + `ChatView` + `app/(workspace)` route group; `/work/purchase` moved inside the shell. Deployed `dpl_w7vuu8Niz6RERfC3sacYTGBXXyTx`, all routes 200. Deploy log: `post-deploy-log-20260611-phase1-complete-chat-routing`.

**Phase 1 COMPLETE.** Next: Phase 2 — purchase server code into `modules/purchase/server/`, `Message.cardType` card registry, standard agent interface extraction, platform eventBus + metricsRegistry, `/work/inbox` approval inbox.

Notes:
- Image thumbnails already work (`AttachmentList` renders image previews + modal) — only style polish needed.
- Mention matching/autocomplete/highlight already implemented for comments (`lib/mentions.js`, `MentionInput`, `MentionText`); this is an extension, not new build.

## Platform Architecture (2026-06-10)

- [x] Write platform architecture design for chat/work-module separation: `docs/platform-architecture.md`.
- [x] User review and approval of the design direction; doc updated to v2 (UX standards, guardrails, branch insights, metrics registry, agent-bot system plan).
- [x] Record the decision in `DECISIONS.md` (2026-06-10 entry).
- [ ] Resolve remaining open items in `docs/platform-architecture.md` section 16 (phase ordering vs Coupang worker, SWR, sheet-sync target, branch/channel mapping).
- [ ] Start Phase 1: routing skeleton, module registry, ESLint module-boundary rule, Branch/BranchAssignment schema.

## Next Session Priority

- [x] Create Claude handoff document with local paths, GitHub links, project structure, commands, safety rules, and current branch status.
- [ ] Push local commits if the next agent will continue from GitHub instead of this local folder.
- [x] Confirm team-built Agent/Bot framework plan before deeper implementation:
  - [x] app registry lifecycle: draft/review/active/disabled/revoked
  - [x] capability declaration for agents, tools, bots, events, and permissions
  - [x] external webhook/API-token skeleton with hashed secret storage
  - [x] local worker job adapter pattern
  - [x] audit logs for every agent/tool/bot execution
  - [x] admin UX that installs agents first, then shows child bots/tools under each agent
- [x] Production test in `#구매요청`:
  - [x] submit a real bulk purchase request to Purchase Agent
  - [x] confirm `PurchaseOrderDraft` is created
  - [x] edit draft line values
  - [x] approve draft
  - [x] confirm `PurchaseOrderVendorTask` records
  - [x] confirm Coupang URL lines create worker queue tasks
- [ ] Run local purchase worker against production task queue only after confirming worker token and target server.
- [ ] Collect artifacts for any Coupang cart issue before code edits.
- [x] Update `#배포로그` Ideas board after test results.
- [x] Commit today's framework docs, parser fix, and deployment log note if not already committed.

## Purchase Agent

- [x] Fix bulk parser so metadata/title lines before vendor sections are not parsed as unknown items.
- [ ] Add clearer UI for approved draft to vendor task transition.
- [ ] Add vendor task detail view.
- [ ] Add manual handoff state for non-Coupang vendors.
- [ ] Add admin controls for supported vendors per channel.
- [ ] Add structured validation for missing quantity, URL, option, and vendor.
- [ ] Keep vendor bots as Purchase Agent tools, not always-visible channel apps.

## Coupang Worker

- [ ] Stabilize cart row matching.
- [ ] Stabilize quantity correction.
- [ ] Handle existing cart items.
- [ ] Handle duplicate product URLs.
- [ ] Save row-level screenshot and HTML on every quantity failure.
- [ ] Do not continue after quantity mismatch.

## Vendor Bots

- [ ] Define vendor bot adapter interface:
  - [ ] vendor slug
  - [ ] supported automation levels
  - [ ] required credentials
  - [ ] supported input schema
  - [ ] output/result schema
  - [ ] handoff mode
- [ ] Sungwon Adpia bot skeleton.
- [ ] Gmarket handoff skeleton.
- [ ] Hyundai Deco handoff skeleton.
- [ ] Vendor-specific order form model if needed.

## Admin UX

- [ ] Improve Agent/Bot settings panel.
- [ ] Show channel-installed agents compactly.
- [ ] Show connected bots/tools under each agent.
- [ ] Show vendor task status summary.
- [ ] Add team-built app registry view later:
  - [ ] submitted apps
  - [ ] review status
  - [ ] declared permissions
  - [ ] install/disable/revoke controls

## Required Before Ending Any Future Session

- [x] Update `HANDOFF.md`.
- [x] Update `TODO.md`.
- [ ] Update `DECISIONS.md` if a decision changed.
- [ ] Update `BUG_LOG.md` if a bug was found or fixed.
- [x] Run relevant tests or explicitly record why tests were not run.
- [ ] Do not leave sensitive values in docs, logs, or committed files.
