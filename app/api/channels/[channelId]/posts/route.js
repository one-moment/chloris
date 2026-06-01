import { requireCurrentUser } from "../../../../../lib/auth";
import { badRequest, createPostRecord, notFound } from "../../../../../lib/serverState";
import { prisma } from "../../../../../lib/prisma";

export async function POST(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { channelId } = await params;
  const { title, body, status, attachments = [] } = await request.json();
  const trimmedBody = body?.trim() ?? "";
  const trimmedTitle = title?.trim() || trimmedBody.slice(0, 40) || attachments[0]?.name;
  if (!trimmedTitle && !trimmedBody && attachments.length === 0) return badRequest("Post title, body, or attachment is required.");

  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true } });
  if (!channel) return notFound("Channel not found.");

  const post = createPostRecord({ title: trimmedTitle, body: trimmedBody, author: user.name, authorId: user.id, status, attachments });
  await prisma.post.create({
    data: {
      id: post.id,
      channelId,
      authorId: user.id,
      title: post.title,
      body: post.body,
      attachmentsJson: JSON.stringify(post.attachments ?? []),
      author: post.author,
      status: post.status
    }
  });

  return Response.json(post, { status: 201 });
}
