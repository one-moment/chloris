import assert from "node:assert/strict";
import {
  isPurchaseAgentCommand,
  PURCHASE_AGENT_MENTIONS,
  toPurchaseBotCommand,
  validatePurchaseAgentCommand
} from "../lib/agents/purchaseAgent/prompts.js";
import { parseBulkPurchaseOrder } from "../lib/agents/purchaseAgent/bulkOrderParser.js";
import {
  buildReservationPrefillQuery,
  buildRouteMessageLines,
  isHermesAgentCommand,
  stripHermesAgentMention,
  WORK_ROUTES
} from "../lib/agents/hermes/prompts.js";
import { isModuleEnabled } from "../lib/brand.js";
import { classifyJson } from "../lib/agents/llm/index.js";

assert.equal(isPurchaseAgentCommand("@구매에이전트 A4용지 2박스 주문"), true);
assert.equal(isPurchaseAgentCommand("@구매 에이전트 키친타올 3개 주문"), true);
assert.equal(isPurchaseAgentCommand("@구매봇 키친타올 3개 주문"), false);
assert.deepEqual(
  validatePurchaseAgentCommand("@구매에이전트 키친타올 3개 주문"),
  { valid: true, itemQuery: "키친타올", quantity: 3, unitLabel: "개" }
);
assert.equal(validatePurchaseAgentCommand("@구매에이전트 키친타올 주문").reason, "missing_quantity");
assert.equal(validatePurchaseAgentCommand("@구매에이전트 3개 주문").reason, "missing_item");

for (const mention of PURCHASE_AGENT_MENTIONS) {
  assert.equal(
    toPurchaseBotCommand(`${mention} 키친타올 3개 주문`),
    "@구매봇 키친타올 3개 주문"
  );
}

const sampleBulkOrder = parseBulkPurchaseOrder(`@구매에이전트
1. 이름/소속 : 유경화/플라워팀
2. 주문상품 내역:
(쿠팡)
-락스 / 1
-버터무드용 스티커 / 1
https://link.coupang.com/a/dU8MJL4A5A
-디자인 샘플용 부자재 / 1개씩
https://link.coupang.com/a/dU83z9ELCK
https://link.coupang.com/a/dU9hsWdMJg
-로즈모먼트 포장지 / 2
https://link.coupang.com/a/dU9oBIgAai
-호일 / 8개
-니트릴장갑(블랙) 1
https://www.coupang.com/vp/products/6101620244?itemId=15606012896&vendorItemId=82824267836
-스테인플러 심 / 3

(성원에드피아)
정사각 스티커 (화이트) / 500개
가로명함 / 500개

(지마켓)
-키티 / 30개

(현대데코)
-pa225s / 30개
-pa225m/20개`);

assert.equal(sampleBulkOrder.isBulkOrder, true);
assert.equal(sampleBulkOrder.requesterName, "유경화");
assert.equal(sampleBulkOrder.requesterTeam, "플라워팀");
assert.equal(sampleBulkOrder.lines.length, 13);
assert.equal(sampleBulkOrder.lines.filter((line) => line.vendor === "coupang").length, 8);
assert.equal(sampleBulkOrder.lines.filter((line) => line.vendor === "swadpia").length, 2);
assert.equal(sampleBulkOrder.lines.filter((line) => line.vendor === "gmarket").length, 1);
assert.equal(sampleBulkOrder.lines.filter((line) => line.vendor === "hyundaideco").length, 2);
assert.equal(sampleBulkOrder.lines.find((line) => line.itemName === "디자인 샘플용 부자재")?.quantity, 1);

const metadataBulkOrder = parseBulkPurchaseOrder(`@구매에이전트
[운영 테스트] 2026-06-09 Purchase Agent 복수주문
이름/소속 : 테스트/운영검증
주문상품 내역:
(쿠팡)
-키친타올 / 2
https://www.coupang.com/vp/products/6577880987?itemId=19013354588&vendorItemId=86137970853
(성원에드피아)
가로명함 / 500개`);

assert.equal(metadataBulkOrder.isBulkOrder, true);
assert.equal(metadataBulkOrder.lines.length, 2);
assert.equal(metadataBulkOrder.lines.some((line) => line.vendor === "unknown"), false);
assert.equal(metadataBulkOrder.lines.find((line) => line.vendor === "coupang")?.itemName, "키친타올");
assert.equal(metadataBulkOrder.lines.find((line) => line.vendor === "swadpia")?.itemName, "가로명함");

// 헤르메스 멘션 감지 + 멘션 제거 헬퍼
assert.equal(isHermesAgentCommand("@헤르메스 안녕"), true);
assert.equal(isHermesAgentCommand("@hermes hi"), true);
assert.equal(isHermesAgentCommand("@Hermes 도와줘"), true);
assert.equal(isHermesAgentCommand("그냥 일반 메시지"), false);
assert.equal(stripHermesAgentMention("@헤르메스 안녕"), "안녕");

// 회귀: 구매와 헤르메스 멘션이 서로 새지 않음
assert.equal(isHermesAgentCommand("@구매에이전트 키친타올 3개 주문"), false);
assert.equal(isPurchaseAgentCommand("@헤르메스 안녕"), false);

// 2단계: WORK_ROUTES 매핑 + 라우트 안내 문구
assert.equal(WORK_ROUTES.purchase.href, "/work/purchase");
assert.equal(WORK_ROUTES.reservation.href, "/work/reservations");
assert.equal(WORK_ROUTES.stockin.href, "/work/stock-in");
assert.equal(WORK_ROUTES.stockin.moduleSlug, "stockin");
assert.equal(WORK_ROUTES.disposal.href, "/work/disposal");
const purchaseRouteLines = buildRouteMessageLines(WORK_ROUTES.purchase);
assert.equal(purchaseRouteLines.length, 2);
assert.ok(purchaseRouteLines.some((line) => line.includes("발주(구매 관리)")));
assert.ok(purchaseRouteLines.some((line) => line.includes("/work/purchase")));

// 2단계: 브랜드 게이팅 — 보로(기본 brand)에서 4개 area 모듈이 enabled
for (const area of ["purchase", "reservation", "stockin", "disposal"]) {
  assert.equal(isModuleEnabled(WORK_ROUTES[area].moduleSlug), true);
}

// 2단계: classifyJson degrade — 키 없으면 실제 호출 없이 skipped (OPENAI_API_KEY 백업→복원)
{
  const savedKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const cls = await classifyJson({ messages: [] });
  assert.equal(cls.skipped, true);
  if (savedKey !== undefined) process.env.OPENAI_API_KEY = savedKey;
}

// 2단계: 알 수 없는 provider → skipped(unknown_provider) (AGENT_LLM_PROVIDER 백업→복원)
{
  const savedProvider = process.env.AGENT_LLM_PROVIDER;
  process.env.AGENT_LLM_PROVIDER = "nonexistent-provider";
  const cls = await classifyJson({ messages: [] });
  assert.equal(cls.skipped, true);
  assert.equal(cls.reason, "unknown_provider");
  if (savedProvider === undefined) delete process.env.AGENT_LLM_PROVIDER;
  else process.env.AGENT_LLM_PROVIDER = savedProvider;
}

// 3단계: buildReservationPrefillQuery — 비PII만 담기고 name/phone 키는 절대 없음
{
  const query = buildReservationPrefillQuery({
    product: "장미 부케",
    amount: 50000,
    pickupAt: "2026-06-18T15:00",
    receiveMethod: "방문수령",
    source: "인스타",
    name: "홍길동",
    phone: "010-1234-5678"
  });
  const params = new URLSearchParams(query);
  assert.equal(params.get("product"), "장미 부케");
  assert.equal(params.get("amount"), "50000");
  assert.equal(params.get("pickup"), "2026-06-18T15:00");
  assert.equal(params.get("receive"), "방문수령");
  assert.equal(params.get("source"), "인스타");
  assert.equal(params.has("name"), false);
  assert.equal(params.has("phone"), false);
}

// 3단계: 허용값 아닌 receive/source·빈 값은 스킵 → 빈 쿼리
assert.equal(
  buildReservationPrefillQuery({ product: "", amount: null, pickupAt: null, receiveMethod: "택배", source: "잘못된경로" }),
  ""
);
assert.equal(buildReservationPrefillQuery(null), "");

console.log("agent gateway tests passed");
