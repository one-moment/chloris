# @예약 — #지점방 현장 예약 진입 설계 (초안)

작성: 2026-06-15 (설계 시작). 상위: `docs/templates-and-crm.md`(CRM 모듈), `docs/platform-architecture.md`.
브랜치: `feature/crm-followups` (CRM 모듈). 상태: **설계 제안 + 미결 결정** — 구현 전 사용자 확인 필요.

## 1. 목표

현장 직원이 **#지점방 채팅에서 `@예약`** 으로 예약을 그 자리에서 등록한다. 매니저용
`/work/reservations`의 "새 예약"과 **같은 폼·같은 검증·같은 저장**을 쓰되, 진입점만 채널이다.
지점은 채널에 연결된 Branch로 **자동 결정**(현장 직원은 지점 선택 불필요).

## 2. 현재 코드 사실 (설계 근거)

- 멘션 입력 `components/MentionInput.jsx` 는 `@` 뒤 토큰으로 **유저만** 후보 제시
  (`filterMentionUsers(query, users)`), 선택 시 `@이름 ` 텍스트 삽입. **액션형 멘션 개념 없음.**
- `Channel.branchId`(옵셔널)로 채널↔지점 연결됨. #지점방 = branchId 있는 채널.
- 예약 생성 API `POST /api/work/crm/reservations` 는 이미 `channelId`·`branchId`를 받는다.
- "새 예약" 폼은 현재 `modules/crm/ui/ReservationsDashboard.jsx` 안에 인라인으로 있음
  (재사용하려면 분리 필요).
- 작성기/채널 UI는 **코어**다. 코어는 모듈을 import할 수 없다(경계, `docs/platform-architecture.md` 12절).

## 3. 핵심 아키텍처 쟁점 — 코어↔모듈 경계

`@예약`은 코어 작성기에서 트리거되지만, 동작(예약 폼·저장)은 CRM 모듈 소유다. 코어가 모듈을
직접 import하면 경계 위반. 두 해법:

- **(A) 매니페스트 기여 컨트랙트(권장, 플랫폼 정합)**: 모듈 매니페스트가 "멘션 액션"을 선언
  (`mentionActions: [{ token: "예약", label, minBranchScoped: true, route/modalId }]`). 코어
  작성기가 이를 읽어 후보에 노출하고, 선택 시 **모듈이 제공한 경로/모달**로 위임. 에이전트-멘션
  오픈 플랫폼 플랜(아키 문서 9·12절)과 같은 방향.
- **(B) 단순 진입 버튼(v1 최소)**: 멘션 시스템을 안 건드리고, branchId 연결된 채널 작성기 옆에
  "예약" 버튼을 코어가 렌더 → 클릭 시 `/work/reservations?new=1&channel=<id>`로 이동(폼 모달 오픈).
  경계 위반 없음(라우트 이동만). 가장 빨리 출시 가능.

## 4. 권장 빌드 순서

1. **폼 분리**: `ReservationsDashboard`의 "새 예약" 폼 → `modules/crm/ui/ReservationForm.jsx`로 추출
   (props: `branchId`(고정), `channelId`, `onSubmitted`). `/work/reservations`도 이걸 사용.
2. **v1 진입(버튼)**: #지점방(branchId 有) 작성기에 "예약" 버튼 → 폼 모달, 지점=채널 지점 고정,
   제출 시 `POST …/reservations`에 `channelId`+`branchId` 포함. (해법 B — 경계 안전, 즉시 가치)
3. **(선택) 채널 요약 카드**: 제출 후 #지점방에 "예약 접수: {고객} {상품} {픽업일}" 요약 게시
   (가시성). 메시지/게시 API 재사용.
4. **v2 멘션(@예약)**: 코어 멘션 시스템에 **액션형 멘션** 도입(해법 A) — 매니페스트 컨트랙트 +
   `MentionInput` 후보에 액션 항목 + 선택 시 텍스트 삽입 대신 모달 오픈. 에이전트 플랫폼 작업과 함께.

## 5. 결정 (2026-06-15 사용자 확정)

1. **트리거**: **③ 버튼 먼저(v1) → 멘션 나중(v2)** ✅ 확정. v1 = "예약" 버튼(라우트 이동, 경계 안전).
2. **폼 표시**: **모달** ✅ (권장값 채택)
3. **활성 채널**: **branchId 연결된 채널만** ✅ (권장값 채택)
4. **채널 요약 카드**: **켬** ✅ — 제출 후 #지점방에 요약 게시 (권장값 채택)
5. **권한**: **인증 사용자 누구나(CRM 활성 브랜드 한정)** ✅ (권장값 채택)

→ v1 구현은 `ralph/PROMPT.md` OBJECTIVE(4단계: 폼 분리 → 딥링크 → 코어 버튼 → 요약카드)로 진행.

## 6. 가드레일

- 코어는 CRM 모듈을 import하지 않는다(매니페스트 컨트랙트/라우트 이동으로 위임).
- 고객/예약 데이터는 DB에만(로그·커밋 금지). 결제·외부주문 없음.
- 신규 마이그레이션 불필요(기존 `Reservation`에 `channelId` 이미 존재).
