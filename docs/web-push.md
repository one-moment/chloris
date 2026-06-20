# 웹 푸시 (Web Push) — 구현 문서

Chloris PWA의 웹 푸시 알림 기능. 단계별 구현했고 **1~3단계 완료(아이폰 실기기 검증 통과)**, 4단계 예정.

## 단계 현황

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | PWA 토대 (manifest · 서비스워커 · 아이콘) | ✅ 완료 (PR #10) |
| 2 | 구독 저장 (권한요청 + `PushSubscription` DB) | ✅ 완료 (PR #12) |
| 3 | 서버 발송 (web-push + 410 자동정리) | ✅ 완료·실기기 검증 (PR #16) |
| 4 | 이벤트 연결 (새 글/멘션/채널가입 승인요청/작업 승인요청) | ⬜ 예정 |

## 동작 흐름

1. 앱이 `/sw.js`를 등록(`ServiceWorkerRegister`), `app/manifest.js`로 설치형 PWA 제공.
2. 사용자가 사이드바 **"알림 받기"** 토글 → 권한 요청 → `pushManager.subscribe()` → 구독(endpoint+키)을 `POST /api/push/subscribe`로 DB 저장.
3. 서버가 `lib/push.js`의 `sendToUser(userId, {title, body, url})`로 저장된 구독에 발송.
4. 서비스워커 `push` 핸들러가 알림 표시, `notificationclick`이 해당 URL로 포커스/이동.
5. 발송 중 무효(HTTP 410/404) 구독은 자동 삭제.

## 핵심 파일

| 파일 | 역할 |
|---|---|
| `app/manifest.js` | 동적 manifest (브랜드별 name/색상/아이콘) |
| `public/sw.js` | 서비스워커 — push/notificationclick (캐싱 없음) |
| `components/ServiceWorkerRegister.jsx` | SW 등록 (`scope:'/'`, `updateViaCache:'none'`) |
| `prisma/schema*.prisma` `PushSubscription` | User 1:N, `endpoint` unique, `onDelete: Cascade` |
| `app/api/push/subscribe/route.js` | 구독 upsert(POST) / 본인 행 삭제(DELETE), 세션 인증 |
| `lib/push.js` | `sendToUser`(allSettled 기기별 격리, 410/404 정리), `getVapidPublicKey`(유도), `isPushConfigured` |
| `app/api/push/test/route.js` | 셀프 테스트 발송(POST, 본인 기기). 미설정 시 503 |
| `app/api/push/public-key/route.js` | 공개키 반환(GET, 런타임 유도) |
| `components/PushNotificationToggle.jsx` | 토글 + "테스트 알림" 버튼, iOS 미설치/denied 안내 |

## 환경 변수 (중요 — 단순함)

3단계 이후 **필요한 건 사실상 `VAPID_PRIVATE_KEY` 하나**:

| 변수 | 필수 | 비고 |
|---|---|---|
| `VAPID_PRIVATE_KEY` | ✅ | 발송 서명. 공개키는 이 값에서 **유도**(ECDH prime256v1). **커밋 금지, Vercel 환경변수에만.** |
| `VAPID_SUBJECT` | 선택 | mailto:/https. 기본값 `mailto:admin@1moment.co.kr`. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ❌ 불필요 | 공개키 유도로 대체(빌드 인라인/캐시/이름오타 취약점 제거). 명시하면 우선 사용은 됨. |
| `DATABASE_URL` | ✅ | 구독 저장. Vercel/Supabase는 **pooler host** 사용. |

키 생성: `npx web-push generate-vapid-keys`.

## 검증 방법

- 토글 ON → 권한 허용 → `PushSubscription` 행 1개 / 다른 기기 → 행 추가 / OFF → 삭제 / 재토글 중복 없음(upsert).
- "테스트 알림" → 기기 수신(아이폰은 홈 화면 설치 + iOS 16.4+, 앱 백그라운드에서 알림센터 확인).
- 무효 구독 후 재발송 → 410 → 자동 삭제(`removed` 증가).
- `GET /api/push/public-key` 키 반환 = VAPID 설정 정상. `GET /api/health` `database: ok`.

## 운영 노트 (배포 시 함정)

- **Vercel env는 대시보드에서** 설정(파일 `.env.vercel.example`은 템플릿일 뿐, 실값 커밋 금지). 환경 **스코프(Production/Preview)** 정확히 체크.
- **`NEXT_PUBLIC_*`는 빌드타임 인라인** → 값 변경 시 캐시 없는 **재빌드 필요**(빈 커밋은 빌드 캐시를 안 비움). ※ 3단계에서 공개키 유도로 전환하여 이 함정 회피.
- **브랜치 지정(`gitBranch`) env는 Preview 전용** — Production용은 브랜치 비우고(All Branches) 등록.
- **Supabase 직접 host `db.<ref>.supabase.co`는 IPv6-only → Vercel 연결 불가**. 반드시 **pooler host**(`aws-N-<region>.pooler.supabase.com`, 6543 transaction `?pgbouncer=true` / 5432 session).
- 발송은 **Node 런타임 전용**(라우트 `export const runtime = "nodejs"`).
- **Vercel "Sensitive" env는 `vercel env pull`로 값이 안 보임**(빈 값으로 나옴) → 확인하려면 plain으로 재등록. 값을 못 보면 `vercel env pull`이 유일한 확인 수단.
- **회사별 Vercel 프로젝트 = 회사별 Supabase DB.** chloris(보로) 운영 = Supabase `rodzysyxieneykcuokwh`(ap-northeast-2). `DATABASE_URL`이 빈/다른 회사 DB를 가리키지 않게 주의(증상: 로그인 안 됨/사용자 0명).
- **Supabase 6543 트랜잭션 풀러가 Prisma `$queryRaw`(health)에서 `unavailable`** 날 수 있음 → 운영은 **5432 세션 풀러** 사용으로 해결(보로 규모 OK; 고부하 시 `6543?pgbouncer=true&connection_limit=1` 재검토).
- **`/api/auth/me`는 쿠키 없는 요청엔 prerender 캐시(빈 목록)** 를 줄 수 있음 → 외부에서 0명으로 보여도 **로그인(쿠키) 요청은 라이브**. DB 연결 확인은 health + 실제 로그인으로.

## 운영 환경 변수 (현재값, 2026-06-20)
chloris Production 스코프(All Branches, plain):
- `DATABASE_URL` = `…rodzysyxieneykcuokwh…@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres` (세션 풀러)
- `DIRECT_URL` = 동일(5432)
- `VAPID_PRIVATE_KEY` = (설정됨; 값은 비공개)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = 불필요(공개키 유도)
- Supabase 통합 변수(`POSTGRES_*`/`SUPABASE_*`)는 통합이 관리 — 앱은 `DATABASE_URL`만 사용.

## 4단계 (예정) — 이벤트 연결

`sendToUser`를 도메인 이벤트에 연결:
- 새 게시글 / 멘션 / 채널 가입 승인요청 / 작업(에이전트) 승인요청
- 대상 사용자 결정 → `sendToUser(userId, { title, body, url })`. 중복·과다 발송 방지(설정/뮤트), 발송 실패 로깅(민감값 제외).
- **Done when:** 각 이벤트 발생 시 관련 사용자 기기로 실제 알림 수신.
