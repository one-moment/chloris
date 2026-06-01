import { requireCurrentUser } from "../../../../lib/auth";
import { badRequest, notFound, serializePost } from "../../../../lib/serverState";
import { prisma } from "../../../../lib/prisma";

const ALLOWED_STATUSES = new Set(["검토중", "진행중", "완료"]);

export async function PATCH(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { postId } = await params;
  const { status } = await request.json();
  if (!ALLOWED_STATUSES.has(status)) return badRequest("Invalid post status.");

  const existing = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!existing) return notFound("Post not found.");

  const updated = await prisma.post.update({
    where: { id: postId },
    data: { status },
    include: { comments: { orderBy: { createdAt: "asc" } } }
  });

  return Response.json(serializePost(updated));
}
