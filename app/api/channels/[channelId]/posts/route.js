import { badRequest, createPostRecord, findChannelContext, notFound, updateState } from "../../../../../lib/serverState";

export async function POST(request, { params }) {
  const { channelId } = await params;
  const { title, body, author, status } = await request.json();
  const trimmedTitle = title?.trim();
  const trimmedBody = body?.trim();
  if (!trimmedTitle || !trimmedBody) return badRequest("Post title and body are required.");

  const created = await updateState((state) => {
    const context = findChannelContext(state, channelId);
    if (!context) return null;

    const post = createPostRecord({ title: trimmedTitle, body: trimmedBody, author, status });
    context.channel.posts.unshift(post);
    return post;
  });

  if (!created) return notFound("Channel not found.");
  return Response.json(created, { status: 201 });
}
