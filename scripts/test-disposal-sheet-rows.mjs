// 폐기 시트 행 매핑(disposalSheetRows) 단위테스트 — 승인정보 4칸 추가 + 반려행 검증.
// 순수 함수라 DB·네트워크 불필요. 실행: npx tsx scripts/test-disposal-sheet-rows.mjs
import assert from "node:assert/strict";
import { disposalSheetRows } from "../lib/inventorySheetSync.js";

const line = {
  itemName: "장미", quantity: 10, unit: "송이", category: "기타",
  cause: "시듦", sourceLotId: "20260624_장미_오늘꽃_0001", unitPrice: 500, amount: 5000
};
const BASE_11 = [
  "2026-06-24", "강남1호점", "김직원", "장미", 10, "송이", "기타", "시듦",
  "20260624_장미_오늘꽃_0001", 500, 5000
];

// ── 1) 승인 행: 처리자/시각은 batch.approvedByName/approvedAt에서 자동 채움 ──
const approved = {
  branchId: "branch-gangnam-1",
  disposalDate: new Date("2026-06-24T00:00:00Z"),
  status: "submitted",
  approvedByName: "박선영",
  approvedAt: new Date("2026-06-24T05:30:00Z"), // KST 14:30
  rejectReason: null,
  lines: [line]
};
const a = disposalSheetRows(approved, { branchName: "강남1호점", author: "김직원" })[0];
assert.equal(a.length, 15, "총 15칸");
assert.deepEqual(a.slice(0, 11), BASE_11, "기존 11칸 순서·내용 보존");
assert.equal(a[11], "박선영", "12 승인매니저");
assert.equal(a[12], "2026-06-24 14:30", "13 승인일시(KST)");
assert.equal(a[13], "승인", "14 승인상태");
assert.equal(a[14], "", "15 반려사유=빈칸(승인 행)");

// ── 2) 반려 행: DB에 반려자/시각 없음 → 옵션(decidedByName/decidedAt)으로 채움 ──
const rejected = {
  branchId: "branch-gangnam-1",
  disposalDate: new Date("2026-06-24T00:00:00Z"),
  status: "rejected",
  approvedByName: null,
  approvedAt: null,
  rejectReason: "수량 불일치",
  lines: [line]
};
const r = disposalSheetRows(rejected, {
  branchName: "강남1호점", author: "김직원",
  decidedByName: "박선영", decidedAt: new Date("2026-06-24T06:00:00Z") // KST 15:00
})[0];
assert.equal(r.length, 15, "반려도 15칸");
assert.deepEqual(r.slice(0, 11), BASE_11, "반려 행도 기존 11칸 보존");
assert.equal(r[11], "박선영", "12 반려 처리 매니저(옵션)");
assert.equal(r[12], "2026-06-24 15:00", "13 반려 처리 시각(KST, 옵션)");
assert.equal(r[13], "반려", "14 승인상태=반려");
assert.equal(r[14], "수량 불일치", "15 반려사유");

// ── 3) 옵션 우선순위: decidedByName/decidedAt가 batch.approved*보다 우선 ──
const both = disposalSheetRows(approved, {
  decidedByName: "재처리매니저", decidedAt: new Date("2026-06-25T00:00:00Z") // KST 09:00
})[0];
assert.equal(both[11], "재처리매니저", "옵션 처리자가 approvedByName보다 우선");
assert.equal(both[12], "2026-06-25 09:00", "옵션 시각이 approvedAt보다 우선(KST)");

// ── 4) 빈 값 안전: 처리자/시각/사유 없으면 빈칸, 라벨은 상태에서 파생 ──
const empty = disposalSheetRows({
  branchId: "b", disposalDate: new Date("2026-06-24T00:00:00Z"), status: "submitted", lines: [line]
})[0];
assert.equal(empty[11], "", "처리자 없으면 빈칸");
assert.equal(empty[12], "", "처리시각 없으면 빈칸");
assert.equal(empty[13], "승인", "상태 라벨 파생");
assert.equal(empty[14], "", "반려사유 없으면 빈칸");

// ── 5) 다중 라인: 모든 행에 동일 승인정보가 붙는다 ──
const multi = disposalSheetRows({ ...approved, lines: [line, { ...line, itemName: "튤립" }] });
assert.equal(multi.length, 2, "라인 2개 → 2행");
assert.equal(multi[1][3], "튤립", "둘째 행 품목");
assert.equal(multi[1][13], "승인", "둘째 행도 승인상태");
assert.equal(multi[1][11], "박선영", "둘째 행도 승인매니저");

console.log("✅ disposalSheetRows 단위테스트 통과 — 15칸·기존 11칸 보존·승인/반려/KST/옵션우선/다중라인");
