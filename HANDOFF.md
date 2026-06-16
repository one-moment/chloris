# HANDOFF — Chloris OS (DELL → Mac 인계)

> DELL(Windows)에서 코드를 정리·커밋한 상태를 Mac(주 개발/배포 환경)으로 넘기기 위한 인계 문서입니다.
> Mac의 Claude Code가 **가장 먼저 이 파일을 읽고** 아래 "⚠️ 먼저 확인" 항목을 처리한 뒤 배포를 진행하세요.

작성일: 2026-06-16 · 작성: DELL 로컬 (Claude Code) · 인계 대상: Mac 로컬 (Claude Code)

---

## 0. 한 줄 요약

DELL에는 **Node/npm이 없어 빌드·배포가 불가**합니다. 그래서 DELL에서는 **코드 정리 + git 로컬 커밋까지만** 했습니다.
**원격 푸시·DB 마이그레이션·Vercel 배포는 Mac에서** 진행합니다. (리더 확정 사항)

**리더 결정 (2026-06-16):**
- 푸시 위치: **Mac** (DELL은 인증이 없어 커밋까지만).
- 원격 저장소: **`https://github.com/one-moment/chloris`**.
- DELL의 이 스냅샷은 `chloris-snapshot.bundle`(git 번들)로 동봉 — Mac에서 원격과 **비교용**으로 사용.

---

## ⚠️ 먼저 확인 (배포 전 필수 — 매우 중요)

### A. 이 코드는 작업지시서가 가정한 브랜치보다 "이전" 스냅샷입니다
이 저장소는 `chloris-main (1).zip`을 푼 것으로, **초기 MVP 상태**입니다.
반면 `WORK-ORDER-borough-design-deploy.md`(원래 한글명 `작업지시서-디자인반영-배포.md`)는
`feature/purchase-bot-mvp` 브랜치(`48fca05`)를 기준으로 작성되어 있고, 그 브랜치에 있다고 가정한
**파일·마이그레이션·스크립트가 이 코드에는 전혀 없습니다.** 실제 확인 결과:

| 작업지시서가 참조 | 이 코드에 존재? |
|---|---|
| `HANDOFF.md` (기존) | ❌ (이 파일은 이번에 새로 작성) |
| `AGENTS.md`, `TODO.md`, `DECISIONS.md` | ❌ 없음 |
| `docs/design-system.md`, `docs/brand-theme-boro.md` | ❌ 없음 |
| `docs/multi-company-split.md`, `docs/templates-and-crm.md` | ❌ 없음 |
| `lib/brand.js`, `public/brand/` (로고/에셋), `public/` 자체 | ❌ 없음 |
| 마이그레이션 `20260614120000_add_post_templates` | ❌ 없음 (아래 표 참고) |
| npm 스크립트 `agent-gateway:test`, `purchase-bot:test` | ❌ package.json에 없음 |
| 멘션 키보드 내비 커밋 `ddf4696` 포함 여부 | ❓ 확인 불가 (zip에 git 이력 없음) |
| `NEXT_PUBLIC_BRAND=borough` 브랜드 처리 | ❓ package.json name은 아직 `mattermost-project-mvp` |

**이 코드에 실제로 있는 Prisma 마이그레이션은 3개뿐입니다:**
- `20260602003000_init_postgres`
- `20260603143000_add_write_path_indexes`
- `20260605093000_add_editing_and_mentions`

➡️ **결론:** 만약 원격 저장소(`one-moment/chloris`)에 이미 `feature/purchase-bot-mvp @ 48fca05`
같은 더 진전된 작업이 있다면, **이 zip 내용을 그 위에 그대로 push 하면 최신 작업이 사라집니다(회귀/유실).**
**절대 force push 하지 말고**, Mac에서 먼저 원격을 `git fetch`해서 이 스냅샷과의 관계를 비교하세요.
(이 zip이 더 최신인지, 원격이 더 최신인지부터 판단해야 합니다.)

### B. 푸시 대상 저장소 — 확정됨: `one-moment/chloris`
- ✅ **확정:** `https://github.com/one-moment/chloris` (리더 결정).
- 참고로 README / `push-to-github.sh` / `GITHUB_UPLOAD.md`에는 옛 주소 `one-moment/mattermost`가 남아있음 → 무시.
- 브랜치는 원격 상태 확인 후 결정(작업지시서 기준 `feature/purchase-bot-mvp`). **이 스냅샷을 main 등에 그대로 덮어쓰지 말 것**(아래 A).

### C. 기본 `.env`가 운영 DB를 가리킬 위험
작업지시서 주의사항대로, DB에 쓰는 작업/테스트는 **대상 `DATABASE_URL`이 의도한 DB가 맞는지 반드시 먼저 확인**.
회사 간 DB 교차(원모먼트·오늘꽃·보로) 금지. (현재 이 저장소의 로컬 `.env`는 SQLite `file:./dev.db`로 안전하게 설정됨.)

---

## 1. DELL에서 한 작업 (이번 인계 범위)

1. `chloris-main (1).zip` → 작업 폴더 루트로 압축 해제 후 **평탄화** (중첩 `chloris-main/` 폴더 제거).
2. **잡파일 제거:**
   - `mattermost-project-mvp.zip` (저장소 안에 들어있던 중첩 zip — 구버전 스냅샷)
   - `download` (실수로 저장된 gitignore 조각 파일)
3. **`.gitignore` 보완:** `.claude/`(세션 로컬 설정), `mattermost-project-mvp.zip` 추가.
4. **`.gitattributes` 신규 추가:** 줄바꿈 LF 정규화 (Windows→Mac CRLF 충돌, `.sh` 깨짐 방지).
5. **한글 파일명 → ASCII 변경:** `작업지시서-디자인반영-배포.md` → `WORK-ORDER-borough-design-deploy.md`
   (macOS의 git 유니코드 정규화 문제 회피. **내용은 한국어 그대로**.)
6. **로컬 `.env` 생성** (`.env.example` 복사, SQLite). gitignore 대상이라 **커밋·푸시되지 않음**.
7. **git 저장소 초기화** (`main` 브랜치) + 최초 커밋. **remote는 일부러 설정하지 않음**(위 B/A 확인 후 Mac에서 설정).

> 검증: 스테이징에 `.env`, `.env.production`, `.claude/`, `node_modules/`, `prisma/dev.db` **포함 안 됨** 확인 완료.

---

## 2. DELL 환경 상태

| 항목 | 상태 |
|---|---|
| git | ✅ 2.54.0 사용 가능 (로컬 커밋 가능) |
| Node / npm | ❌ 미설치 → `npm install`/`build`/`prisma`/배포 **불가** |
| GitHub 인증 | ❌ gh CLI 없음, credential helper 없음, 토큰 없음 → **원격 push 불가** |

➡️ DELL은 "코드 정리 + 커밋" 전용. 빌드/마이그레이션/배포는 Mac에서.

---

## 3. Mac에서 할 일 (배포 절차)

### 3-1. 코드 가져오기 / 원격 비교 (★먼저)
원격은 `one-moment/chloris`로 확정. **이 스냅샷을 올리기 전에 원격이 더 최신인지부터 비교**하세요.

이 인계물에는 DELL 스냅샷이 `chloris-snapshot.bundle`로 동봉되어 있습니다(Slack 전달). 비교 절차:
```bash
# 1) 원격 최신본 확보
git clone https://github.com/one-moment/chloris.git
cd chloris
git fetch --all

# 2) DELL 스냅샷(번들)을 비교용 remote로 추가
git remote add dell /path/to/chloris-snapshot.bundle
git fetch dell

# 3) 원격 최신 브랜치 vs DELL 스냅샷 비교 (어느 쪽이 최신인지 판단)
git log --oneline origin/feature/purchase-bot-mvp -10
git log --oneline dell/main -10
git diff origin/feature/purchase-bot-mvp dell/main --stat
```
➡️ 원격이 더 최신이면(거의 확실) **이 스냅샷은 참고만** 하고 원격 기준으로 작업. `--force` push 금지.

### 3-2. 로컬 실행 확인
```bash
npm install
cp .env.example .env        # 로컬 SQLite
npm run db:push
npm run dev                 # http://127.0.0.1:3000
```

### 3-3. 빌드 검증
```bash
npm run lint
npm run build
```
> 참고: 작업지시서의 `npm run agent-gateway:test` / `purchase-bot:test`는 **이 코드의 package.json에 없음**.
> 해당 테스트가 필요한 배치라면, 그 스크립트가 있는 더 최신 브랜치를 받아야 합니다(위 A 참고).

### 3-4. 운영 배포 (Vercel + Supabase)
자세한 절차: `docs/deploy-vercel-supabase.md`. 요약:
1. Supabase 프로젝트/Storage 생성 → `DATABASE_URL`(pooler), `DIRECT_URL`(direct) 확보.
2. Vercel에 GitHub 저장소 import (Framework: Next.js, Build: `npm run vercel-build` — `vercel.json`에 지정됨).
3. Vercel 환경변수: `.env.vercel.example` 항목을 실제 값으로 등록.
4. DB 스키마 반영 (대상 DB 재확인 후):
   ```bash
   DATABASE_URL="postgresql://..." DIRECT_URL="postgresql://..." npm run db:push:postgres
   ```
5. 배포 후 점검: `GET /api/health` → `health ok / database ok`, 첫 관리자 가입, 초대코드, 글/댓글/첨부.
6. 배포 id·로그 기록 (작업지시서: `#배포로그` Ideas 게시판).

---

## 4. 지켜야 할 선 (작업지시서 발췌)

- 모듈 경계 유지(`npm run lint` 가드레일). core↔module 경계 깨지 않기.
- 고객/개인정보(PII)는 **로그·커밋 금지**.
- 요청 범위 밖 변경, 파일/DB 삭제, `git push --force` / `reset --hard` **금지**.
- 비밀키는 코드에 직접 쓰지 말고 `.env`만 사용.
- 커밋 메시지는 **한국어**, 테스트 통과 후에만 커밋.

---

## 5. 프로젝트 개요 (빠른 파악)

- **무엇:** Mattermost 스타일 사내 협업 MVP — `프로젝트 > 채널 > Messages / Ideas / Files`.
- **스택:** Next.js(App Router) 15 + React 19 + Prisma. 로컬 SQLite(`schema.prisma`) / 운영 PostgreSQL(`schema.postgres.prisma`).
- **첨부:** inline(개발) 또는 S3 presigned(운영, Supabase Storage 호환).
- **인증:** 이메일/비번 + httpOnly 세션 쿠키. 첫 계정 자동 `admin`, 이후 초대코드 가입.
- 더 자세히: `README.md`, `PLAN.md`, `docs/`.

---

## 6. 미해결 / 리더 확인 필요

- [x] **B.** 푸시 대상 = `one-moment/chloris`, 푸시 위치 = Mac. (리더 확정 2026-06-16)
- [ ] **A.** 이 스냅샷 vs 원격 최신본 관계 — 어느 쪽이 최신? (회귀 방지 / 3-1 절차로 비교)
- [ ] **C.** 브랜치 확정 (작업지시서 기준 `feature/purchase-bot-mvp`) — 원격 확인 후
- [ ] **D.** 보로 디자인 반영 / 템플릿 마이그레이션 / 멘션 내비 배치 — 이 코드 기준으로 새로 할지, 최신 브랜치를 받아서 할지
- [ ] 대상 운영 DB(`DATABASE_URL`)가 의도한 회사(보로) DB가 맞는지
