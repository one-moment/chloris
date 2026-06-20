# Ralph Loop Prompt — Chloris

You are running inside a **Ralph loop**: this same prompt is fed to you on every
iteration. You can see your previous work through the file system and git history.
Each iteration, make **one bounded, safe step** toward the OBJECTIVE, leave the repo
green (build/lint passing), record what you did, then stop. The loop will re-invoke
you to continue.

## OBJECTIVE (헤르메스 3단계 첫 실행 = 예약: 양식 미리채움 + 사람 제출)

정본 방향: 헤르메스 = 단일 안내데스크 에이전트(A안). 3단계 첫 실행 = **예약**, 방식 = **(나) 미리채움**.
직원이 `@헤르메스 …예약…`을 적으면, 헤르메스가 메시지에서 비PII 예약 정보를 뽑아 **예약 양식을 미리 채운 링크**를 안내한다.
사람이 그 양식에서 **확인·수정·제출**하면 기존 예약 생성 API(`POST /api/work/crm/reservations`)가 실제로 만든다.
**헤르메스는 DB에 직접 쓰지 않는다. 승인·결제·마이그레이션 없음.** (헤르메스 직접 생성은 이후 단계.)

⚠️ **PII 원칙(중요)**: 고객 **성함·연락처는 절대 링크(URL)에 넣지 않는다**(URL 로그 위험 — AGENTS.md).
미리채움은 **비PII 항목만**: 상품·금액·픽업일시·수령방법·예약경로. 성함·연락처는 사람이 양식에서 입력.

참고:
- `modules/crm/ui/ReservationForm.jsx` — 필드: name/phone/branchId/reservedAt/pickupAt/product/amount/source/receiveMethod/note.
  `pickupAt`은 `<input type="datetime-local">`(형식 `YYYY-MM-DDTHH:mm`, 오프셋 없음).
  `SOURCE_OPTIONS=["인스타","네이버플레이스","네이버톡톡","네이버검색","매장방문","전화예약","지인"]`, `RECEIVE_OPTIONS=["방문수령","퀵"]`.
  props: branches/fixedBranchId/channelId/onSubmitted/onCancel. 현재 미리채움 값은 안 받음(prop으로 추가).
- `app/(workspace)/work/reservations/page.jsx`(서버) — 현재 `?new=1&channel=&branch=`만 읽어 `ReservationsDashboard`에 props로 넘김 → Dashboard가 Form에 전달.
- `lib/agents/hermes/{prompts,service}.js`(2단계 결과), `lib/agents/llm`(`classifyJson`).
⚠️ 헤르메스(lib/)는 `modules/`를 import하지 않는다 — **링크 문자열만** 만든다. 예약 양식 수정은 crm 모듈 내부에서.

**[결정·승인됨] 미리채움 전달 = props(useSearchParams 아님)**: 서버 `page.jsx`가 미리채움 파라미터도 읽어
`ReservationsDashboard` → `ReservationForm`로 prop 전달(기존 channel/branch 흐름과 동일). 따라서 이번에 고칠 파일은 **정확히 다음 8개**다(그 외 수정 금지):

1. (수정) `lib/agents/hermes/prompts.js`
   - 분류 프롬프트 확장: area 분류 + **area=reservation이면 비PII 예약 정보도 함께 추출**.
     출력 JSON: `{ area, reservation?: { product:string|null, amount:number|null, pickupAt:"YYYY-MM-DDTHH:mm"|null,
     receiveMethod:"방문수령"|"퀵"|null, source:(SOURCE_OPTIONS 중 하나)|null } }`.
     상대 날짜("내일 오후 3시") 해석 위해 프롬프트에 **오늘 날짜(Asia/Seoul)** 포함. `pickupAt`은 **오프셋 없는 로컬 `YYYY-MM-DDTHH:mm`**로
     출력하도록 지시(datetime-local 직결, TZ drift 방지). 모르면 각 필드 null. **성함·연락처는 추출/출력하지 않는다.**
   - `buildReservationPrefillQuery(reservation)` → 비어있지 않은 **비PII** 필드만 쿼리스트링으로
     (`product`,`amount`,`pickup`,`receive`,`source`). receive/source는 허용값일 때만 포함. `encodeURIComponent`.
     **`name`/`phone` 키는 절대 만들지 않는다.**
   - 기존 `WORK_ROUTES`/`buildRouteMessageLines`/`HERMES_HELP_LINES`/`buildWorkIntentMessages`/mention 헬퍼 유지(확장).

2. (수정) `lib/agents/hermes/service.js` — `runHermesAgent`(2단계 골격·AgentRun running→completed/failed 유지)
   - 분류(자체 try/catch degrade)에서 `area`와 `reservation`(있으면) 추출.
   - **area="reservation"이고** 추출된 비PII 필드가 하나라도 있으면: 채널 branchId 조회
     (`prisma.channel.findUnique({where:{id:channelId},select:{branchId:true}})`)해서
     `"/work/reservations?new=1&channel=<id>" + (branchId ? "&branch=<branchId>" : "") + "&" + buildReservationPrefillQuery(...)`
     링크를 만들고 "예약 정보를 채워뒀어요. 확인하고 제출해 주세요: <link>" 안내. `action="reservation_prefill"`.
   - reservation이지만 추출 필드가 없거나 분류 skip/실패 → **2단계처럼 일반 예약 링크(또는 help)로 degrade**.
   - 그 외 area는 2단계 동작 유지. AgentRun completed, `outputJson={action, area, href}`. **DB 쓰기·도구·승인 없음. 메시지 게시만.**

3. (수정) `app/(workspace)/work/reservations/page.jsx` — searchParams에서 `product`,`amount`,`pickup`,`receive`,`source`도 읽어
   `ReservationsDashboard`에 prop으로 전달(기존 new/channel/branch 읽기 패턴 그대로 확장).

4. (수정) `modules/crm/ui/ReservationsDashboard.jsx` — 새 미리채움 props를 받아 `ReservationForm`에 그대로 전달.

5. (수정) `modules/crm/ui/ReservationForm.jsx`
   - 선택적 미리채움 props(`product`,`amount`,`pickup`,`receive`,`source`)를 받아 **초기 폼 값으로만** 반영(있을 때만).
     `receive`/`source`는 허용값일 때만 적용. `pickup`은 datetime-local 형식(앞 16자)으로 변환.
   - **성함·연락처는 미리채우지 않는다.** 기존 동작(수동 입력·고객검색·branch/channel·검증·제출)은 절대 깨지 않는다 — 미리채움은 **순수 추가**.

6. (수정) `scripts/test-agent-gateway.mjs` — 순수 단위(DB·네트워크 없음)
   - `buildReservationPrefillQuery`: 비PII만 담기고 **`name`/`phone` 키가 없는지** assert; 허용값 매핑/빈값 스킵 assert.
   - `classifyJson` degrade(키없음→skipped) assert. 실 OpenAI 호출 금지(`OPENAI_API_KEY` 백업→복원).

7. (수정) `scripts/test-agent-layer.mjs` — DB 통합(루프 미실행, `node --check` 문법만)
   - 키 없음(백업→복원) → 예약 intent가 일반 링크(또는 help)로 degrade. 기존 헤르메스 검증 유지.

8. (수정) `DECISIONS.md`/`TODO.md`/`HANDOFF.md` — 3단계-(나) 항목 + "루프 후 사람 검증"(아래) 명시.

### 이 OBJECTIVE 전용 추가 가드레일 (절대)
- **헤르메스는 DB에 직접 쓰지 않는다.** 실제 예약 생성은 사람이 양식 제출 → 기존 `POST /api/work/crm/reservations`. 승인/결제/외부주문 없음.
- **PII(성함·연락처)를 URL/링크에 넣지 않는다.** 미리채움은 비PII 항목만.
- 두뇌 호출은 `@헤르메스` 멘션일 때만·멘션당 1회(분류+추출 한 번에). 키없음/실패는 2단계 링크(또는 help)로 degrade.
- `agent-layer:test`(DB 통합) 루프 미실행. 루프 검증은 `npm run lint` + `npm run agent-gateway:test`(DB·네트워크 미사용)만.
- `modules/` import 금지(헤르메스는 링크 문자열만). `openaiClient.js`·구매 코드·운영 배포·DB 마이그레이션 변경 금지. 다른 공급사 어댑터 추가 금지.
- **예약 양식 기존 동작 회귀 금지**(미리채움은 순수 추가).
- 새 브랜치/git 수술 금지. 이미 사람이 `feature/hermes-stage3`(= 최신 `feature/purchase-bot-mvp`에서 분기) 위에 있다고 가정.

### 완료 조건
위 8개 변경 완료 + `npm run lint` 통과 + `npm run agent-gateway:test` 통과(prefill 쿼리/비PII/degrade 단위) +
`DECISIONS.md`/`TODO.md`/`HANDOFF.md` 갱신 + `feature/hermes-stage3` 커밋 — 모두 충족 시에만 완료.
`HANDOFF.md`에 "루프 후 사람 검증 필요: ① 로컬/연습 DB `agent-layer:test`(DATABASE_URL 운영 아닌지 먼저 확인)
② 로컬 `OPENAI_API_KEY` 설정 후 dev에서 `@헤르메스 …예약…` → 미리채워진 양식이 열리고 항목이 맞는지·성함/연락처는 비어 있는지·사람이 제출 시 정상 생성되는지 확인 ③ PR 생성·검토"를 명시할 것.

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
