# chloris 기획 정리 (기획 정본 · 개요)

> 이 문서는 **기획 개요 + 색인**입니다. 상세·정본 스펙은 레포의 문서들(아래 "정본 문서")을 따르고,
> 이 문서와 충돌하면 **레포 문서가 우선**합니다(발견 시 리더에게 보고).
> 작성: 기획자(claude.ai의 Claude). 실제 구현 구조에 맞춰 정리.

## 0. 한 줄 요약
Chloris = 사내 Work OS. 원모먼트·보로플라워마켓·오늘꽃 3사를 **1개 레포 / 회사별 Vercel·Supabase**로 운영.
채팅·게시판이 공통 코어, CRM·예약은 보로 전용 모듈.

## 1. 실제 아키텍처 (현행)
- **1개 레포** (`one-moment/chloris`). 회사 구분은 환경변수 **`NEXT_PUBLIC_BRAND`** + `lib/brand.js`.
- 브랜드 전용 기능은 **`modules/registry.js`의 모듈 게이팅**으로 켜고 끔(끼우는 자리).
- **배포·DB는 회사별로 분리** (Vercel 프로젝트 + Supabase ×사). 진행 순서: **보로 먼저** → 원모먼트·오늘꽃.
> 초기에 검토했던 "공통 코어 레포 + 브랜드 레포 3개 + npm 패키지" 안은 **채택하지 않았습니다.**

## 2. 공통(코어) vs 브랜드 모듈
- **공통 코어:** 인증/계정, 프로젝트>채널 구조, 지점(branches), 채팅(Messages), 게시판(Ideas: 글·댓글·멘션·상태), 파일 업로드, 자동화 봇 실행 틀, 게시글 템플릿(채널별 포함).
- **공유 업무:** 구매요청/구매봇 등.
- **보로 전용 모듈(신규):** CRM · 예약. (`modules/`에서 브랜드 게이팅)
- 브랜드 값(이름·테마·채널 구성 등)은 `lib/brand.js`/brand 설정으로 분리.

## 3. 저장소(파일/사진)
- 기본 `inline`(1.5MB 제한). **S3 지원은 코드에 내장**(`lib/storage.js`, `STORAGE_PROVIDER=s3` + S3 env).
- 보로는 사진 업로드가 많아 **S3 전환 진행 예정**(새 업로드부터 S3, 기존 inline은 그대로 동작). 자동 이미지 압축도 코어로 추가 예정.

## 4. 작업 라벨
- `[코어]` 공통 · `[브랜드:보로]` 보로 전용 · `[디자인:공통]`/`[디자인:보로]` 디자인.

## 5. 진행 상태 (요약)
> 현행 갱신: 개발(Claude Code) 2026-06-14. 상세는 `TODO.md`·`HANDOFF.md`가 정본.
- Phase 1(라우팅·모듈구조·지점) 완료·배포.
- 보로 디자인 시스템 1·2차 반영 완료·배포(번들 정본 `docs/design/borough/`). 구조형 완성 디자인(그린 레일·모바일 드로어·Lucide)은 **별도 배치 대기**.
- 게시글 템플릿(채널별 포함) **운영 배포 완료** — 마이그레이션 `20260614120000_add_post_templates`(additive, channelId 포함) 보로 운영 DB 적용. 멘션 키보드 내비도 함께 반영. (배포 `dpl_7kUQ3YMhfM8yxtsqtZ64cvUA4WyJ`, 배포로그 `post-deploy-log-20260614-borough-design-templates-mention`)
- 다음: 보로 S3 전환(+이미지 압축) → CRM·예약 모듈 → 인프라 분리(원모먼트·오늘꽃 콘솔 작업).

## 6. 정본 문서 (이 개요보다 우선)
- 시작점: `HANDOFF.md`
- 에이전트 규칙: `AGENTS.md`
- 전체 아키텍처: `docs/platform-architecture.md`
- 회사별 분리: `docs/multi-company-split.md`
- 템플릿·CRM·예약: `docs/templates-and-crm.md`
- 자동화 봇: `docs/agent-bot-framework.md`
- 배포: `docs/deploy-vercel-supabase.md`
- 결정 기록: `DECISIONS.md` · 진행 현황: `TODO.md`
- 디자인 정본: `docs/design-system.md`, `docs/brand-theme-boro.md`, `docs/design/borough/`

## 7. 협업 (4인 팀)
리더(사용자) · 기획(claude.ai의 Claude) · UX 디자인(Claude Design) · 개발(Claude Code).
에이전트끼리 직접 대화하지 않으며, **GitHub 문서 + 리더 전달**로 협업. 상세는 `docs/design/borough/협업시스템.md` 참조.
