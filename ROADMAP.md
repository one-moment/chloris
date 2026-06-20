# ROADMAP

엔진: Next.js App Router + Prisma + Supabase(PostgreSQL) 기반 사내 커뮤니케이션·업무 MVP.
데이터 모델: `프로젝트 > 채널 > Messages / Ideas / Files`. 채널 타입: 일반 소통 / 구매요청 / 입고 / 출고 / 재고관리.
현재 운영 인스턴스: **오늘꽃(onul-kkot)** — `https://onul-kkot.vercel.app` (Vercel icn1 + Supabase ap-northeast-2).

> 근거: `git log --oneline -30`, 최근 변경 파일, `PLAN.md`, `README.md`, `prisma/schema.postgres.prisma`, `docs/`, 라우트/컴포넌트 목록. 코드 내 TODO/FIXME 없음, 테스트 스크립트 없음(lint만).
> 미래 단계의 순서·번호는 (추정)이며, 각 항목 옆에 근거 또는 (추정)을 표시함.

---

## 완료된 Phase

### Phase 0 — 정적 목업 & 로컬 개발 기반 ✅
- `index.html` / `styles.css` / `app.js` 정적 목업, Next.js 로컬 개발 안정화.
- 근거: `19c4413 Stabilize Next.js local development`, `6f8a0ee Start backend API routes`.
- **Done when:** 정적 목업이 뜨고 `npm run dev`로 Next 앱이 동작한다. ✅

### Phase 1 — 프론트엔드 채널 중심 구조 ✅
- `app/page.jsx` 상태 orchestration + 컴포넌트 분리(ProjectSidebar / Topbar / MessagesView / IdeasView / PostCard / FilesView / AutomationPanel / BotRunList), 샘플데이터·자동화 payload 로직을 `lib/`로 분리.
- 근거: `PLAN.md` Phase 1(완료 표기), `components/` 13개, `ed1a966 Connect frontend actions to API mutations`.
- **Done when:** 프로젝트/채널 전환·Messages/Ideas/Files 탭이 컴포넌트로 동작한다. ✅

### Phase 2 — 백엔드 API & 데이터 모델 ✅ (일부 잔여 → Phase 6으로 이월)
- Prisma 스키마(`schema.prisma` SQLite dev / `schema.postgres.prisma` 운영), 마이그레이션 3건(init / write-path-indexes / editing-mentions).
- API 전반: auth(register/login/logout/me), projects, channels(+삭제), messages, posts(+상태), comments, files, invites, bot-runs, uploads/presign, state, health, users.
- 인증/세션(httpOnly 쿠키)·비밀번호 해시·초대코드·`ALLOW_PUBLIC_SIGNUP`, 첨부(inline + S3 presign), 멘션·타임스탬프·편집(`editedAt`)·게시글 상태, write-path 지연 최적화.
- 근거: `app/api/**/route.js`(21개), `prisma/migrations/`, `PLAN.md` Phase 2(완료 다수), `31eb888 Add timestamps editing and mentions`, `cf7548b Optimize write path latency`, `05a99f7 Support improvement request statuses`.
- **Done when:** 로그인 사용자가 프로젝트/채널/메시지/Ideas/댓글/파일/봇실행을 만들면 DB에 반영되고 작성자가 기록된다. ✅
- **잔여(미완):** 봇 등록 CRUD(`/api/bots` 라우트 없음), 입력 검증 강화, 채널별 권한 모델 — `PLAN.md` Phase 2 "다음 작업"에 명시. → Phase 5·6으로 이월.

### Phase 3 — 운영 배포 기반 ✅
- Vercel(`vercel.json`, region `icn1` 서울) + Supabase(Postgres/Storage), Docker/Caddy 대안 구성, 백업 스크립트, 배포 문서(`docs/deploy-vercel-supabase.md`).
- **오늘꽃(onul-kkot) 운영 인스턴스 배포(2026-06-20):** Supabase 서울(ap-northeast-2, `xakudnwgvssubaqrnafg`)로 마이그레이션 적용 → 운영 env 등록 → 배포 → 첫 관리자 생성 → 가입 잠금(`ALLOW_PUBLIC_SIGNUP=false`). 보로(`chloris` 프로젝트)와 Vercel·DB 분리.
- 근거: `495395c Pin Vercel functions to Seoul region`, `6bca018 Add production deployment foundations`, `a095e8d Add Vercel Supabase deployment profile`, 이번 세션 배포 기록. (오늘꽃 배포 상세는 사내 메모리/`#배포로그`)
- **Done when:** 운영 URL에서 `/api/health`가 `ok / database ok`, 첫 관리자 생성·외부 가입 차단(403)이 확인된다. ✅ (`https://onul-kkot.vercel.app`)

### Phase 3.5 — 오늘꽃 브랜드 디자인 시스템 적용 ✅ (2026-06-20)
- 브랜드 디자인 시스템 v1.0(mood A "새벽 시장")을 CSS 토큰으로 적용: `styles.css` `:root`에 `--oht-*` 레이어(컬러·타이포·radius·그린틴트 그림자·모션) + 기존 시맨틱 변수명 유지하며 값만 오늘꽃 팔레트로 리맵 → 컴포넌트 전체 재스킨.
- Pretendard(제품 UI)/Nanum Myeongjo(브랜드 히어로) 폰트, 코랄 CTA(`.primary-button`), 로그인 명조 워드마크, 숫자 `tabular-nums`, 미정의였던 `--ink` 정의(버그 수정).
- 근거: `/Users/user/Downloads/오늘꽃 디자인 시스템.pdf`, 변경 파일 `styles.css`·`app/globals.css`·`app/layout.jsx`·`components/AuthScreen.jsx`·`index.html`. 로직 변경 0.
- 범위 제외: PDF 예시 화면(실시간 시세·검수 리포트·사입 명세서)은 토큰이 아닌 **미구현 기능** → Phase 4~5에서 구현.
- **Done when:** 앱 전역이 오늘꽃 그린 팔레트·폰트로 렌더되고 `npm run build`/`npm run lint`가 통과한다. ✅

---

## 예정 Phase

### Phase 4 — 오늘꽃 계산서(팝빌) 연동 ◀ 현재 진행
- 현재 상태: `popbill@1.64.2` 설치 + 시그니처 검증 노트(`docs/popbill-taxinvoice-verification.md`)만 존재. **어댑터 `lib/popbill.js` 미구현**, `POPBILL_*` env 미등록, 발행 UI/API 미연결.
- 할 일:
  1. `lib/popbill.js` 어댑터 구현 — 검증노트의 **정정된 호출순서** 준수(`registIssue`/`cancelIssue`/`delete`의 콜백 위치, `userId = process.env.POPBILL_USER_ID || ""`).
  2. `POPBILL_*` env 설계(LinkID/SecretKey/사업자번호/UserID) 및 운영 등록.
  3. `getBalance`/`getInfo` 실통신 검증(응답 필드 casing 확인).
  4. 계산서 발행/취소 API·UI를 채널/게시글 흐름에 연결.
- 근거: `162dcdc 오늘꽃 계산서: 팝빌 SDK 설치 및 시그니처 검증`, `docs/popbill-taxinvoice-verification.md`(1단계 검증 / 3단계 어댑터 예정 명시).
- **Done when:** 팝빌 테스트 자격증명으로 `getBalance`/`getInfo` 성공 + 계산서 발행·취소가 동작하고, 운영 env가 등록된다.

### Phase 5 — 봇/자동화 실 구동 (PLAN.md Phase 4) (추정 순서)
- 현재 상태: `Bot`/`BotRun` 모델 + `AutomationPanel`/`BotRunList` + `bot-runs` API는 **기록/개념 레이어**. 실제 봇 실행 서버 호출은 `PLAN.md` "제외 기능"으로 미구현. **봇 등록 CRUD 미구현.**
- 할 일: 봇 등록 CRUD → 구매봇(쿠팡/지마켓 등) 실행 워커 연결 → **결제 직전 승인/반려 워크플로우** → 입고/출고/재고 스프레드시트 API 연결 → 봇 실행 권한·감사 로그·재시도.
- 근거: `prisma` `Bot`/`BotRun`, `components/AutomationPanel.jsx`·`BotRunList.jsx`, `lib/automation.js`, `PLAN.md` Phase 4.
- **Done when:** 채널에서 봇 실행 → 외부 워커 호출 → 결과 payload 기록 → 승인/반려로 상태 전이가 한 사이클 동작한다. (실제 결제는 항상 사람 승인 후 — 자동화 금지)

### Phase 6 — 운영 강화: 스토리지·입력검증·권한 (Phase 2 잔여 통합) (추정 순서)
- S3 전환: 오늘꽃 운영은 현재 `STORAGE_PROVIDER=inline`(첨부=DB 인라인). 서울 Supabase Storage 버킷 + S3 키 등록 후 `STORAGE_PROVIDER=s3` 전환.
- 입력 검증 강화, 채널별 권한 모델, 역할 세분화(현재 `admin`/`member` 2단계).
- 근거: `lib/storage.js`(inline 폴백), `app/api/uploads/presign/route.js`, `PLAN.md` Phase 2 "다음 작업"·Phase 5 "권한 모델 고도화".
- **Done when:** 오늘꽃 운영에서 첨부가 S3로 업로드되고, 역할/채널 기준 접근 제어가 적용된다.

### Phase 7 — CI/CD & 품질 (추정)
- GitHub 연동 자동배포: `feature/oneulkkot` origin push 완료, **대시보드 Git 연결 + Production Branch 지정 잔여**.
- 테스트 도입(현재 lint only), TypeScript 전환(추정 — `PLAN.md` Phase 1 "다음 작업"으로 언급).
- 근거: `package.json` scripts(test 없음), 이번 세션 push, `PLAN.md` Phase 1.
- **Done when:** `feature/oneulkkot` push가 자동 운영배포로 이어지고, 테스트 스위트가 통과한다.

### Phase 8 — Mattermost 연동 (PLAN.md Phase 3) (추정 — 보류 가능)
- 팀/채널 생성, 채널 멤버 관리, 게시글/댓글/봇 결과 알림, 멘션 매핑.
- 주의: 레포명은 `mattermost`지만 **실제 Mattermost 서버 연동은 현재 없음**(자체 Next.js 앱). 제품 방향상 우선순위·실행 여부는 (추정).
- 근거: `PLAN.md` Phase 3, `PLAN.md` "제외 기능: 실제 Mattermost 서버 연동".
- **Done when:** 프로젝트 생성 시 Mattermost 팀/채널이 생성되고 앱 이벤트가 Mattermost로 알림된다.
