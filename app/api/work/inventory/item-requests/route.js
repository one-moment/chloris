// 신규 품목 등록 요청 API (보로 inventory 모듈). 폐기/입고 폼에서 미등록 품목명을 만나면
// 현장 직원이 등록을 요청하고(POST, 멤버 허용), 관리자가 승인/반려한다(GET 목록은 관리자 전용).
// 승인 처리는 [requestId]/route.js (PATCH). 마이그레이션 적용 전에는 GET은 빈 배열로 degrade.
import { requireCurrentUser } from "../../../../../lib/auth";
import { badRequest } from "../../../../../lib/serverState";
import { prisma } from "../../../../../lib/prisma";
import { isModuleEnabled } from "../../../../../lib/brand";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

function inventoryEnabled() {
  return isModuleEnabled("disposal") || isModuleEnabled("stockin");
}

function isMissingTableError(error) {
  const message = String(error?.message ?? "");
  return error?.code === "P2021" || message.includes("NewItemRequest") || message.includes("FlowerItem");
}

function serialize(req) {
  return {
    id: req.id,
    requestedName: req.requestedName,
    branchId: req.branchId ?? null,
    channelId: req.channelId ?? null,
    requestedById: req.requestedById ?? null,
    status: req.status,
    resolvedItemId: req.resolvedItemId ?? null,
    decidedById: req.decidedById ?? null,
    decidedAt: req.decidedAt?.toISOString?.() ?? req.decidedAt ?? null,
    createdAt: req.createdAt?.toISOString?.() ?? req.createdAt
  };
}

export async function GET(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });
  if (!inventoryEnabled()) return Response.json({ requests: [] });

  const status = (new URL(request.url).searchParams.get("status") ?? "pending").trim();
  try {
    const requests = await prisma.newItemRequest.findMany({
      where: status === "all" ? {} : { status },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return Response.json({ requests: requests.map(serialize) });
  } catch (error) {
    if (isMissingTableError(error)) return Response.json({ requests: [] });
    throw error;
  }
}

export async function POST(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (!inventoryEnabled()) return Response.json({ error: "Inventory module is not enabled." }, { status: 404 });

  const { requestedName, branchId = null, channelId = null } = await request.json();
  const trimmed = requestedName?.trim();
  if (!trimmed) return badRequest("Requested item name is required.");

  try {
    const existingItem = await prisma.flowerItem.findFirst({ where: { name: trimmed }, select: { id: true, isActive: true } });
    if (existingItem) {
      return Response.json({ alreadyExists: true, itemId: existingItem.id, isActive: existingItem.isActive });
    }

    const existingReq = await prisma.newItemRequest.findFirst({ where: { requestedName: trimmed, status: "pending" } });
    if (existingReq) return Response.json(serialize(existingReq));

    const created = await prisma.newItemRequest.create({
      data: {
        id: `item-request-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        requestedName: trimmed,
        branchId: branchId || null,
        channelId: channelId || null,
        requestedById: user.id,
        status: "pending"
      }
    });
    return Response.json(serialize(created), { status: 201 });
  } catch (error) {
    if (isMissingTableError(error)) {
      return Response.json({ error: "재고 테이블이 아직 준비되지 않았습니다." }, { status: 503 });
    }
    throw error;
  }
}
