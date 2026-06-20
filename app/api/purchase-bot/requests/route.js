import { requireCurrentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function GET(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const status = request.nextUrl.searchParams.get("status");
  const where = status ? { status } : {};
  const requests = await prisma.purchaseRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { item: true, workerTask: true }
  });

  return Response.json({ requests });
}
