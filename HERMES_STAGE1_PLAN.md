# 헤르메스 1단계 개발계획 (다듬은 버전)

> 상태: **구현 전 / 리더 승인 대기**. 작업지시서 "보고 후 승인 — 게이트"에 대응하는 보고 문서.
> 작성 기준: 대상 브랜치 `feature/purchase-bot-mvp`(`a3c974a`) 실제 코드 확인 완료.

## 0. 컨텍스트 (왜)
- 채팅 메시지는 [route.js:63](app/api/channels/[channelId]/messages/route.js)에서 `!created.bot`일 때만 `handleMessageWithAgentGateway({ body, channelId, messageId, requester: user })`로 넘어가고, `handled`가 false면 `handlePurchaseBotCommand`로 폴백한다.
- 현재 게이트웨이([lib/agentGateway/service.js:8](lib/agentGateway/service.js))는 `runPurchaseAgent`만 호출 — 분배 단계가 없다.
- 헤르메스 = 단일 안내데스크 에이전트(A안). 1단계는 **배선 검증**이 목적이라 **안내 메시지 + AgentRun 기록만** 한다(두뇌·도구·승인 없음).

## 0.1 ⚠️ 환경 선행조건 (중요)
이 워크트리(`claude/hardcore-hodgkin-d0fbdd`, `069aecb`)에는 에이전트 계층이 **전혀 없다**(main의 옛 조상). 전제 코드는 `feature/purchase-bot-mvp`에만 있다.
- **결정됨**: 이 워크트리에서 새 하위 브랜치를 만들어 작업 → `feature/purchase-bot-mvp`로 PR.
- 구현 시작 시 첫 명령:
  ```bash
  git fetch
  git checkout -b feature/hermes-stage1 feature/purchase-bot-mvp
  ```
  (feature/purchase-bot-mvp 자체를 체크아웃하는 게 아니라 그 끝점에서 새 브랜치를 만드는 것이라 다른 워크트리와 충돌 없음.)

## 1. 변경/추가 파일

### (신규) lib/agents/hermes/prompts.js
`purchaseAgent/prompts.js` 구조 미러링.
```js
export const HERMES_AGENT_SLUG = "hermes-agent";
export const HERMES_AGENT_MENTIONS = ["@헤르메스", "@hermes", "@Hermes"];

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}
export function isHermesAgentCommand(body) {
  const text = String(body ?? "");
  return HERMES_AGENT_MENTIONS.some((mention) => text.includes(mention));
}
export function stripHermesAgentMention(body) { // 2단계 대비
  let text = normalizeText(body);
  for (const mention of HERMES_AGENT_MENTIONS) text = normalizeText(text.replaceAll(mention, ""));
  return text;
}
export const HERMES_HELP_LINES = [
  "안녕하세요, 업무지원 비서 헤르메스입니다.",
  "앞으로 발주·예약·입고·폐기를 채팅으로 바로 도와드릴게요.",
  "지금은 준비 단계라 인사만 드립니다.",
  "",
  "예) @헤르메스 발주 도와줘 · @헤르메스 예약 확인"
];
```

### (신규) lib/agents/hermes/service.js
`purchaseAgent/service.js`의 `nowId`/`stringifyJson`/`appendPurchaseAgentMessage`/`getPurchaseAgentInstallation`/run 패턴 미러링하되 **도구·승인·업무데이터 없음**.
```js
import { prisma } from "../../prisma";
import { HERMES_AGENT_SLUG, HERMES_HELP_LINES, isHermesAgentCommand } from "./prompts";

function nowId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function stringifyJson(value, fallback = {}) {
  try { return JSON.stringify(value ?? fallback); } catch { return JSON.stringify(fallback); }
}
async function appendHermesAgentMessage(channelId, lines) {
  return prisma.message.create({
    data: { id: nowId("msg"), channelId, author: "헤르메스",
      body: ["헤르메스", "", ...lines].join("\n"), attachmentsJson: "[]", bot: true }
  });
}
export async function getHermesInstallation(channelId) {
  if (!prisma.agentApp) return null;
  return prisma.channelAgentInstallation.findFirst({
    where: { channelId, enabled: true, agentApp: { slug: HERMES_AGENT_SLUG, status: "active" } },
    include: { agentApp: true }
  });
}
export async function runHermesAgent({ body, channelId, messageId, requester }) {
  if (!isHermesAgentCommand(body)) return { handled: false, reason: "not_hermes_command" };
  const installation = await getHermesInstallation(channelId);
  if (!installation) return { handled: false, reason: "hermes_not_installed" };

  const run = await prisma.agentRun.create({
    data: { id: nowId("agentrun"), agentAppId: installation.agentAppId, channelId, messageId,
      requesterId: requester.id, status: "running", inputText: body,
      intentJson: stringifyJson({ source: "deterministic_mention", agent: HERMES_AGENT_SLUG, action: "help" }) }
  });
  try {
    await appendHermesAgentMessage(channelId, HERMES_HELP_LINES);
    const output = { handled: true, action: "help" };
    const updated = await prisma.agentRun.update({
      where: { id: run.id }, data: { status: "completed", outputJson: stringifyJson(output) } });
    return { ...output, agentRunId: updated.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.agentRun.update({ where: { id: run.id }, data: { status: "failed", error: message.slice(0, 2000) } });
    throw error;
  }
}
```

### (수정) lib/agentGateway/service.js — 분기 1곳만
```js
import { runPurchaseAgent } from "../agents/purchaseAgent/service";
import { isHermesAgentCommand } from "../agents/hermes/prompts";   // 추가
import { runHermesAgent } from "../agents/hermes/service";          // 추가
// ...
  try {
    if (isHermesAgentCommand(body)) {                               // 추가
      const hermesResult = await runHermesAgent({ body, channelId, messageId, requester });
      if (hermesResult.handled) return hermesResult;
    }
    return await runPurchaseAgent({ body, channelId, messageId, requester });
  } catch (error) { /* 기존 missing-table degrade 그대로 */ }
```
- 미설치/비멘션이면 `handled:false` → 기존 구매 경로 그대로 통과. **구매 동작 무변경.**

### (수정) scripts/test-agent-gateway.mjs — 순수 단위 (DB 없음)
> ⚠️ 작업지시서 5)는 여기서 "AgentRun completed 확인"을 요구하지만, 이 파일은 **DB를 안 건드리는 단위 테스트**다. AgentRun/메시지 게시 검증은 아래 `test-agent-layer.mjs`로 분리한다.
```js
import { isHermesAgentCommand, stripHermesAgentMention } from "../lib/agents/hermes/prompts.js";
assert.equal(isHermesAgentCommand("@헤르메스 안녕"), true);
assert.equal(isHermesAgentCommand("@hermes hi"), true);
assert.equal(isHermesAgentCommand("@구매에이전트 키친타올 3개 주문"), false);
assert.equal(stripHermesAgentMention("@헤르메스 안녕"), "안녕");
// 회귀: 구매 멘션이 헤르메스로 안 샘
assert.equal(isPurchaseAgentCommand("@헤르메스 안녕"), false);
```

### (수정) scripts/test-agent-layer.mjs — DB 통합 (로컬 한정)
- `seedAgentLayer()`에 헤르메스 AgentApp upsert 추가:
  ```js
  await prisma.agentApp.upsert({
    where: { slug: "hermes-agent" },
    create: { id: "agentapp-hermes-agent", slug: "hermes-agent", name: "헤르메스",
      role: "concierge", status: "active",
      description: "발주·예약·입고·폐기를 채팅으로 안내·라우팅하는 업무지원 비서(1단계: 안내만).",
      configJson: JSON.stringify({ mentions: ["@헤르메스", "@hermes", "@Hermes"] }) },
    update: { status: "active" }
  });
  ```
- 구매 에이전트 설치 직후 헤르메스 설치 추가:
  ```js
  await enableChannelAgent({ channelId, agentId: "hermes-agent", config: {}, actor: admin });
  ```
- 헤르메스 검증 블록 추가(구매 회귀 블록은 그대로 유지):
  ```js
  const hermesResult = await handleMessageWithAgentGateway({
    body: "@헤르메스 안녕", channelId, messageId: `${runId}-hermes-message`, requester });
  assert.equal(hermesResult.handled, true);
  assert.equal(hermesResult.action, "help");
  const hermesRun = await prisma.agentRun.findUnique({ where: { id: hermesResult.agentRunId } });
  assert.equal(hermesRun.status, "completed");
  const hermesMessage = await prisma.message.findFirst({
    where: { channelId, author: "헤르메스" }, orderBy: { createdAt: "desc" } });
  assert.ok(hermesMessage);
  assert.match(hermesMessage.body, /업무지원 비서 헤르메스/);
  ```
- 정리(finally): 기존 `agentRun/message/channelAgentInstallation deleteMany(by requesterId/channelId)`가 헤르메스 레코드까지 덮으므로 추가 정리 불필요. 헤르메스 AgentApp은 구매와 동일하게 upsert로 남겨둠(idempotent).

### 패키지/설정 — 변경 없음
`agent-gateway:test`, `agent-layer:test`, `lint`(+`check-module-boundaries.mjs`) 이미 존재. 모듈경계 검사는 `modules/`끼리만 보므로 `lib/agents/hermes`는 대상 아님(경계 위반 없음).

## 2. 헤르메스 등록 방법 (시험 한정)
- 위 `test-agent-layer.mjs`의 `seedAgentLayer()`에서 `hermes-agent` AgentApp upsert + 시험 채널에 `enableChannelAgent` 설치.
- 운영 자동 시드 없음(구매 에이전트도 동일). 운영 등록은 별도 단계(리더 승인 후) — 이번 범위 아님.
- **운영 DB 마이그레이션 불필요** — 기존 AgentApp/AgentRun/ChannelAgentInstallation 재사용.

## 3. 예상 영향 / 위험
- `@헤르메스`가 포함된 메시지에서만 분기. 미설치 채널 → `handled:false` → 기존 경로 그대로. **구매 경로 동작 변화 0.**
- missing-table degrade(try/catch) 유지. 헤르메스 실패도 동일 catch가 흡수.
- 범위 밖(이번에 안 함): 두뇌(LLM)·업무 실행·딥링크 안내·운영 배포·구매 코드 수정·독립 구매 에이전트 정리.

## 4. 검증 방법 (완료 기준)
1. `npm run lint` 통과(모듈 경계 포함).
2. `npm run agent-gateway:test` 통과(헤르메스 단위 + 구매 회귀).
3. **로컬 `DATABASE_URL` 확인 후에만** `npm run agent-layer:test` — 헤르메스 AgentRun completed + 안내 메시지 게시 + 구매 회귀. ⚠️ 기본 `.env`가 운영 DB일 수 있으니 함부로 실행 금지(HANDOFF 주의).
4. 로컬 dev 채널에서 `@헤르메스 안녕` → "업무지원 비서 헤르메스입니다…" 안내 응답 확인.

## 5. DECISIONS.md 추가(구현 시 함께 커밋, 초안)
```
## 2026-06-17: 헤르메스 1단계 — 게이트웨이 분기 + 안내 응답(동작 변경 없음)
- A안(단일 안내데스크) 채택. lib/agents/hermes/{prompts,service}.js 신설.
- 게이트웨이는 @헤르메스일 때만 runHermesAgent 분기, 미설치 시 handled:false로 기존 구매 경로 통과.
- 1단계는 두뇌·도구·승인 없음(안내+AgentRun만). 등록은 시험 한정(test-agent-layer.mjs), 운영 시드 없음.
```

## 6. 커밋/PR
- 테스트 통과 후 한국어 커밋: `[코어] 헤르메스 에이전트 뼈대 + 게이트웨이 분기 (안내 응답만, 동작 변경 없음)`
- `feature/hermes-stage1` → `feature/purchase-bot-mvp`로 PR.

## 7. 미세 결정(기본값 채택, 이견 시 알려주세요)
- AgentApp `role` = `"concierge"`(구매는 `"purchase"`). 표시명 `"헤르메스"`.
- 멘션 = `@헤르메스 / @hermes / @Hermes`(작업지시서 그대로, 대소문자 변형 2개로 커버).
- 메시지 author = `"헤르메스"`(구매는 `"구매 에이전트"`).
