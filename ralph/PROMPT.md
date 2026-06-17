# Ralph Loop Prompt — Chloris

You are running inside a **Ralph loop**: this same prompt is fed to you on every
iteration. You can see your previous work through the file system and git history.
Each iteration, make **one bounded, safe step** toward the OBJECTIVE, leave the repo
green (build/lint passing), record what you did, then stop. The loop will re-invoke
you to continue.

## OBJECTIVE (헤르메스 2단계 — 두뇌 스위치 + "이건 ○○ 업무" 분류·안내)

정본 방향: 헤르메스 = 단일 안내데스크 에이전트(A안). 2단계는 직원이 `@헤르메스 ...`로 평소 말을 적으면
**발주/예약/입고/폐기/기타 중 무엇인지 한 번 분류**해서 → **해당 화면 바로가기를 안내**하는 것까지.
**실제 업무 실행(발주·예약 생성 등)·승인(ApprovalRequest)·업무데이터 변경은 없다 — 그건 3단계.** 읽기·분류·안내만.

두뇌는 **공급사 교체 가능한 얇은 '스위치'**로 만들되, **시작 공급사는 OpenAI**(기존 `lib/agents/openaiClient.js` 재사용)로 한다.
키가 없거나 **어떤 이유로든 실패하면 1단계 안내(HERMES_HELP_LINES)로 안전하게 degrade**한다(아래 #3 보강 참조).

참고(패턴): `lib/agents/openaiClient.js`(classifyAgentIntent 시그니처 + extractStatementLineItems의 "JSON만 지시→파싱" 패턴),
`lib/agents/hermes/{prompts,service}.js`(1단계 결과), `lib/brand.js`(`isModuleEnabled` — 브랜드 게이팅).
⚠️ **헤르메스는 `lib/`에 있고 `modules/`·`modules/registry.js`를 import하지 않는다**(현재 lib는 modules를 전혀 import하지 않음 = core/modules 분리 관행). 라우팅은 아래 내부 맵으로, 브랜드 게이팅은 `lib/brand`의 `isModuleEnabled`로만 한다.

이번에 만들/고칠 파일은 정확히 다음 7개뿐이다(그 외 수정 금지):

1. (신규) `lib/agents/llm/index.js` — 공급사 스위치(제너릭 분류기)
   - `classifyJson({ messages })`를 내보낸다. `process.env.AGENT_LLM_PROVIDER`(기본 "openai")로 분기.
   - provider "openai": `classifyAgentIntent({ messages })`(`../openaiClient`) 호출(스키마 미사용 — 프롬프트로 "JSON만" 지시).
     결과가 `{ skipped:true }`면 그대로 반환. 아니면 OpenAI Responses 응답에서 출력 텍스트를 뽑아
     (`payload.output_text` 또는 `payload.output[].content[].text`를 모은 것; 추출 헬퍼는 이 파일에 작게 구현 —
     openaiClient의 pickResponsesOutputText는 export 안 됨, openaiClient는 수정 금지),
     코드펜스 제거 후 `JSON.parse` → `{ ok:true, data }`. 파싱 실패 → `{ error:"parse" }`. (HTTP 오류 throw는 상위(#3)에서 잡음.)
   - 알 수 없는 provider → `{ skipped:true, reason:"unknown_provider" }`.
   - **OpenAI만 구현한다. 다른 공급사 어댑터는 이번에 추가하지 않는다(스위치 자리만 만든다).**

2. (수정) `lib/agents/hermes/prompts.js` — 분류 프롬프트 + 라우팅 맵 추가(기존 `HERMES_HELP_LINES`는 fallback으로 유지)
   - `buildWorkIntentMessages(text)` → OpenAI Responses `input` 배열을 만든다:
     `[{ role:"user", content:[{ type:"input_text", text: "<지시문>\n\n직원 메시지: <text>" }] }]`.
     지시문: "다음 직원 메시지를 purchase(발주)/reservation(예약)/stockin(입고)/disposal(폐기)/other(기타) 중 하나로 분류하라.
     설명 없이 JSON만 출력: {\"area\":\"...\"}."
   - `WORK_ROUTES`: area → { moduleSlug, label, href }
     - purchase → { moduleSlug:"purchase",     label:"발주(구매 관리)", href:"/work/purchase" }
     - reservation → { moduleSlug:"reservations", label:"예약 관리",       href:"/work/reservations" }
     - stockin → { moduleSlug:"stockin",      label:"입고 관리",       href:"/work/stock-in" }
     - disposal → { moduleSlug:"disposal",     label:"폐기 관리",       href:"/work/disposal" }
   - `buildRouteMessageLines({ label, href })` → 안내 라인(예: `이건 ${label} 업무로 보여요.`, `여기서 처리하실 수 있어요: ${href}`).

3. (수정) `lib/agents/hermes/service.js` — `runHermesAgent` 확장(1단계 골격 유지)
   - 멘션 확인 → 설치 확인 → AgentRun(running) 생성: 기존과 동일.
   - `import { isModuleEnabled } from "../../brand";` 추가. `import { classifyJson } from "../llm";` 추가.
     `buildWorkIntentMessages`, `WORK_ROUTES`, `buildRouteMessageLines`, `stripHermesAgentMention`는 `./prompts`에서 가져온다.
   - **분류는 자체 try/catch로 감싼다(보강 — 어떤 실패든 안전 degrade)**:
     `let area=null; try { const cls = await classifyJson({ messages: buildWorkIntentMessages(stripHermesAgentMention(body)) }); area = cls?.ok ? (cls.data?.area ?? null) : null; } catch { area = null; }`
     → 키없음·파싱실패·API/네트워크 throw 등 **모든 실패에서 area=null**(run은 계속 진행, failed로 떨어뜨리지 않는다).
   - 답변 결정:
     - `route = area ? WORK_ROUTES[area] : null`.
     - `route`가 없거나 `area === "other"`이거나 `!isModuleEnabled(route.moduleSlug)` → **fallback: `HERMES_HELP_LINES` 안내**, `action="help"`.
     - 그 외 → `buildRouteMessageLines(route)` 안내, `action="route"`.
   - 안내 메시지 게시(author "헤르메스", bot:true) → AgentRun completed, `outputJson = { action, area: area ?? null, href: route?.href ?? null }`. (메시지 게시·DB 오류만 기존 catch로 failed.)
   - **업무데이터 변경·도구·승인 없음. 메시지 게시만.**

4. (수정) `scripts/test-agent-gateway.mjs` — 순수 단위(DB·네트워크 없음)
   - `WORK_ROUTES` 매핑/`buildRouteMessageLines` 출력 assert.
   - 브랜드 게이팅: 보로(기본 brand)에서 4개 area의 모듈이 `isModuleEnabled`로 true인지 assert.
   - `classifyJson`의 degrade: `OPENAI_API_KEY`가 없으면 `{ skipped:true }`를 반환하는지 assert(실제 OpenAI 호출 금지).
     **단, 키를 지울 땐 반드시 백업→복원(또는 격리)하여 다른 검사·환경에 영향 주지 마라**
     (예: `const k = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY; /* assert */ if (k !== undefined) process.env.OPENAI_API_KEY = k;`).

5. (수정) `scripts/test-agent-layer.mjs` — DB 통합(루프에서 실행 안 함; `node --check` 문법만)
   - 테스트 환경엔 `OPENAI_API_KEY`가 없으므로 분류가 skip → **헤르메스가 1단계 안내로 degrade**한다.
     기존 헤르메스 검증(안내 응답/AgentRun completed/구매 회귀/미설치 회귀)이 그대로 통과하도록 유지(필요하면 문구 매칭만 조정).

6. (수정) `.env.example` — `AGENT_LLM_PROVIDER="openai"` 추가 + 주석:
   "헤르메스 분류 두뇌의 공급사 스위치. OPENAI_API_KEY가 설정되면 분류·안내가 켜지고, 없으면 1단계 안내로 동작."
   **키 값은 쓰지 않는다.**

7. (수정) `DECISIONS.md`/`TODO.md`/`HANDOFF.md` — 2단계 항목 추가.

### 이 OBJECTIVE 전용 추가 가드레일 (절대)
- **두뇌(OpenAI) 호출은 `@헤르메스` 멘션일 때만** 일어난다(비용·지연 통제). 멘션당 분류 1회.
- **`agent-layer:test`(DB 통합)를 이 루프에서 실행하지 마라**(무인 루프에서 DATABASE_URL이 운영일 위험).
  루프 검증은 `npm run lint` + `npm run agent-gateway:test`(둘 다 DB·네트워크 미사용)만. 실제 분류·라우팅 확인은 루프 후 사람이 로컬에서 키를 넣고.
- **`modules/`·`modules/registry.js` import 금지**(core/modules 분리). 라우팅은 내부 `WORK_ROUTES` + `lib/brand`의 `isModuleEnabled`로만.
- **`openaiClient.js`·구매 관련 코드·운영 배포·DB 마이그레이션 변경 금지.** 다른 공급사 어댑터는 이번에 추가하지 않는다.
- **새 브랜치 생성·git 수술 금지.** 이미 사람이 `feature/hermes-stage2`(= 최신 `feature/purchase-bot-mvp`에서 분기) 위에 있다고 가정한다.

### 이 OBJECTIVE의 완료 조건
위 7개 변경 완료 + `npm run lint` 통과 + `npm run agent-gateway:test` 통과(분류 degrade·라우팅 매핑 단위 포함) +
`DECISIONS.md`/`TODO.md`/`HANDOFF.md` 갱신 + `feature/hermes-stage2` 커밋 — 이 모두가 충족될 때만 완료다.
`HANDOFF.md`에 "루프 후 사람 검증 필요: ① 로컬/연습 DB `agent-layer:test`(DATABASE_URL 운영 아닌지 먼저 확인)
② 로컬에서 OPENAI_API_KEY 설정 후 dev에서 `@헤르메스 …발주/예약/입고/폐기…` 분류·안내 확인 ③ PR 생성·검토"를 명시할 것.

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
