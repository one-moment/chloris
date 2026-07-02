// 품목 마스터 수정·삭제 API (관리자 전용). 이름/분류/원산지/단위/활성여부 편집. 이름 변경 시 중복 검사.
// 삭제는 입고/폐기 이력 0건 + 다른 참조(신규 품목 요청) 없음일 때만 hard delete — 아니면 409로 안내.
import { requireCurrentUser } from "../../../../../../../lib/auth";
import { badRequest } from "../../../../../../../lib/serverState";
import { prisma } from "../../../../../../../lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

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

export async function PATCH(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });

  const { itemId } = await params;
  const existing = await prisma.flowerItem.findUnique({ where: { id: itemId } });
  if (!existing) return Response.json({ error: "Item not found." }, { status: 404 });

  const body = await request.json();
  const data = {};

  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) return badRequest("Item name is required.");
    if (trimmed !== existing.name) {
      const dup = await prisma.flowerItem.findFirst({ where: { name: trimmed, id: { not: itemId } }, select: { id: true } });
      if (dup) return Response.json({ error: "이미 등록된 품목명입니다." }, { status: 409 });
      data.name = trimmed;
    }
  }
  if ("category" in body) data.category = body.category?.trim() || null;
  if ("origin" in body) data.origin = body.origin?.trim() || null;
  if ("isImported" in body) data.isImported = Boolean(body.isImported);
  if (typeof body.defaultUnit === "string" && body.defaultUnit.trim()) data.defaultUnit = body.defaultUnit.trim();
  if ("isActive" in body) data.isActive = Boolean(body.isActive);
  if ("aliasesJson" in body) {
    data.aliasesJson = typeof body.aliasesJson === "string" ? body.aliasesJson : JSON.stringify(body.aliasesJson ?? []);
  }

  const updated = await prisma.flowerItem.update({ where: { id: itemId }, data });
  return Response.json(serialize(updated));
}

export async function DELETE(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });

  const { itemId } = await params;
  const existing = await prisma.flowerItem.findUnique({ where: { id: itemId } });
  if (!existing) return Response.json({ error: "Item not found." }, { status: 404 });

  // 입고/폐기 이력 검사: 과거 데이터는 itemId 없이 itemName만 채워진 경우가 있어 둘 다 본다.
  const [stockInCount, disposalCount, requestRefCount] = await Promise.all([
    prisma.stockInLine.count({ where: { OR: [{ itemId }, { itemName: existing.name }] } }),
    prisma.disposalLine.count({ where: { OR: [{ itemId }, { itemName: existing.name }] } }),
    prisma.newItemRequest.count({ where: { resolvedItemId: itemId } })
  ]);

  if (stockInCount > 0 || disposalCount > 0) {
    return Response.json(
      { error: "입고/폐기 이력이 있어 삭제할 수 없습니다. 비활성 처리만 가능합니다.", stockInCount, disposalCount },
      { status: 409 }
    );
  }
  if (requestRefCount > 0) {
    return Response.json(
      { error: "이 품목을 참조하는 신규 품목 등록 요청 기록이 있어 삭제할 수 없습니다. 비활성 처리만 가능합니다." },
      { status: 409 }
    );
  }

  await prisma.flowerItem.delete({ where: { id: itemId } });
  return Response.json({ ok: true, deletedId: itemId });
}
