// 품목 마스터 조회 API (보로 전용 inventory 모듈). 폐기/입고 폼의 품목명 자동완성 +
// 저장 시 검증(exactMatch)에 쓰인다. 폼은 이 API만 호출한다(모듈 직접 import 금지 — 경계 유지).
// 마이그레이션 적용 전이거나 모듈 비활성 브랜드에서는 빈 배열로 degrade한다.
import { requireCurrentUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { isModuleEnabled } from "../../../../../lib/brand";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

const MAX_ITEMS = 20;

function inventoryEnabled() {
  return isModuleEnabled("disposal") || isModuleEnabled("stockin");
}

function isMissingTableError(error) {
  const message = String(error?.message ?? "");
  return error?.code === "P2021" || message.includes("FlowerItem");
}

export async function GET(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (!inventoryEnabled()) return Response.json({ items: [], exactMatch: false });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (!q) return Response.json({ items: [], exactMatch: false });

  try {
    const items = await prisma.flowerItem.findMany({
      where: { isActive: true, name: { contains: q } },
      orderBy: { name: "asc" },
      take: MAX_ITEMS
    });

    return Response.json({
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category ?? null,
        origin: item.origin ?? null,
        defaultUnit: item.defaultUnit
      })),
      exactMatch: items.some((item) => item.name === q)
    });
  } catch (error) {
    if (isMissingTableError(error)) return Response.json({ items: [], exactMatch: false });
    throw error;
  }
}
