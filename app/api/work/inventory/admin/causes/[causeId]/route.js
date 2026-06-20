// 폐기원인 마스터 수정 API (관리자 전용). 이름/정렬/활성여부 편집. 이름 변경 시 중복 검사.
import { requireCurrentUser } from "../../../../../../../lib/auth";
import { badRequest } from "../../../../../../../lib/serverState";
import { prisma } from "../../../../../../../lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

function serialize(cause) {
  return {
    id: cause.id,
    name: cause.name,
    isActive: cause.isActive,
    sortOrder: cause.sortOrder
  };
}

export async function PATCH(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });

  const { causeId } = await params;
  const existing = await prisma.disposalCause.findUnique({ where: { id: causeId } });
  if (!existing) return Response.json({ error: "Cause not found." }, { status: 404 });

  const body = await request.json();
  const data = {};

  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) return badRequest("Cause name is required.");
    if (trimmed !== existing.name) {
      const dup = await prisma.disposalCause.findFirst({ where: { name: trimmed, id: { not: causeId } }, select: { id: true } });
      if (dup) return Response.json({ error: "이미 등록된 폐기원인입니다." }, { status: 409 });
      data.name = trimmed;
    }
  }
  if ("isActive" in body) data.isActive = Boolean(body.isActive);
  if ("sortOrder" in body) data.sortOrder = Number.parseInt(body.sortOrder, 10) || 0;

  const updated = await prisma.disposalCause.update({ where: { id: causeId }, data });
  return Response.json(serialize(updated));
}
