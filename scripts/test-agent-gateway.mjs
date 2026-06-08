import assert from "node:assert/strict";
import {
  isPurchaseAgentCommand,
  PURCHASE_AGENT_MENTIONS,
  toPurchaseBotCommand,
  validatePurchaseAgentCommand
} from "../lib/agents/purchaseAgent/prompts.js";
import { parseBulkPurchaseOrder } from "../lib/agents/purchaseAgent/bulkOrderParser.js";

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

console.log("agent gateway tests passed");
