import assert from "node:assert/strict";
import { matchPurchaseItems, parseAliases, parsePurchaseCommand } from "../lib/purchaseBot/parser.js";

const items = [
  {
    id: "a4-paper",
    name: "A4용지",
    aliasesJson: JSON.stringify(["a4", "복사용지", "A4 용지"])
  },
  {
    id: "boro-namecard",
    name: "보로 강남점 명함",
    aliasesJson: JSON.stringify(["보로 명함", "강남점 명함"])
  }
];

const a4 = parsePurchaseCommand("@구매봇 A4용지 2박스 주문");
assert.equal(a4.itemQuery, "A4용지");
assert.equal(a4.quantity, 2);
assert.equal(a4.unitLabel, "박스");
assert.equal(matchPurchaseItems(a4, items)[0].id, "a4-paper");

const a4WithoutQuantity = parsePurchaseCommand("@구매봇 A4용지 주문");
assert.equal(a4WithoutQuantity.quantity, null);
assert.equal(a4WithoutQuantity.itemQuery, "A4용지");

const namecard = parsePurchaseCommand("@구매봇 보로 명함 500매 재주문");
assert.equal(namecard.itemQuery, "보로 명함");
assert.equal(namecard.quantity, 500);
assert.equal(namecard.unitLabel, "매");
assert.equal(matchPurchaseItems(namecard, items)[0].id, "boro-namecard");

assert.deepEqual(parseAliases("not-json"), []);
assert.deepEqual(parseAliases(JSON.stringify(["a", "b"])), ["a", "b"]);

console.log("purchase bot parser tests passed");
