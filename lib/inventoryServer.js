// 입고·폐기 서버 헬퍼 (prisma 사용). API 라우트가 공유한다(모듈 경계 유지 — 코어 lib).
// 순수 검증 로직은 lib/inventory.js, 여기는 DB 조회·직렬화·lot 단가 스냅샷.
import { prisma } from "./prisma";
import { validateDisposalLines } from "./inventory";

export function isMissingInventoryTableError(error) {
  const message = String(error?.message ?? "");
  return error?.code === "P2021"
    || message.includes("DisposalBatch")
    || message.includes("DisposalLine")
    || message.includes("FlowerItem")
    || message.includes("DisposalCause")
    || message.includes("StockInLine");
}

export function serializeDisposalBatch(batch) {
  const lines = (batch.lines ?? []).map((line) => ({
    id: line.id,
    lineIndex: line.lineIndex,
    itemId: line.itemId ?? null,
    itemName: line.itemName,
    quantity: line.quantity,
    unit: line.unit,
    category: line.category,
    cause: line.cause,
    sourceLotId: line.sourceLotId ?? null,
    unitPrice: line.unitPrice ?? null,
    amount: line.amount ?? null,
    note: line.note ?? null
  }));
  return {
    id: batch.id,
    branchId: batch.branchId,
    channelId: batch.channelId ?? null,
    disposalDate: batch.disposalDate?.toISOString?.() ?? batch.disposalDate,
    status: batch.status,
    lineCount: lines.length,
    totalAmount: lines.reduce((sum, line) => sum + (line.amount ?? 0), 0),
    submittedAt: batch.submittedAt?.toISOString?.() ?? batch.submittedAt ?? null,
    syncedAt: batch.syncedAt?.toISOString?.() ?? batch.syncedAt ?? null,
    createdAt: batch.createdAt?.toISOString?.() ?? batch.createdAt,
    lines
  };
}

// 출처 lot 단가를 일괄 조회해 매핑 시점 스냅샷에 쓴다.
export async function resolveLotPrices(lines) {
  const lotIds = [...new Set((lines ?? []).map((line) => line.sourceLotId).filter(Boolean))];
  if (!lotIds.length) return new Map();
  const lots = await prisma.stockInLine.findMany({
    where: { lotId: { in: lotIds } },
    select: { lotId: true, unitPrice: true }
  });
  return new Map(lots.map((lot) => [lot.lotId, lot.unitPrice]));
}

// DisposalLine create payload. batchId 는 호출 측에서 nested create(부모 암시) 또는 명시적으로 붙인다.
export function buildDisposalLineData(lines, priceByLot, batchId) {
  return (lines ?? []).map((line, index) => {
    const qty = Number(line.quantity) || 0;
    const unitPrice = line.sourceLotId ? (priceByLot.get(line.sourceLotId) ?? null) : null;
    const amount = unitPrice != null ? Math.round(unitPrice * qty) : null;
    return {
      id: `${batchId}-line-${index + 1}`,
      lineIndex: index + 1,
      itemId: line.itemId || null,
      itemName: String(line.itemName ?? "").trim(),
      quantity: qty,
      unit: line.unit?.trim?.() || "송이",
      category: line.category ?? "",
      cause: String(line.cause ?? "").trim(),
      sourceLotId: line.sourceLotId || null,
      unitPrice,
      amount,
      note: line.note?.trim?.() || null,
      rawText: typeof line.rawText === "string" ? line.rawText : ""
    };
  });
}

// 최종제출 검증: 활성 품목·폐기원인 마스터와 대조.
export async function validateDisposalForSubmit(lines) {
  const [items, causes] = await Promise.all([
    prisma.flowerItem.findMany({ where: { isActive: true }, select: { name: true } }),
    prisma.disposalCause.findMany({ where: { isActive: true }, select: { name: true } })
  ]);
  return validateDisposalLines(lines, {
    itemNames: new Set(items.map((item) => item.name)),
    causeNames: new Set(causes.map((cause) => cause.name))
  });
}
