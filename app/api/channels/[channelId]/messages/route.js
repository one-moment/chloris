import { badRequest, createMessageRecord, findChannelContext, notFound, updateState } from "../../../../../lib/serverState";

export async function POST(request, { params }) {
  const { channelId } = await params;
  const { body, author, bot } = await request.json();
  const trimmedBody = body?.trim();
  if (!trimmedBody) return badRequest("Message body is required.");

  const created = await updateState((state) => {
    const context = findChannelContext(state, channelId);
    if (!context) return null;

    const message = createMessageRecord({ body: trimmedBody, author, bot });
    context.channel.messages.unshift(message);
    return message;
  });

  if (!created) return notFound("Channel not found.");
  return Response.json(created, { status: 201 });
}
