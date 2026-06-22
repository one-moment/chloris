// 폐기·재고 인사이트 순수 집계 헬퍼 단위 테스트 (DB 미접속).
// 실행: npx tsx scripts/test-inventory-metrics.mjs
// 검증 대상(lib/inventory.js): pct, normalizeGranularity, bucketKeyForDate,
// aggregateDisposalByItem, buildWasteTrend. 통합/DB 테스트 아님.
import assert from "node:assert/strict";
import {
  pct,
  normalizeGranularity,
  bucketKeyForDate,
  aggregateDisposalByItem,
  buildWasteTrend
} from "../lib/inventory.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const utcDay = (key) => new Date(`${key}T00:00:00Z`).getUTCDay(); // 0=일 … 1=월

// ── pct ──────────────────────────────────────────────────────────────────────
check("pct: 기본/분모0/반올림", () => {
  assert.equal(pct(10, 100), 10);
  assert.equal(pct(5, 0), 0); // 분모 0 → 0
  assert.equal(pct(1, 3), 33.3); // 소수 1자리
  assert.equal(pct(35000, 400000), 8.8);
});

// ── normalizeGranularity ─────────────────────────────────────────────────────
check("normalizeGranularity: 화이트리스트 외 → month", () => {
  assert.equal(normalizeGranularity("day"), "day");
  assert.equal(normalizeGranularity("week"), "week");
  assert.equal(normalizeGranularity("month"), "month");
  assert.equal(normalizeGranularity("year"), "month");
  assert.equal(normalizeGranularity(undefined), "month");
});

// ── bucketKeyForDate ─────────────────────────────────────────────────────────
check("bucketKeyForDate: day/month 키", () => {
  assert.equal(bucketKeyForDate("2026-05-10T09:00:00Z", "day"), "2026-05-10");
  assert.equal(bucketKeyForDate(new Date("2026-05-10T00:00:00Z"), "month"), "2026-05-01");
  assert.equal(bucketKeyForDate("not-a-date", "day"), null);
});

check("bucketKeyForDate: week=월요일 시작, 같은 주는 같은 키", () => {
  // 같은 Mon~Sun 주에 속하는 세 날짜가 동일 키로 묶이고, 키는 월요일이어야 한다.
  const wed = bucketKeyForDate("2026-05-06T00:00:00Z", "week");
  const monSame = bucketKeyForDate("2026-05-04T00:00:00Z", "week");
  const sunSame = bucketKeyForDate("2026-05-10T00:00:00Z", "week");
  assert.equal(wed, monSame);
  assert.equal(wed, sunSame);
  assert.equal(utcDay(wed), 1); // 월요일
  // 일요일(2026-05-10)의 다음 날 월요일은 새 주로 분리
  const nextMon = bucketKeyForDate("2026-05-11T00:00:00Z", "week");
  assert.notEqual(nextMon, wed);
  assert.equal(utcDay(nextMon), 1);
});

// ── 공용 픽스처 ──────────────────────────────────────────────────────────────
const branchName = new Map([["A", "강남1호점"], ["B", "잠실점"]]);
const batches = [
  { branchId: "A", disposalDate: new Date("2026-05-10T00:00:00Z"), lines: [
    { itemName: "장미", quantity: 10, amount: 20000 },
    { itemName: "튤립", quantity: 6, amount: 10000 }
  ] }, // A 5월 폐기 30000
  { branchId: "B", disposalDate: new Date("2026-05-12T00:00:00Z"), lines: [
    { itemName: "장미", quantity: 3, amount: 5000 }
  ] }, // B 5월 폐기 5000
  { branchId: "A", disposalDate: new Date("2026-06-03T00:00:00Z"), lines: [
    { itemName: "수국", quantity: 4, amount: 20000 }
  ] } // A 6월 폐기 20000
];
const deliveries = [
  { branchId: "A", statementDate: new Date("2026-05-09T00:00:00Z"), lines: [{ amount: 300000 }] },
  { branchId: "B", statementDate: new Date("2026-05-11T00:00:00Z"), lines: [{ amount: 100000 }] },
  { branchId: "A", statementDate: new Date("2026-06-02T00:00:00Z"), lines: [{ amount: 100000 }] }
];

// ── aggregateDisposalByItem ──────────────────────────────────────────────────
check("aggregateDisposalByItem: 합산 + 폐기가액 desc 정렬", () => {
  const byItem = aggregateDisposalByItem(batches);
  assert.deepEqual(byItem, [
    { itemName: "장미", quantity: 13, amount: 25000 },
    { itemName: "수국", quantity: 4, amount: 20000 },
    { itemName: "튤립", quantity: 6, amount: 10000 }
  ]);
  assert.deepEqual(aggregateDisposalByItem([]), []);
});

// ── buildWasteTrend ──────────────────────────────────────────────────────────
check("buildWasteTrend(month): 버킷·지점별 폐기율", () => {
  const trend = buildWasteTrend(batches, deliveries, "month", branchName);
  assert.equal(trend.granularity, "month");
  assert.equal(trend.points.length, 2);

  const [may, jun] = trend.points;
  assert.equal(may.bucket, "2026-05-01");
  assert.equal(may.disposalAmount, 35000);
  assert.equal(may.stockInAmount, 400000);
  assert.equal(may.wasteRate, 8.8);
  // 지점 정렬: 강남1호점 < 잠실점 (가나다)
  assert.deepEqual(may.branches.map((b) => b.branchName), ["강남1호점", "잠실점"]);
  assert.equal(may.branches[0].wasteRate, 10); // A: 30000/300000
  assert.equal(may.branches[1].wasteRate, 5); // B: 5000/100000

  assert.equal(jun.bucket, "2026-06-01");
  assert.equal(jun.wasteRate, 20); // 20000/100000
  assert.equal(jun.branches.length, 1);
});

check("buildWasteTrend(week): 모든 버킷 키가 월요일", () => {
  const trend = buildWasteTrend(batches, deliveries, "week", branchName);
  assert.ok(trend.points.length >= 1);
  for (const point of trend.points) assert.equal(utcDay(point.bucket), 1);
});

check("buildWasteTrend: branchName 누락 시 branchId로 폴백 / 빈 입력 안전", () => {
  const trend = buildWasteTrend(batches, deliveries, "month", undefined);
  assert.equal(trend.points[0].branches[0].branchName, trend.points[0].branches[0].branchId);
  const empty = buildWasteTrend([], [], "day", branchName);
  assert.deepEqual(empty, { granularity: "day", points: [] });
});

console.log(`\n폐기·재고 인사이트 헬퍼 테스트 통과: ${passed}건`);
