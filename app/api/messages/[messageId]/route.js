import { requireCurrentUser } from "../../../../lib/auth";
import { canEditRecord } from "../../../../lib/permissions";
import { badRequest, notFound, serializeMessage } from "../../../../lib/serverState";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function PATCH(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { messageId } = await params;
  const { body } = await request.json();
  const trimmedBody = body?.trim();
  if (!trimmedBody) return badRequest("Message body is required.");

  const existing = await prisma.message.findUnique({ where: { id: messageId } });
  if (!existing) return notFound("Message not found.");
  if (!canEditRecord(user, existing)) return Response.json({ error: "You cannot edit this message." }, { status: 403 });
  if (existing.body === trimmedBody) return Response.json(serializeMessage(existing));

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: {
      body: trimmedBody,
      editedAt: new Date()
    }
  });

  return Response.json(serializeMessage(updated));
}
