// 통계(매출) 지표 API — 원모먼트 analytics 모듈.
// ⚠️ Phase 0: 더미(시드) 숫자만 반환한다. RDS·실데이터·마케팅 API 연동은 Phase 1~2.
// 응답 "형태(계약)"는 지금 고정한다 — Phase 1에서 데이터 출처만 RDS로 교체하고 형태는 유지.
// 쿼리: from(YYYY-MM-DD), to(YYYY-MM-DD), granularity(day|week|month) → range에 echo.
// 설계: docs/platform-architecture.md (모듈 API는 /api/work/<module>/...)
import { requireCurrentUser } from "../../../../../lib/auth";
import { isModuleEnabled } from "../../../../../lib/brand";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 366; // 더미 생성 상한(병리적 범위 방지)
const GRANULARITIES = new Set(["day", "week", "month"]);

// 더미용 결정적 의사난수(0~1). 같은 날짜·키면 항상 같은 값 → 렌더마다 숫자가 흔들리지 않게.
function seeded(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 100000) / 100000;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// 기간 내 날짜 문자열 배열(시작·종료 포함). 상한 초과 시 종료를 잘라낸다.
function eachDay(start, end) {
  const days = [];
  for (let t = start.getTime(); t <= end.getTime() && days.length < MAX_DAYS; t += DAY_MS) {
    days.push(isoDate(new Date(t)));
  }
  return days;
}

// 하루치 더미 매출/주문/광고비. 주말 가중 + 완만한 성장 추세 + 시드 노이즈.
function dummyDay(dateStr, index) {
  const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0=일 ... 6=토
  const weekend = dow === 0 || dow === 6 ? 1.18 : 1;
  const growth = 1 + index * 0.004;
  const revenue = Math.round((1_650_000 + seeded(dateStr) * 900_000) * weekend * growth);
  const aov = 48_000 + Math.round(seeded(`${dateStr}|aov`) * 22_000); // 48,000~70,000
  const orders = Math.max(1, Math.round(revenue / aov));
  const adSpend = Math.round(revenue * (0.14 + seeded(`${dateStr}|ad`) * 0.1)); // 매출의 14~24%
  return { date: dateStr, revenue, orders, adSpend };
}

// 일자 버킷 키(주=월요일 시작, 월=1일). day면 그대로.
function bucketKey(dateStr, granularity) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (granularity === "month") {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }
  if (granularity === "week") {
    const dow = date.getUTCDay();
    const backToMonday = dow === 0 ? 6 : dow - 1;
    return isoDate(new Date(date.getTime() - backToMonday * DAY_MS));
  }
  return dateStr;
}

// 일자 포인트들을 granularity 버킷으로 합산.
function toSeries(dailyPoints, granularity) {
  const buckets = new Map();
  for (const point of dailyPoints) {
    const key = bucketKey(point.date, granularity);
    const bucket = buckets.get(key) ?? { date: key, revenue: 0, orders: 0, adSpend: 0 };
    bucket.revenue += point.revenue;
    bucket.orders += point.orders;
    bucket.adSpend += point.adSpend;
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function summarize(dailyPoints) {
  const revenue = dailyPoints.reduce((sum, p) => sum + p.revenue, 0);
  const orders = dailyPoints.reduce((sum, p) => sum + p.orders, 0);
  const adSpend = dailyPoints.reduce((sum, p) => sum + p.adSpend, 0);
  const aov = orders ? Math.round(revenue / orders) : 0;
  const roas = adSpend ? Math.round((revenue / adSpend) * 100) / 100 : 0; // blended(전체 기준)
  const adCostRatio = revenue ? Math.round((adSpend / revenue) * 1000) / 10 : 0; // % 1자리
  return { revenue, orders, aov, adSpend, roas, adCostRatio };
}

const EMPTY = {
  range: { start: null, end: null, granularity: "day" },
  summary: { revenue: 0, orders: 0, aov: 0, adSpend: 0, roas: 0, adCostRatio: 0 },
  previous: { revenue: 0, orders: 0, aov: 0, roas: 0 },
  series: [],
  meta: { adSpendSource: "manual", roasType: "blended" }
};

export async function GET(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const rawGranularity = params.get("granularity");
  const granularity = GRANULARITIES.has(rawGranularity) ? rawGranularity : "day";

  // 기본 기간: 이번 달 1일 ~ 오늘.
  const now = new Date();
  const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  let start = parseDate(params.get("from")) ?? defaultStart;
  let end = parseDate(params.get("to")) ?? defaultEnd;
  if (start.getTime() > end.getTime()) [start, end] = [end, start];

  // 모듈 비활성(다른 브랜드)에서도 계약 형태는 유지하되 0값으로 degrade.
  if (!isModuleEnabled("analytics")) {
    return Response.json({ ...EMPTY, range: { start: isoDate(start), end: isoDate(end), granularity } });
  }

  const days = eachDay(start, end);
  const dailyPoints = days.map((dateStr, index) => dummyDay(dateStr, index));

  // 직전 동일 길이 기간(증감 % 표시용).
  const periodLength = days.length;
  const prevEnd = new Date(start.getTime() - DAY_MS);
  const prevStart = new Date(prevEnd.getTime() - (periodLength - 1) * DAY_MS);
  const prevPoints = eachDay(prevStart, prevEnd).map((dateStr, index) => dummyDay(dateStr, index));
  const prev = summarize(prevPoints);

  return Response.json({
    range: { start: isoDate(start), end: isoDate(end), granularity },
    summary: summarize(dailyPoints),
    previous: { revenue: prev.revenue, orders: prev.orders, aov: prev.aov, roas: prev.roas },
    series: toSeries(dailyPoints, granularity),
    meta: { adSpendSource: "manual", roasType: "blended" }
  });
}
