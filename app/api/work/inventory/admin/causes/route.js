// 폐기원인 마스터 관리 API (관리자 전용, 보로 inventory 모듈). 목록/등록.
// 수정·비활성화는 [causeId]/route.js (PATCH). 마이그레이션 적용 전에는 빈 배열로 degrade.
import { requireCurrentUser } from "../../../../../../lib/auth";
import { badRequest } from "../../../../../../lib/serverState";
import { prisma } from "../../../../../../lib/prisma";
import { isModuleEnabled } from "../../../../../../lib/brand";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

function isMissingTableError(error) {
  return error?.code === "P2021" || String(error?.message ?? "").includes("DisposalCause");
}

function serialize(cause) {
  return {
    id: cause.id,
    name: cause.name,
    isActive: cause.isActive,
    sortOrder: cause.sortOrder
  };
}

export async function GET(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });
  if (!isModuleEnabled("disposal")) return Response.json({ causes: [] });

  const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "1";
  try {
    const causes = await prisma.disposalCause.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
    return Response.json({ causes: causes.map(serialize) });
  } catch (error) {
    if (isMissingTableError(error)) return Response.json({ causes: [] });
    throw error;
  }
}

export async function POST(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });

  const { name, sortOrder = 0 } = await request.json();
  const trimmedName = name?.trim();
  if (!trimmedName) return badRequest("Cause name is required.");

  const existing = await prisma.disposalCause.findFirst({ where: { name: trimmedName }, select: { id: true } });
  if (existing) return Response.json({ error: "이미 등록된 폐기원인입니다." }, { status: 409 });

  const created = await prisma.disposalCause.create({
    data: {
      id: `disposal-cause-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: trimmedName,
      sortOrder: Number.parseInt(sortOrder, 10) || 0,
      isActive: true
    }
  });
  return Response.json(serialize(created), { status: 201 });
}
