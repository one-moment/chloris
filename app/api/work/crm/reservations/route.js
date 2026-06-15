// CRM 예약 목록 API (보로 전용 모듈). 예약 목록 + 고객명/지점명 매핑 + 필터.
// 지점/상태/픽업일 범위로 필터링하며, 화면의 지점 필터를 위해 branches 목록도 함께 반환한다.
// 마이그레이션 미적용/테이블 부재 시 reservations는 빈 배열로 degrade(branches는 그대로).
import { requireCurrentUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { isModuleEnabled } from "../../../../../lib/brand";
import { badRequest } from "../../../../../lib/serverState";

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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

// 예약 생성: 전화번호로 Customer upsert + Reservation 생성. 결제/외부주문 없음(레코드 생성만).
// 고객 데이터는 DB에만 저장하며 로그/커밋에 남기지 않는다(AGENTS.md).
export async function POST(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (!isModuleEnabled("reservations")) {
    return Response.json({ error: "예약 모듈이 활성화되어 있지 않습니다." }, { status: 404 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return badRequest("요청 본문을 읽을 수 없습니다.");
  }

  const name = payload?.name?.trim();
  const phone = payload?.phone?.trim();
  const branchId = payload?.branchId?.trim();
  const product = payload?.product?.trim();
  const source = payload?.source?.trim();
  const receiveMethod = payload?.receiveMethod?.trim();
  const note = payload?.note?.trim() || null;
  const channelId = payload?.channelId?.trim() || null;
  const postId = payload?.postId?.trim() || null;
  const amount = Number(payload?.amount);

  if (!name) return badRequest("성함을 입력하세요.");
  if (!phone) return badRequest("연락처를 입력하세요.");
  if (!branchId) return badRequest("지점을 선택하세요.");
  if (!product) return badRequest("상품을 입력하세요.");
  if (!source) return badRequest("예약 경로를 선택하세요.");
  if (!receiveMethod) return badRequest("수령 방법을 선택하세요.");
  if (!Number.isFinite(amount) || amount < 0) return badRequest("금액을 올바르게 입력하세요.");

  const pickupAt = payload?.pickupAt ? new Date(payload.pickupAt) : null;
  if (!pickupAt || Number.isNaN(pickupAt.getTime())) return badRequest("픽업 일시를 올바르게 입력하세요.");
  let reservedAt;
  if (payload?.reservedAt) {
    const parsed = new Date(payload.reservedAt);
    if (Number.isNaN(parsed.getTime())) return badRequest("예약 날짜를 올바르게 입력하세요.");
    reservedAt = parsed;
  }

  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } });
  if (!branch) return badRequest("존재하지 않는 지점입니다.");

  try {
    const customer = await prisma.customer.upsert({
      where: { phone },
      update: {},
      create: {
        id: generateId("cust"),
        name,
        phone,
        homeBranchId: branchId,
        createdById: user.id
      }
    });

    const reservation = await prisma.reservation.create({
      data: {
        id: generateId("resv"),
        customerId: customer.id,
        branchId,
        channelId,
        postId,
        ...(reservedAt ? { reservedAt } : {}),
        pickupAt,
        product,
        amount: Math.trunc(amount),
        source,
        receiveMethod,
        status: "예약접수",
        note,
        createdById: user.id
      }
    });

    return Response.json(
      {
        reservation: {
          id: reservation.id,
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          branchId,
          branchName: null,
          product,
          amount: reservation.amount,
          status: reservation.status,
          source,
          receiveMethod,
          reservedAt: toIso(reservation.reservedAt),
          pickupAt: toIso(reservation.pickupAt)
        }
      },
      { status: 201 }
    );
  } catch (error) {
    if (isMissingTableError(error)) {
      return Response.json(
        { error: "CRM 저장소가 아직 준비되지 않았습니다(마이그레이션 미적용)." },
        { status: 503 }
      );
    }
    throw error;
  }
}
