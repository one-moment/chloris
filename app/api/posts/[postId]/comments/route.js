import { requireCurrentUser } from "../../../../../lib/auth";
import { badRequest, createCommentRecord, findPostContext, notFound, updateState } from "../../../../../lib/serverState";

export async function POST(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { postId } = await params;
  const { body } = await request.json();
  const trimmedBody = body?.trim();
  if (!trimmedBody) return badRequest("Comment body is required.");

  const created = await updateState((state) => {
    const context = findPostContext(state, postId);
    if (!context) return null;

    const comment = createCommentRecord({ body: trimmedBody, author: user.name, authorId: user.id });
    context.post.comments = [...(context.post.comments ?? []), comment];
    return comment;
  });

  if (!created) return notFound("Post not found.");
  return Response.json(created, { status: 201 });
}
