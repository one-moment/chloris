# Chloris 디자인 시스템 (공통)

작성: 2026-06-14. 출처: Borough Flower Market 디자인 시스템 패키지(Claude Design 산출) 요약.
> 이 문서는 레포에 디자인 원본 문서가 없어, 전달받은 디자인 시스템 패키지를 기준으로 요약·기록한 것입니다(작업지시서 지시). 회사별 테마는 `docs/brand-theme-*.md`.

## 원칙

- 시맨틱 별칭(semantic alias)으로 작업한다. 원시 색상값을 직접 쓰지 않고 `--surface-*`, `--text-*`, `--accent` 등 의미 토큰을 쓴다.
- 회사(브랜드) 차이는 토큰 값으로만 바뀌고, 컴포넌트/레이아웃 구조는 공유한다. (`data-brand` 스코프 + `lib/brand.js`)
- 미니멀·정중. 이모지는 UI 크롬에 쓰지 않는다(채팅 리액션만 예외). 낮고 따뜻한 그림자, 바운스 없는 차분한 모션.
- 적용 위치(기존 방식 유지): 토큰 = `styles.css`, 브랜드 크롬 = `app/globals.css`, 로고/에셋 = `public/brand/`, 테마 스코프 = `data-brand`.

## 타이포그래피

- 패밀리: `--font-display`(Cormorant Garamond, 라틴 디스플레이) · `--font-serif`(Gowun Batang, 한국어 세리프) · `--font-sans`(Gothic A1, UI 산세리프) · `--font-mono`.
- UI 기본은 Gothic A1. 에디토리얼/브랜드 표면(제목·시적 리드)에 세리프.
- 스케일(원본 토큰): display clamp(52→104 / 40→76 / 32→52), h1 40 / h2 31 / h3 25 / h4 20 / title 17 / body 15 / caption 13 / overline 11.
- 가중치 300–800, 행간 tight 1.04 ~ relaxed 1.72, 자간 overline 0.2em.
- 헬퍼 클래스: `.t-display`, `.t-h1~4`, `.t-lede`(세리프 리드), `.t-overline`(대문자 라벨).

## 스페이싱 · 형태 · 그림자 · 모션

- 스페이싱 4px 베이스(`--space-1`=4 … `--space-8`=32 …).
- 라운드: `--radius-md`(10, 입력/버튼) · `--radius-lg`(14, 카드) · pill은 칩만.
- 그림자: 낮고 따뜻한 그린 틴트 `--shadow-sm/md/lg`. 강한 검정 그림자 금지.
- 모션: `--ease-out` 차분, 200ms 내외, 바운스 없음. Hover 살짝 떠오름, Press scale 0.985.

## 색 구조 (의미 토큰)

브랜드 색은 회사별 테마에서 정의하고, 공통 의미 슬롯은 다음과 같다:
- 표면: `--surface-page`(본문), `--surface-card`/`--surface-raised`(카드), `--surface-sunken`, `--surface-dark`(사이드바/히어로).
- 텍스트: `--text-strong/body/muted/faint`, `--text-on-dark*`, `--text-on-accent`.
- 보더: `--border-subtle/border/border-strong`, `--border-on-dark`, `--border-accent`.
- 상태: `--success/warning/danger/info` + 각 `*-soft`.
- 포커스: `--focus-ring`(골드 링).

## 아이코노그래피

- Lucide 아이콘(얇은 스트로크). 로고 마크는 아이콘이 아닌 브랜드 자산(`public/brand/`)으로 사용, 직접 작화 금지.

## 현재 코드 매핑 메모

본 앱은 기존에 단일 `:root` 시맨틱 변수(`--bg/--surface/--surface-subtle/--line/--text/--muted/--accent/--accent-weak/--blue/--amber/--danger/--radius/--shadow`)를 컴포넌트가 소비한다. 디자인 시스템 토큰은 이 변수명에 매핑해 적용한다(회사별 테마가 같은 변수명을 스왑). 상세는 `docs/brand-theme-boro.md`.
