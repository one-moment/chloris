import { requireCurrentUser } from "../../../../../lib/auth";
import { createVendorTasksForApprovedDraft } from "../../../../../lib/agents/purchaseAgent/draftTasks";
import { prisma } from "../../../../../lib/prisma";
import { serializePurchaseOrderDraft } from "../../../../../lib/serverState";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

function nowId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function canApproveDraft(user, draft) {
  return user.role === "admin" || draft.requesterId === user.id;
}

function approvalMessageBody(draft, approver, taskSummaryLines) {
  const vendorCount = new Set(draft.lines.map((line) => line.vendor)).size;
  return [
    "구매요청서 초안이 승인되었습니다.",
    "",
    `초안 ID: ${draft.id}`,
    `승인자: ${approver.name}`,
    `총 품목: ${draft.lines.length}개`,
    `거래처: ${vendorCount}곳`,
    "",
    "거래처별 작업:",
    ...taskSummaryLines,
    "",
    "다음 단계: 거래처별 작업으로 분리해 장바구니 구성 요청을 생성합니다.",
    "최종 결제는 사람이 직접 진행해야 합니다."
  ].join("\n");
}

export async function POST(_request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { draftId } = await params;
  const draft = await prisma.purchaseOrderDraft.findUnique({
    where: { id: draftId },
    include: { lines: { orderBy: { lineIndex: "asc" } } }
  });

  if (!draft) return Response.json({ error: "Purchase order draft not found." }, { status: 404 });
  if (!canApproveDraft(user, draft)) return Response.json({ error: "Permission denied." }, { status: 403 });
  if (draft.status !== "draft") return Response.json({ error: "Only draft purchase orders can be approved." }, { status: 409 });

  const updated = await prisma.$transaction(async (tx) => {
    const nextDraft = await tx.purchaseOrderDraft.update({
      where: { id: draftId },
      data: { status: "approved" },
      include: {
        lines: { orderBy: { lineIndex: "asc" } },
        vendorTasks: { orderBy: { createdAt: "asc" } }
      }
    });
    const vendorTaskResult = await createVendorTasksForApprovedDraft({
      tx,
      draft: nextDraft,
      approver: user
    });

    if (draft.channelId) {
      await tx.message.create({
        data: {
          id: nowId("msg"),
          channelId: draft.channelId,
          author: "구매 에이전트",
          body: approvalMessageBody(nextDraft, user, vendorTaskResult.summaryLines),
          attachmentsJson: "[]",
          bot: true
        }
      });
    }

    return tx.purchaseOrderDraft.findUnique({
      where: { id: draftId },
      include: {
        lines: { orderBy: { lineIndex: "asc" } },
        vendorTasks: { orderBy: { createdAt: "asc" } }
      }
    });
  });

  return Response.json({ draft: serializePurchaseOrderDraft(updated) });
}
