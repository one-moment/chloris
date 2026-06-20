// CRM 고객 수정 API (보로 전용 모듈). 이름/연락처/홈지점/메모 부분 수정.
// 고객 데이터는 DB에만 저장(로그/커밋 금지). 전화번호 unique → 중복 시 409.
import { requireCurrentUser } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";
import { isModuleEnabled } from "../../../../../../lib/brand";
import { badRequest } from "../../../../../../lib/serverState";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

function isMissingTableError(error) {
  const message = String(error?.message ?? "");
  return error?.code === "P2021" || message.includes("Customer");
}

export async function PATCH(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (!isModuleEnabled("crm")) {
    return Response.json({ error: "CRM 모듈이 활성화되어 있지 않습니다." }, { status: 404 });
  }

  const { customerId } = await params;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return badRequest("요청 본문을 읽을 수 없습니다.");
  }

  const data = {};
  if (payload?.name !== undefined) {
    const name = payload.name?.trim();
    if (!name) return badRequest("성함은 비울 수 없습니다.");
    data.name = name;
  }
  if (payload?.phone !== undefined) {
    const phone = payload.phone?.trim();
    if (!phone) return badRequest("연락처는 비울 수 없습니다.");
    data.phone = phone;
  }
  if (payload?.homeBranchId !== undefined) {
    const homeBranchId = payload.homeBranchId?.trim() || null;
    if (homeBranchId) {
      const branch = await prisma.branch.findUnique({ where: { id: homeBranchId }, select: { id: true } });
      if (!branch) return badRequest("존재하지 않는 지점입니다.");
    }
    data.homeBranchId = homeBranchId;
  }
  if (payload?.memo !== undefined) {
    data.memo = payload.memo?.trim() || null;
  }

  if (Object.keys(data).length === 0) return badRequest("변경할 내용이 없습니다.");

  try {
    const customer = await prisma.customer.update({ where: { id: customerId }, data });
    return Response.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        homeBranchId: customer.homeBranchId ?? null,
        memo: customer.memo ?? null
      }
    });
  } catch (error) {
    if (error?.code === "P2025") {
      return Response.json({ error: "고객을 찾을 수 없습니다." }, { status: 404 });
    }
    if (error?.code === "P2002") {
      return Response.json({ error: "이미 등록된 전화번호입니다." }, { status: 409 });
    }
    if (isMissingTableError(error)) {
      return Response.json({ error: "CRM 저장소가 아직 준비되지 않았습니다(마이그레이션 미적용)." }, { status: 503 });
    }
    throw error;
  }
}
