import { requireCurrentUser } from "../../../lib/auth";
import { serializeUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function GET(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const query = request.nextUrl.searchParams.get("query")?.trim();
  const where = query ? {
    OR: [
      { name: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { handle: { contains: query, mode: "insensitive" } }
    ]
  } : {};

  const users = await prisma.user.findMany({
    where,
    orderBy: { name: "asc" },
    take: 12
  });

  return Response.json({ users: users.map(serializeUser) });
}
