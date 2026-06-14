# 보로플라워마켓 테마 (brand: borough)

작성: 2026-06-14. 상위: `docs/design-system.md`. 적용 인스턴스: `NEXT_PUBLIC_BRAND=borough`.
> 출처: Borough Flower Market 디자인 시스템 패키지. 레포에 원본 문서가 없어 요약·기록(작업지시서 지시).

## 브랜드 팔레트

- 포레스트 그린 `#185640` (`--brand`) — 사이드바·헤더·CTA·강조 중심. 로고 바탕색.
- 세이지 골드 `#D5CD8C` (`--accent`/gold) — 포인트·포커스 링·다크 위 텍스트. 로고 레터폼 색.
- 보태니컬 클레이 `#BE6E54` (`--seasonal`) — 제철 강조 하나의 따뜻한 액센트(절제).
- 웜 페이퍼 `#F7F4EA`→`#FCFBF5` — 본문 배경(종이 크림). 순백은 카드에만.
- 잉크 `#171C18` — 본문 텍스트(웜 그린 블랙).
- 상태색(원본): success `#2C7B60` / warning `#C79A3A` / danger `#B0503B` / info `#3E6E8E` + soft 변형.

## 앱 시맨틱 변수 매핑 (styles.css `:root`)

| 앱 변수 | 보로 값 | 용도 |
|---|---|---|
| `--bg` | `#f7f4ea` | 페이퍼 본문 |
| `--surface` | `#ffffff` | 흰 카드 |
| `--surface-subtle` | `#f0ecdd` | 웜 sunken(칩/보조) |
| `--line` / `--line-strong` | ink 알파 0.13 / 0.24 | 보더 |
| `--text` / `--muted` | `#171c18` / `#6b7568` | 텍스트 |
| `--accent` / `--accent-weak` | `#185640` / `#d6e2d9` | 브랜드 그린 |
| `--blue` | `#1f664d` | 링크/멘션/활성(그린 계열) |
| `--amber` / `--amber-weak` | `#946a1a` / `#f4ebcf` | 경고(웜 골드) |
| `--danger` | `#b0503b` | 웜 테라코타 |
| `--radius` / `--shadow` | 10px / 그린 틴트 | 형태/그림자 |
| 폰트 | Gothic A1 / Gowun Batang / Cormorant | 본문/세리프/디스플레이 |
| 추가 | `--brand`,`--gold`,`--on-dark`,`--seasonal`,`--focus-ring` | 크롬용 |

## 브랜드 크롬 (app/globals.css)

- 그린 사이드바(`#185640`) + 라이트 텍스트, 골드 로고(`public/brand/logo-mark-gold.png`).
- 세리프 제목(채널명·업무 제목·인증), 골드 포커스 링, 작성기 상단 그린→골드 3px 액센트 스트립.

## 적용 상태

- [x] 1차 적용·운영 배포됨 (2026-06-11, `dpl_PeJfjSLHucdqEEJhAr1ubKaJtd1T`): 위 토큰·폰트·그린 사이드바·로고·세리프 제목·골드 포커스·액센트 스트립.
- [ ] 2차(완성 디자인) 잔여 후보 — 작업지시서 승인 대기:
  - 상태색(success/warning/danger/info + soft)을 칩·상태 배지에 정식 매핑.
  - 카드 상단 액센트 스트립 적용 범위 정리(현재 작성기만).
  - (논의 필요·구조성) 그린 레일(72) + 사이드바(248) 2단 크롬, Lucide 아이콘 도입.
  - 타이포 헬퍼 클래스(`.t-display/.t-lede/.t-overline`) 도입 및 에디토리얼 표면 적용.

> 2차 반영은 "스타일만, 동작 변경 없음" 범위. 구조성 항목(레일/아이콘)은 별도 승인.

## 2026-06-14: Claude Design 정식 번들 수령

- 정본 파일이 레포에 기록됨: `docs/design/borough/`(borough.css + ds 토큰 + Design Guide.html), 원본 링크는 `docs/design/README.md`.
- 위 토큰 값들은 번들의 `ds/colors.css`와 동일(이미 1차 적용된 값과 일치). 추가로 상태색 soft 변형(success/warning/danger/info + `*-soft`)과 정식 시맨틱 별칭 세트 포함.
- `borough.css`는 **우리 클래스명 그대로** 작성된 제품 스타일시트(모바일 우선). 2차 반영의 정본은 이제 이 파일이다.
- 구조 요건(완성 디자인): `.workspace-root` 래퍼 + 데스크톱 `레일(64)+사이드바(268)+메인` 3열 + 모바일 오프캔버스 드로어 + Lucide 아이콘. → "스타일만" 범위를 넘으므로 적용 범위는 리더 승인 후 확정.
