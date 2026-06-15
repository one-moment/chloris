// CRM 고객조회 API (보로 전용 모듈). 이름/전화로 기존 고객 + 최근 예약을 반환한다.
// 작성기/예약 폼은 이 API만 호출한다(모듈 직접 import 금지 — 경계 유지).
// CRM 마이그레이션이 운영에 적용되기 전이거나 보로 외 브랜드에서는 빈 배열로 degrade한다.
import { requireCurrentUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { isModuleEnabled } from "../../../../../lib/brand";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

const RECENT_LIMIT = 5;
const MAX_CUSTOMERS = 10;

function isMissingTableError(error) {
  const message = String(error?.message ?? "");
  return error?.code === "P2021" || message.includes("Customer") || message.includes("Reservation");
}

function serializeReservation(reservation) {
  return {
    id: reservation.id,
    branchId: reservation.branchId,
    product: reservation.product,
    amount: reservation.amount,
    status: reservation.status,
    source: reservation.source,
    receiveMethod: reservation.receiveMethod,
    reservedAt: reservation.reservedAt?.toISOString?.() ?? reservation.reservedAt,
    pickupAt: reservation.pickupAt?.toISOString?.() ?? reservation.pickupAt
  };
}

export async function GET(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (!isModuleEnabled("crm")) return Response.json({ customers: [] });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (!q) return Response.json({ customers: [] });

  try {
    const customers = await prisma.customer.findMany({
      where: { OR: [{ name: { contains: q } }, { phone: { contains: q } }] },
      orderBy: { name: "asc" },
      take: MAX_CUSTOMERS
    });

    const ids = customers.map((customer) => customer.id);
    const reservations = ids.length
      ? await prisma.reservation.findMany({
          where: { customerId: { in: ids } },
          orderBy: { reservedAt: "desc" }
        })
      : [];

    const byCustomer = new Map();
    for (const reservation of reservations) {
      const list = byCustomer.get(reservation.customerId) ?? [];
      list.push(reservation);
      byCustomer.set(reservation.customerId, list);
    }

    return Response.json({
      customers: customers.map((customer) => {
        const list = byCustomer.get(customer.id) ?? [];
        return {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          homeBranchId: customer.homeBranchId ?? null,
          memo: customer.memo ?? null,
          reservationCount: list.length,
          totalAmount: list.reduce((sum, reservation) => sum + (reservation.amount ?? 0), 0),
          recentReservations: list.slice(0, RECENT_LIMIT).map(serializeReservation)
        };
      })
    });
  } catch (error) {
    if (isMissingTableError(error)) return Response.json({ customers: [] });
    throw error;
  }
}
