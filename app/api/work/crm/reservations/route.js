// CRM 예약 목록 API (보로 전용 모듈). 예약 목록 + 고객명/지점명 매핑 + 필터.
// 지점/상태/픽업일 범위로 필터링하며, 화면의 지점 필터를 위해 branches 목록도 함께 반환한다.
// 마이그레이션 미적용/테이블 부재 시 reservations는 빈 배열로 degrade(branches는 그대로).
import { requireCurrentUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { isModuleEnabled } from "../../../../../lib/brand";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

const MAX_RESERVATIONS = 200;

function isMissingTableError(error) {
  const message = String(error?.message ?? "");
  return error?.code === "P2021" || message.includes("Reservation") || message.includes("Customer");
}

function toIso(value) {
  return value?.toISOString?.() ?? value ?? null;
}

export async function GET(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (!isModuleEnabled("reservations")) return Response.json({ reservations: [], branches: [] });

  const branches = await prisma.branch.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });
  const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId")?.trim() || null;
  const status = searchParams.get("status")?.trim() || null;
  const from = searchParams.get("from")?.trim() || null;
  const to = searchParams.get("to")?.trim() || null;

  const where = {};
  if (branchId) where.branchId = branchId;
  if (status) where.status = status;
  if (from || to) {
    where.pickupAt = {};
    if (from) where.pickupAt.gte = new Date(from);
    if (to) where.pickupAt.lte = new Date(to);
  }

  try {
    const reservations = await prisma.reservation.findMany({
      where,
      orderBy: { pickupAt: "desc" },
      take: MAX_RESERVATIONS
    });

    const customerIds = [...new Set(reservations.map((reservation) => reservation.customerId))];
    const customers = customerIds.length
      ? await prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true, phone: true }
        })
      : [];
    const customerMap = new Map(customers.map((customer) => [customer.id, customer]));

    return Response.json({
      reservations: reservations.map((reservation) => {
        const customer = customerMap.get(reservation.customerId) ?? null;
        return {
          id: reservation.id,
          customerId: reservation.customerId,
          customerName: customer?.name ?? null,
          customerPhone: customer?.phone ?? null,
          branchId: reservation.branchId,
          branchName: branchNames.get(reservation.branchId) ?? null,
          product: reservation.product,
          amount: reservation.amount,
          status: reservation.status,
          source: reservation.source,
          receiveMethod: reservation.receiveMethod,
          note: reservation.note ?? null,
          channelId: reservation.channelId ?? null,
          postId: reservation.postId ?? null,
          reservedAt: toIso(reservation.reservedAt),
          pickupAt: toIso(reservation.pickupAt)
        };
      }),
      branches: branches.map((branch) => ({ id: branch.id, name: branch.name }))
    });
  } catch (error) {
    if (isMissingTableError(error)) return Response.json({ reservations: [], branches: branches.map((branch) => ({ id: branch.id, name: branch.name })) });
    throw error;
  }
}
