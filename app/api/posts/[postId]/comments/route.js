import { badRequest, createCommentRecord, findPostContext, notFound, updateState } from "../../../../../lib/serverState";

export async function POST(request, { params }) {
  const { postId } = await params;
  const { body, author } = await request.json();
  const trimmedBody = body?.trim();
  if (!trimmedBody) return badRequest("Comment body is required.");

  const created = await updateState((state) => {
    const context = findPostContext(state, postId);
    if (!context) return null;

    const comment = createCommentRecord({ body: trimmedBody, author });
    context.post.comments = [...(context.post.comments ?? []), comment];
    return comment;
  });

  if (!created) return notFound("Post not found.");
  return Response.json(created, { status: 201 });
}
