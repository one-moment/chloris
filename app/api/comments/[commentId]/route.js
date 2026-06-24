import { requireCurrentUser } from "../../../../lib/auth";
import { normalizeMentionIds } from "../../../../lib/mentions";
import { canEditRecord } from "../../../../lib/permissions";
import { badRequest, notFound } from "../../../../lib/serverState";
import { prisma } from "../../../../lib/prisma";
import { formatRelativeDateTime } from "../../../../lib/time";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

function serializeUpdatedComment(comment) {
  return {
    id: comment.id,
    postId: comment.postId,
    authorId: comment.authorId,
    author: comment.author,
    body: comment.body,
    mentions: JSON.parse(comment.mentionsJson ?? "[]"),
    createdAt: formatRelativeDateTime(comment.createdAt),
    createdAtIso: comment.createdAt.toISOString(),
    updatedAt: formatRelativeDateTime(comment.updatedAt),
    updatedAtIso: comment.updatedAt.toISOString(),
    editedAt: comment.editedAt ? formatRelativeDateTime(comment.editedAt) : null,
    editedAtIso: comment.editedAt?.toISOString() ?? null,
    isEdited: Boolean(comment.editedAt)
  };
}

export async function PATCH(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { commentId } = await params;
  const { body, mentions = [] } = await request.json();
  const trimmedBody = body?.trim();
  if (!trimmedBody) return badRequest("Comment body is required.");

  const existing = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!existing) return notFound("Comment not found.");
  if (!canEditRecord(user, existing)) return Response.json({ error: "You cannot edit this comment." }, { status: 403 });

  const users = await prisma.user.findMany({ select: { id: true } });
  const mentionIds = normalizeMentionIds(mentions, users);
  const mentionsJson = JSON.stringify(mentionIds);
  if (existing.body === trimmedBody && existing.mentionsJson === mentionsJson) {
    return Response.json(serializeUpdatedComment(existing));
  }

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: {
      body: trimmedBody,
      mentionsJson,
      editedAt: new Date()
    }
  });

  return Response.json(serializeUpdatedComment(updated));
}

export async function DELETE(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { commentId } = await params;
  const existing = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!existing) return notFound("Comment not found.");
  if (!canEditRecord(user, existing)) return Response.json({ error: "You cannot delete this comment." }, { status: 403 });

  // 답글(자식 댓글)은 스키마 onDelete: Cascade로 함께 삭제된다.
  await prisma.comment.delete({ where: { id: commentId } });

  return Response.json({ ok: true, id: commentId, postId: existing.postId });
}
