import { requireCurrentUser } from "../../../../../lib/auth";
import { createApiPerfLogger } from "../../../../../lib/apiPerf";
import { createCommentRecord } from "../../../../../lib/serverState";
import { normalizeMentionIds } from "../../../../../lib/mentions";
import { prisma } from "../../../../../lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function POST(request, { params }) {
  const perf = createApiPerfLogger("comments.create", request);
  const headers = perf.responseHeaders();
  perf.log("request received", { preferredRegion });

  const user = await perf.measure("auth/session check", "authMs", () => requireCurrentUser());
  if (!user) {
    perf.done({ status: 401 });
    return Response.json({ error: "Authentication required." }, { status: 401, headers });
  }

  const { postId } = await params;
  const { body, mentions = [], parentId } = await request.json();
  const trimmedBody = body?.trim();
  if (!trimmedBody) {
    perf.done({ status: 400 });
    return Response.json({ error: "Comment body is required." }, { status: 400, headers });
  }

  const post = await perf.measure("permission check", "permissionMs", () => (
    prisma.post.findUnique({ where: { id: postId }, select: { id: true } })
  ));
  if (!post) {
    perf.done({ status: 404 });
    return Response.json({ error: "Post not found." }, { status: 404, headers });
  }

  let resolvedParentId = null;
  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { id: true, postId: true, parentId: true }
    });
    if (!parent || parent.postId !== postId) {
      perf.done({ status: 400 });
      return Response.json({ error: "Reply target comment not found." }, { status: 400, headers });
    }
    resolvedParentId = parent.parentId ?? parent.id;
  }

  const users = await prisma.user.findMany({ select: { id: true } });
  const mentionIds = normalizeMentionIds(mentions, users);
  const comment = createCommentRecord({ body: trimmedBody, author: user.name, authorId: user.id });
  const created = await perf.measure("DB insert", "dbInsertMs", () => prisma.comment.create({
    data: {
      id: comment.id,
      postId,
      authorId: user.id,
      parentId: resolvedParentId,
      author: comment.author,
      body: comment.body,
      mentionsJson: JSON.stringify(mentionIds)
    },
    select: {
      id: true,
      authorId: true,
      parentId: true,
      author: true,
      body: true,
      mentionsJson: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true
    }
  }));

  perf.log("optional select/join start", { skipped: true });
  perf.log("optional select/join end", { skipped: true, optionalSelectMs: 0, reason: "insert returns selected row" });
  perf.done({ status: 201 });
  return Response.json({
    id: created.id,
    authorId: created.authorId,
    parentId: created.parentId,
    author: created.author,
    body: created.body,
    mentions: mentionIds,
    createdAt: "방금 전",
    createdAtIso: created.createdAt.toISOString(),
    updatedAt: "방금 전",
    updatedAtIso: created.updatedAt.toISOString(),
    editedAt: null,
    editedAtIso: null,
    isEdited: false
  }, { status: 201, headers });
}
