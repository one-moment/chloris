# Chloris 플랫폼 아키텍처 설계 v2

작성일: 2026-06-10 (v1) / 갱신: 2026-06-10 (v2 — UX 표준, 가드레일, 지점 인사이트, 에이전트-봇 체제 반영)
상태: 사용자 승인됨 (잔여 결정 사항은 16절 참고)

## 1. 배경과 문제 정의

Chloris의 기획이 확장되고 있다:

- 처음: SWIT을 대체하는 사내 채팅/게시판 커뮤니케이션 툴
- 현재: ERP형 업무 기능(구매요청, 지출결의, 생화·부자재 입고, 생화 폐기, 예약주문 관리, 마케팅, 지점 KPI)을 포함한 전천후 업무 자동화 툴
- 업무별 팀장 역할 에이전트 + 단위업무 봇으로 자동화를 진행하고, 직원이 Claude/Codex로 직접 개발한 에이전트/봇을 연동할 수 있는 오픈 플랫폼이 목표

현재 MVP 코드에서 확장을 막는 구조적 문제 3가지:

1. **채팅 코어가 업무 도메인을 직접 안다.**
   `app/page.jsx`(931줄)가 구매 워크플로우 핸들러까지 보유하고, `MessagesView`에 구매 전용 props가 직접 주입된다.
2. **`/api/state` 단일 엔드포인트가 모든 데이터를 5초마다 폴링한다.**
3. **`channel.type`이 업무 구분 키로 쓰인다.** 업무가 늘수록 채널 타입 enum이 비대해진다.

운영상의 문제 (자동화 체제가 풀어야 할 것):

- 원재료 입고/폐기를 스프레드시트에 수작업 기입 → 담당자가 바쁘면 우선순위에서 밀려 경영 데이터가 적시에 공유되지 않는다.
- 입력과 데이터 수집 자체를 자동화하여 "입력이 곧 보고"가 되어야 한다.

## 2. 설계 원칙

1. **채널은 커뮤니케이션 전용이다.** 업무 화면은 별도 라우트(`/work/*`)로 분리한다.
2. **업무는 "모듈" 단위로 수직 분할한다.** UI + API 서비스 + DB 스키마 + 에이전트 정의가 한 폴더에 응집 (vertical slice).
3. **모듈은 코어와 플랫폼만 import한다. 모듈 간 직접 import는 금지.** 모듈 간 연계는 플랫폼 이벤트 경유 (12절).
4. **채팅과 업무 모듈의 연결 통로는 두 가지뿐:** (a) 에이전트 설치(`ChannelAgentInstallation`), (b) 인터랙티브 카드(카드 레지스트리).
5. **현장 입력은 채팅, 관리 처리는 대시보드.** 직원은 멘션+사진으로 입력, 관리자는 대시보드/인박스에서 처리 (9절).
6. **자동화 플랫폼 계층은 공통 인프라다.** 특정 업무에 종속되지 않는다.
7. **점진적 마이그레이션.** 빅뱅 리팩토링 금지 (AGENTS.md 규칙).

## 3. 목표 계층 구조

```text
┌─────────────────────────────────────────────────┐
│ UI 라우트                                         │
│  /chat/...        커뮤니케이션 (채널/게시판/파일)      │
│  /work/<module>   업무 대시보드                     │
│  /work/inbox      전역 승인 인박스                   │
│  /work/branch-insights  지점 KPI 인사이트            │
│  /admin/...       앱 레지스트리, 권한, 감사로그        │
├─────────────────────────────────────────────────┤
│ 업무 모듈 (modules/<slug>/)                        │
│  purchase, expenses, flower-stock,                │
│  reservations, marketing, branch-insights         │
├─────────────────────────────────────────────────┤
│ 자동화 플랫폼 (lib/platform/)                       │
│  agentGateway, agents, botIntegrations,           │
│  eventBus, metricsRegistry, workerQueue,          │
│  audit(AgentRun/ToolCall/EventLog)                │
├─────────────────────────────────────────────────┤
│ 코어 (lib/core/)                                  │
│  auth, permissions, prisma, storage,              │
│  projects/channels/messages/posts/files,          │
│  마스터 데이터(Branch/Vendor/Item), 상태 어휘         │
└─────────────────────────────────────────────────┘
```

의존 방향은 위에서 아래로만: 모듈 → 플랫폼 → 코어.

## 4. 디렉터리 설계

```text
app/
  (workspace)/
    layout.jsx               # 전역 사이드바: 커뮤니케이션 / 업무 / 관리자 3섹션
    chat/[channelId]/page.jsx
    work/
      inbox/page.jsx         # 전역 승인 인박스
      purchase/page.jsx      # 구매요청
      expenses/page.jsx      # 지출결의
      flower-stock/page.jsx  # 생화·부자재 입고/폐기
      reservations/page.jsx  # 예약주문 (캘린더 뷰)
      marketing/page.jsx
      branch-insights/page.jsx  # 지점 KPI 대시보드
    admin/
      apps/page.jsx          # 앱 레지스트리
  api/
    state/route.js           # 커뮤니케이션 데이터만 (축소 대상)
    work/<module>/...        # 모듈별 API (얇은 라우트 핸들러)

modules/
  registry.js                # 모든 모듈의 매니페스트 등록
  purchase/
    index.js                 # 매니페스트 (5절)
    server/
    ui/
      cards/                 # 채팅 카드
  expenses/  flower-stock/  reservations/  marketing/  branch-insights/

lib/
  core/                      # auth, permissions, prisma, storage, masterData
  platform/                  # agentGateway, agents, botIntegrations,
                             # eventBus, metricsRegistry, workerQueue

components/                  # 코어 UI만

prisma/
  schema/                    # Prisma 6 멀티파일 스키마
    core.prisma              # User, Session, Project, Channel, Branch, Vendor, Item...
    platform.prisma          # AgentApp, AgentRun, BotApp, ApprovalRequest...
    purchase.prisma          # 모듈별 파일
    ...

scripts/
  purchase-worker/           # 현행 유지
```

## 5. 모듈 매니페스트 계약

```js
// modules/purchase/index.js
export const purchaseModule = {
  slug: "purchase",
  name: "구매",
  nav: { label: "구매 관리", href: "/work/purchase", icon: "shopping-cart", minRole: "member" },
  agents: [purchaseAgentDefinition],   // 팀장 에이전트 (13절)
  chatCards: {
    "purchase.order_draft": DraftCard,
    "purchase.request": RequestCard
  },
  channelStateLoader,                  // 채널 화면용 카드 데이터 로더 (선택)
  metrics: [                           // 메트릭 레지스트리 기여 (11절)
    { key: "purchase_spend", label: "구매 지출", unit: "krw", byBranch: true, query }
  ]
};
```

**계약 비대화 방지 규칙:** 매니페스트 신규 필드는 두 개 이상의 모듈이 필요로 할 때만 추가한다. 한 모듈만 필요한 것은 그 모듈의 라우트 페이지 안에서 해결한다.

코드 registry는 사내 코어 모듈용이고, 팀 제작/외부 앱은 DB 기반 앱 레지스트리(13절, docs/agent-bot-framework.md 계승)를 쓴다.

## 6. 채팅 ↔ 모듈 연결 (카드 레지스트리)

1. 에이전트가 채팅 메시지를 만들 때 `Message`에 `cardRef`(cardType + entityId)를 기록 (마이그레이션 1개).
2. 채널 로딩 시 해당 채널의 카드 엔티티만 모듈 `channelStateLoader`로 배치 로드.
3. `MessagesView`는 `cardRegistry[message.cardType]`으로 컴포넌트를 찾는다. 채팅 코어는 "카드" 개념만 알고, 내용은 모듈 소유.

**양방향 링크:** 대시보드 행 → "원본 대화 보기"(레코드의 `channelId`/`messageId` 활용), 채팅 카드 → "대시보드에서 열기". 감사 추적과 맥락 전환을 동시에 해결.

## 7. API/상태 분리

| 데이터 | 현재 | 목표 |
|---|---|---|
| 프로젝트/채널/메시지/게시글/파일 | `/api/state` 폴링 | `/api/state` 유지 (커뮤니케이션 전용으로 축소) |
| 채팅 카드 엔티티 | `/api/state`에 포함 | 채널별 카드 로더 (`/api/channels/:id/cards`) |
| 업무 대시보드 데이터 | 없음 | `/api/work/<module>/...` — 라우트 진입 시 fetch |

규칙: 라우트 핸들러는 얇게, 로직은 `modules/<slug>/server/`에. **모듈 데이터를 `/api/state`에 넣지 않는다** (가장 유혹이 큰 지름길이므로 명시).

## 8. channel.type의 역할 축소

- 표시용 라벨로만 유지. 업무 동작은 `ChannelAgentInstallation`/`ChannelBotInstallation`이 단독 결정.
- 신규 업무 추가 시 채널 타입 enum을 늘리지 않는다.

## 9. UX 표준

### 9.1 업무 화면 공통 문법 (4단 구성)

모든 모듈 대시보드의 기본 템플릿: **요약 지표 → 내 처리 대기 → 전체 목록 → 상세 패널.**
커스텀은 이 틀 안의 "뷰" 수준으로: 예약주문=캘린더 뷰, 입고=일자별 체크리스트, 폐기=사진 증빙 그리드.
문법은 컨벤션이며 코드 제약이 아니다 — 라우트 페이지는 모듈 소유라 어떤 레이아웃도 가능. 강제 항목은 내비 등록, 상태 어휘, 인박스 연동 세 가지뿐.

### 9.2 전역 승인 인박스 (/work/inbox)

지출결의·구매 드래프트·폐기 확정 등 모든 승인 건을 `ApprovalRequest` 기반으로 한 화면에 모은다. 사이드바 최상단 배지 카운트. 결정은 인박스에서, 맥락 확인은 모듈 상세로 점프. 관리자의 하루가 "인박스 비우기"로 단순해진다.

### 9.3 입력은 채팅, 처리는 대시보드

- 지점 직원(모바일·현장): 채팅 멘션+사진으로 입력 → 에이전트가 구조화 → 카드로 즉시 확인
- 관리자(데스크톱): 대시보드/인박스에서 일괄 처리
- 직원 교육은 "멘션 하나"로 끝난다. 모듈별 입력 폼을 따로 만들지 않는다.

### 9.4 상태 어휘·색상 통일

대기/진행/승인/완료/반려/실패 6가지 상태의 이름과 칩 색을 코어 디자인 토큰으로 고정. 모듈이 임의 상태명/색 사용 금지.

### 9.5 알림

상태 변경은 원본 채널의 카드 업데이트로 알린다. 별도 알림 센터는 후순위.

## 10. 데이터 모델 표준

### 10.1 마스터 데이터 기준

**두 개 이상의 모듈이 쓰는 엔티티는 코어 마스터 데이터로 내린다.**

- `Branch` (지점): 채널과 업무 레코드가 참조. 채널에 지점을 연결하면 그 채널에서 생성된 업무 레코드에 지점이 자동 기록된다.
- `BranchAssignment` (userId + branchId + role): 지점관리자/수퍼바이저의 담당 지점 표현.
- `Vendor`, `Item`: 다음 승격 후보. 현재 `PurchaseItem`에 섞인 "품목 정보"와 "구매 설정"의 분리를 Phase 2에서 검토.

### 10.2 권한 2축 (지점 × 역할)

| 역할 | 범위 |
|---|---|
| 직원 | 자기 지점 채널 입력 + 자기 요청 조회 |
| 지점관리자 | 자기 지점 업무 처리 (입고 확정, 폐기 승인) |
| 수퍼바이저 | 담당 지점 묶음 (`BranchAssignment`) |
| 본사 관리자 | 전 지점 + 지출결의 승인 |
| 시스템 관리자 | 앱 레지스트리 |

범위 제한은 UI 숨김이 아니라 서버 서비스 계층에서 강제한다.

## 11. 지점 인사이트 모듈과 메트릭 레지스트리

`modules/branch-insights`: 지점별 KPI·통계를 그래프와 숫자로 시각화. 자기 데이터를 만들지 않고 다른 모듈 데이터를 집계하는 읽기 전용 모듈.

**메트릭 레지스트리 패턴** — 모듈 간 직접 참조 금지를 지키는 방법:

- 각 모듈이 매니페스트 `metrics`에 제공 가능한 KPI를 선언 (key, label, unit, byBranch, query 함수)
- 플랫폼의 `metricsRegistry`가 이를 수집, 인사이트 모듈은 레지스트리만 조회
- 모듈 추가 → KPI 자동 확장 (폐기 모듈 추가 시 폐기율 카드가 코드 수정 없이 등장)

**권한:** 같은 화면, 다른 범위. 본사=전 지점 비교, 수퍼바이저=담당 지점, 지점관리자=자기 지점 추이. 메트릭 서비스가 서버에서 범위를 자른다.

**성능:** v1은 방문 시 실시간 집계. 느려지면 Vercel Cron으로 일별 `MetricSnapshot` 적재(v2) — 전월 대비 추이도 스냅샷으로 싸게 계산. v1→v2는 메트릭 서비스 내부 교체라 다른 코드에 영향 없음.

## 12. 확장 리스크와 가드레일

| 리스크 | 증상 | 예방책 |
|---|---|---|
| 모듈 간 직접 참조 | 예약주문→구매요청 생성 등 연계 시 모듈이 서로 import | 모듈 간 import 금지. 플랫폼 `eventBus` 경유 (예: `reservation.confirmed` 발행 → 구매 모듈 구독). 초기엔 서버 내 디스패처 함수로 충분 |
| 공용 데이터 소유권 분쟁 | 모듈마다 자기 Item 테이블 생성, 또는 남의 테이블 직접 쿼리 | 10.1 마스터 데이터 기준 적용 |
| 매니페스트 계약 비대화 | 코어에 `if (module.slug === ...)` 분기 등장 | 신규 필드는 2개 이상 모듈 필요 시에만 (5절) |
| 공통 문법의 족쇄화 | 칸반/캠페인 빌더가 4단 구성에 안 맞음 | 문법은 컨벤션 (9.1). 이탈 비용은 해당 모듈 폴더 안에서만 지불 |

**집행 장치 (Phase 1에서 설치):**

1. ESLint `no-restricted-imports`: `modules/A` → `modules/B` import를 빌드에서 차단
2. `AGENTS.md`에 모듈 규칙 추가 (이후 어떤 코딩 에이전트가 작업해도 강제)
3. `/api/state`에 모듈 데이터 금지 규칙 명시 (7절)

## 13. 에이전트-봇 자동화 체제

목표: 입고/폐기 등 스프레드시트 수작업 기입을 제거하고, 담당자가 바빠도 경영 데이터가 적시에 모이는 체제. 직원이 Claude/Codex로 직접 개발한 에이전트/봇을 연동할 수 있는 오픈 플랫폼.

### 13.1 팀장 에이전트 패턴 (모듈당 1개)

에이전트는 업무의 "팀장" 역할:

- **창구**: 채널 멘션으로 자연어/사진 입력을 받아 구조화된 레코드(드래프트)로 변환
- **오케스트레이션**: 어떤 봇을 어떤 순서로 실행할지 결정, 결과 취합
- **승인 라우팅**: 사람 결정이 필요한 건을 `ApprovalRequest`로 만들어 인박스에 전달
- **정기 보고**: 주간 폐기 요약 등을 채널에 자동 게시 (적시 공유 문제 해결)
- **리마인드**: 미입력 지점에 채널로 독촉 (데이터 누락 방지)

Purchase Agent가 검증된 첫 사례이며, 이를 표준 에이전트 인터페이스로 추출해 템플릿화한다.

### 13.2 봇 4타입 (docs/agent-bot-framework.md 계승)

봇은 에이전트 아래의 단위업무 수행자로, 채널에 직접 노출되지 않는다:

| 타입 | 예시 |
|---|---|
| internal service | 입고 기록 봇, 폐기 집계 봇 |
| external webhook (직원 개발) | 거래명세서 OCR 봇 |
| local worker | Coupang 워커 (기존) |
| manual handoff | 미지원 벤더 수동 처리 |

### 13.3 입고·폐기 자동화 시나리오 (첫 적용 대상)

```text
직원: #강남점 채널에서 "@생화관리 장미 24송이 폐기" + 사진
  → 생화관리 에이전트가 구조화 (품목/수량/지점/사유)
  → 카드로 즉시 확인 (수정 가능)
  → 지점관리자 인박스에서 확정
  → flower-stock 모듈 데이터 적재 → KPI/대시보드 자동 갱신
```

- **명세서 OCR 봇**: 거래명세서 사진 → 입고 라인 자동 생성. "하나하나 기입" 자체를 제거.
- **시트 동기화 봇 (전환기 한정)**: 확정된 입고/폐기 데이터를 기존 스프레드시트에 자동 기입. 직원 수작업은 즉시 사라지고 경영진은 익숙한 시트를 그대로 보다가, 대시보드 정착 후 시트를 은퇴시킨다.

### 13.4 직원 개발 개방 (오픈 플랫폼)

직원이 만든 봇은 다음 경로로만 연동한다 (DB 직접 접근 금지 — DECISIONS.md 2026-06-08):

1. **앱 레지스트리**: draft → submitted → review → active → disabled → revoked 라이프사이클. 타입/이벤트/스코프/설정 스키마/크리덴셜 요구를 선언.
2. **스코프 토큰**: `BotCredential`(tokenHash, scopesJson — 스키마 기존재)로 최소 권한 발급. 발급/회수 UI 필요.
3. **웹훅 이벤트**: `BotApp.webhookUrl` + `signingSecretHash` + `eventSubscriptionsJson` (스키마 기존재). 서명·재시도를 포함한 전달 파이프라인 구현 필요.
4. **로컬 워커 큐**: 브라우저/세션 의존 작업용 (Coupang 워커 패턴 재사용).

**개발자 경험 — AI 코드젠 친화가 핵심:**

- 봇 스타터 템플릿 저장소 제공: API 클라이언트, 웹훅 수신 골격, 서명 검증 포함
- 템플릿에 `CLAUDE.md`/`AGENTS.md` 동봉 + Chloris API 레퍼런스 문서 → 직원은 "이 템플릿으로 X하는 봇 만들어줘"라고 Claude/Codex에 지시하면 됨
- 샌드박스: 테스트 채널 + dry-run 모드 (실데이터 미반영 실행)

**거버넌스:**

- admin 리뷰 후 활성화, 스코프 최소 원칙, rate limit
- 모든 실행은 `BotEventLog`/`AgentRun`/`AgentToolCall` 감사로그
- kill switch: 채널 단위 disable, 앱 단위 revoke
- 금지선 유지: 최종 결제 자동화 금지, 프로덕션 데이터 삭제 금지, 실메일 발송 승인 필요

### 13.5 성공 지표

- 입고/폐기 1건 기록 소요 시간 (목표: 사진+멘션 10초)
- 발생 → 데이터 반영 리드타임 (목표: 당일)
- 수작업 유지 스프레드시트 수 (목표: 0)
- 직원 제작 활성 봇 수

## 14. 단계별 마이그레이션 계획

### Phase 1 — 라우팅 골격, registry, 가드레일 (동작 변화 없음)

- `app/(workspace)/layout.jsx` 분리, `/chat/[channelId]` 라우트 신설
- `modules/registry.js` + 구매 모듈 매니페스트 (기존 lib 코드 re-export)
- 사이드바 3섹션 (커뮤니케이션/업무/관리자)
- ESLint 모듈 경계 규칙 + AGENTS.md 갱신
- `Branch` + `BranchAssignment` 스키마 추가 (마이그레이션, 사용자 승인 후 프로덕션 적용)
- fetch 유틸을 `lib/core/apiClient.js`로 추출

### Phase 2 — 구매 모듈 이전 + 카드 레지스트리 + 플랫폼 기반

- `lib/purchaseBot`, `lib/agents/purchaseAgent` → `modules/purchase/server/`
- `Message.cardType` 마이그레이션 + 카드 레지스트리 전환
- agentGateway를 registry 디스패치로 교체 + **표준 에이전트 인터페이스 추출 (13.1)**
- 플랫폼 `eventBus` (서버 내 디스패처) + `metricsRegistry` 인터페이스, 구매 모듈에 첫 메트릭 선언
- `/work/purchase` 대시보드 v1 + `/work/inbox` 승인 인박스
- `PurchaseItem`의 품목/구매설정 분리 검토 (Vendor/Item 마스터 승격)

### Phase 3 — 생화관리 모듈로 설계 검증 + 자동화 첫 성과

- `modules/flower-stock`: 입고/폐기, 생화관리 에이전트, 입고 기록 봇, 폐기 집계 봇
- 시트 동기화 봇 (전환기) — 스프레드시트 수작업 제거 첫 가시 성과
- 신규 모듈이 코어 수정 없이 폴더+registry 등록만으로 동작하는지가 설계 성공 기준

### Phase 4 — 상태 분리 + 인사이트

- `/api/state` 축소, 채널 카드 로더 전환
- Prisma 멀티파일 스키마 전환 (파일 분리만, DB 마이그레이션 불필요)
- `modules/branch-insights` v1 (실시간 집계) — 권한 2축 적용

### Phase 5 — 오픈 플랫폼 개통

- DB 앱 레지스트리 라이프사이클 + 제출/리뷰 UI
- 웹훅 전달 파이프라인 (서명/재시도), 토큰 발급/회수 UI
- 봇 스타터 템플릿 + API 문서 + 샌드박스
- 직원 개발 파일럿 1개 (명세서 OCR 봇 권장)
- 이후: `modules/reservations`(캘린더), `modules/expenses`, `MetricSnapshot` 등 수요 순

### 현행 우선순위와의 관계

Coupang 워커 안정화(TODO.md)는 `scripts/`로 이미 분리되어 있어 위 단계와 충돌하지 않는다. 병행 또는 선행 가능.

## 15. 이 설계가 보장하는 것

- 업무 모듈이 늘어도 채팅 코어 코드는 변경되지 않는다.
- 각 업무 폴더만 보면 그 업무의 전부가 보인다.
- 모듈 추가 = 폴더 + registry 한 줄. KPI도 자동 확장된다.
- 직원 제작 봇은 토큰/웹훅/워커 큐로만 연동되고 모든 실행이 감사로그에 남는다.
- 현장 입력(채팅) → 구조화(에이전트) → 처리(인박스/대시보드) → 집계(인사이트)가 하나의 파이프라인이 된다.

## 16. 잔여 결정 사항

1. Phase 1+2를 Coupang 워커 안정화보다 먼저 진행할지, 병행할지
2. 대시보드 fetch에 SWR 도입 여부 (현행 무의존성 기조 유지 vs 편의성)
3. 시트 동기화 봇의 대상 시트와 연동 방식 (Google Sheets API 등) — Phase 3 착수 전 확정
4. `Branch` 도입 시 기존 프로젝트/채널과 지점의 매핑 규칙 — Phase 1 착수 전 확정
