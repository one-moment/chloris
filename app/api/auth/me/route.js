import { prisma } from "../../../../lib/prisma";
import { getCurrentUser, serializeUser } from "../../../../lib/auth";

export async function GET() {
  const [currentUser, users] = await Promise.all([
    getCurrentUser(),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } })
  ]);

  return Response.json({
    currentUser: serializeUser(currentUser),
    users: users.map(serializeUser)
  });
}
