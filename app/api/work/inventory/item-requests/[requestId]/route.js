// 신규 품목 요청 승인/반려 API (관리자 전용). approve → 품목 마스터에 upsert(+요청 연결),
// reject → 반려 처리. 이미 처리된 요청은 재처리 불가.
import { requireCurrentUser } from "../../../../../../lib/auth";
import { badRequest } from "../../../../../../lib/serverState";
import { prisma } from "../../../../../../lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

function serializeRequest(req) {
  return {
    id: req.id,
    requestedName: req.requestedName,
    status: req.status,
    resolvedItemId: req.resolvedItemId ?? null,
    decidedById: req.decidedById ?? null,
    decidedAt: req.decidedAt?.toISOString?.() ?? req.decidedAt ?? null
  };
}

export async function PATCH(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });

  const { requestId } = await params;
  const existing = await prisma.newItemRequest.findUnique({ where: { id: requestId } });
  if (!existing) return Response.json({ error: "Request not found." }, { status: 404 });
  if (existing.status !== "pending") return badRequest("이미 처리된 요청입니다.");

  const { action, name, category = null, origin = null, isImported = false, defaultUnit = "송이" } = await request.json();

  if (action === "reject") {
    const updated = await prisma.newItemRequest.update({
      where: { id: requestId },
      data: { status: "rejected", decidedById: user.id, decidedAt: new Date() }
    });
    return Response.json({ request: serializeRequest(updated) });
  }

  if (action !== "approve") return badRequest("Invalid action (approve|reject).");

  const itemName = name?.trim() || existing.requestedName;
  let item = await prisma.flowerItem.findFirst({ where: { name: itemName } });
  if (!item) {
    item = await prisma.flowerItem.create({
      data: {
        id: `flower-item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: itemName,
        category: category?.trim() || null,
        origin: origin?.trim() || null,
        isImported: Boolean(isImported),
        defaultUnit: defaultUnit?.trim() || "송이",
        aliasesJson: "[]",
        isActive: true,
        createdById: user.id
      }
    });
  } else if (!item.isActive) {
    item = await prisma.flowerItem.update({ where: { id: item.id }, data: { isActive: true } });
  }

  const updated = await prisma.newItemRequest.update({
    where: { id: requestId },
    data: { status: "approved", resolvedItemId: item.id, decidedById: user.id, decidedAt: new Date() }
  });

  return Response.json({ request: serializeRequest(updated), item: { id: item.id, name: item.name } });
}
