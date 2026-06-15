// 입고 기록 생성/목록 API (보로 inventory 모듈). 각 라인이 lot이 되어 lotId 자동 발번된다
// (YYYYMMDD_품목_거래처_NNNN, 기존 시트 계승). 발주/영수증/실입고 3중 대조 상태를 계산한다.
// 입고가액 = round(단가 × 실입고). status: "draft" | "submitted". 시트 연동은 Phase 5(승인 후).
import { requireCurrentUser } from "../../../../../lib/auth";
import { badRequest } from "../../../../../lib/serverState";
import { prisma } from "../../../../../lib/prisma";
import { isModuleEnabled } from "../../../../../lib/brand";
import {
  serializeStockInDelivery,
  lotDatePrefix,
  buildLotId,
  stockInLineStatus,
  isMissingInventoryTableError
} from "../../../../../lib/inventoryServer";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function GET(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (!isModuleEnabled("stockin")) return Response.json({ deliveries: [], branches: [] });

  const params = new URL(request.url).searchParams;
  const where = {};
  if (params.get("branchId")) where.branchId = params.get("branchId");
  if (params.get("status")) where.status = params.get("status");

  const branches = await prisma.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  try {
    const deliveries = await prisma.stockInDelivery.findMany({
      where,
      orderBy: { statementDate: "desc" },
      take: 50,
      include: { lines: { orderBy: { lineIndex: "asc" } } }
    });
    return Response.json({ deliveries: deliveries.map(serializeStockInDelivery), branches });
  } catch (error) {
    if (isMissingInventoryTableError(error)) return Response.json({ deliveries: [], branches });
    throw error;
  }
}

export async function POST(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (!isModuleEnabled("stockin")) return Response.json({ error: "Stock-in module is not enabled." }, { status: 404 });

  const body = await request.json();
  const branchId = (body.branchId ?? "").toString().trim();
  const supplier = (body.supplier ?? "").toString().trim();
  if (!branchId) return badRequest("지점(branchId)이 필요합니다.");
  if (!supplier) return badRequest("거래처(supplier)가 필요합니다.");
  if (!body.statementDate) return badRequest("입고일(statementDate)이 필요합니다.");

  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  const lines = rawLines.filter((line) => String(line.itemName ?? "").trim() !== "");
  if (lines.length === 0) return badRequest("입고 품목이 한 개 이상 필요합니다.");
  const status = body.status === "submitted" ? "submitted" : "draft";

  try {
    const statementDate = new Date(body.statementDate);
    const prefix = lotDatePrefix(statementDate);
    const base = await prisma.stockInLine.count({ where: { lotId: { startsWith: `${prefix}_` } } });
    const deliveryId = `stockin-delivery-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const lineData = lines.map((line, index) => {
      const quantity = Number(line.quantity) || 0;
      const unitPrice = Number(line.unitPrice) || 0;
      const orderedQty = line.orderedQty === "" || line.orderedQty == null ? null : Number(line.orderedQty);
      const receiptQty = line.receiptQty === "" || line.receiptQty == null ? null : Number(line.receiptQty);
      const note = line.note?.trim?.() || null;
      return {
        id: `${deliveryId}-line-${index + 1}`,
        lineIndex: index + 1,
        lotId: buildLotId(prefix, line.itemName, supplier, base + index + 1),
        itemId: line.itemId || null,
        itemName: String(line.itemName).trim(),
        supplier,
        stockInDate: statementDate,
        unit: line.unit?.trim?.() || "송이",
        unitPrice,
        quantity,
        amount: Math.round(unitPrice * quantity),
        orderedQty,
        receiptQty,
        note,
        status: stockInLineStatus({ orderedQty, receiptQty, quantity, note }),
        rawText: typeof line.rawText === "string" ? line.rawText : ""
      };
    });

    const totalAmount = lineData.reduce((sum, line) => sum + line.amount, 0);

    const created = await prisma.stockInDelivery.create({
      data: {
        id: deliveryId,
        branchId,
        channelId: body.channelId || null,
        messageId: body.messageId || null,
        supplier,
        statementDate,
        totalAmount,
        status,
        sourceText: typeof body.sourceText === "string" ? body.sourceText : "",
        attachmentsJson: JSON.stringify(Array.isArray(body.attachments) ? body.attachments : []),
        createdById: user.id,
        lines: { create: lineData }
      },
      include: { lines: { orderBy: { lineIndex: "asc" } } }
    });

    return Response.json(serializeStockInDelivery(created), { status: 201 });
  } catch (error) {
    if (isMissingInventoryTableError(error)) {
      return Response.json({ error: "재고 테이블이 아직 준비되지 않았습니다." }, { status: 503 });
    }
    throw error;
  }
}
