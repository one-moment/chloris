import { badRequest, findPostContext, notFound, updateState } from "../../../../lib/serverState";

const ALLOWED_STATUSES = new Set(["검토중", "진행중", "완료"]);

export async function PATCH(request, { params }) {
  const { postId } = await params;
  const { status } = await request.json();
  if (!ALLOWED_STATUSES.has(status)) return badRequest("Invalid post status.");

  const updated = await updateState((state) => {
    const context = findPostContext(state, postId);
    if (!context) return null;

    context.post.status = status;
    return context.post;
  });

  if (!updated) return notFound("Post not found.");
  return Response.json(updated);
}
