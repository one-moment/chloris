# 구조형 디자인 독립 리뷰 노트 (worktree: design/structural-rail)

작성자(개발)와 분리된 검수 서브에이전트의 발견사항 기록. 다음 이터레이션에서 [열림] 항목을 먼저 수정 후 [해결]로 표시.

형식: `- [열림|해결] (S단계) 내용`

## 발견사항
(이터레이션마다 추가)

### iter 1 — S1 (Lucide 인프라) 리뷰
- [해결] (S1) 알 수 없는 name이면 Icon이 조용히 null 반환 → dev에서 `console.warn` 또는 가시 폴백 추가.
- [해결] (S1) 사이즈 미스매치: borough.css는 `i[data-lucide]{width/height/stroke-width}`(레일21·icon-button17·badge13 등 18규칙)로 아이콘 크기를 제어하는데 lucide-react는 `<svg class="lucide">`를 렌더 → 셀렉터 불일치. S3에서 CSS 기반 사이징이 안 먹음. 해결: 렌더 svg에 `data-lucide={name}` 부여 + borough.css 적용 시 `i[data-lucide]`를 `[data-lucide]`로 완화(또는 호출부마다 size/strokeWidth 명시).
- [해결] (S1) 디자인 HTML이 쓰는 아이콘 누락: alert-triangle, layout-dashboard, ruler, square-dashed, smartphone, git-commit-horizontal → 레지스트리에 추가(AlertTriangle/LayoutDashboard/Ruler/SquareDashed/Smartphone/GitCommitHorizontal).
- [해결] (S1) 래퍼가 추가 props(onClick/style/data-*)를 버림 → `...rest`를 `<Glyph>`로 spread 권장.

### iter 2 — S2 (DS 토큰 + .workspace-root 래퍼) 리뷰
- (발견사항 없음) — 토큰 충돌 회피(앱 --accent/--warning 보존), 폰트 fallback만 미세 차이(무시 가능), .workspace-root 레이아웃 투명, JSX 균형 확인.
- S1 발견사항 4건: [해결] (iter 2에서 선수정).

### iter 3 — S3 (셸+레일 도입) 리뷰
- [해결] (S3) 768~980px 빈 사이드바 열 회귀: globals `@media(max-width:980px) .sidebar{position:fixed; translateX(-105%)}`(오프캔버스)와 borough-shell의 `@media(min-width:768px)` 3열 강제가 겹쳐, 292px 열은 예약되나 사이드바가 화면 밖이라 rail~main 사이 빈칸. 수정: 3열/레일 분기점을 모바일 드로어 경계(≤980 = 모바일)와 일치(예: `min-width:981px`)시키거나 S4 드로어 전환을 이 구간까지 포함. (S4와 동일 영역 → S4에서 함께 처리)
- (확인됨) 토큰 전부 정의됨, 레일 값 정본 충실, 아바타 골드/대비 OK, 검색버튼=기존 핸들러(로직 변경 없음), 모바일 기존 동작 불변, 모듈 경계 위반 없음.

### iter 4 — S4 (모바일 드로어 polish + 분기점 정합) 리뷰
- (발견사항 없음) — 980/981 상호배타(갭/오버랩 없음), ≤980 단일열+오프캔버스(빈 열 없음), ≥981 3열 in-flow 사이드바. 드로어 polish는 transition/box-shadow/배경만 덮고 position/transform 유지 → 슬라이드·클릭닫기 무손상. 토큰 전부 정의.
- S3 발견사항(768~980 빈 열): [해결] (iter 4).
- (S7 메모) POS≈880px는 현재 모바일 드로어 범위 — 레일 노출 필요 시 S7에서 경계 조정.

### iter 5 — S5 (컴포넌트 정합/셸 통합) 리뷰
- [해결] (S5) `.workspace-root .main-header { padding:12px 20px }`가 무조건부라 globals `@media(max-width:980) .main-header{padding:12px 14px}`(모바일 좌우 14px 의도)를 특이도로 덮음 → 모바일 헤더 좌우 20px. 수정: 이 패딩을 `@media(min-width:981px)`로 스코프해 모바일 14px 보존.
- (확인됨) main-area min-height:0 스크롤 컨테인 정상(붕괴 위험 없음), --surface-page 정의·의도 톤, 모듈 대시보드는 .work-* 자체 클래스라 무회귀.
