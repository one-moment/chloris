# Ralph Loop Prompt — Chloris

You are running inside a **Ralph loop**: this same prompt is fed to you on every
iteration. You can see your previous work through the file system and git history.
Each iteration, make **one bounded, safe step** toward the OBJECTIVE, leave the repo
green (build/lint passing), record what you did, then stop. The loop will re-invoke
you to continue.

## OBJECTIVE (헤르메스 1단계 — 게이트웨이 분배 + 안내 응답)

승인된 상세 스펙: 저장소의 `HERMES_STAGE1_PLAN.md`. **그 문서가 정본이다. 그 파일 목록과
코드 형태를 정확히 따르고, 그 범위를 절대 벗어나지 마라.** 추가 참고: `docs/agent-bot-framework.md`,
`lib/agents/purchaseAgent/prompts.js`, `lib/agents/purchaseAgent/service.js`(패턴 미러링용).

목표: 단일 안내데스크 에이전트 "헤르메스"의 뼈대를 세우고, 채팅 게이트웨이가 `@헤르메스`
멘션을 헤르메스로 분배하게 한다. **이번 단계는 안내 메시지 + AgentRun 기록만** 한다 —
두뇌(LLM)·도구·승인·업무 데이터 변경은 없다.

이번에 만들/고칠 파일은 정확히 다음 6개뿐이다 (그 외 파일 수정 금지):

1. (신규) `lib/agents/hermes/prompts.js`
   - `HERMES_AGENT_SLUG="hermes-agent"`, `HERMES_AGENT_MENTIONS=["@헤르메스","@hermes","@Hermes"]`,
     `isHermesAgentCommand(body)`, `stripHermesAgentMention(body)`(2단계 대비), `HERMES_HELP_LINES`.
   - `lib/agents/purchaseAgent/prompts.js` 구조 미러링.
2. (신규) `lib/agents/hermes/service.js`
   - `getHermesInstallation(channelId)` + `runHermesAgent({body,channelId,messageId,requester})`:
     멘션 확인 → 설치 확인 → AgentRun(running) 생성(agentAppId는 설치 레코드에서) →
     안내 메시지 게시(author "헤르메스", bot:true) → AgentRun completed. 실패 시 AgentRun failed.
   - `purchaseAgent/service.js` 패턴 미러링하되 **도구·승인·업무데이터 없음**. prisma import는 `../../prisma`.
3. (수정) `lib/agentGateway/service.js` — 기존 try 안, `runPurchaseAgent` 호출 **앞**에 분기 1곳만:
   `if (isHermesAgentCommand(body)) { const r = await runHermesAgent({body,channelId,messageId,requester}); if (r.handled) return r; }`
   missing-table degrade(catch) 그대로 유지. **구매 경로 동작 불변.**
4. (수정) `scripts/test-agent-gateway.mjs` — 상단에
   `import { isHermesAgentCommand, stripHermesAgentMention } from "../lib/agents/hermes/prompts.js";` 추가 +
   멘션 감지/회귀(`isPurchaseAgentCommand("@헤르메스 안녕")===false`) 단위 assert 추가.
   (이 파일은 DB를 쓰지 않는 순수 단위 테스트다.)
5. (수정) `scripts/test-agent-layer.mjs` — `seedAgentLayer()`에 `hermes-agent` AgentApp upsert +
   시험 채널 `enableChannelAgent({channelId, agentId:"hermes-agent", config:{}, actor:admin})` +
   헤르메스 검증 블록(handled/action/AgentRun completed/안내 메시지) 추가. 정리(finally)는 기존
   requesterId/channelId 기준이 헤르메스 레코드까지 덮으므로 추가 정리 불필요.
   **이 테스트 코드는 작성만 하고, 이 루프에서 실행하지는 마라(아래 추가 가드레일).**
6. (수정) `DECISIONS.md` — 헤르메스 1단계 결정 항목 1개 추가(`HERMES_STAGE1_PLAN.md`의 초안 사용).

범위 밖(이번에 절대 안 함): 두뇌/LLM, 업무 실제 실행, 딥링크 안내, 운영 배포, DB 마이그레이션,
구매 관련 코드 수정, 독립 구매 에이전트 껍데기 정리, package.json/설정 변경.

### 이 OBJECTIVE 전용 추가 가드레일 (절대)
- **`agent-layer:test`(DB에 쓰는 통합 테스트)를 이 루프에서 실행하지 마라.** 사람이 안 보는
  루프에서는 `DATABASE_URL`이 운영을 가리킬 위험이 있다. 이 루프의 검증은 `npm run lint` +
  `npm run agent-gateway:test`(둘 다 DB 미사용)로만 한다. `agent-layer:test` 실행과 수동
  `@헤르메스` 확인은 루프 종료 후 사람의 몫임을 `HANDOFF.md`에 남겨라.
- **새 브랜치 생성·git 이력 수술 금지.** 이미 사람이 `feature/hermes-stage1`(= 최신
  `feature/purchase-bot-mvp`에서 분기)을 만들어 그 위에 있다고 가정한다. 다른 브랜치로 커밋하지 마라.

### 이 OBJECTIVE의 완료 조건
위 6개 변경 완료 + `npm run lint` 통과 + `npm run agent-gateway:test` 통과 +
`DECISIONS.md`/`TODO.md`/`HANDOFF.md` 갱신 + `feature/hermes-stage1`에 커밋 — 이 모두가 충족될
때만 완료다. `HANDOFF.md`에 "루프 후 사람 검증 필요: 로컬/연습 DB로 agent-layer:test + dev에서
@헤르메스 확인 + PR 생성"을 명시해 둘 것.

## Every iteration, in order

1. **Read context first**: `AGENTS.md`, `HANDOFF.md`, `TODO.md`, `DECISIONS.md`, `BUG_LOG.md`,
   and for this objective `docs/templates-and-crm.md` + `docs/platform-architecture.md`.
2. **Check git** (`git log --oneline -10`, `git status`, `git diff`) to see what previous
   iterations already did. Do not redo finished work.
3. **Pick the single smallest next step** toward the OBJECTIVE. One concern per iteration
   (one model, one API route, one UI piece). Prefer existing project patterns and helpers.
4. **Implement** that step only. Keep changes scoped — no broad rewrites or flow refactors.
5. **Verify**: run `npm run lint` (includes module-boundary check) and any relevant test
   script (`npm run *:test`). Fix what you broke. Never report progress on unverified code.
6. **Record**: update `TODO.md` (check off / add sub-tasks), `HANDOFF.md` (current state),
   `DECISIONS.md` (if a decision was made), `BUG_LOG.md` (if a bug was found/fixed/deferred).
7. **Commit** the iteration to the current feature branch with a clear message
   (never to `main`). Then stop — the loop re-invokes you.

## Hard guardrails (the loop runs unattended — these are absolute)

- **NEVER** run production DB migrations (`prisma migrate deploy`), `db push` to prod,
  or `npx vercel deploy`. Migrations are created locally only; production apply needs the
  human. If a step requires prod migration/deploy, STOP and write the request into HANDOFF.md.
- **NEVER** implement final payment/purchase automation. That stays a human-reviewed step.
- **NEVER** delete data, send real emails, or perform real external orders.
- **NEVER** write secrets, API keys, DB URLs, customer/payroll data, or session data into
  any repository file or commit (AGENTS.md).
- **NEVER** import one module from another module. Cross-module flows go through platform
  events. Keep `modules/<slug>/` boundaries (enforced by `npm run lint`).
- Do not add module data to `/api/state`; modules fetch via `/api/work/<module>/...`.
- If you are blocked, uncertain about scope, or about to do anything on this list,
  STOP and record the question in HANDOFF.md instead of guessing.

## Completion

When the OBJECTIVE above is fully complete — implemented, `npm run lint` clean, relevant
tests passing, tracking docs updated, and changes committed to the feature branch —
output exactly:

    <promise>RALPH-DONE</promise>

Do not output that string for any other reason. If the objective is not fully met, end the
iteration normally (without the promise) so the loop continues.
