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
