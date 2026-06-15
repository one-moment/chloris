# Ralph Loop 런북 (Chloris)

Claude Code 공식 **`ralph-loop`** 플러그인(Anthropic 1st-party)을 이 저장소에서
쓰기 위한 설정입니다. Ralph loop = 같은 프롬프트를 반복 주입해, Claude가 직전
작업(파일·git 기록)을 보고 완료될 때까지 스스로 이어서 작업하게 하는 기법입니다.

## 1) 플러그인 설치 (대화형 Claude Code에서 1회)

플러그인 설치는 `/plugin` 패널을 통해서만 가능합니다(자동화 세션에서는 못 엶).
대화형 Claude Code 세션에서 아래를 실행하세요:

```
/plugin marketplace add anthropics/claude-plugins-official
/plugin install ralph-loop@claude-plugins-official
```

> 이 머신엔 Anthropic 공식 마켓플레이스가 이미 등록돼 있어 두 번째 줄만으로도 될 수
> 있습니다. 설치 후 `/help`에 `/ralph-loop`, `/cancel-ralph`가 보이면 성공입니다.

## 2) 루프 실행

작업 목표는 [`ralph/PROMPT.md`](PROMPT.md)의 **OBJECTIVE 섹션**에 적혀 있습니다.
현재 기본 목표 = 보로 **CRM + 예약 모듈** 구현(`docs/templates-and-crm.md`).
다른 작업을 시키려면 `PROMPT.md`의 OBJECTIVE만 바꾸면 됩니다.

대화형 세션에서:

```
/ralph-loop "ralph/PROMPT.md 를 읽고 그 지시를 정확히 따르라. 매 반복마다 한 단계씩만 진행하고, 그 파일의 OBJECTIVE가 lint+테스트 통과 상태로 완전히 끝났을 때만 <promise>RALPH-DONE</promise> 를 출력하라." --completion-promise "RALPH-DONE" --max-iterations 30
```

- `--completion-promise "RALPH-DONE"` : Claude가 이 문자열을 출력하면 루프 종료.
- `--max-iterations 30` : 안전 상한(무한 루프 방지). 필요시 조정.
- 진행 중 중단: `/cancel-ralph`.

## 3) 안전장치 (중요)

루프는 사람이 안 보는 사이 돌 수 있으므로 `PROMPT.md`에 절대 금지선을 박아뒀습니다:

- 프로덕션 마이그레이션(`prisma migrate deploy`)·`vercel deploy` 금지 (로컬 마이그레이션만 생성).
- 최종 결제/구매 자동화 금지, 데이터 삭제·실제 외부 주문·실제 이메일 발송 금지.
- 시크릿/DB URL/고객·급여 데이터를 저장소 파일에 쓰지 않음 (`AGENTS.md`).
- 모듈 간 직접 import 금지(`npm run lint`가 강제).

처음 돌릴 때는 `--max-iterations 3~5` 정도로 짧게 시작해 동작을 확인한 뒤 늘리는 걸 권장합니다.
매 반복은 `npm run lint` + 관련 테스트를 통과시키고 feature 브랜치에 커밋하도록 되어 있어,
중간에 멈춰도 저장소는 항상 green 상태로 남습니다.

## 참고

- 프롬프트 정본: [`ralph/PROMPT.md`](PROMPT.md)
- 프로젝트 규칙: [`AGENTS.md`](../AGENTS.md), 작업 현황: [`TODO.md`](../TODO.md) / [`HANDOFF.md`](../HANDOFF.md)
