# 템플릿 · 고객관리(CRM) · 예약 관리 설계

작성: 2026-06-11 (사용자 확정). 상위 설계: `docs/platform-architecture.md`.

## 배경

보로플라워(brand)는 다지점 꽃집이다. 현재 예약은 지점별/월별 Google 스프레드시트로 관리한다(성함·연락처·예약날짜·픽업일시·상품·결제금액·예약경로·수령방법·비고 + 월별 총건수/매출/경로비중 요약, 약 20개월치).

직원 요청 3건이 이 설계의 출발점이다:
1. 게시글 양식 자동생성(반복입력 제거) → **템플릿 시스템**
2. 게시글 작성 시 고객정보 자동연동(이름/전화로 과거 주문이력 조회) → **고객관리(CRM)**
3. 멘션 키보드 선택 → **완료**(`components/MentionInput.jsx`, 배포 대기)

(1)과 (2)는 하나의 고리다: **템플릿 = 입력 폼, CRM = 그 폼이 읽고(조회) 쓰는(저장) 데이터.**

## 확정된 결정 (2026-06-11)

- 지점: `강남1호점`·`강남2호점`·`잠실점` (이미 시드됨, 이름 변경 불필요). 향후 추가 예: 성수역점. **지점 추가 = Branch 레코드 1개, 화면·코드 변경 없음.**
- 고객은 **전 지점 공통**(전화번호 1개 = 고객 1명). 교차방문해도 어느 지점에서나 보로플라워 고객의 전체 주문 맥락을 보고 응대한다(브랜드 가치).
- 가시성: 고객·주문이력은 전 지점 공통 조회. 전화번호는 대량 목록/내보내기에서 마스킹(`010-****-7175`), 실제 응대 시 전체 표시. 본사 무제한. 고객 데이터는 로그·문서·커밋에 남기지 않는다(AGENTS.md).

## 기능 1 — 템플릿 시스템 (코어)

게시글 작성기에 재사용 템플릿. 게시판/채널 고정값이 아니라 **사용자/관리자가 만드는 라이브러리**(자유도 우선).

데이터(코어):
```
PostTemplate { id, name, body, scope("personal"|"shared"), ownerId?, createdById?, createdAt, updatedAt }
```
- 개인 템플릿 = 본인만, 공유 템플릿 = 관리자 관리·전체 노출.
- 치환 토큰(삽입 시 해석): `{{지점}}`(채널에 연결된 Branch명), `{{오늘}}`, `{{작성자}}`.
- UX: 작성기 "템플릿" 선택기(공유 먼저, 내 것 다음) → 제목(첫 줄)+본문 채움. "템플릿 관리" 모달에서 작성/수정.
- 권한: 개인 = 누구나, 공유 = 관리자.
- API: `/api/post-templates` (GET/POST/PATCH/DELETE). 추가 테이블 → 마이그레이션 작성 후 운영 적용은 승인 필요.
- 위치: 작성기는 코어 커뮤니케이션 UI이므로 코어에 둔다(업무 모듈 아님).

## 기능 2 — 고객관리(CRM) + 예약 관리 (모듈)

내부 모듈 `modules/crm`. 화면: `/work/customers`(고객), `/work/reservations`(예약, 스프레드시트 후신).

데이터:
```
Customer {            // 전 지점 공통, 전화번호 = 식별키
  id, name, phone(idx), homeBranchId?, memo?, createdById?, createdAt, updatedAt
}
Reservation {         // 스프레드시트 한 행 = 주문/예약 한 건
  id, customerId, branchId, channelId?, postId?,
  reservedAt, pickupAt, product, amount,
  source, receiveMethod, status, note?,
  createdById?, createdAt, updatedAt
}
```
- Customer 1—N Reservation. 단골 횟수 = 전 지점 예약 합계.
- `status`: 예약접수 / 픽업대기 / 픽업완료 / 취소.
- `source`(예약경로): 인스타 / 네이버플레이스 / 네이버톡톡 / 네이버검색 / 매장방문 / 전화예약 / 지인.
- `receiveMethod`(수령방법): 방문수령 / 퀵 (확장: 택배 등).

조회/저장 고리:
- 조회: `GET /api/work/crm/customers?q=`(이름/전화) → 고객 + 최근 예약. 작성기(코어)는 이 API만 호출(모듈 직접 import 금지 — 경계 유지).
- 저장: 주문서 게시글 제출 → 전화번호로 Customer upsert + Reservation 생성 + 원본 게시글 링크. 직원은 주문서만 쓰면 데이터가 쌓인다.

화면:
- `/work/reservations`: 목록 + 픽업일 캘린더 뷰, 지점 필터, 본사 통합(전 지점 rollup), 행→원본 채팅 점프.
- `/work/customers`: 이름/전화 검색 → 프로필 + 주문이력 + 누적건수/금액, 수동 입력/수정.
- 지표 기여(메트릭 레지스트리 → 지점 인사이트): 예약건수·매출·경로비중·단골재방문율, byBranch.

## 스프레드시트 컬럼 매핑

| 스프레드시트 | Chloris |
|---|---|
| 성함 | Customer.name |
| 연락처 | Customer.phone (전 지점 식별키) |
| 예약 날짜 | Reservation.reservedAt |
| 픽업 일시 | Reservation.pickupAt |
| 상품 | Reservation.product |
| 결제금액 | Reservation.amount |
| 예약 경로 | Reservation.source |
| 수령방법 | Reservation.receiveMethod |
| 비고 | Reservation.note |
| (하단 요약 총건수/매출/경로비중) | 실시간 지표(자동 집계) |
| (월별 탭) | 기간 필터 |

## 기존 데이터 import

20개월치 시트 → 1회 CSV import로 Reservation + Customer(전화번호 dedupe) 생성. 취소건은 비고/표시에서 status=취소로 매핑. **미결: 이 시트가 어느 지점 기록인지**(import 시 branchId 지정에 필요). 운영 import는 staging/local 검증 후 승인받아 실행.

## 구현 순서

1. 템플릿 시스템(코어, 독립·즉시 가치).
2. CRM 코어(Customer·Reservation 테이블, `/work/customers`·`/work/reservations` 검색/프로필/목록/캘린더/수동입력).
3. 연결(주문서 제출 → Customer upsert + Reservation 생성, 작성기 고객조회 자동완성, 레코드↔게시글 링크).
4. 지표 → 지점 인사이트.
5. (선택, 나중) 외부 쇼핑몰(네이버 등) 동기화 — 연동 봇.

## 미결 항목

- 기존 시트의 지점 귀속(import 대상 branchId).
- 템플릿 치환 토큰 세트 최종 확정(`{{지점}}`/`{{오늘}}`/`{{작성자}}`).
- 멘션 키보드 선택 배포 시점(구현 완료, 미배포).
