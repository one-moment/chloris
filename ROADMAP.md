# ROADMAP — Chloris 웹 푸시

> **근거:** `git log --oneline -30`, 최근 변경 파일, 소스 TODO/FIXME 스캔(이 브랜치엔 0건), `HANDOFF.md`, 운영 `prisma migrate status`.
> **범위 주의:** 이 브랜치(`feature/push-subscribe`) = **기반 채팅 MVP + 웹 푸시 1~2단계**. 구매봇·CRM·예약·폐기검수·재고·봇/에이전트 등 플랫폼 기능군은 **다른 feature 라인·운영에 존재하며 이 브랜치 코드엔 없음**(맨 아래 "병행 트랙", 진행도 (추정)).

## 완료된 Phase

### Phase 0 — 기반 채팅 MVP + 2-PC 개발환경 ✅
프로젝트/채널/메시지/Ideas 게시판/댓글·멘션/파일/로그인·세션/봇 실행 개념 + PostgreSQL 마이그레이션 + Vercel·Supabase 배포 + 개발환경 정비(`.nvmrc`/`.gitattributes`/`engines`/`HANDOFF.md`).
- 규모: API 라우트 22개, 컴포넌트 17개, 마이그레이션 4개(이 브랜치 기준).
- **Done when:** 로그인 후 채널에서 메시지·게시판·파일이 동작하고 운영에 배포되어 있다. → 충족.

### Phase 1 — 웹 푸시: PWA 토대 ✅
`app/manifest.js`(동적, 보로 브랜드 확정값), `public/sw.js`(push·notificationclick, 캐싱 없음), `components/ServiceWorkerRegister.jsx`, 아이콘 6종(`public/icons/`), `app/layout.jsx` 메타/뷰포트, `next.config.mjs` `/sw.js` `no-cache`. → PR #10 develop 머지.
- **Done when:** `npm run build`·lint 통과 / Manifest·SW activated / Lighthouse Installable / DevTools self-push 알림+클릭 / iPhone 홈 화면 설치·아이콘 표시.
  - 충족: build·lint·self-push 검증 ✅.
  - iPhone 홈 화면 설치 검증: **(추정) 미확인**(Preview URL 안내까지 완료, 실기기 확인 응답 없음).

### Phase 2 — 웹 푸시: 구독 저장 ✅(코드)·검증 일부 대기
`PushSubscription` 모델(User 1:N, `endpoint` unique, `onDelete: Cascade`, `@@index([userId])`), `POST/DELETE /api/push/subscribe`(세션 인증·endpoint upsert·본인 행만 삭제·민감값 로그 금지), 사이드바 "알림 받기" 토글(권한요청 / iOS 미설치 안내 / denied 안내 / 미구성 비활성). → PR #12 develop 머지.
- **Done when:** 토글 ON→DB 행 1개 / 다른 기기 ON→행 추가 / OFF→삭제 / 같은 기기 재토글 시 중복 없음(upsert) / 미인증 401 / 운영 마이그레이션 적용 / VAPID 공개키 Vercel 등록.
  - 충족: 로컬 API/DB E2E 전부 ✅, 운영 마이그레이션 `add_push_subscriptions` 적용 ✅, VAPID 공개키 Vercel 등록 ✅.
  - **미충족(대기):** Vercel **Preview 실기기 검증** — Preview 스코프에 DB env가 없어 막힘(STATE.md Blockers 참조).

## 예정 Phase

### Phase 3 — 웹 푸시: 서버 발송 (예정)
`web-push` 라이브러리 도입(현재 `package.json` deps에 없음), `VAPID_PRIVATE_KEY`로 서명해 저장된 구독으로 실제 발송, 만료/무효 구독(HTTP 410) 자동 정리.
- **Done when:** 서버에서 특정 사용자의 모든 기기로 알림 발송 성공 / 410 응답 시 해당 구독 행 자동 삭제 / `web-push` 의존성 추가 / 발송 트리거 경로(내부 함수 또는 관리자 테스트 엔드포인트) 존재.
- 선결: `VAPID_PRIVATE_KEY` 확보(리더 메모에 백업됨 — 착수 시 가져오기).

### Phase 4 — 웹 푸시: 이벤트 연결 (예정)
새 글 / 멘션 / 채널 가입 승인요청 / 작업 승인요청 이벤트 → 대상 사용자 기기로 발송.
- **Done when:** 각 이벤트 발생 시 대상 사용자에게 실제 알림 수신(중복·과다 발송 방지 포함).

## 병행 트랙 (이 브랜치 밖 — 진행도 (추정))
- **플랫폼 기능군**(구매봇·CRM·예약·폐기검수·재고·봇/에이전트 레이어): `feature/purchase-bot-mvp`·`feature/crm-*`·`feature/disposal-*`·`design/structural-rail` 라인 + 운영에 존재(운영 마이그레이션 16개 적용 확인). 이 브랜치 코드엔 없음. (추정: `HANDOFF.md`·메모리·운영 마이그레이션 목록 기준.)
- **develop↔prod 정렬**: `develop`(마이그레이션 4) ≪ 운영(16). 기능 라인 통합/정렬은 미해결 조직 과제. (이 세션 `migrate status`로 16 vs 4 직접 확인.)
