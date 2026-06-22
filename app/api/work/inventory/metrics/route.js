// 재고 지표 API (보로 inventory 모듈). 최종제출(submitted) 기록만 집계한다.
// 폐기 건수·수량·가액(사유/구분 비중), 입고 가액·불일치율, 폐기율(가액기준), byBranch.
// 기간(from/to)·지점 필터. 테이블 부재/모듈 비활성 시 0값으로 degrade. 설계: §11
import { requireCurrentUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { isModuleEnabled } from "../../../../../lib/brand";
import { isMissingInventoryTableError } from "../../../../../lib/inventoryServer";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

function inventoryEnabled() {
  return isModuleEnabled("disposal") || isModuleEnabled("stockin");
}

// 백분율(소수 1자리). 분모 0이면 0.
function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

// 월별 집계 키(YYYY-MM). 폐기는 disposalDate, 입고는 statementDate 기준.
function monthKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const EMPTY = {
  period: { from: null, to: null },
  disposal: { batchCount: 0, lineCount: 0, totalQuantity: 0, totalAmount: 0, byCause: [], byCategory: [], byItem: [] },
  stockIn: { deliveryCount: 0, lineCount: 0, totalAmount: 0, discrepancyCount: 0, discrepancyRate: 0 },
  wasteRateByAmount: 0,
  byBranch: [],
  byMonth: []
};

export async function GET(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (!inventoryEnabled()) return Response.json(EMPTY);

  const params = new URL(request.url).searchParams;
  const branchId = params.get("branchId") || null;
  const from = params.get("from");
  const to = params.get("to");
  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);
  const hasDate = Boolean(from || to);

  try {
    const disposalWhere = { status: "submitted" };
    const stockWhere = { status: "submitted" };
    if (branchId) {
      disposalWhere.branchId = branchId;
      stockWhere.branchId = branchId;
    }
    if (hasDate) {
      disposalWhere.disposalDate = dateFilter;
      stockWhere.statementDate = dateFilter;
    }

    const [disposalBatches, stockDeliveries, branches] = await Promise.all([
      prisma.disposalBatch.findMany({ where: disposalWhere, include: { lines: true } }),
      prisma.stockInDelivery.findMany({ where: stockWhere, include: { lines: true } }),
      prisma.branch.findMany({ select: { id: true, name: true } })
    ]);

    const branchName = new Map(branches.map((branch) => [branch.id, branch.name]));
    const causeMap = new Map();
    const categoryMap = new Map();
    const itemMap = new Map();
    const byBranch = new Map();
    const monthBucket = new Map();
    const branchEntry = (id) => {
      if (!byBranch.has(id)) {
        byBranch.set(id, { branchId: id, branchName: branchName.get(id) ?? id, disposalAmount: 0, stockInAmount: 0, discrepancyCount: 0 });
      }
      return byBranch.get(id);
    };
    const monthEntry = (key) => {
      if (!monthBucket.has(key)) {
        monthBucket.set(key, { month: key, disposalAmount: 0, stockInAmount: 0 });
      }
      return monthBucket.get(key);
    };

    let disposalLineCount = 0;
    let disposalQuantity = 0;
    let disposalAmount = 0;
    for (const batch of disposalBatches) {
      const entry = branchEntry(batch.branchId);
      const month = monthEntry(monthKey(batch.disposalDate));
      for (const line of batch.lines) {
        disposalLineCount += 1;
        disposalQuantity += line.quantity ?? 0;
        const amount = line.amount ?? 0;
        disposalAmount += amount;
        entry.disposalAmount += amount;
        month.disposalAmount += amount;
        const cause = causeMap.get(line.cause) ?? { cause: line.cause, count: 0, amount: 0 };
        cause.count += 1;
        cause.amount += amount;
        causeMap.set(line.cause, cause);
        const category = categoryMap.get(line.category) ?? { category: line.category, count: 0, amount: 0 };
        category.count += 1;
        category.amount += amount;
        categoryMap.set(line.category, category);
        const item = itemMap.get(line.itemName) ?? { itemName: line.itemName, count: 0, quantity: 0, amount: 0 };
        item.count += 1;
        item.quantity += line.quantity ?? 0;
        item.amount += amount;
        itemMap.set(line.itemName, item);
      }
    }

    let stockLineCount = 0;
    let stockAmount = 0;
    let discrepancyCount = 0;
    for (const delivery of stockDeliveries) {
      const entry = branchEntry(delivery.branchId);
      const month = monthEntry(monthKey(delivery.statementDate));
      for (const line of delivery.lines) {
        stockLineCount += 1;
        const amount = line.amount ?? 0;
        stockAmount += amount;
        entry.stockInAmount += amount;
        month.stockInAmount += amount;
        if (line.status && line.status !== "ok") {
          discrepancyCount += 1;
          entry.discrepancyCount += 1;
        }
      }
    }

    return Response.json({
      period: { from: from ?? null, to: to ?? null },
      disposal: {
        batchCount: disposalBatches.length,
        lineCount: disposalLineCount,
        totalQuantity: Math.round(disposalQuantity * 100) / 100,
        totalAmount: disposalAmount,
        byCause: [...causeMap.values()].sort((a, b) => b.amount - a.amount),
        byCategory: [...categoryMap.values()].sort((a, b) => b.amount - a.amount),
        byItem: [...itemMap.values()]
          .map((item) => ({ ...item, quantity: Math.round(item.quantity * 100) / 100 }))
          .sort((a, b) => b.amount - a.amount)
      },
      stockIn: {
        deliveryCount: stockDeliveries.length,
        lineCount: stockLineCount,
        totalAmount: stockAmount,
        discrepancyCount,
        discrepancyRate: pct(discrepancyCount, stockLineCount)
      },
      wasteRateByAmount: pct(disposalAmount, stockAmount),
      byBranch: [...byBranch.values()]
        .map((entry) => ({ ...entry, wasteRate: pct(entry.disposalAmount, entry.stockInAmount) }))
        .sort((a, b) => b.disposalAmount - a.disposalAmount),
      // 월별: 폐기율 추이 + 월별 입고/폐기가액 (오름차순 월). "unknown"은 마지막으로.
      byMonth: [...monthBucket.values()]
        .map((entry) => ({ ...entry, wasteRate: pct(entry.disposalAmount, entry.stockInAmount) }))
        .sort((a, b) => a.month.localeCompare(b.month))
    });
  } catch (error) {
    if (isMissingInventoryTableError(error)) return Response.json(EMPTY);
    throw error;
  }
}
