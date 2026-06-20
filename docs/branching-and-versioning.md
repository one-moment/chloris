# Chloris 브랜치·버전 관리 지침

> 위치 제안: `docs/branching-and-versioning.md` (영구 거버넌스 문서)
> 전제: 코드 1벌 → Vercel 3 프로젝트(원모먼트·보로·오늘꽃) → 회사별 Supabase. 브랜드 차이는 `NEXT_PUBLIC_BRAND` + 회사별 DB뿐.

## 0. 한 줄 원칙

**작게, 자주 통합한다.** 이번 정리 사태(147커밋짜리 feature 브랜치가 사실상 트렁크가 됨)는 코드가 나빠서가 아니라 *통합 규칙이 없어서* 생겼다. 아래 규칙은 그 재발을 막는 최소 집합이다.

## 1. 브랜치 모델 (3단)

| 브랜치 | 분기원 | 병합 대상 | 수명 |
|---|---|---|---|
| `main` | — | — | 영구 (운영/릴리스, 보호) |
| `develop` | `main`(최초 1회) | — | 영구 (통합 트렁크, 항상 배포 가능) |
| `feature/*` | `develop` | `develop` (PR) | 며칠 |
| `fix/*` | `develop` (긴급은 `main`) | `develop`(+`main`) | 시간~하루 |
| `release/*` | `develop` | `main` + `develop` | 짧게 |
| `chore/*` | `develop` | `develop` | 짧게 |

- **네이밍**: `feature/crm-followups`, `fix/login-cookie`, `chore/rename-package`. kebab-case. **1기능 = 1브랜치 = 1PR**.
- **`main`은 `develop`에서 릴리스 머지로만** 갱신. `develop`은 Vercel preview가 가리킨다.
- **장수 feature 브랜치 금지.** feature는 며칠 내 머지, `develop`에 자주 rebase. (이번 사태의 직접 원인이므로 1순위 규칙.)

## 2. 병렬 Claude Code 세션 + worktree

동시 2~5세션을 굴리는 환경에 맞춘 규칙.

- **세션 1개 = worktree 1개 = feature 브랜치 1개.** loop 상태가 서로 섞이지 않게 격리.
- worktree 위치는 한 곳으로 고정(예: `.worktrees/<branch>`)하고 `.gitignore`에 등록.
- **worktree는 백업이 아니다.** 세션 진행 중 수시로 커밋·푸시한다. 디스크에만 있는 작업은 *없는 작업*이다. (이번 `bold-colden` worktree가 거의 그 함정이었음.)
- 세션이 한 단위를 끝내면 **즉시 PR**. 쌓아두지 않는다.
- Ralph loop는 완료 게이트(`npx tsc --noEmit` / `next build`)를 통과한 상태에서만 푸시 → 깨진 코드가 `develop`로 흘러가지 않음.

## 3. 두 대(DELL/Mac) 워크플로

- DELL=개발, Mac=테스트·배포. **시작 전 항상 `pull`, 기기 전환 전 항상 `push`**. `HANDOFF.md` 체크리스트 갱신.
- `.gitattributes`(개행 정규화)·`.nvmrc`(Node 고정) 유지.
- **파괴적 이력 작업(force-push, `reset --hard`, 브랜치 삭제)은 "전체·최신 클론"에서만.** 부분/구버전 클론에서는 절대 금지. (단, 기존 로컬 작업을 *커밋·푸시*하는 것은 어느 기기에서나 안전 — 회수는 그 작업이 있는 기기에서 한다.)

## 4. 버전(태그) 정책 — CalVer

내부 Work OS + 연속 배포라 호환성 SemVer는 과함. **CalVer** 권장.

- 형식: `vYYYY.0M.PATCH` (예: `v2026.06.0`, 같은 달 두 번째 배포면 `v2026.06.1`).
- **운영 배포(=`main` 머지)마다 태그.** 태그가 곧 롤백 지점이며, Vercel 배포ID와 함께 실질 롤백 단위.
- 호환성 깨는 변경은 태그 메시지/CHANGELOG에 명시(내부라 major 버전까진 불필요).
- 배포 로그는 기존대로 `#배포로그` 보드에도 기록.

## 5. 릴리스·배포 흐름 (3브랜드)

- **릴리스 = `develop`→`main` 머지 → 태그 → Vercel이 `main`을 3개 프로젝트에 자동 배포.**
- **커밋 1개 → 배포 3개.** 브랜드 차이는 env(`NEXT_PUBLIC_BRAND`) + 회사별 DB뿐. **브랜드를 브랜치로 만들지 않는다.**
- 마이그레이션: DB 3개를 각각 `prisma migrate deploy`(대상 URL 명시). **회사 간 DB 교차 금지.** `db push`는 dev/scratch 전용.

## 6. CI 게이트 (깨진 머지 차단)

- `develop`/`main` 대상 PR 필수 통과: `npm ci` → `npm run lint`(모듈 경계 포함) → `npx tsc --noEmit` → `npm run build` → `prisma migrate status`(드리프트 검사).
- 브랜치 보호(GitHub Settings → Branches): PR 필수, `main`·`develop` 직접·force push 금지, CI green 필수.

## 7. 벽에 붙일 5줄

1. feature는 며칠, 매일 push, PR 작게.
2. 브랜드는 env — 절대 브랜치 아님.
3. 운영 배포마다 태그.
4. 파괴적 작업은 전체 클론에서만.
5. DB는 migrate로, 회사 간 교차 금지.
