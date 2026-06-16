# HANDOFF.md

## ▶ CRM Phase 3 — 배포 라인 머지 완료 (2026-06-16)

**상태: 코드 완료 + 배포 라인 머지·푸시됨.** `feature/crm-phase3`(A-1 `f22c580` / B `d864ee0` / A-2 `39f3bd8`
/ A-3 `48b4552`) → `feature/purchase-bot-mvp` 머지(`7d8c483`, --no-ff) → origin 푸시(`b859630..7d8c483`).
새 마이그레이션 없음. lint(모듈 경계 ok)+build+agent-gateway+purchase-bot test 통과.

구글시트 준비 완료(현재 키로): 탭 `시트1`→`예약` 리네임, 헤더행(예약일·픽업일시·지점·고객명·연락처·상품·금액·경로·
수령방법·상태·비고·예약ID) 기록, **라이브 append 테스트 1행(A2, 가짜데이터 "삭제 가능")** 성공 → 쓰기 경로 검증됨.

**남은 사람 작업(ops):**
- **배포**: 코드는 푸시됨. Vercel CLI 미설치 → 대시보드/CLI로 prod 배포 트리거·헬스 확인 필요.
- **Vercel env(prod)**: `CRM_RESERVATION_SHEET_ID=1iP-4du5-e-MGsAgjah1aQhVWwt4mAmn6G05eE4zs2IA`,
  `CRM_RESERVATION_SHEET_TAB=예약`, 인라인 `GOOGLE_SA_CLIENT_EMAIL`/`GOOGLE_SA_PRIVATE_KEY`(파일경로 아님) → redeploy.
- ⚠️ **SA 키 회전**: 대화에 평문 공유된 키(`35b7bbab…`) 폐기 + 새 키 발급 → 새 키로 Vercel env 설정(시트 공유는
  SA 이메일 동일이라 재공유 불필요). 회전 먼저 → 새 키로 env, 권장.
- 시트 테스트행(A2) 삭제는 사용자 재량.

---

### (참고) 원래 OBJECTIVE — `ralph/PROMPT.md`:
- **Part A — `@예약` v2 액션-멘션**: 코어 `components/MentionInput.jsx`를 모듈 선언 액션-멘션으로 확장
  (매니페스트 컨트랙트, 코어→모듈 import 금지). 선택 시 텍스트 삽입 대신 `/work/reservations?new=1&channel=&branch=`
  딥링크. @유저 멘션 회귀 금지. 설계 = `docs/crm-reservation-mention.md` 해법 A. v1 버튼은 검증 전까지 유지.
- **Part B — 예약→구글시트 append (코드만, env 미설정 시 no-op)**: `POST /api/work/crm/reservations` 최종제출 시
  새 시트에 한 줄 append(서비스계정 JWT + Sheets API v4). 베스트-에포트. 키 커밋 금지, 운영 연결은 사용자 ops.

**새 대화에서 재개 방법**: 이 워크트리에 들어가서(`EnterWorktree` path `.claude/worktrees/crm-phase3`) `/loop`로
`ralph/PROMPT.md` 따라 진행. (메인/다른 브랜치는 건드리지 말 것 — 한 워크트리=한 루프.)

**사용자 ops 선행(Part B 활성화용)**: ① CRM 예약용 새 구글시트 생성 ② 서비스계정
`boro-reservation@boro-reservation.iam.gserviceaccount.com`에 편집자 공유 ③ Vercel 운영 env에 키+시트ID.

**현재 운영(prod)**: 인벤토리 + CRM Phase 2(캘린더·인사이트·폼) + @예약 v1(버튼) + import 데이터(고객 2,810/예약 3,122) 라이브.

### Phase 3 진행 로그 (Ralph loop, `feature/crm-phase3`)
- iter 1 (done, **Part A-1** 매니페스트 컨트랙트): `modules/crm/index.js` `reservationsModule.mentionActions`
  추가([{token:"예약", label, minRole:"member", requiresBranch:true, hrefFor(channel)→
  `/work/reservations?new=1&channel=<id>&branch=<branchId>`}]) + `modules/registry.js`
  `getMentionActions(currentUser, channel)` 셀렉터(role 필터 + requiresBranch면 channel.branchId 필요,
  href 없는 항목 제외; `modules`는 이미 brand 게이팅됨). 코어→registry는 기존 허용 패턴(ProjectSidebar의
  `getWorkNavItems`와 동일). 코어는 modules/를 import하지 않고 데이터만 읽음. **소비처 아직 없음 → 무회귀.**
  `npm run lint`(모듈 경계 ok) + `next build`(라우트 변화 없음) 통과. 다음: A-2(MentionInput 확장).
- iter 2 (done, **Part B** 예약→구글시트 연동, 코드+라이브 자격증명 검증):
  - `lib/googleSheets.js` (공용 SA Sheets 헬퍼): 자격증명 해석 = `GOOGLE_APPLICATION_CREDENTIALS`(JSON 파일경로)
    우선, 없으면 인라인 `GOOGLE_SA_CLIENT_EMAIL`+`GOOGLE_SA_PRIVATE_KEY`(Vercel용). `getAccessToken`(JWT RS256)/
    `appendSheetRows`/`getSpreadsheetMeta`. `lib/crmReservationSheetSync.js`: `isReservationSheetConfigured`
    (`CRM_RESERVATION_SHEET_ID`+자격증명 있어야 활성), `reservationSheetRow`(12열 순수 매핑), `syncReservation`
    (미설정 시 no-op). `POST /api/work/crm/reservations`에 try/catch 비치명적 배선(실패해도 201; branch.name select 추가).
  - **사용자 제공 ops 자격증명 검증(읽기전용, 쓰기 없음)**: SA 키(`boro-reservation@boro-reservation.iam.gserviceaccount.com`)
    + 시트ID로 token 200 + `spreadsheets.get` 200 → 키 유효 + SA가 시트에 공유됨 확인. 시트 제목 "[보로] CRM 예약 관리",
    현재 탭 = "시트1"(코드 기본 탭 "예약" — 불일치). `lint`+`build` 통과. 키는 레포에 저장 안 함(`.env`는 키 **경로**만,
    gitignored; 키 파일은 Downloads). **커밋에 키/시트값 미포함.**
  - 남은 사람 작업: ① **라이브 append 테스트 승인**(운영 시트에 실제 1행) ② 탭 정리("시트1"→"예약" 또는
    `CRM_RESERVATION_SHEET_TAB=시트1`)+헤더행 ③ **키 회전 권장**(대화에 평문 공유됨) ④ 운영(Vercel) env 주입
    (`CRM_RESERVATION_SHEET_ID` + 인라인 `GOOGLE_SA_*`)+redeploy. 다음 코드 단계: A-2(MentionInput 확장).

> ⚠️ 루프 운영 주의(검증됨): **새 턴마다 Bash 셸 cwd가 메인 레포(`…/mattermost`, `feature/purchase-bot-mvp`)로
> 초기화**된다(EnterWorktree no-op 이후/턴 경계). 워크트리 작업은 매 Bash 명령에서 `cd .claude/worktrees/crm-phase3`
> (또는 `git -C`/절대경로) 필수. 메인 `.env`=운영 Postgres / 워크트리 `.env`=sqlite 더미. 워크트리에서 DB 쓰기 안전,
> 메인에서는 절대 DB 쓰기/커밋 금지. A-1·B 작업은 모두 워크트리(`feature/crm-phase3`)에 커밋됨(메인 clean 확인).
- iter 3 (done, **Part A-2** 코어 MentionInput 확장, 커밋 `39f3bd8`): `mentionActions` prop + `onAction(action)` 콜백,
  `filterMentionActions` + 통합 `items`(액션 상단→유저)로 방향키/Enter/Tab 내비, 액션 선택 시 텍스트 삽입 대신
  `clearActiveMention`+`onAction` 위임. 기존 호출부 무회귀, IME 가드 불변, `.mention-action` CSS. lint+build pass.
- iter 4 (done, **Part A-3** 채널 작성기 배선, OBJECTIVE 완료): `components/MessagesView.jsx`에 `useRouter` +
  `getMentionActions(currentUser, channel)`(registry 경유 — 코어→모듈 import 아님) → 메시지 작성기 `MentionInput`에
  `mentionActions` 전달 + `onAction=(action)=>router.push(action.href)`. 채널 `branchId` 없으면 액션 미노출
  (`requiresBranch` 필터). v1 "예약" 진입(=`components/Topbar.jsx`의 링크)은 그대로 유지. @유저 멘션 무회귀.
  `npm run lint`(모듈 경계 ok)+`next build`+`agent-gateway:test`+`purchase-bot:test` 통과.

> **✅ CRM Phase 3 OBJECTIVE 완료 (2026-06-16, Ralph loop 4 iter, `feature/crm-phase3`).** Part A(@예약 v2
> 액션-멘션) + Part B(예약→구글시트 연동 코드 + 라이브 자격증명 읽기전용 검증) 모두 구현·커밋·green.
> **미배포** — 머지/배포는 사람. 남은 사람 작업: ① 배포 라인(`feature/purchase-bot-mvp`) 머지 + 배포 ② 라이브
> append 테스트 승인 ③ 시트 탭 "시트1"→"예약" 정리 + 헤더행 ④ Vercel env(인라인 `GOOGLE_SA_*` + `CRM_RESERVATION_SHEET_ID`)
> ⑤ **SA 키 회전**(대화에 평문 공유됨). 커밋: A-1 `f22c580` / B `d864ee0` / A-2 `39f3bd8` / A-3 (이번 커밋).
- iter 3 (done, **Part A-2** 코어 MentionInput 액션-멘션 지원): `components/MentionInput.jsx`에 `mentionActions`
  prop + `onAction(action)` 콜백 추가. `filterMentionActions`(유저 멘션과 동일 매칭: 빈쿼리→전체/부분일치) +
  통합 `items` 리스트(액션 상단→유저)로 방향키/Enter/Tab 내비; 액션 선택 시 `clearActiveMention`(잔여 @토큰 제거)
  + `onAction(action)` 위임(텍스트 삽입 안 함). 코어는 modules/ 비의존(데이터는 prop으로만). **기존 호출부
  (IdeasView/PostCard/MessagesView)는 새 prop 미전달 → items=유저후보, @유저 멘션 동작/IME/키보드 무회귀.**
  `.mention-action` 액센트 CSS(globals.css). lint(모듈 경계 ok)+build 통과. 다음: A-3(MessagesView 배선).

## 2026-06-16: CRM ↔ 인벤토리 병합 + 운영 배포 (회귀 해소)

`feature/crm-followups`를 배포 라인 `feature/purchase-bot-mvp`에 병합(merge `8fee95f`) → 운영 배포
`dpl_8xzgv9ZuitM25BfXBLBGsxA6XhDm`. 이제 운영에 **인벤토리 + CRM Phase 2(고객 입력폼·픽업 캘린더·
지점 인사이트) + @예약 v1 + 시트 import 데이터(고객 2,810/예약 3,122)** 가 모두 함께 라이브.
헬스 ok/db ok, CRM API 미인증 401, /work/customers·/work/reservations·/work/disposal·/work/stock-in 200.
충돌은 문서 3건(HANDOFF/TODO/ralph PROMPT)뿐 — 배포 라인 버전 채택(CRM 상세는 `feature/crm-followups`
브랜치+git 히스토리에 보존). 코드(globals.css·Topbar 등)는 자동 병합, 새 마이그레이션 없음.
- 후속(코드 외): @예약 v2 액션-멘션(에이전트 플랫폼과), Sheets API 운영 연동·게시(GCP/Vercel 설정).
- `feature/crm-followups` 워크트리/브랜치는 병합 완료 — 정리(삭제) 가능.

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
- Iteration 12 (done, Phase 4-1): stock-in write API + server helpers (`lotDatePrefix`, `buildLotId`
  = `YYYYMMDD_품목_거래처_NNNN` continuing the day's running seq, `stockInLineStatus` 3-way →
  ok/discrepancy/missing/substitute, `serializeStockInDelivery`). `POST /api/work/inventory/stock-ins`
  (draft|submitted, lotId auto-number, amount=round(price×실입고), totalAmount), `GET` (list + branches).
  Degrade. lint+build pass.
- Iteration 13 (done, Phase 4-2): stock-in form UI (`StockInDashboard.jsx` full form replaces stub).
  Table 품목/발주/영수증/실입고/단가/특이사항; 품목 combobox; Enter/last-cell→new-row (IME-safe);
  client 3-way preview (`rowStatus` mirrors server) → row highlight + 상태 chip (일치/불일치/미입고/대체);
  지점·거래처·입고일 header; 입고 등록(POST submitted → lotId auto-number); 엑셀 복사; 입고가액 합계.
  lint+build pass.
- Iteration 14 (done, Phase 4-3a): 거래명세서 OCR backend. `extractStatementLineItems({imageUrl})` in
  `lib/agents/openaiClient.js` (Vision via OpenAI Responses API input_image; `OPENAI_VISION_MODEL`/
  `OPENAI_AGENT_MODEL`; returns skipped/parseError/result). `POST /api/work/inventory/stock-ins/ocr`
  → normalized `{ degraded, supplier, statementDate, lines }`. No key / API error / parse fail →
  `degraded:true` + empty lines (form falls back to manual). lint+build pass.
- Iteration 15 (done, Phase 4-3b): OCR wired into stock-in form. "거래명세서 인식" file button →
  `uploadStatementImage` (maybeCompressImage → presign → S3 PUT, inline→dataURL fallback) → `/ocr` →
  prefills rows (receiptQty=receivedQty=명세서 수량, unitPrice) + supplier/date; `degraded`→수기 폴백 안내.
  lint+build pass. **Phase 4 COMPLETE** (stock-in API + form + 3-way + lotId + OCR).
- Iteration 16 (done, Phase 6-1): metrics API `GET /api/work/inventory/metrics?from=&to=&branchId=`
  (submitted-only). Returns disposal {batch/line/qty/amount, byCause, byCategory}, stockIn {amount,
  discrepancyCount/Rate}, wasteRateByAmount (폐기가액/입고가액 %), byBranch [{disposal/stockIn amount,
  wasteRate, discrepancyCount}]. Auth + brand guard + degrade-to-zero. lint+build pass.
- Iteration 17 (done, Phase 6-2): insights UI. `inventoryInsightsModule` (slug inventory-insights,
  member nav → /work/inventory/insights) + route + `InventoryInsightsDashboard.jsx` (client):
  지점·기간 filter, stat cards (폐기율/폐기가액/입고가액/불일치율), 사유 비중 table, 지점별 table.
  Consumes metrics API. lint+build pass. **Phase 6 COMPLETE.**
- Iteration 18 (done, Phase 5-1): sheet-sync code `lib/inventorySheetSync.js` — pure column mappers
  (`disposalSheetRows`/`stockInSheetRows`) + Service-Account JWT → Sheets `values:append`. **Default
  skipped**: `isSheetSyncConfigured()` requires `INVENTORY_SHEET_SYNC_ENABLED=1` + `INVENTORY_SHEET_ID`
  + `GOOGLE_SA_CLIENT_EMAIL`/`GOOGLE_SA_PRIVATE_KEY`; without them it never connects. Wired non-fatally
  into disposal POST/PATCH submit (sets `syncedAt`) + stock-in POST submit. lint+build pass.
- Iteration 19 (done, Phase 5-2): `scripts/import-inventory-sheet.mjs` — parses 입고/폐기 CSV exports,
  normalizes (₩/comma→Int, `구분(원인)`→category+cause, decimals, preserves lotId/sourceLotId), reports
  past-disposal→past-lot linkage, **dry-run by default** (`--commit`+`--branch` required to write; prisma
  dynamically imported so dry-run never connects). Verified via `node --check` + fixture dry-run. Not run
  against any DB. lint clean.

**INVENTORY MODULE OBJECTIVE COMPLETE** (2026-06-15, Ralph). Phases 1–4 + 6 implemented; Phase 5
(sheet sync + import) code exists, human-gated. Every iteration committed on `feature/purchase-bot-mvp`,
`npm run lint` + `next build` green throughout.

**DEPLOYED to Boro prod (2026-06-15, user-approved):**
- Migration `20260615140000_add_inventory_module` applied via `prisma migrate deploy` (verified target =
  Boro prod `aws-1-ap-northeast-2.pooler.supabase.com`; it was the only pending migration; additive).
- Deploy `dpl_7TLchkAbb1jrUsPUcPoMAsnoi5y6` (READY, target production), alias
  `https://mattermost-project-mvp.vercel.app`. Health ok / database ok. Smoke: `/api/work/inventory/
  reasons` 401 (auth-gated, deployed), `/work/disposal` 200, `/work/inventory/insights` 200.
- POST-DEPLOY follow-ups (2026-06-15, user decisions):
  - 보로2호점 = **강남2호점** (`branch-gangnam-2`) → import `--branch=branch-gangnam-2`. (NOTE: forms'
    branch dropdown still shows 강남1/강남2/잠실 labels — real store is "보로2호점"; consider relabeling
    branch-gangnam-2 → "보로2호점" or adding proper Boro branch names later.)
  - NEW Google Sheet created (separate from existing): `INVENTORY_SHEET_ID=1cpB9fOjrMVOcfoCEe5IFXhWVoAv1ECVMmSIxh2n3w6A`
    (보로 입고·폐기 (Chloris 자동연동), owner captain@1moment.co.kr). Needs tabs "입고"/"폐기" + Service
    Account shared as editor before sync.
  - STILL BLOCKED: (a) #배포로그 + #기능개선건의 posts — Claude Chrome extension NOT connected (no browser
    available) and no prod-app API creds; needs the extension enabled OR user pastes. (b) Sheets sync —
    Service Account creds (`GOOGLE_SA_CLIENT_EMAIL`/`GOOGLE_SA_PRIVATE_KEY`) + set Vercel env
    (`INVENTORY_SHEET_SYNC_ENABLED=1`, `INVENTORY_SHEET_ID` above) + redeploy. (c) import — need clean
    CSV exports of the existing sheet's 입고/폐기 tabs (the Drive markdown export concatenates many
    ranges → unreliable to parse); then `node scripts/import-inventory-sheet.mjs --stockin=.. --disposal=..`
    dry-run → `--branch=branch-gangnam-2 --commit`.
- ⚠️ HUMAN ACTION REQUIRED before sheet sync / import go live (do NOT do unattended):
  1. Create a NEW Google Sheet (separate from the existing one) + a Service Account; set the env vars above.
  2. Decide `branchId` attribution for the existing sheet's ~20 months of rows (which branch).
  3. Run the import script in dry-run, review, then run for real against the NEW sheet + DB (approval).
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

## Done — 구조형 완성 디자인 배포 (2026-06-15)

그린 레일 + 모바일 오프캔버스 드로어 + Lucide 아이콘을 ralph loop(워크트리 `design/structural-rail`, 7단계, 단계별 독립 리뷰 서브에이전트)로 개발 → `feature/purchase-bot-mvp` 머지(`9108ace`) → 운영 배포.
- 배포 `dpl_8unCwqYHSEVuns6r5zhQNpRzeRVZ`, 헬스 ok/database ok, 마이그레이션 없음(CSS·마크업·아이콘만).
- 데스크톱 ≥981px 3열(레일64+사이드바292+메인), 모바일 ≤980px 드로어. 보로 전용(brand 게이팅), 앱 로직·모듈 경계 불변.
- 정본 `docs/design/borough/`, 리뷰 추적 `docs/design/REVIEW-structural-rail.md`, 단계 TODO는 TODO.md 구조형 섹션(S1~S7 완료).
- 배포로그: `post-deploy-log-20260615-structural-design-rail`.
- 잔여: POS(~880px) 레일 노출 경계 하향(추후 별도), 실사용 시각 점검 권장.
