# TODO.md

## CRM Phase 2 follow-ups — isolated worktree `feature/crm-followups` (2026-06-15)

CRM core shipped+deployed. This worktree (base `6bcc162`) is separate from the inventory loop
(`feature/purchase-bot-mvp`). OBJECTIVE in `ralph/PROMPT.md`. One bounded step/iteration.

- [x] (P2-1) 고객 쓰기 API: `POST /api/work/crm/customers` (생성, 전화 unique→409) +
  `PATCH /api/work/crm/customers/[customerId]` (부분 수정). Auth+brand guard+503 degrade. Lint+build pass.
- [x] (P2-2) 고객 수동 입력/수정 폼 UI on `/work/customers`: 헤더 "+ 새 고객" 생성 폼 + 선택 고객 "수정" 폼(공용 `CustomerForm`), 홈지점 select(예약 API의 branches), 제출 → POST/PATCH → 검색 갱신. Lint+build pass.
- [x] (P2-3) 픽업 캘린더 뷰 on `/work/reservations`: 목록/캘린더 토글 + 월 그리드(픽업일 버킷, 일별 예약 칩 최대 3 + "+N", 오늘 강조, 월 이동). New CSS `.work-cal-*`. Lint+build pass.
- [~] (P2-4) 지표 → 지점 인사이트.
  - [x] (P2-4a) 집계 API `GET /api/work/crm/metrics`: 총 예약건수·매출·고객수·재방문율 + byBranch(건수/매출) + sourceMix. groupBy 집계, 인증+브랜드 가드+테이블 부재 0값 degrade. Lint+build pass.
  - [x] (P2-4b) 지점 인사이트 UI: `/work/reservations` "인사이트" 뷰(목록/캘린더/인사이트 토글) — 요약지표(총건수·매출·고객수·재방문율) + 지점별 표 + 경로비중 표. metrics API 소비. Lint+build pass.
  - NOTE: 플랫폼 제네릭 `metricsRegistry`는 미구현이라 지점 인사이트를 **모듈 로컬 집계**로 구현(범위 최소). 레지스트리 생기면 이관. (플랫폼 TODO 유지)
- **Ralph 루프 Phase 2 OBJECTIVE 완료** (2026-06-15, 격리 워크트리 feature/crm-followups, 5 iterations): 고객 수동입력/수정 ✓ · 픽업 캘린더 ✓ · 지점 인사이트 ✓. 전부 lint+build green. 운영 미배포(코드만, 새 마이그레이션 없음). 커밋 로컬.
- [~] `@예약` #지점방 진입 v1 (버튼) — 설계 확정(`docs/crm-reservation-mention.md`), OBJECTIVE = `ralph/PROMPT.md`. 진행 중:
  - [x] (v1-1) 예약 폼 분리: `modules/crm/ui/ReservationForm.jsx`(props: branches/fixedBranchId/channelId/onSubmitted/onCancel); `/work/reservations`가 사용. 무동작-변경. lint+build pass.
  - [x] (v1-2) `/work/reservations` 딥링크: page가 `?new=1&channel=&branch=` 읽어(async searchParams) ReservationsDashboard에 initialNew/initialChannelId/initialBranchId 전달 → 폼 자동 오픈(지점 고정+channelId). Lint+build pass(라우트 dynamic).
  - [x] (v1-3) 코어 "예약" 버튼: `components/Topbar.jsx` 채널 헤더에 branchId 연결 채널 + 예약 모듈 활성 시 `next/link` → `/work/reservations?new=1&channel=&branch=`. 코어→모듈 import 없음(lib/brand만). 모듈 경계 lint + build pass.
  - [ ] (v1-4) 제출 후 #지점방 요약 카드(선택, 켬) → v1 완료 시 RALPH-DONE. — next
- 보류(입력 필요): 20개월 시트 import — 지점 매핑은 받음(1호점/2호점/3호점 → 강남1/강남2/잠실, 23년7월~ 월별 탭). 남은 것: 시트 접근수단(Sheets API 키 or CSV) + 운영 import 승인. (사용자: 시트키 전달 예정)

## Multi-company split & branding (2026-06-11, night)

Product serves 3 companies (internal tools): 원모먼트(online delivery), 보로플라워마켓(offline franchise), 오늘꽃(wholesale + venue supply). Shared base = chat + board; custom modules per company.

- [x] Naming confirmed: "Chloris(사내 Work OS) → 회사별 브랜딩 워크스페이스."
- [x] Separation strategy confirmed: ONE repo → 3 Vercel projects (onemoment/borough/todaykkot) by `NEXT_PUBLIC_BRAND`, SEPARATE Supabase per company. Runbook: `docs/multi-company-split.md`.
- [x] Code groundwork done: `lib/brand.js` (brand config + module gating), `modules/registry.js` brand-filtered, `app/layout.jsx` data-brand + workspace name, `.env.example` NEXT_PUBLIC_BRAND. CRM/reservations marked Borough-only; purchase shared. Lint+build pass.
- [ ] INFRA (user/ops): Borough = reuse current deploy+DB (relabel). 원모먼트/오늘꽃 = new Supabase + new Vercel project (same repo) + env (`NEXT_PUBLIC_BRAND`, `DATABASE_URL`, `DIRECT_URL`) + `prisma migrate deploy` on each fresh DB + domains. Can assist running migrations once DB URLs are provided.
- [~] Borough feature build started (track A first; infra split deferred by user):
  - [x] TEMPLATE system (core, all brands): `PostTemplate` schema + migration `20260614120000_add_post_templates` (NOT applied to prod — needs approval), API `/api/post-templates` (+ `[templateId]`), token helper `lib/postTemplates.js` ({{지점}}/{{오늘}}/{{작성자}}), `TemplatePicker` in post composer, `TemplateManagerDialog` (create/edit/delete; personal=anyone, shared=admin). GET degrades to [] if table missing, so code is deploy-safe pre-migration. Lint+build+tests pass.
  - [x] Applied `20260614120000_add_post_templates` to Boro prod DB + deployed.
  - [~] CRM + reservations (Borough-only modules) per `docs/templates-and-crm.md` — IN PROGRESS (Ralph loop).
    - [x] (1a) Data model: `Customer` (phone `@unique` = chain-wide key) + `Reservation` (spreadsheet-row successor) added to both Prisma schemas; migration `20260615103000_add_crm_module` created (NOT applied to prod — needs approval). No FK (PostTemplate convention → deploy-safe pre-migration). `prisma validate`+`generate`+lint pass.
    - [x] (1b) Module skeleton: `modules/crm/` manifests (`crmModule` slug crm → `/work/customers`, `reservationsModule` slug reservations → `/work/reservations`) + stub dashboards (`ui/CustomersDashboard`, `ui/ReservationsDashboard`), registered in `modules/registry.js`; route pages `app/(workspace)/work/customers|reservations/page.jsx` with `isModuleEnabled` guard (brand gating via `lib/brand.js`). Lint + `next build` pass (both routes compile).
    - [x] (2) Lookup API `GET /api/work/crm/customers?q=` (name/phone → customer + reservationCount/totalAmount + recentReservations). Auth + brand guard + missing-table degrade-to-empty (deploy-safe pre-migration). `app/api/work/crm/customers/route.js`. Lint + build pass.
    - [x] (3a) `/work/customers` screen: debounced 이름/전화 검색 → 고객 카드(단골 배지 ≥2건, 누적건수·금액) → 클릭 시 최근 예약 이력 테이블. Consumes lookup API. New CSS `.work-list/.work-list-row/.work-badge`. Lint+build pass.
    - [x] (3b-api) 예약 목록 API `GET /api/work/crm/reservations` (branchId/status/from/to 필터) → 예약 + 고객명/지점명 매핑 + branches 목록. Auth + brand guard + degrade. `app/api/work/crm/reservations/route.js`. Lint+build pass.
    - [x] (3b) `/work/reservations` screen: 지점·상태 필터 + 요약지표(건수/합계금액) + 픽업일순 예약 테이블(고객·지점·상품·금액·경로·상태). API 소비. New CSS `.work-filter-row`. Lint+build pass. (픽업 캘린더 뷰는 후속 (6)으로 분리.)
    - [x] (4-api) 예약 생성 POST `POST /api/work/crm/reservations`: 필드 검증 → 전화번호로 Customer upsert + Reservation 생성. 결제/외부주문 없음(레코드 생성만), 고객데이터 로그/커밋 금지. 테이블 부재 시 503. Lint+build pass.
    - [x] (4) 예약 입력 폼 UI: `/work/reservations`의 "새 예약" 폼 — 성함/연락처/지점/예약일/픽업일시/상품/금액/경로/수령방법/비고, 타입 검증, 고객조회 자동완성(전화·이름 디바운스 → 기존 고객 클릭 채움), 제출 → POST → 목록 reload. New CSS `.work-header-actions`. Lint+build pass.
    - **Ralph 루프 OBJECTIVE(보로 CRM+예약 모듈) 완료** (2026-06-15, 8 iterations). 코어 조회/등록 플로우 end-to-end 구현·feature 브랜치 커밋. 운영 미배포·마이그레이션 미적용.
    - [ ] (5, OBJECTIVE 범위 밖 — 후속) 고객 수동 입력/수정, 픽업 캘린더 뷰, `@예약` 채널 진입, 지표 → 지점 인사이트, 20개월 시트 import(지점 귀속 미결).
    - [x] 운영 적용·배포 (2026-06-15, 사용자 승인): 마이그레이션 `20260615103000_add_crm_module` 보로 운영 DB(ref rodzysyxieneykcuokwh) 적용 완료(`migrate deploy`, "up to date") + Vercel 운영 배포 `dpl_4kuqaGPSdpkomjt7VhwAqifUSvsc`(READY, mattermost-project-mvp.vercel.app). 헬스 ok/database ok, 새 CRM API 미인증 401, /work/customers·/work/reservations 200.
    - [ ] (사람/앱) #배포로그 Ideas 게시(배포봇 명의, `post-deploy-log-20260615-crm-module`) — 운영 DB 쓰기라 자동화 보류, 앱 또는 승인 후 진행.
    - [ ] (3c) 고객 수동 입력/수정(`/work/customers`) — manual entry.
    - [ ] (4) Reservation form ("새 예약" + `@예약`), submit → Customer upsert + Reservation create.
    - [ ] (5) Metrics → 지점 인사이트.

## Deployed 2026-06-14: Borough design 2nd pass + templates + mention nav

- Combined deploy `dpl_7kUQ3YMhfM8yxtsqtZ64cvUA4WyJ` (health ok / database ok). Deploy log: `post-deploy-log-20260614-borough-design-templates-mention`.
- Verified DATABASE_URL = Boro 운영 (postgres.rodzysyxieneykcuokwh, ap-northeast-2) before migrate deploy.
- Includes: Borough design 2nd pass (style-only — status tokens/chips, card spacing; rail/drawer/Lucide deferred), mention keyboard nav (ddf4696), channel-scoped post templates.
- Design source vendored at `docs/design/borough/`. Structural "완성 디자인" (rail/off-canvas drawer/Lucide) = separate future batch (scope decision: style-only).

## Deferred / next

- [x] Image upload compression implemented + DEPLOYED (`dpl_2VWU3YBPBchdKTNu1uKbcPL1CcxJ`, health ok). Zero-dep canvas (`lib/imageCompress.js`): images only, 2000px/JPEG 0.82, EXIF-safe, HEIC fallback, inline + S3. Deploy log `post-deploy-log-20260614-image-compression-recovery`.
  - NOTE: Vercel team account hit "fair use" (commercial-use) block → prod briefly down ("Payment required"); resolved by account fix, redeployed. Paid Vercel plan needed (esp. for the 3-company split).
- [x] Borough S3 transition COMPLETE (2026-06-15): Supabase Storage bucket `boro-uploads` (public) + Vercel Production env (STORAGE_PROVIDER=s3, S3_BUCKET/REGION/ENDPOINT/FORCE_PATH_STYLE/PUBLIC_BASE_URL, AWS keys). Verified: new uploads → `…/object/public/boro-uploads/…` (S3), existing inline still works. Gotcha resolved: S3_ENDPOINT was Preview-only → added Production. Endpoint host = `<ref>.storage.supabase.co/storage/v1/s3`; public = `<ref>.supabase.co/storage/v1/object/public/boro-uploads`.
- [ ] Structural design batch: green rail + mobile off-canvas drawer + Lucide icons (from `docs/design/borough/borough.css`).
- [x] Planning overview `chloris-기획정리.md` received from 기획(Claude) and added at repo root (index validated — all referenced canonical docs exist; section 5 progress refreshed to the 2026-06-14 deploy).
- [ ] Later: 원모먼트/오늘꽃 themes (data-brand scoped) + their custom modules when requirements are defined.
- [x] Applied Borough Flower Market design system to the current tool (= 보로플라워마켓 instance) and DEPLOYED `dpl_PeJfjSLHucdqEEJhAr1ubKaJtd1T` (health ok, logo 200, deploy log `post-deploy-log-20260614-borough-design-system`). Token remap in `styles.css` (green/gold/paper/serif), brand chrome in `app/globals.css`, logos in `public/brand/`.
- [x] Naming confirmed: "Chloris(사내 Work OS) → 회사별 브랜딩 워크스페이스" (companies: 원모먼트/보로플라워마켓/오늘꽃).
- [ ] Stage 2 polish (optional): full green rail, per-component fine-tuning to Borough component specs, serif on editorial surfaces, dark-mode parity if needed.
- [ ] When splitting: extract Borough tokens into a theme file (e.g. `themes/borough.css`) and add 원모먼트/오늘꽃 themes; gate modules per company.

## New Requests (2026-06-11, evening)

Employee feature request + one UX fix:

- [x] Mention keyboard navigation: arrow keys (↑↓) move the highlight, Enter/Tab selects, Esc closes; IME-safe (no intercept mid-composition) and does not trigger message send while the popover is open. `components/MentionInput.jsx`. Verified lint+build. NOT yet deployed.
CLARIFIED 2026-06-11: (1) and (2) form one loop — template = input form, CRM = the store the form reads (lookup) and writes (on submit).

- [ ] (1) Template SYSTEM (user clarified: users AND admins author reusable templates, load to reduce repetitive entry — max freedom). Core communication feature (lives in core, not a work module).
  - Data: `PostTemplate { id, name, body, scope (personal|shared), ownerId, createdById, timestamps }`. Personal = visible to owner; shared = admin-managed, visible to all.
  - Tokens resolved at insert: `{{지점}}` (from channel's linked Branch), `{{오늘}}`, `{{작성자}}`.
  - UX: composer "템플릿" picker (shared first, then mine) fills title(line 1)+body; "템플릿 관리" modal to author/edit. Permissions: anyone creates personal; admin creates/edits shared.
  - API: GET/POST/PATCH/DELETE `/api/post-templates`. Additive table → migration created locally, prod apply needs approval.
- [ ] (2) CRM module (user clarified: online customer management — look up returning customers by name/phone, pull past order history). Internal module `modules/crm`, route `/work/customers`.
  - Data: `Customer { id, name, phone(idx), branchId?, memo, timestamps }`, `Order { id, customerId, branchId?, channelId?, postId?, orderNo, items, amount, pickupAt, source, status, timestamps }`. Customer 1—N Order.
  - Lookup: GET `/api/work/crm/customers?q=` (name or phone) → matches + recent orders. Composer calls this API (no core→module import; boundary kept).
  - The loop: 주문서 template submit → upsert Customer by phone + create Order linked to the post → next visit, name/phone lookup autofills → history accrues → feeds 지점 인사이트 metrics later.
  - PII: phone is sensitive — branch-scoped visibility (staff=own branch, manager/HQ=all); never log/commit customer data (AGENTS.md).
  - External shopping-mall sync (Cafe24/imweb 등) = optional later step via integration bot, NOT required for this ask.
- Proposed build order: ① template system (independent, ships now) → ② CRM core (tables + /work/customers search/profile/manual entry) → ③ connect (composer lookup autofill + create-order-on-submit) → ④ optional mall sync.
- RESOLVED 2026-06-11 (evening): decisions locked, spec written → `docs/templates-and-crm.md` + DECISIONS entry. Brand 보로플라워; branches 강남1호점/강남2호점/잠실점 (no rename, future e.g. 성수역점); customer chain-wide by phone (cross-branch context). Existing 20-month sheet → one-time import (branchId for those rows still TBD).
- REFINED 2026-06-11: templates ≠ forms, built as two independent tracks.
  - Track A — TEMPLATE system (core, general): free-text post helpers for 구매요청/인계사항/공지 etc. Output = plain post. `PostTemplate` scope personal|shared + tokens. Ships standalone, first.
  - Track B — CRM + RESERVATION (module): reservation input is a DEDICATED FORM (typed fields, validation, customer lookup) writing Customer+Reservation — NOT a template. Form reachable from /work/reservations "새 예약" and #지점방 @예약.
- Mention keyboard nav: committed (`ddf4696`), NOT deployed — decide deploy timing (standalone or with first template/CRM batch).

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

## Usage Model Rethink (2026-06-11 user feedback, discuss next session)

User feedback after experiencing Phase 1 in production:
1. Channel explosion risk: channels are currently per-task (구매요청, 입고...), so tasks × branches multiplies channel count.
2. `/work/*` screens are status-only; for real ERP use they must be operating consoles.
3. Overall usage must be simpler and more intuitive; concept definitions feel unclear.

Proposed direction (pending user decision):
- [ ] Invert the channel axis: channel = branch room (지점방, 1 per branch like a KakaoTalk room), task = agent mention (@구매/@입고/@폐기 in the same room). Channel count grows +1 per branch, not ×tasks. Enablers already shipped: channel-branch link, ChannelAgentInstallation; Phase 2 registry dispatch makes multi-agent-per-channel real. Existing per-task channels would be consolidated after Phase 2.
- [ ] Revise principle 9.3: field staff input via chat; managers may BOTH input and process in dashboards (add create-forms to work screens).
- [ ] Redefine work-screen standard as action-first: metrics → action queue (approve/process buttons) → list with row actions → create new. `/work/inbox` is the centerpiece.
- [ ] Intuitiveness quick wins: pinned usage-guide post per channel (pin shipped), agent 도움말 command, quick agent-mention chips in message composer.
- [ ] After decision: update `docs/platform-architecture.md` + `DECISIONS.md`, plan channel consolidation migration.

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
