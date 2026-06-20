# STATE — Chloris

> 작성 2026-06-19 · 브랜치 `feature/push-subscribe` 기준 · 자세한 단계는 [ROADMAP.md](ROADMAP.md)

## RESUME

- **현재 Phase:** Phase 2 (웹 푸시 — 구독 저장) **마무리 단계**.
  코드·운영 마이그레이션·VAPID 공개키 등록 완료, PR #12 develop 머지됨. 남은 건 Preview 실기기 검증 1건. 그다음이 Phase 3.

- **이 Phase 목표:** 사용자가 기기에서 알림을 켜면 그 기기의 구독(endpoint + 암호화 키)을 서버 DB에 저장하고, 끄면 삭제한다. (실제 발송은 Phase 3.)
  → **코드상 목표 달성**(로컬 API/DB E2E 통과). 남은 건 **Vercel Preview에서 실기기로 토글 동작 최종 확인.**

- **바로 다음 할 일:**
  1. Vercel **Preview 스코프**에 유효한 staging `DATABASE_URL`/`DIRECT_URL` 등록 — Supabase **Connect** 의 Session/Transaction **pooler** 문자열(올바른 project ref 포함). (NEXT_PUBLIC_VAPID_PUBLIC_KEY는 Preview에 이미 있음.)
  2. 스테이징 DB에 스키마 적용: `npx prisma migrate deploy --schema prisma/schema.postgres.prisma` (staging 접속정보로).
  3. develop preview 재배포 → 로그인 → 사이드바 "알림 받기" → 권한 허용 → staging `PushSubscription` 행 생성/삭제 확인 → iPhone 홈 화면 추가 후 동일.
  4. 검증 끝나면 **Phase 3(서버 발송)** 착수.

- **막힌 것 (Blockers):**
  1. **Preview 실기기 검증 불가** — Vercel **Preview 스코프에 `DATABASE_URL` 없음** → 로그인 등 DB 라우트가 500(`/api/health` = `missing DATABASE_URL` 확인). 제공된 staging 접속정보는 무효: 직접 호스트 `db.<ref>.supabase.co` **DNS NXDOMAIN**, 풀러는 **`tenant/user not found`** → **project ref 미해결**(오타 또는 미프로비저닝, 추정). → **유효한 Session pooler 연결 문자열**이 있어야 진행.
  2. **develop↔prod 마이그레이션 분기** — `develop` 4 ≪ 운영 16(이 세션 직접 확인). 이번 추가 마이그레이션은 독립적이라 안전 적용됐으나, 라인 정렬은 별도 과제. (조직 과제 — (추정) 우선순위.)
  3. **Phase 3 선결값** — 발송엔 `VAPID_PRIVATE_KEY` 필요. 로컬 `.env`엔 없을 수 있음(워크트리 정리 예정). **리더 메모에 백업됨** → Phase 3 착수 시 가져와 `.env`/Vercel에 주입.

## 한 줄 요약
웹 푸시 1·2단계(PWA 토대 + 구독 저장) 코드 완료·develop 머지·운영 마이그레이션 적용·공개키 등록. 즉시 막힌 건 Preview용 staging DB 연결(접속정보 무효), 이후 Phase 3(서버 발송).

## 이 문서의 근거
- `git log --oneline -30` — 이 브랜치 = 기반 MVP + 웹 푸시 1·2단계(구매/CRM 등 미포함).
- 소스 TODO/FIXME/HACK 스캔: **0건**.
- `HANDOFF.md` — 활성 기능 개발은 다른 feature 라인, 이 라인은 정비/기반용임을 명시.
- 운영 `prisma migrate status` — 운영 16 적용 / 이 브랜치 4.
- 세션 메모리 `web-push-status.md`.
- "(추정)" 표시 = 이 브랜치 코드 밖(운영·타 브랜치·미확인 검증)에서 추론한 항목.
