// CRM 고객조회 API (보로 전용 모듈). 이름/전화로 기존 고객 + 최근 예약을 반환한다.
// 작성기/예약 폼은 이 API만 호출한다(모듈 직접 import 금지 — 경계 유지).
// CRM 마이그레이션이 운영에 적용되기 전이거나 보로 외 브랜드에서는 빈 배열로 degrade한다.
import { requireCurrentUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { isModuleEnabled } from "../../../../../lib/brand";
import { badRequest } from "../../../../../lib/serverState";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

const RECENT_LIMIT = 5;
const MAX_CUSTOMERS = 10;

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function serializeCustomer(customer) {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    homeBranchId: customer.homeBranchId ?? null,
    memo: customer.memo ?? null
  };
}

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

// 고객 수동 생성. 전화번호 unique → 중복 시 409. 고객 데이터는 DB에만 저장(로그/커밋 금지).
export async function POST(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (!isModuleEnabled("crm")) {
    return Response.json({ error: "CRM 모듈이 활성화되어 있지 않습니다." }, { status: 404 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return badRequest("요청 본문을 읽을 수 없습니다.");
  }

  const name = payload?.name?.trim();
  const phone = payload?.phone?.trim();
  const homeBranchId = payload?.homeBranchId?.trim() || null;
  const memo = payload?.memo?.trim() || null;

  if (!name) return badRequest("성함을 입력하세요.");
  if (!phone) return badRequest("연락처를 입력하세요.");

  if (homeBranchId) {
    const branch = await prisma.branch.findUnique({ where: { id: homeBranchId }, select: { id: true } });
    if (!branch) return badRequest("존재하지 않는 지점입니다.");
  }

  try {
    const customer = await prisma.customer.create({
      data: { id: generateId("cust"), name, phone, homeBranchId, memo, createdById: user.id }
    });
    return Response.json({ customer: serializeCustomer(customer) }, { status: 201 });
  } catch (error) {
    if (error?.code === "P2002") {
      return Response.json({ error: "이미 등록된 전화번호입니다." }, { status: 409 });
    }
    if (isMissingTableError(error)) {
      return Response.json({ error: "CRM 저장소가 아직 준비되지 않았습니다(마이그레이션 미적용)." }, { status: 503 });
    }
    throw error;
  }
}
