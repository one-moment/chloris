// CRM 지점 인사이트 집계 API (보로 전용 모듈). 예약건수·매출·경로비중·재방문율, byBranch.
// NOTE: 플랫폼 제네릭 metricsRegistry(docs/platform-architecture.md)는 아직 미구현이라,
// 지점 인사이트를 모듈 로컬 집계로 구현한다. 레지스트리가 생기면 이 쿼리를 그쪽으로 이관.
// 마이그레이션 미적용/테이블 부재 시 0값으로 degrade(배포 안전).
import { requireCurrentUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { isModuleEnabled } from "../../../../../lib/brand";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

function isMissingTableError(error) {
  const message = String(error?.message ?? "");
  return error?.code === "P2021" || message.includes("Reservation") || message.includes("Customer");
}

const EMPTY = {
  total: { count: 0, revenue: 0, customers: 0, repeatCustomers: 0, repeatRate: 0 },
  byBranch: [],
  sourceMix: []
};

export async function GET() {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (!isModuleEnabled("crm")) return Response.json(EMPTY);

  try {
    const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
    const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));

    const [totals, byBranchRows, sourceRows, customerRows] = await Promise.all([
      prisma.reservation.aggregate({ _count: { _all: true }, _sum: { amount: true } }),
      prisma.reservation.groupBy({ by: ["branchId"], _count: { _all: true }, _sum: { amount: true } }),
      prisma.reservation.groupBy({ by: ["source"], _count: { _all: true } }),
      prisma.reservation.groupBy({ by: ["customerId"], _count: { _all: true } })
    ]);

    const customers = customerRows.length;
    const repeatCustomers = customerRows.filter((row) => row._count._all >= 2).length;

    return Response.json({
      total: {
        count: totals._count._all,
        revenue: totals._sum.amount ?? 0,
        customers,
        repeatCustomers,
        repeatRate: customers ? Math.round((repeatCustomers / customers) * 100) : 0
      },
      byBranch: byBranchRows
        .map((row) => ({
          branchId: row.branchId,
          branchName: branchNames.get(row.branchId) ?? row.branchId,
          count: row._count._all,
          revenue: row._sum.amount ?? 0
        }))
        .sort((a, b) => b.revenue - a.revenue),
      sourceMix: sourceRows
        .map((row) => ({ source: row.source, count: row._count._all }))
        .sort((a, b) => b.count - a.count)
    });
  } catch (error) {
    if (isMissingTableError(error)) return Response.json(EMPTY);
    throw error;
  }
}
