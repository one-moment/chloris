// 입고 lot 자동 추천 API (보로 전용 inventory 모듈). 폐기 시 출처 lot 매핑에 쓰인다.
// 같은 품목명 + 입고일 ∈ [폐기일 - N일, 폐기일] lot을 최신순으로 반환(기존 시트의 "4일 이내
// 로트 수기 판단"을 자동화). 관리자는 추천을 채택/변경할 수 있다(폼 측). 단가는 매핑 시점에
// 폐기행에 스냅샷된다(Phase 3 제출 API). 마이그레이션 적용 전에는 빈 배열로 degrade.
import { requireCurrentUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { isModuleEnabled } from "../../../../../lib/brand";
import { DEFAULT_LOT_WINDOW_DAYS } from "../../../../../lib/inventory";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

const MAX_LOTS = 10;

function inventoryEnabled() {
  return isModuleEnabled("disposal") || isModuleEnabled("stockin");
}

function isMissingTableError(error) {
  const message = String(error?.message ?? "");
  return error?.code === "P2021" || message.includes("StockInLine");
}

export async function GET(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (!inventoryEnabled()) return Response.json({ lots: [], windowDays: DEFAULT_LOT_WINDOW_DAYS });

  const params = new URL(request.url).searchParams;
  const item = (params.get("item") ?? "").trim();
  if (!item) return Response.json({ lots: [], windowDays: DEFAULT_LOT_WINDOW_DAYS });

  const dateParam = (params.get("date") ?? "").trim();
  const refDate = dateParam ? new Date(dateParam) : new Date();
  if (Number.isNaN(refDate.getTime())) {
    return Response.json({ error: "Invalid date." }, { status: 400 });
  }

  const windowDays = Number.parseInt(params.get("window") ?? "", 10) || DEFAULT_LOT_WINDOW_DAYS;
  const start = new Date(refDate);
  start.setDate(start.getDate() - windowDays);
  const endExclusive = new Date(refDate);
  endExclusive.setDate(endExclusive.getDate() + 1);

  try {
    const lots = await prisma.stockInLine.findMany({
      where: { itemName: item, stockInDate: { gte: start, lt: endExclusive } },
      orderBy: { stockInDate: "desc" },
      take: MAX_LOTS
    });

    return Response.json({
      windowDays,
      lots: lots.map((lot) => ({
        lotId: lot.lotId,
        itemName: lot.itemName,
        supplier: lot.supplier,
        unit: lot.unit,
        unitPrice: lot.unitPrice,
        quantity: lot.quantity,
        stockInDate: lot.stockInDate?.toISOString?.() ?? lot.stockInDate
      }))
    });
  } catch (error) {
    if (isMissingTableError(error)) return Response.json({ lots: [], windowDays });
    throw error;
  }
}
