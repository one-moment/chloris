# STATE

> 이 레포의 현재 상태 스냅샷. 근거: `git log`, 최근 변경 파일, 코드(라우트/모델/`lib`), `PLAN.md`/`README.md`/`docs/`. 추측은 (추정) 표시.

```text
RESUME
──────────────────────────────────────────────────────────────
현재 Phase : Phase 4 — 오늘꽃 계산서(팝빌) 연동
             (직전 Phase 3 운영배포 완료: onul-kkot 서울 인스턴스 가동)

이 Phase 목표 :
  팝빌(popbill) 전자(세금)계산서 발행 기능을 오늘꽃 인스턴스에 실제 연결.
  현재는 SDK 설치 + 시그니처 검증 노트까지만 되어 있고, 어댑터/ENV/UI가 없음.

바로 다음 할 일 :
  1) lib/popbill.js 어댑터 구현 — docs/popbill-taxinvoice-verification.md의
     정정된 호출순서대로(registIssue/cancelIssue/delete 콜백 위치,
     userId = process.env.POPBILL_USER_ID || "").
  2) POPBILL_* env 설계(LinkID/SecretKey/사업자번호/UserID).
  3) getBalance/getInfo 실통신 검증(응답 필드 casing 확인).
  4) 발행/취소 API·UI를 채널/게시글 흐름에 연결.

막힌 것 (Blockers) :
  - 팝빌 테스트 LinkID/SecretKey/사업자번호 미확보 → getBalance/getInfo
    실통신 검증 불가. (근거: docs/popbill-taxinvoice-verification.md "미검증(자격증명 필요)")
  - (병행 대기) 오늘꽃 GitHub 연동 자동배포: 대시보드 Git 연결 +
    Production Branch=feature/oneulkkot 지정 잔여(사용자 작업).
  - (병행 대기) 오늘꽃 운영 첨부 S3 미연결(현재 inline) — Supabase Storage
    버킷/키 받으면 전환.
──────────────────────────────────────────────────────────────
```

## 코드/배포 스냅샷

- **스택:** Next.js 15 App Router + React 19 + Prisma 6 + Supabase PostgreSQL. 빌드 `npm run vercel-build`(`prisma generate` → `next build`).
- **체크아웃 브랜치:** `claude/mystifying-gould-bb9179` (= `feature/oneulkkot` 내용, 동일 커밋 라인). HEAD `fbf9930`(작업 보존 커밋 — 작업지시 문서 1개).
- **데이터 모델(`prisma/schema.postgres.prisma`):** Project, Channel, User, Session, Invite, Message, Post, Comment, File, Bot, BotRun. 마이그레이션 3건.
- **API 라우트:** `app/api/**/route.js` 21개(auth/projects/channels/messages/posts/comments/files/invites/bot-runs/uploads/state/health/users). **`/api/bots`(봇 등록 CRUD) 없음.**
- **운영:** `https://onul-kkot.vercel.app` (Vercel team `one-moment-1808`, project `onul-kkot`, region icn1) + Supabase 서울(ap-northeast-2, `xakudnwgvssubaqrnafg`). `/api/health` = ok / database ok. 가입 잠김. 보로(`chloris`)와 분리.

## 완료 / 미완 요약

완료:
- 채팅(Messages)·게시판(Ideas)·파일(Files) MVP, 멘션·편집·타임스탬프·게시글 상태·채널 삭제.
- 인증/세션/초대코드/가입정책, 첨부(inline + S3 presign 코드), health, write-path 최적화.
- 운영 배포 기반(Vercel+Supabase, Docker/Caddy 대안, 백업) + 오늘꽃 서울 인스턴스 배포.

미완(근거 있는 미완성):
- **팝빌 계산서:** `lib/popbill.js` 없음, `POPBILL_*` env 없음, 발행 UI/API 없음 (SDK+검증노트만).
- **봇/자동화 실 구동:** 실제 봇 실행 서버 호출 없음(`PLAN.md` 제외 기능), 봇 등록 CRUD 없음.
- **운영 S3:** 오늘꽃은 inline 사용 중(S3 미전환).
- **권한:** `admin`/`member` 2단계만, 채널별 세부 권한 없음 (`lib/permissions.js`).
- **테스트:** 없음(`package.json`에 test 스크립트 없음, lint만). TypeScript 전환도 안 됨 (추정 — `PLAN.md`가 향후 과제로 언급).
- **Mattermost 실연동:** 없음(레포명만 mattermost) (추정 — 보류 가능).

## 참고/주의

- 코드 내 `TODO`/`FIXME`/`HACK` 주석 **없음**(검색 결과 0건). 미완성 판단은 "파일 부재 + PLAN/README/docs의 명시"에 근거.
- `main` 브랜치는 stale 가능성 — 작업이 feature 브랜치 라인 위에 스택됨 (추정).
- 운영 DB는 운영 인스턴스를 가리키므로 로컬 테스트에 운영 `DATABASE_URL` 사용 금지.
