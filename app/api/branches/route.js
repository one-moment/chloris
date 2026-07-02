// 지점 목록 API (admin 전용) — 매니저 지정 화면의 지점 드롭다운용. 활성 지점만 기본 반환.
import { requireCurrentUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { isModuleEnabled } from "../../../lib/brand";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function GET(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });
  if (!isModuleEnabled("branch-admin")) return Response.json({ error: "Not enabled." }, { status: 404 });

  const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "1";
  const branches = await prisma.branch.findMany({
    where: includeInactive ? {} : { status: "active" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, status: true }
  });
  return Response.json({ branches });
}
