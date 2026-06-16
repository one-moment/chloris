// 폐기 기록 조회/수정 API. 작성자: draft(임시저장)/rejected(반려) 상태에서 행 교체·검수요청(review) 전환.
//   검수요청 전환 시 서버 검증 게이트 통과(422면 미반영) + 담당 매니저 태그 + 채널 게시글 생성(R4).
// 매니저: action=approve|reject 로 검수. 승인(→submitted) 시에만 구글시트 반영(검수 전 미반영).
//   승인/반려는 그 지점 매니저(BranchAssignment.role="manager") 또는 전역 admin만 가능.
import { requireCurrentUser } from "../../../../../../lib/auth";
import { badRequest } from "../../../../../../lib/serverState";
import { prisma } from "../../../../../../lib/prisma";
import { isModuleEnabled } from "../../../../../../lib/brand";
import { normalizeAuthorStatus } from "../../../../../../lib/inventory";
import {
  serializeDisposalBatch,
  resolveLotPrices,
  buildDisposalLineData,
  validateDisposalForSubmit,
  isMissingInventoryTableError,
  canApproveDisposal,
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
      if (existing.status !== "review") return badRequest("검수대기 상태의 폐기 기록만 승인/반려할 수 있습니다.");
      const allowed = await canApproveDisposal(user, existing.branchId);
      if (!allowed) return Response.json({ error: "이 지점의 담당 매니저만 검수할 수 있습니다." }, { status: 403 });

      if (action === "reject") {
        const rejected = await prisma.disposalBatch.update({
          where: { id: batchId },
          data: { status: "rejected", rejectReason: typeof body.rejectReason === "string" ? body.rejectReason : null },
          include: { lines: { orderBy: { lineIndex: "asc" } } }
        });
        await postDisposalDecision(rejected, { actorName: user.name, decision: "rejected", reason: rejected.rejectReason });
        return Response.json(serializeDisposalBatch(rejected));
      }

      // approve → submitted(승인·시트반영 종착). metrics·시트 동기화 기준은 submitted 그대로 유지.
      let approved = await prisma.disposalBatch.update({
        where: { id: batchId },
        data: {
          status: "submitted",
          approvedById: user.id,
          approvedByName: user.name,
          approvedAt: new Date(),
          submittedAt: new Date(),
          rejectReason: null
        },
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

    // ── 작성자 편집/검수요청: draft 또는 rejected 상태에서만 ──────────────────
    if (existing.status !== "draft" && existing.status !== "rejected") {
      return badRequest("검수중이거나 승인된 기록은 수정할 수 없습니다.");
    }

    const replaceLines = Array.isArray(body.lines) ? body.lines : null;
    const nextStatus = normalizeAuthorStatus(body.status);

    const effectiveLines = replaceLines
      ?? (await prisma.disposalLine.findMany({ where: { batchId }, orderBy: { lineIndex: "asc" } }));

    if (nextStatus === "review") {
      if (effectiveLines.length === 0) return badRequest("폐기 품목이 한 개 이상 필요합니다.");
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
