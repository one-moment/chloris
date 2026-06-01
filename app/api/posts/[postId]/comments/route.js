import { requireCurrentUser } from "../../../../../lib/auth";
import { badRequest, createCommentRecord, notFound } from "../../../../../lib/serverState";
import { prisma } from "../../../../../lib/prisma";

export async function POST(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { postId } = await params;
  const { body } = await request.json();
  const trimmedBody = body?.trim();
  if (!trimmedBody) return badRequest("Comment body is required.");

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) return notFound("Post not found.");

  const comment = createCommentRecord({ body: trimmedBody, author: user.name, authorId: user.id });
  await prisma.comment.create({
    data: {
      id: comment.id,
      postId,
      authorId: user.id,
      author: comment.author,
      body: comment.body
    }
  });

  return Response.json(comment, { status: 201 });
}
