import { requireCurrentUser } from "../../../../lib/auth";
import { ALL_POST_STATUSES } from "../../../../lib/constants";
import { canEditRecord } from "../../../../lib/permissions";
import { badRequest, notFound, serializePost } from "../../../../lib/serverState";
import { prisma } from "../../../../lib/prisma";

const ALLOWED_STATUSES = new Set(ALL_POST_STATUSES);

export async function PATCH(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { postId } = await params;
  const { status, title, body, pinned } = await request.json();
  if (status !== undefined && !ALLOWED_STATUSES.has(status)) return badRequest("Invalid post status.");

  const existing = await prisma.post.findUnique({ where: { id: postId } });
  if (!existing) return notFound("Post not found.");

  const data = {};
  if (status !== undefined) data.status = status;

  if (pinned !== undefined) {
    if (user.role !== "admin") return Response.json({ error: "Only admins can pin posts." }, { status: 403 });
    data.pinnedAt = pinned ? new Date() : null;
  }

  const isContentEdit = title !== undefined || body !== undefined;
  if (isContentEdit) {
    if (!canEditRecord(user, existing)) return Response.json({ error: "You cannot edit this post." }, { status: 403 });
    const trimmedTitle = title?.trim();
    const trimmedBody = body?.trim() ?? "";
    if (!trimmedTitle) return badRequest("Post title is required.");
    data.title = trimmedTitle;
    data.body = trimmedBody;
    if (existing.title !== trimmedTitle || existing.body !== trimmedBody) data.editedAt = new Date();
  }

  if (Object.keys(data).length === 0) return badRequest("No changes provided.");

  const updated = await prisma.post.update({
    where: { id: postId },
    data,
    include: { comments: { orderBy: { createdAt: "asc" } } }
  });

  return Response.json(serializePost(updated));
}

export async function DELETE(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { postId } = await params;
  const existing = await prisma.post.findUnique({ where: { id: postId } });
  if (!existing) return notFound("Post not found.");
  if (!canEditRecord(user, existing)) return Response.json({ error: "You cannot delete this post." }, { status: 403 });

  // 댓글·답글은 스키마 onDelete: Cascade로 함께 삭제된다(고아 레코드 없음).
  await prisma.post.delete({ where: { id: postId } });

  return Response.json({ ok: true, id: postId });
}
