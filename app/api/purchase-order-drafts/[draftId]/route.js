import { requireCurrentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { serializePurchaseOrderDraft } from "../../../../lib/serverState";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

const EDITABLE_LINE_STATUSES = new Set(["needs_review", "needs_item_match", "ready"]);

function cleanOptionalText(value) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function normalizeQuantity(value) {
  if (value === null || value === undefined || value === "") return null;
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99999) return undefined;
  return quantity;
}

function canEditDraft(user, draft) {
  return user.role === "admin" || draft.requesterId === user.id;
}

export async function PATCH(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { draftId } = await params;
  const payload = await request.json();
  const draft = await prisma.purchaseOrderDraft.findUnique({
    where: { id: draftId },
    include: { lines: true }
  });

  if (!draft) return Response.json({ error: "Purchase order draft not found." }, { status: 404 });
  if (!canEditDraft(user, draft)) return Response.json({ error: "Permission denied." }, { status: 403 });
  if (draft.status !== "draft") return Response.json({ error: "Only draft purchase orders can be edited." }, { status: 409 });

  const existingLineIds = new Set(draft.lines.map((line) => line.id));
  const lineUpdates = Array.isArray(payload.lines) ? payload.lines : [];
  const invalidLine = lineUpdates.find((line) => !existingLineIds.has(line.id));
  if (invalidLine) return Response.json({ error: "Draft line not found." }, { status: 400 });

  const normalizedLines = [];
  for (const line of lineUpdates) {
    const itemName = String(line.itemName ?? "").trim();
    if (!itemName) return Response.json({ error: "Item name is required." }, { status: 400 });

    const quantity = normalizeQuantity(line.quantity);
    if (quantity === undefined) return Response.json({ error: "Quantity must be a positive whole number." }, { status: 400 });

    const status = EDITABLE_LINE_STATUSES.has(line.status) ? line.status : "needs_review";
    normalizedLines.push({
      id: line.id,
      itemName,
      quantity,
      unitLabel: cleanOptionalText(line.unitLabel),
      url: cleanOptionalText(line.url),
      notes: cleanOptionalText(line.notes),
      status
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.purchaseOrderDraft.update({
      where: { id: draftId },
      data: {
        requesterName: cleanOptionalText(payload.requesterName),
        requesterTeam: cleanOptionalText(payload.requesterTeam)
      }
    });

    for (const line of normalizedLines) {
      await tx.purchaseOrderDraftLine.update({
        where: { id: line.id },
        data: {
          itemName: line.itemName,
          quantity: line.quantity,
          unitLabel: line.unitLabel,
          url: line.url,
          notes: line.notes,
          status: line.status
        }
      });
    }

    return tx.purchaseOrderDraft.findUnique({
      where: { id: draftId },
      include: { lines: { orderBy: { lineIndex: "asc" } } }
    });
  });

  return Response.json({ draft: serializePurchaseOrderDraft(updated) });
}
