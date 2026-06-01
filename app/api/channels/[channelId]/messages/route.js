import { requireCurrentUser } from "../../../../../lib/auth";
import { badRequest, createMessageRecord, findChannelContext, notFound, updateState } from "../../../../../lib/serverState";

export async function POST(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { channelId } = await params;
  const { body, bot, attachments = [] } = await request.json();
  const trimmedBody = body?.trim() ?? "";
  if (!trimmedBody && attachments.length === 0) return badRequest("Message body or attachment is required.");

  const created = await updateState((state) => {
    const context = findChannelContext(state, channelId);
    if (!context) return null;

    const message = createMessageRecord({ body: trimmedBody, author: user.name, authorId: user.id, bot, attachments });
    context.channel.messages.unshift(message);
    return message;
  });

  if (!created) return notFound("Channel not found.");
  return Response.json(created, { status: 201 });
}
