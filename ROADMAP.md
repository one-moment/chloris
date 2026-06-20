# ROADMAP — 클로리스 (통합 멀티컴퍼니 플랫폼)

생성/갱신: 2026-06-20 · 브랜치: `feature/ledger-settlement-mvp`(통합본, origin과 동기) · 근거: `git log`, `HANDOFF.md`, `TODO.md`, `DECISIONS.md`, 디렉터리/의존성 실측.

> 상세 진행기록은 [HANDOFF.md](HANDOFF.md)·[TODO.md](TODO.md)·[DECISIONS.md](DECISIONS.md)가 정본. 이 문서는 상위 한눈 보기다. 배포/검증 상태 일부는 그 문서 기준(추정 — 이 브랜치에서 직접 재검증한 것은 아님).

---

## 완료된 Phase

### Phase A — 채팅/협업 코어 ✅ (운영 배포, 추정)
인증·세션, 프로젝트·채널, 메시지, Ideas(게시판), 댓글, 파일, 멘션, 검색, 게시글 템플릿, 읽음/고정. SQLite(dev)+Postgres(운영), Vercel(icn1)+Supabase.
- **Done when**: 채팅·Ideas·파일·검색·인증이 운영에서 동작. ✅

### Phase B — 멀티컴퍼니 플랫폼 기반 ✅
브랜드 게이팅(`lib/brand.js`, `NEXT_PUBLIC_BRAND`=onemoment|borough|todaykkot), 모듈 레지스트리(`modules/registry.js` + 경계 린트 `scripts/check-module-boundaries.mjs`), 워크스페이스 셸(`app/(workspace)/`), 지점 레이어, CI 게이트(`.github/workflows/ci.yml`), 거버넌스 문서(AGENTS/DECISIONS 등).
- **Done when**: 브랜드별 모듈 on/off + `/work/*` 라우팅 + 모듈 경계 가드 동작. ✅ (`docs/platform-architecture.md`, `docs/multi-company-split.md`)

### Phase C — 업무 모듈 ✅ (보로 운영 라이브, 추정)
- 구매(purchase): 구매봇 MVP + purchaseAgent + 워커(`scripts/purchase-worker/`). 최종 결제는 사람.
- CRM: 고객/예약 + `@예약` v2 액션-멘션 + 예약→구글시트 연동 (**보로 운영 라이브·검증 완료**, HANDOFF 기준).
- 입고·폐기(inventory): 입고/폐기/재고 지표 + 거래명세서 OCR + 구글시트 연동 (운영 배포, 추정).
- analytics: 원모먼트 매출 대시보드 Phase 0(더미).
- **Done when**: 각 모듈 `/work/*` 화면 + 쓰기 API + (해당 시) 시트 연동 동작. ✅(대부분) — 상세·잔여는 HANDOFF/TODO.

### Phase D — 에이전트 레이어 ⏳ (코드 완료, 사람검증 대기)
purchaseAgent + 안내데스크 에이전트 "헤르메스" 1~3단계(분배→분류 라우팅→예약 미리채움). DB 직접쓰기·운영배포 없음. PII 비추출 가드.
- **Done when**: `@헤르메스` 분류·안내·예약 미리채움이 로컬/연습 검증 통과 + 각 단계 PR 병합. ⏳ (HANDOFF "루프 후 사람 검증 필요": `agent-layer:test` + dev 분류 확인 + PR)

### Phase E — 웹 푸시/PWA + 원모먼트 브랜딩 ✅(코드)
PWA manifest/서비스워커, 구독 API(`/api/push/subscribe`), 알림 토글, 원모먼트 로고/테마.
- **Done when**: 구독 저장 + 브랜드 테마 적용. ✅(코드) — VAPID 운영 env는 ops(추정).

### Phase F — 오늘꽃 정산: 단계 0 (수집 어댑터) ✅(코드)
팝빌 공용 설정(`lib/popbill.js`) + 계좌조회(`lib/popbillBank.js`)·홈택스 매입(`lib/popbillHomeTax.js`) 수집 어댑터(`requestJob→getJobState→search`) + 연결확인 프로브.
- **Done when**: 두 수집 어댑터 구현·로드 + lint. ✅ / **잔여**: 테스트베드 라이브 수신 1회(준비물 후).

---

## 예정 Phase

### Phase G — 오늘꽃 정산: 단계 1 (매입 계산서 대조)
기존 시트 인프라(`lib/googleSheets.js`·`inventorySheetSync` 패턴) 재사용. `PurchaseInvoice`·`CollectionJob` 모델(+마이그레이션), `lib/reconcile.js`(키: 공급자 사업자번호+합계금액+작성일자±N일), settlement API(수집/폴링/대조/목록, 기존 `app/api/work/*` 패턴).
- **Done when**: 실제 사입 건에 "계산서 확인 ✓/확인 필요"가 시트+앱에 자동·정확 표시(테스트베드). 송금은 사람.

### Phase H — 오늘꽃 정산: 단계 2 (입금 대조 + 정산)
`BankDeposit`·`DepositorAlias` 모델, 입금 대조(부분입금 누적, 잔여=청구−누적), 입금자명 별칭 학습, 시트 되써넣기.
- **Done when**: 입금/미입금/잔여금액 자동·정확 표시 + 별칭 1회 연결 후 자동 매칭.

### Phase I — 오늘꽃 정산 콘솔 UI (관리자)
`modules/` 패턴으로 정산 모듈(목록·상태뱃지·수집/대조 버튼·예외검토·별칭관리). 브랜드 게이팅(todaykkot).
- **Done when**: 관리자가 수집·대조·예외·별칭을 앱에서 수행, 비관리자 비노출.

### Phase J — (선택) 정산 요약 알림
매일 "송금 가능 N/미입금 M/확인 필요 K" 채널 게시(수동 수집 MVP → 크론 후속).
- **Done when**: 지정 시각 지정 채널 자동 게시.

### Phase K — (보류) 계산서(세금계산서) 발행
SDK 시그니처 검증만 완료(`docs/popbill-taxinvoice-verification.md`). 발행은 정산 다음 단계.
- **Done when**: 관리자 멱등 발행(과세/면세)+상태 동기화, 중복발행 방지.

---

## 공통 선행조건 (담당자 준비물 — 라이브 블로커)
팝빌 가입+테스트베드 / 홈택스 부서사용자 계정→팝빌 등록 / 입금 은행계좌 팝빌 등록 / 구글 서비스계정 시트 편집공유 / **거래원장 시트 칸 구성 제공(사입·납품)** / 연동 키 `.env`. (월 거래량·계좌 수 미확인 — 추정)
