import { requireCurrentUser } from "../../../../../lib/auth";
import { badRequest, createMessageRecord, notFound } from "../../../../../lib/serverState";
import { prisma } from "../../../../../lib/prisma";

export async function POST(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { channelId } = await params;
  const { body, bot, attachments = [] } = await request.json();
  const trimmedBody = body?.trim() ?? "";
  if (!trimmedBody && attachments.length === 0) return badRequest("Message body or attachment is required.");

  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true } });
  if (!channel) return notFound("Channel not found.");

  const message = createMessageRecord({ body: trimmedBody, author: user.name, authorId: user.id, bot, attachments });
  await prisma.message.create({
    data: {
      id: message.id,
      channelId,
      authorId: user.id,
      author: message.author,
      body: message.body,
      attachmentsJson: JSON.stringify(message.attachments ?? []),
      bot: Boolean(message.bot)
    }
  });

  return Response.json(message, { status: 201 });
}
