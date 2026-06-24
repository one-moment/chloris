# DECISIONS.md

## 2026-06-23: 댓글 줄바꿈/붙여넣기 지원

- 댓글 작성·수정 입력을 한 줄 input → 여러 줄 textarea로 전환(`MentionInput` `multiline`).
- 댓글 Enter=등록, Shift+Enter=줄바꿈 (채팅과 동일, 한글 조합 중 등록 방지 가드 포함). 수정칸은 Esc=취소.
- 게시글은 기존 정상 동작으로 변경 없음.
- 리치 텍스트(자동 불릿 스타일)는 외부 에디터 필요로 범위 제외(예시는 일반 텍스트로 충족).
- 변경 파일: `components/PostCard.jsx` + `app/globals.css` 버튼 정렬 1줄(`.comment-composer { align-items: end }`).

## 2026-06-17: 헤르메스 3단계 첫 실행 = 예약(방식 (나) 양식 미리채움)

- 첫 실제 업무 = 예약, 방식 = (나) 미리채움. 헤르메스는 `@헤르메스 …예약…`에서 비PII 정보(상품·금액·픽업일시·수령방법·예약경로)를
  뽑아 예약 양식을 미리 채운 링크만 안내한다. **실제 생성은 사람이 양식 제출 → 기존 `POST /api/work/crm/reservations`.**
  헤르메스는 DB에 직접 쓰지 않는다(직접 생성은 이후 단계). 승인·결제·마이그레이션 없음.
- **PII**: 성함·연락처는 절대 URL/링크에 넣지 않고 추출도 안 한다(URL 로그 위험 — AGENTS.md). 미리채움은 비PII만. 성함·연락처는 사람이 양식의 고객검색으로 입력.
- 미리채움 전달은 **props**(서버 `page.jsx`가 searchParams 읽어 `ReservationsDashboard`→`ReservationForm` 전달; 기존 channel/branch 흐름과 동일, useSearchParams 미사용). 폼은 prefill 없으면 기존 동작 그대로(순수 추가).
- `pickupAt`은 오프셋 없는 로컬 `YYYY-MM-DDTHH:mm`(datetime-local 직결, TZ drift 방지). 키없음/실패는 2단계 링크(또는 help)로 degrade.

## 2026-06-17: 헤르메스 2단계 — 두뇌 스위치 + "이건 ○○ 업무" 분류·안내

- 두뇌(LLM)는 공급사 교체 가능한 얇은 '스위치'(`lib/agents/llm/index.js` `classifyJson`, `AGENT_LLM_PROVIDER`)로 두고
  **시작 공급사는 OpenAI**(기존 `lib/agents/openaiClient.js` `classifyAgentIntent` 재사용). 다른 어댑터는 자리만(미구현).
- `@헤르메스 …말…` → purchase/reservation/stockin/disposal/other로 1회 분류 → `WORK_ROUTES`로 해당 `/work/*`
  바로가기 안내까지. **실제 실행·승인(ApprovalRequest)·업무데이터 변경은 없다(=3단계).** 메시지 게시만.
- **degrade(확정)**: 키 없음·파싱 실패·OpenAI API/네트워크 오류 등 **어떤 실패든 1단계 안내(HERMES_HELP_LINES)로
  안전 degrade**하고 AgentRun은 completed 유지(failed로 떨구지 않음). → 키 없이도 병합·테스트·머지 안전.
- 라우팅 게이팅은 `lib/brand`의 `isModuleEnabled(moduleSlug)`로만. **헤르메스(lib/)는 `modules/`를 import하지 않는다**
  (core/modules 분리). 슬러그: purchase/reservations/stockin/disposal(보로 전부 enabled).
- 비용·지연 통제: 두뇌 호출은 `@헤르메스` 멘션일 때만·멘션당 1회. DB 통합/실 OpenAI 호출 검증은 사람 게이트(루프 미실행).

## 2026-06-17: 헤르메스 1단계 — 게이트웨이 분배 + 안내 응답(동작 변경 없음)

- 헤르메스 = 단일 안내데스크 에이전트(A안). `lib/agents/hermes/{prompts,service}.js` 신설(`purchaseAgent` 패턴 미러링).
- 게이트웨이(`lib/agentGateway/service.js`)는 `@헤르메스`일 때만 `runHermesAgent`로 분배하고, 미설치/비멘션이면
  `handled:false`로 기존 구매 경로를 그대로 통과한다 → **구매 동작 불변.** missing-table degrade(try/catch) 유지.
- 1단계는 두뇌(LLM)·도구·승인(ApprovalRequest)·업무데이터 변경이 **없다** — 채널 안내 메시지 게시 +
  `AgentRun`(running→completed) 기록만. 실패 시 `AgentRun` failed.
- 등록은 시험 한정(`scripts/test-agent-layer.mjs`의 `seedAgentLayer` upsert + `enableChannelAgent`)이며 운영 자동
  시드는 없다(구매 에이전트와 동일). 운영 DB 마이그레이션 불필요(기존 `AgentApp`/`AgentRun`/`ChannelAgentInstallation` 재사용).
- 정본 스펙: `HERMES_STAGE1_PLAN.md`. 독립 구매 에이전트 껍데기·`@구매에이전트` 멘션 정리는 헤르메스 안정화 후 별도 단계.

## 2026-06-16: 예약 → 구글시트 연동 자격증명/env 설계 (CRM Phase 3 Part B)

- 공용 Sheets 헬퍼 `lib/googleSheets.js`를 두고 CRM이 사용한다(인벤토리 `lib/inventorySheetSync.js`는
  당장 리팩터하지 않음 — 범위 최소화; 추후 공용 헬퍼로 통합 가능). PROMPT의 "small shared Sheets helper" 충족.
- 자격증명 해석 우선순위: **① `GOOGLE_APPLICATION_CREDENTIALS`(서비스계정 JSON 파일 경로, 로컬/표준)**,
  없으면 **② 인라인 `GOOGLE_SA_CLIENT_EMAIL`+`GOOGLE_SA_PRIVATE_KEY`(Vercel 등 파일 없는 환경)**. 둘 다 없으면
  no-op. 운영(Vercel)은 파일경로가 비현실적이라 인라인 env 권장.
- 게이트: `isReservationSheetConfigured()` = `CRM_RESERVATION_SHEET_ID` 있고 자격증명 있을 때만 활성. 기본 비활성.
- 시트 탭 기본 "예약"(`CRM_RESERVATION_SHEET_TAB`로 변경 가능). 실제 사용자 시트는 현재 탭 "시트1" → 사람이 정리.
- 베스트-에포트: 예약 POST에서 시트 append는 try/catch로 감싸 실패해도 201 유지. 에러 로그에 PII 미기록.
- **보안**: 키는 레포에 저장/커밋 금지(`.gitignore`가 `boro-reservation-*.json`·`.env` 이미 차단). `.env`에는 키
  **경로**만(내용 아님). 대화로 평문 공유된 키는 검증 후 **회전 권장**.

## 2026-06-16: `mentionActions` 매니페스트 컨트랙트 (CRM Phase 3, @예약 v2)

- 코어 작성기에서 `@예약` 같은 **액션형 멘션**을 트리거하되 동작은 모듈이 소유하도록, 모듈 매니페스트에
  `mentionActions: [{ token, label, minRole?, requiresBranch?, hrefFor(channel) }]` 컨트랙트를 둔다
  (`docs/crm-reservation-mention.md` 해법 A, 2026-06-15 사용자 확정).
- 코어는 `modules/registry.js`의 `getMentionActions(currentUser, channel)`로 **데이터만** 읽고, 선택 시
  텍스트 삽입 대신 `href` 딥링크로 라우팅한다. 코어는 `modules/`를 직접 import하지 않는다(경계 유지).
  코어→registry import는 기존 허용 패턴(`ProjectSidebar`의 `getWorkNavItems`).
- AGENTS.md "매니페스트 컨트랙트 필드는 2개 이상 모듈이 필요할 때만 추가" 가이드와의 긴장: 지금은
  reservations 모듈만 사용하지만, 이 필드는 reservations 전용이 아니라 **에이전트-멘션 오픈 플랫폼**
  (`docs/platform-architecture.md` 9·12절)의 범용 확장점으로 설계됐다(향후 @구매/@입고 등 에이전트 멘션이
  동일 컨트랙트 사용). OBJECTIVE(`ralph/PROMPT.md`)가 이 컨트랙트를 명시 지시하므로 채택.



- `Customer` and `Reservation` modeled per `docs/templates-and-crm.md`. Loosely coupled like
  `PostTemplate`: scalar id fields, **no Prisma `@relation` / no FK constraints**, indexes only.
  Rationale: keeps the table deploy-safe before the migration is applied (app degrades when
  tables are absent) and avoids editing existing models (Branch/Channel) with back-relations.
- `Customer.phone` is `@unique` (chain-wide identity key) so the reservation form can
  `upsert` by phone (spec requires upsert-by-phone). One Customer per phone across all branches.
- `Reservation.amount` is `Int` (KRW, no decimals). `status` defaults to `예약접수`.
  `reservedAt` defaults to now(); `pickupAt` required. Spec-optional fields (`channelId`,
  `postId`, `note`, `homeBranchId`, `memo`, `createdById`) are nullable.
- Migration `20260615103000_add_crm_module` hand-written (additive CREATE TABLE, no FK),
  **NOT applied to any production DB** — `.env DATABASE_URL` points at Boro prod, so no
  `prisma migrate`/`db push` was run; apply is deferred to explicit user approval (AGENTS.md).

## 2026-06-11 (night): Multi-company split & Borough theme

- The product serves three companies as internal tools: 원모먼트(online flower delivery), 보로플라워마켓(offline franchise flower shop), 오늘꽃(online flower wholesale + large-venue supply). Shared base = chat + board (게시판); each company gets custom modules per its work.
- Tool category name: PENDING user decision. Proposal recorded in TODO (platform codename Chloris as the engine; per-company branded instances, e.g. "Borough Workspace"). Category descriptor candidates: 사내 업무 OS / 워크스페이스 / 협업·자동화 플랫폼.
- Separation approach (recommended): ONE shared core codebase; per-company differs by (a) brand theme (CSS token set) and (b) enabled modules. This avoids triple-maintaining the chat/board base. Concrete forking/repo strategy still to be decided (multi-tenant single deploy vs. per-company deploy from shared core vs. forks).
- Design: applied the Borough Flower Market design system to the current tool (= the 보로플라워마켓 instance; its branches 강남1/강남2/잠실 match the design system's store list). Implemented as token remap in `styles.css` (forest green #185640 + sage gold #D5CD8C + warm paper #F7F4EA + serif fonts) + brand chrome in `app/globals.css` (green sidebar, serif titles, gold focus, card accent strip) + logo assets in `public/brand/`. Tokens kept under existing semantic variable names so the whole app re-skins and so other companies' themes can swap the same names later.

## 2026-06-11 (evening): Templates, CRM & Reservations

- Brand is 보로플라워 (multi-branch flower shop). Branches confirmed: 강남1호점, 강남2호점, 잠실점 (already seeded; no rename). Future branches added as Branch records (e.g. 성수역점) with no screen/code change.
- Customer is CHAIN-WIDE: one Customer per phone number across all branches. Cross-branch visits share order context so any branch can serve a 보로플라워 customer with full history (brand value). This overrides the earlier branch-scoped customer visibility idea.
- PII balance: customer + order history visible chain-wide to authenticated staff; phone masked in bulk lists/exports, full when actively serving; HQ unrestricted; never log/commit customer data.
- Templates ≠ forms (separate mechanisms, developed independently): TEMPLATES are free-text post helpers (구매요청·인계사항·공지) → output is a plain post, no structured capture, general/core. FORMS are typed-field data entry (예약/주문) → save a system record, module-owned, with validation/customer-lookup/status. Reservation input is a dedicated FORM (not a template) writing to the reservation system.
- Template system (feature 1): user/admin-authored reusable text templates (`PostTemplate`, scope personal|shared), insert-time tokens `{{지점}}/{{오늘}}/{{작성자}}`. Lives in CORE (composer), not a module. Ships independently of CRM.
- CRM + Reservations (feature 2): internal module `modules/crm`; `Customer` (phone key) + `Reservation` (= spreadsheet row); routes `/work/customers`, `/work/reservations` (list + pickup calendar + per-branch + HQ rollup). The existing Google Sheet is the model; columns map 1:1 (see doc). Order/reservation history is created from 주문서 post submissions (the template↔CRM loop) and feeds 지점 인사이트 metrics.
- External shopping-mall sync is optional/later via integration bot, not required.
- Build order: ① template system → ② CRM core → ③ connect (submit→record, composer lookup) → ④ metrics → ⑤ optional mall sync.
- Full spec: `docs/templates-and-crm.md`.

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
