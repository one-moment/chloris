import { requireCurrentUser } from "../../../../../lib/auth";
import { createApiPerfLogger } from "../../../../../lib/apiPerf";
import { badRequest, createPostRecord, notFound, serializePost } from "../../../../../lib/serverState";
import { prisma } from "../../../../../lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function POST(request, { params }) {
  const perf = createApiPerfLogger("posts.create");
  perf.log("request received");

  const user = await perf.measure("auth/session check", "authMs", () => requireCurrentUser());
  if (!user) {
    perf.done({ status: 401 });
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { channelId } = await params;
  const { title, body, status, attachments = [] } = await request.json();
  const trimmedBody = body?.trim() ?? "";
  const trimmedTitle = title?.trim() || trimmedBody.slice(0, 40) || attachments[0]?.name;
  if (!trimmedTitle && !trimmedBody && attachments.length === 0) {
    perf.done({ status: 400 });
    return badRequest("Post title, body, or attachment is required.");
  }

  const channel = await perf.measure("permission check", "permissionMs", () => (
    prisma.channel.findUnique({ where: { id: channelId }, select: { id: true } })
  ));
  if (!channel) {
    perf.done({ status: 404 });
    return notFound("Channel not found.");
  }

  const post = createPostRecord({ title: trimmedTitle, body: trimmedBody, author: user.name, authorId: user.id, status, attachments });
  const created = await perf.measure("DB insert", "dbInsertMs", () => prisma.post.create({
    data: {
      id: post.id,
      channelId,
      authorId: user.id,
      title: post.title,
      body: post.body,
      attachmentsJson: JSON.stringify(post.attachments ?? []),
      author: post.author,
      status: post.status
    },
    select: {
      id: true,
      title: true,
      body: true,
      attachmentsJson: true,
      authorId: true,
      author: true,
      status: true,
      createdAt: true
    }
  }));

  perf.log("optional select/join start", { skipped: true });
  perf.log("optional select/join end", { skipped: true, optionalSelectMs: 0, reason: "insert returns selected row without comments" });
  perf.done({ status: 201 });
  return Response.json(serializePost({ ...created, comments: [] }), { status: 201 });
}
