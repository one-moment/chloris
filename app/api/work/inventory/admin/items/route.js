// 품목 마스터 관리 API (관리자 전용, 보로 inventory 모듈). 목록/등록.
// 수정·비활성화는 [itemId]/route.js (PATCH). 마이그레이션 적용 전에는 빈 배열로 degrade.
import { requireCurrentUser } from "../../../../../../lib/auth";
import { badRequest } from "../../../../../../lib/serverState";
import { prisma } from "../../../../../../lib/prisma";
import { isModuleEnabled } from "../../../../../../lib/brand";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

function inventoryEnabled() {
  return isModuleEnabled("disposal") || isModuleEnabled("stockin");
}

function isMissingTableError(error) {
  return error?.code === "P2021" || String(error?.message ?? "").includes("FlowerItem");
}

function serialize(item) {
  return {
    id: item.id,
    name: item.name,
    category: item.category ?? null,
    origin: item.origin ?? null,
    isImported: item.isImported,
    defaultUnit: item.defaultUnit,
    aliasesJson: item.aliasesJson,
    isActive: item.isActive
  };
}

export async function GET(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });
  if (!inventoryEnabled()) return Response.json({ items: [] });

  const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "1";
  try {
    const items = await prisma.flowerItem.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: "asc" }
    });
    return Response.json({ items: items.map(serialize) });
  } catch (error) {
    if (isMissingTableError(error)) return Response.json({ items: [] });
    throw error;
  }
}

export async function POST(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });

  const { name, category = null, origin = null, isImported = false, defaultUnit = "송이", aliasesJson = "[]" } = await request.json();
  const trimmedName = name?.trim();
  if (!trimmedName) return badRequest("Item name is required.");

  const existing = await prisma.flowerItem.findFirst({ where: { name: trimmedName }, select: { id: true } });
  if (existing) return Response.json({ error: "이미 등록된 품목명입니다." }, { status: 409 });

  const created = await prisma.flowerItem.create({
    data: {
      id: `flower-item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: trimmedName,
      category: category?.trim() || null,
      origin: origin?.trim() || null,
      isImported: Boolean(isImported),
      defaultUnit: defaultUnit?.trim() || "송이",
      aliasesJson: typeof aliasesJson === "string" ? aliasesJson : JSON.stringify(aliasesJson ?? []),
      isActive: true,
      createdById: user.id
    }
  });
  return Response.json(serialize(created), { status: 201 });
}
