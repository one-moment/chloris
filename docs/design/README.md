# 디자인 산출물 (Claude Design → 레포 기록)

> 클로드디자인 지침대로 외부 핸드오프 링크가 아니라 **레포에 기록된 파일이 기준**입니다.
> 원본(전달용 링크): https://api.anthropic.com/v1/design/h/gc6vrX6XVenEF6YZP3PSfg (`open_file=workspace/Chloris Workspace.html`)
> 번들명: `chloris-work-os-design-polish` (Claude Design, 2026-06-14)

## 의도 (채팅 전사 요약)
풀 보로 리브랜드 + **모바일·소형 POS 우선** + 느슨한 간격 정리 + 공통 디자인 가이드. 산출물은 단일 HTML 목업 + 디자인 가이드. **핵심: 제품 CSS(`borough.css`)는 앱의 기존 클래스명을 그대로 사용**해 코드에 바로 이식 가능하게 작성됨.

## borough/ (이 폴더의 정본)
- `borough.css` — 제품 워크스페이스 스타일시트(우리 클래스명, `.workspace-root` 스코프, 모바일 우선 컨테이너 쿼리, 변형 훅 `[data-theme|sidebar|cards|chips]`).
- `ds/colors.css·typography.css·spacing.css·fonts.css` — Borough 디자인 토큰(정본).
- `Design Guide.html` — 토큰·컴포넌트 스펙시멘(시각 가이드).
- `디자인지침-ClaudeDesign.md` · `협업시스템.md` — 팀 협업/디자인 절차 지침.

## 구현 메모
- 데스크톱(`@container device min-width:720px`): `레일(64) + 사이드바(268) + 메인` 3열 → **`.rail` 요소 필요**.
- 모바일: 사이드바 오프캔버스 드로어(`.app-shell[data-drawer="open"]`).
- 아이콘: Lucide(`i[data-lucide]`). 기본 변형값: theme=forest, sidebar=dark, cards=comfortable, chips=soft.
- 적용 요약/매핑은 `docs/design-system.md`(공통) · `docs/brand-theme-boro.md`(보로) 참고.
