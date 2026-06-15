# 꽃 입고·폐기 관리 (재고/원가 모듈) 설계

작성: 2026-06-15 (사용자 확정). 상위 설계: `docs/platform-architecture.md`, 선행 패턴: `docs/templates-and-crm.md`(CRM 모듈).
모듈 슬러그: `modules/inventory` (보로플라워마켓 전용). 화면: `/work/disposal`(폐기), `/work/stock-in`(입고), 마스터 관리(관리자).

## 1. 배경

보로플라워는 매장 작업자가 **입고**(거래명세서)와 **폐기**를 Swit/채팅에 자유 텍스트+사진으로 올리면,
매니저가 [Google 스프레드시트](https://docs.google.com/spreadsheets/d/17LSQ7iM_HAVaT2tiX5Ehl6BLFFVTFeQTxN7gJv0_o1o/edit)에
**수기로 재입력**해 왔다. 이 이중입력이 병목이고, 밀리면 통계가 늦어 경영 판단이 늦어진다.

직원 개선 요청 2건 + 본부장 비전이 출발점이다:

- **김연주(1차)**: 표(Table) 입력 + 엑셀 복사, 품목명 자동완성.
- **박선영(2차)**: Enter/Tab 키보드 행이동, 품목명 자유입력 + 저장 시 검증(미등록 차단), 구분·폐기원인 드롭다운,
  오류 1건이라도 있으면 저장 불가, 스프레드시트 자동 연동, **임시저장/최종제출** 2단계.
- **본부장**: "채팅에 텍스트+사진만 올리면 입고/폐기가 자동 입력."

두 직원 요청은 충돌이 아니라 상호보완이다(자동완성=입력 시점 예방 / 검증=저장 시점 게이트). 합치면
"빠르면서 정확한 표 입력 폼"이 된다.

## 2. 기존 시트에서 확인한 실제 구조 (2026-06-15 분석)

이 시트는 단순 기록이 아니라 **lot 단위 원가 추적 시스템**이었다.

- **마스터 탭**: 거래처(원모먼트/빅토리아/인터넷꽃시장/현강(도매)/오늘꽃/식물), 품목 마스터(수백 종, 색상/원산지 변형 포함),
  폐기원인 마스터(`구분(원인)` 조합).
- **입고 탭**: `LotID | 거래처 | 입고일 | 품목 | 단가(원/송이) | 입고수량 | 입고가액(원) | 입고주차 | 입고월`.
  - LotID 포맷 = `20250502_거베라(화이트)_빅토리아_0002` = `입고일_품목_거래처_순번4자리`.
- **폐기 탭**: `폐기일 | 품목 | 폐기수량 | LotID(출처) | 단가(원/송이) | 폐기가액(원) | 폐기주차 | 폐기월 | 폐기원인`.
  - 폐기수량은 **소수**(0.1·0.25·0.166 — 송이/단 일부 폐기).
  - `LotID(출처)`로 입고 lot에 연결 → 단가·폐기가액 산출.

### 발견한 약점 (개선 대상)

| # | 현재 시트 문제 | Chloris 개선 |
|---|---|---|
| 1 | LotID 수기 작성 → 오타·중복 | 입고 확정 시 **자동 발번**(포맷 유지) |
| 2 | 폐기행 LotID(출처) **다수 공란** → 폐기가액 누락 | **4일 자동 추천**으로 매핑률↑, 미매핑 경고 |
| 3 | 단가/금액에 `₩700`·`₩8,000`·`700` 혼용 | **숫자 타입 강제** |
| 4 | 폐기원인이 `습짐`·`오늘의꽃(습짐)`·`기타(습짐)` 뒤섞임 | **구분/원인 2컬럼 드롭다운** 분리(박선영 표준) |
| 5 | 주차/월/가액 수식·수기 | 저장 시 **자동 계산** |
| 6 | 원시 붙여넣기 임시표(`NO_HEADER` 덩어리) 잔존 | **임시저장 기능**이 대체 |
| 7 | 지점 컬럼 없음(단일 지점 구조) | `branchId`로 **전 지점 통합·KPI rollup** |

## 3. 확정된 결정 (2026-06-15)

1. **구분(category)** = 박선영 표준 3종 고정: `기타` / `제작폐기_꽃다발` / `제작폐기_오늘의꽃`.
   (이세희 과거 기록 `오늘의꽃`→`제작폐기_오늘의꽃`, `제작 꽃다발`→`제작폐기_꽃다발`로 매핑.)
2. **품목 마스터·폐기원인 목록**을 생성하고 **관리자가 관리**(시트 마스터 탭을 시드).
3. **Chloris가 원장(原帳)**. 최종제출 시 **새로 생성한** 구글시트에 한 방향 자동 추가
   (기존 시트는 오염하지 않도록 분리). 엑셀 복사는 보조.
4. **lot 원가 추적 + 4일 자동 매핑** 내장(생화 일일 가격 변동 대응).
5. **품목명 검증 게이트**: 자유입력 허용, 최종제출 시 마스터와 대조. 미등록 → 저장 차단 +
   "신규 품목 등록 요청" 버튼 → 관리자 승인 시 마스터 자동 추가.
6. **과거 데이터 import**: 기존 시트의 과거 lot + 폐기를 import해 초기부터 과거 폐기가 lot에 연결되게 한다.

## 4. 입력 방식 — "하나의 표, 두 가지로 채운다"

폐기/입고 입력을 CRM 예약 폼과 같은 **전용 폼**(타입 필드·검증·마스터 조회)으로 만들고, 두 경로로 채운다:

1. **빠른 수기 입력** (직원 요청): 키보드 중심 표 입력. **토대.**
2. **AI 사전채움** (본부장 비전): 채팅 텍스트+사진(거래명세서) → 에이전트가 **같은 표를 미리 채움** →
   사람이 검토 후 같은 검증·저장. 구매 에이전트의 "초안→확정" 패턴(`lib/agents/purchaseAgent/`) 복제.

두 경로 모두 **같은 검증·같은 저장·같은 시트 연동**으로 수렴한다.

## 5. 데이터 모델

CRM 규칙 계승: 외부 참조(branchId/channelId/messageId/itemId/sourceLotId)는 **스칼라(FK 없음)**,
모듈 내부 관계(Delivery↔Line, Batch↔Line)만 FK. 추가 테이블 → 부재 시 빈값으로 degrade(배포 안전).
금액은 원 단위 정수(`Int`), 수량은 소수 허용(`Float`).

```
FlowerItem        // 품목 마스터 = 자동완성·검증 소스
  id, name(unique), category?, origin?, isImported, defaultUnit("송이"|"단"|"개"),
  aliasesJson, isActive, createdById, ts

DisposalCause     // 폐기원인 마스터(관리자 관리): 물내림/줄기짓무름/습짐/잎탈락/...
  id, name(unique), isActive, sortOrder, ts
// 구분(category)는 3종 고정 → lib/inventory 상수(테이블 아님)

StockInDelivery   // 거래명세서 1장 = 입고 1건
  id, branchId, channelId?, messageId?, supplier, statementDate, totalAmount?,
  status("draft"|"submitted"), sourceText, attachmentsJson, createdById, ts
StockInLine       // 입고 1행 = lot 1개
  id, deliveryId(FK), lineIndex, lotId(unique), itemId?, itemName, supplier, stockInDate,
  unit, unitPrice(원/송이), quantity(입고수량), amount(입고가액),
  orderedQty?(발주), receiptQty?(영수증), note, status("ok"|"discrepancy"|"substitute"), rawText, ts

DisposalBatch     // 폐기 1건
  id, branchId, channelId?, messageId?, disposalDate, status("draft"|"submitted"),
  sourceText, attachmentsJson, createdById, submittedAt?, syncedAt?, ts
DisposalLine
  id, batchId(FK), lineIndex, itemId?, itemName, quantity(소수), unit,
  category(기타|제작폐기_꽃다발|제작폐기_오늘의꽃), cause(DisposalCause.name),
  sourceLotId?, unitPrice?(스냅샷), amount?(폐기가액), note, rawText, ts

NewItemRequest    // 신규 품목 등록 요청 → 관리자 승인
  id, requestedName, branchId?, channelId?, requestedById,
  status("pending"|"approved"|"rejected"), resolvedItemId?, decidedById?, decidedAt?, ts
```

LotID 포맷은 기존 시트 계승: `YYYYMMDD_품목_거래처_NNNN`. 입고 확정 시 시스템이 발번(중복 방지 순번).

## 6. LotID 매핑 (4일 자동 추천)

폐기 시 관리자가 "최근 4일 내 어느 lot?"을 머리로 판단하던 것을 시스템이 대신한다.

- 폐기 품목 선택 → `GET /api/work/inventory/lots?item=&date=`가 **같은 품목 + 입고일 ∈ [폐기일−4일, 폐기일]**
  lot을 최신순으로 반환. 기본값 = 가장 최근 lot.
- 관리자는 추천 그대로 채택 / 다른 lot / 4일 외 lot / "출처 없음(단가 미상)" 선택 가능(현재와 같은 신뢰 모델, 단 기본 자동).
- 매핑 시 lot 단가를 폐기행에 **스냅샷 복사**(나중에 lot 단가 보정돼도 과거 폐기가액 불변). 필요 시 재연결.
- 폐기가액 = `round(unitPrice × quantity)`. 4일 창은 관리자 설정값.

## 7. 마스터 관리 (품목·폐기원인·구분)

- 시드: 기존 시트 마스터 탭 → `FlowerItem`, `DisposalCause` 초기 적재(import 스크립트).
- 자동 학습: 입고/폐기 확정 시 신규 품목은 `NewItemRequest`로 모아 관리자 승인 → `FlowerItem` 추가.
- 관리자 화면: 품목·폐기원인 활성/비활성·별칭·정렬 편집, 신규 품목 요청 승인/반려.
- 구분 3종은 코드 상수(변경 빈도 낮음, 통계 키).

## 8. 폐기 입력 폼

표 그리드(행=품목). 컬럼: `품목명 | 수량 | 구분 | 폐기원인 | (lot 출처) | 사진`.

- **키보드**(박1): `Enter`=다음 칸, 마지막 칸 `Enter`=새 행, `Tab`=이동. 한글 IME 안전(기존 `components/MentionInput.jsx` 패턴).
- **품목명**(김2·박2): 콤보박스(자동완성 + 자유입력). `GET /api/work/inventory/items?q=`.
- **구분·폐기원인**(박3): 드롭다운(고정/등록 목록만).
- **lot 출처**: 6절 자동 추천 picker.
- **검증 게이트**(박4): 최종제출 시 전 행 검증(품목명∈마스터, 수량>0, 구분·원인∈목록). 1건이라도 실패 →
  저장 차단, 오류 행 빨강 + `"3행: 등록된 품목명과 일치하지 않습니다 → 소국(화이트)인가요?"`. 미등록은 "신규 품목 등록 요청" 버튼.
- **임시저장/최종제출**(박 추가): `status` 1필드. 임시저장=검증 없이 보관(현장 만족도), 최종제출=검증+시트 기록.
- 진입: `/work/disposal` "새 폐기" + #지점방 `@폐기`(같은 폼).

## 9. 입고 입력 + 거래명세서 OCR

표 컬럼: `품목 | 발주 | 영수증 | 실입고 | 단가 | 금액 | 특이사항`.

- **3중 대조**: 발주/영수증/실입고 불일치 자동 플래그(재고부족·대체입고·미입고). 작업자 텍스트의 `10/10/0`, `단 2/1/1` 표기가 그대로 매핑.
- **거래명세서 사진 OCR**: 인쇄 정형표 → Vision 모델로 품명/수량/단가/금액 자동 추출(초안 시드). 폐기 꽃 사진은 증빙 첨부.
  - 레포 LLM 훅 `lib/agents/openaiClient.js` 확장(모델은 env). 키 없음/인식 실패 → 빈 표 수기 입력으로 degrade.
- 입고 확정 → 각 라인이 lot이 되고 `lotId` 자동 발번 → 폐기의 4일 추천 풀에 진입.

## 10. 스프레드시트 연동 (새 시트, 한 방향)

- **새 구글시트를 생성**(기존 시트 분리·미오염). Service Account로 Sheets API append.
- 최종제출 시 폐기/입고 행을 새 시트에 자동 추가. 컬럼:
  - 폐기: 날짜·지점·작성자·품목명·수량·단위·구분·폐기원인·LotID(출처)·단가·폐기가액·사진링크.
  - 입고: LotID·거래처·입고일·품목·단가·입고수량·입고가액·발주·영수증·실입고·특이사항.
- 엑셀 복사(TSV 클립보드) + CSV 내보내기는 보조.
- 인프라: Service Account 키는 env(레포에 저장 금지, AGENTS.md). **운영 연동은 승인 후.**

## 11. 기존 데이터 import (새 시트로 분리)

- 기존 시트의 입고 탭(과거 lot) → `StockInLine`(+ 합성 `StockInDelivery`), 폐기 탭 → `DisposalBatch`/`DisposalLine`.
- 폐기행의 `LotID(출처)`를 `sourceLotId`로 연결 → **초기부터 과거 폐기가 과거 lot에 연결**.
- 단가/금액 정규화(`₩`, 콤마 제거 → Int), 폐기원인 `구분(원인)` → category+cause 분해, 수량 소수 보존.
- 결과는 **새 구글시트** + Chloris DB에만 적재(기존 시트 미변경). staging/local 검증 후 승인받아 운영 import.
- 미결: 과거 행의 `branchId` 귀속(어느 지점 기록인지) — import 전 확정 필요.

## 12. 단계별 구현 순서 (Ralph, 한 번에 한 step)

1. **데이터 모델** — 두 schema(`schema.prisma`+`schema.postgres.prisma`)에 모델 추가 + 수기 마이그레이션(운영 미적용).
2. **마스터 + 조회/검증 API** — `GET /api/work/inventory/items|reasons|lots`, 모듈 스켈레톤(`modules/inventory`),
   브랜드 게이팅, 라우트/대시보드 스텁. 관리자 마스터 화면 + `NewItemRequest` 승인.
3. **폐기 폼** — 표·키보드·콤보박스·드롭다운·검증게이트·임시저장/최종제출·lot picker. 제출 API.
4. **입고 lot + 거래명세서 OCR** — 입고 표·3중 대조·lot 발번·Vision 추출.
5. **시트 연동 + import** — 새 시트 생성, 한 방향 append, 과거 데이터 import(승인 후 운영).
6. **지표 → 지점 인사이트** — 폐기율·폐기가액·사유 비중·입고 불일치율, byBranch(메트릭 레지스트리).

## 13. 가드레일 / 미결

- 운영 마이그레이션·`db push` 운영·`vercel deploy`·외부 API(구글시트) 운영 연동은 **사람 승인 후에만**.
- 모듈 경계 준수(모듈 간 import 금지, `/api/state`에 모듈 데이터 금지).
- Service Account 키·고객/매출 원시데이터 등 민감정보는 레포에 저장 금지.
- 미결: ① 과거 import 행 `branchId` 귀속, ② 4일 창 기본값 확정(현재 4), ③ 단/송이 환산표 필요 여부(입고 단위 ↔ 폐기 단위).
