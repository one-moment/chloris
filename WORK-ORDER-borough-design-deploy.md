# 작업 지시서 — [브랜드:보로] 완성 디자인 반영 → 테스트 → 운영 배포

> Claude Code에게 그대로 전달하는 브리프입니다.

## 레포 / 브랜치
- 레포: https://github.com/one-moment/chloris  (이미 로컬에 있으면 그 폴더)
- 브랜치: `feature/purchase-bot-mvp` (최신 `48fca05`)
- 운영 인스턴스: 보로(`NEXT_PUBLIC_BRAND=borough`), 현재 운영 URL `mattermost-project-mvp.vercel.app`

## 먼저 읽을 것 (이 레포가 최종 기준)
`HANDOFF.md`, `AGENTS.md`, `TODO.md`, `DECISIONS.md`,
`docs/multi-company-split.md`, `docs/templates-and-crm.md`,
그리고 디자인 산출 문서 `docs/design-system.md`(공통) · `docs/brand-theme-boro.md`(보로 테마).
> 디자인 문서가 아직 레포에 없으면, 리더가 전달하는 디자인 요약을 기준으로 하고, 같은 위치에 글 요약으로 먼저 커밋하세요.

## 이번 작업 (한 배치)
Claude Design이 완성한 보로 디자인 가이드를 **보로 인스턴스에 반영**합니다.
- 적용 위치(기존 방식 유지): 토큰은 `styles.css`, 브랜드 크롬은 `app/globals.css`, 로고/에셋은 `public/brand/`, 테마 스코프는 `data-brand`.
- 공통 시스템과 보로 테마를 구분해 반영. 색 토큰 이름은 디자인 문서와 `lib/brand.js`/테마 기준에 맞추세요.
- 범위는 "디자인 반영"으로 한정. 기능 추가·리팩토링은 이 배치에 넣지 마세요.

## 지켜야 할 선
- **모듈 경계 유지** (`AGENTS.md` 규칙, `npm run lint` 가드레일). core↔module 경계를 깨지 마세요.
- 고객/개인정보(PII)는 **로그·커밋 금지** (`AGENTS.md`).
- 요청 범위 밖 변경, 파일/DB 삭제, `git push --force`/`reset --hard` 금지.
- 비밀키는 코드에 직접 쓰지 말고 `.env`만.

## 코드 작성 전에 (보고 후 승인)
실제 디자인 문서를 확인한 뒤 **① 바꿀 파일 목록 ② 적용할 토큰/컴포넌트 ③ 예상 영향(화면 변화 범위)** 을 리더에게 먼저 보고하고 승인받으세요.

## 테스트 (완료 기준)
- `npm run lint`, `npm run build` 통과
- `npm run agent-gateway:test`, `npm run purchase-bot:test` 통과
- DB에 쓰는 테스트는 **기본 `.env`가 운영 DB를 가리킬 수 있으니** 함부로 실행하지 마세요 (HANDOFF 주의사항).
- 화면 확인: 보로 테마(색/로고/타이포)가 디자인 문서대로 보이고, 기존 채팅·게시판·업무 메뉴 동작이 깨지지 않는지.

## 운영 배포 (★배포 직전 리더 최종 확인)
이번 배포는 아래 셋을 **한 번에** 올립니다 (리더 승인 완료):
1. 보로 디자인 반영 (스타일)
2. 멘션 키보드 내비 — 커밋 `ddf4696`이 **이미 이 브랜치에 포함**돼 있어 이번 배포 시 자동으로 함께 나갑니다 (별도 작업 불필요).
3. 템플릿 마이그레이션 `20260614120000_add_post_templates` (additive, `channelId` 포함) — 보로 운영 DB에 적용.
   - ⚠️ 대상 `DATABASE_URL`이 **보로 운영 DB**가 맞는지 반드시 먼저 확인 (회사 간 DB 교차 금지).
- 순서: 테스트 통과 → 리더에게 배포 직전 보고/확인 → `prisma migrate deploy` → 코드 배포 → `health ok / database ok` 확인 → 배포 id 기록.
- **배포 로그를 `#배포로그` Ideas 게시판에 기록** (예: `post-deploy-log-20260614-borough-design-templates-mention`).

## 커밋
- 테스트 통과 후에만, **한국어 커밋 메시지**로.
- 예: `보로 디자인 시스템 2차 반영 (스타일만, 동작 변경 없음)`

## 작업 후 리더에게 보고
무엇을 했는지 / 어떤 위험이 있는지 / 리더가 어떻게 확인하면 되는지(운영 URL·배포 로그 위치) 요약.

---
### 리더 결정 (확정)
- [x] 템플릿 마이그레이션(`20260614120000_add_post_templates`): 이번 디자인 배포에 **함께** 올림.
- [x] 멘션 키보드 내비(`ddf4696`): 이번 배포에 포함 (이미 브랜치에 있어 자동 반영).
- [x] 인프라 분리(원모먼트·오늘꽃 Supabase·Vercel): **보로 완료 후 순서대로** — 이번 배포 범위 아님.
