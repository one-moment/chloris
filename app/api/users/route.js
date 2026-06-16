import { requireCurrentUser } from "../../../lib/auth";
import { serializeUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

// Prisma 의 `mode: "insensitive"` 는 PostgreSQL 전용이다. SQLite(로컬 dev)에서는
// PrismaClientValidationError 를 던지므로, 운영(postgres)에서는 대소문자 무시 검색을
// 유지하고 dev(sqlite)에서는 mode 를 생략한다. (sqlite 의 LIKE 는 ASCII 대소문자 무시)
const SUPPORTS_INSENSITIVE = /^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL ?? "");

function textContains(value) {
  return SUPPORTS_INSENSITIVE
    ? { contains: value, mode: "insensitive" }
    : { contains: value };
}

export async function GET(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const query = request.nextUrl.searchParams.get("query")?.trim();
  const where = query ? {
    OR: [
      { name: textContains(query) },
      { email: textContains(query) },
      { handle: textContains(query) }
    ]
  } : {};

  const users = await prisma.user.findMany({
    where,
    orderBy: { name: "asc" },
    take: 12
  });

  return Response.json({ users: users.map(serializeUser) });
}
