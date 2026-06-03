import { requireCurrentUser } from "../../../../../lib/auth";
import { createApiPerfLogger } from "../../../../../lib/apiPerf";
import { badRequest, createMessageRecord, notFound, serializeMessage } from "../../../../../lib/serverState";
import { prisma } from "../../../../../lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function POST(request, { params }) {
  const perf = createApiPerfLogger("messages.create");
  perf.log("request received");

  const user = await perf.measure("auth/session check", "authMs", () => requireCurrentUser());
  if (!user) {
    perf.done({ status: 401 });
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { channelId } = await params;
  const { body, bot, attachments = [] } = await request.json();
  const trimmedBody = body?.trim() ?? "";
  if (!trimmedBody && attachments.length === 0) {
    perf.done({ status: 400 });
    return badRequest("Message body or attachment is required.");
  }

  const channel = await perf.measure("permission check", "permissionMs", () => (
    prisma.channel.findUnique({ where: { id: channelId }, select: { id: true } })
  ));
  if (!channel) {
    perf.done({ status: 404 });
    return notFound("Channel not found.");
  }

  const message = createMessageRecord({ body: trimmedBody, author: user.name, authorId: user.id, bot, attachments });
  const created = await perf.measure("DB insert", "dbInsertMs", () => prisma.message.create({
    data: {
      id: message.id,
      channelId,
      authorId: user.id,
      author: message.author,
      body: message.body,
      attachmentsJson: JSON.stringify(message.attachments ?? []),
      bot: Boolean(message.bot)
    },
    select: {
      id: true,
      authorId: true,
      author: true,
      body: true,
      attachmentsJson: true,
      createdAt: true,
      bot: true
    }
  }));

  perf.log("optional select/join start", { skipped: true });
  perf.log("optional select/join end", { skipped: true, optionalSelectMs: 0, reason: "insert returns selected row" });
  perf.done({ status: 201 });
  return Response.json(serializeMessage(created), { status: 201 });
}
