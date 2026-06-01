import { requireCurrentUser } from "../../../../../lib/auth";
import { badRequest, createPostRecord, findChannelContext, notFound, updateState } from "../../../../../lib/serverState";

export async function POST(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { channelId } = await params;
  const { title, body, status, attachments = [] } = await request.json();
  const trimmedBody = body?.trim() ?? "";
  const trimmedTitle = title?.trim() || trimmedBody.slice(0, 40) || attachments[0]?.name;
  if (!trimmedTitle && !trimmedBody && attachments.length === 0) return badRequest("Post title, body, or attachment is required.");

  const created = await updateState((state) => {
    const context = findChannelContext(state, channelId);
    if (!context) return null;

    const post = createPostRecord({ title: trimmedTitle, body: trimmedBody, author: user.name, authorId: user.id, status, attachments });
    context.channel.posts.unshift(post);
    return post;
  });

  if (!created) return notFound("Channel not found.");
  return Response.json(created, { status: 201 });
}
