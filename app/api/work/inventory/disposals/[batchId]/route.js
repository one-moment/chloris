// 폐기 기록 조회/수정 API. 작성자: draft(임시저장)/rejected(반려) 상태에서 행 교체·검수요청(review) 전환.
//   검수요청 전환 시 서버 검증 게이트 통과(422면 미반영) + 담당 매니저 태그 + 채널 게시글 생성(R4).
// 매니저: action=approve|reject 로 검수. 승인(→submitted) 시에만 구글시트 반영(검수 전 미반영).
//   승인/반려는 그 지점 매니저(BranchAssignment.role="manager") 또는 전역 admin만 가능.
import { requireCurrentUser } from "../../../../../../lib/auth";
import { badRequest } from "../../../../../../lib/serverState";
import { prisma } from "../../../../../../lib/prisma";
import { isModuleEnabled } from "../../../../../../lib/brand";
import { normalizeAuthorStatus, canTransitionDisposal, attachmentCount } from "../../../../../../lib/inventory";
import {
  serializeDisposalBatch,
  resolveLotPrices,
  buildDisposalLineData,
  validateDisposalForSubmit,
  isMissingInventoryTableError,
  canApproveDisposal,
  branchManagers,
  postDisposalReviewRequest,
  postDisposalDecision
} from "../../../../../../lib/inventoryServer";
import { syncDisposalBatch } from "../../../../../../lib/inventorySheetSync";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function GET(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (!isModuleEnabled("disposal")) return Response.json({ error: "Disposal module is not enabled." }, { status: 404 });

  const { batchId } = await params;
  try {
    const batch = await prisma.disposalBatch.findUnique({
      where: { id: batchId },
      include: { lines: { orderBy: { lineIndex: "asc" } } }
    });
    if (!batch) return Response.json({ error: "Batch not found." }, { status: 404 });
    return Response.json(serializeDisposalBatch(batch));
  } catch (error) {
    if (isMissingInventoryTableError(error)) return Response.json({ error: "Batch not found." }, { status: 404 });
    throw error;
  }
}

export async function PATCH(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (!isModuleEnabled("disposal")) return Response.json({ error: "Disposal module is not enabled." }, { status: 404 });

  const { batchId } = await params;
  const existing = await prisma.disposalBatch.findUnique({ where: { id: batchId } });
  if (!existing) return Response.json({ error: "Batch not found." }, { status: 404 });

  const body = await request.json();
  const action = body.action;

  try {
    // ── 매니저 검수 액션: 승인(approve) / 반려(reject) ──────────────────────
    if (action === "approve" || action === "reject") {
      const targetStatus = action === "approve" ? "submitted" : "rejected";
      if (!canTransitionDisposal(existing.status, targetStatus)) {
        return badRequest("검수대기 상태의 폐기 기록만 승인/반려할 수 있습니다.");
      }
      const allowed = await canApproveDisposal(user, existing.branchId);
      if (!allowed) return Response.json({ error: "이 지점의 담당 매니저만 검수할 수 있습니다." }, { status: 403 });

      if (action === "reject") {
        const decidedAt = new Date();
        // 상태 가드를 update 조건(where status:"review")에 넣어 동시 승인/반려 경쟁을 차단한다.
        const rejectResult = await prisma.disposalBatch.updateMany({
          where: { id: batchId, status: "review" },
          data: { status: "rejected", rejectReason: typeof body.rejectReason === "string" ? body.rejectReason : null }
        });
        if (rejectResult.count === 0) return badRequest("이미 처리된(검수대기가 아닌) 폐기 기록입니다.");
        let rejected = await prisma.disposalBatch.findUnique({
          where: { id: batchId },
          include: { lines: { orderBy: { lineIndex: "asc" } } }
        });

        // 반려도 구글시트에 한 줄 남긴다(승인상태=반려). DB엔 반려자/시각이 없어 처리한 매니저·시각을
        // 옵션으로 전달한다. env 설정 시에만 동작·실패는 비치명적(승인 분기와 동일 패턴).
        try {
          const [author, branch] = await Promise.all([
            rejected.createdById ? prisma.user.findUnique({ where: { id: rejected.createdById }, select: { name: true } }) : null,
            prisma.branch.findUnique({ where: { id: rejected.branchId }, select: { name: true } })
          ]);
          const synced = await syncDisposalBatch(rejected, {
            author: author?.name,
            branchName: branch?.name,
            decidedByName: user.name,
            decidedAt
          });
          if (!synced.skipped) {
            rejected = await prisma.disposalBatch.update({
              where: { id: batchId },
              data: { syncedAt: new Date() },
              include: { lines: { orderBy: { lineIndex: "asc" } } }
            });
          }
        } catch (syncError) {
          console.error("disposal_sheet_sync_failed", syncError);
        }

        await postDisposalDecision(rejected, { actorName: user.name, decision: "rejected", reason: rejected.rejectReason });
        return Response.json(serializeDisposalBatch(rejected));
      }

      // approve → submitted(승인·시트반영 종착). 상태 가드를 update 조건에 넣어 동시 처리 경쟁을 차단한다.
      const approveResult = await prisma.disposalBatch.updateMany({
        where: { id: batchId, status: "review" },
        data: {
          status: "submitted",
          approvedById: user.id,
          approvedByName: user.name,
          approvedAt: new Date(),
          submittedAt: new Date(),
          rejectReason: null
        }
      });
      if (approveResult.count === 0) return badRequest("이미 처리된(검수대기가 아닌) 폐기 기록입니다.");
      let approved = await prisma.disposalBatch.findUnique({
        where: { id: batchId },
        include: { lines: { orderBy: { lineIndex: "asc" } } }
      });

      // 승인 후에만 구글시트 한 방향 연동(기본 비활성; env 설정 시에만 동작). 실패는 비치명적.
      try {
        const [author, branch] = await Promise.all([
          approved.createdById ? prisma.user.findUnique({ where: { id: approved.createdById }, select: { name: true } }) : null,
          prisma.branch.findUnique({ where: { id: approved.branchId }, select: { name: true } })
        ]);
        const synced = await syncDisposalBatch(approved, { author: author?.name, branchName: branch?.name });
        if (!synced.skipped) {
          approved = await prisma.disposalBatch.update({
            where: { id: batchId },
            data: { syncedAt: new Date() },
            include: { lines: { orderBy: { lineIndex: "asc" } } }
          });
        }
      } catch (syncError) {
        console.error("disposal_sheet_sync_failed", syncError);
      }

      await postDisposalDecision(approved, { actorName: user.name, decision: "approved" });
      return Response.json(serializeDisposalBatch(approved));
    }

    // ── 작성자 편집/검수요청: 전이 테이블이 허용할 때만(draft/rejected → draft/review) ──────
    const replaceLines = Array.isArray(body.lines) ? body.lines : null;
    const nextStatus = normalizeAuthorStatus(body.status);
    if (!canTransitionDisposal(existing.status, nextStatus)) {
      return badRequest("검수중이거나 승인된 기록은 수정할 수 없습니다.");
    }

    const effectiveLines = replaceLines
      ?? (await prisma.disposalLine.findMany({ where: { batchId }, orderBy: { lineIndex: "asc" } }));

    // 검수요청 사진 게이트: 폼이 보낸 첨부(있으면) 또는 기존 저장 첨부 기준으로 1장 이상 필요.
    // (반려→재요청 시 사진 재업로드 없이 기존 사진으로도 통과.)
    const effectiveAttachments = Array.isArray(body.attachments) ? body.attachments : existing.attachmentsJson;

    if (nextStatus === "review") {
      if (effectiveLines.length === 0) return badRequest("폐기 품목이 한 개 이상 필요합니다.");
      if (attachmentCount(effectiveAttachments) < 1) {
        return badRequest("검수요청에는 폐기 사진이 1장 이상 필요합니다.");
      }
      // 담당 매니저로 지정한 사용자는 해당 지점의 매니저여야 한다(멘션 대상 무결성).
      if (body.reviewerId) {
        const managers = await branchManagers(existing.branchId);
        if (!managers.some((manager) => manager.id === body.reviewerId)) {
          return badRequest("담당 매니저는 해당 지점의 매니저여야 합니다.");
        }
      }
      const errors = await validateDisposalForSubmit(effectiveLines);
      if (errors.length) {
        return Response.json({ error: "검증 오류로 검수 요청할 수 없습니다.", errors }, { status: 422 });
      }
    }

    const priceByLot = replaceLines ? await resolveLotPrices(replaceLines) : new Map();

    let updated = await prisma.$transaction(async (tx) => {
      if (replaceLines) {
        await tx.disposalLine.deleteMany({ where: { batchId } });
        for (const data of buildDisposalLineData(replaceLines, priceByLot, batchId)) {
          await tx.disposalLine.create({ data: { ...data, batchId } });
        }
      }
      return tx.disposalBatch.update({
        where: { id: batchId },
        data: {
          status: nextStatus,
          reviewerId: nextStatus === "review" ? (body.reviewerId ?? existing.reviewerId ?? null) : existing.reviewerId,
          reviewerName: nextStatus === "review" ? (body.reviewerName ?? existing.reviewerName ?? null) : existing.reviewerName,
          reviewRequestedAt: nextStatus === "review" ? new Date() : existing.reviewRequestedAt,
          rejectReason: null,
          attachmentsJson: Array.isArray(body.attachments) ? JSON.stringify(body.attachments) : undefined,
          disposalDate: body.disposalDate ? new Date(body.disposalDate) : undefined,
          sourceText: typeof body.sourceText === "string" ? body.sourceText : undefined
        },
        include: { lines: { orderBy: { lineIndex: "asc" } } }
      });
    });

    // R4: 검수요청 전환 시 지점 채널에 스윗형 게시글 생성/갱신(비치명적).
    if (updated.status === "review") {
      updated = await postDisposalReviewRequest(updated, user);
    }

    return Response.json(serializeDisposalBatch(updated));
  } catch (error) {
    if (isMissingInventoryTableError(error)) {
      return Response.json({ error: "재고 테이블이 아직 준비되지 않았습니다." }, { status: 503 });
    }
    throw error;
  }
}
