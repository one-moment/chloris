// 폐기 기록 조회/수정 API. 임시저장(draft) 배치를 불러와 행을 교체하거나 최종제출로 전환한다.
// 최종제출된 기록은 수정 불가. 최종제출 전환 시 서버 검증 게이트를 통과해야 한다(422면 미반영).
import { requireCurrentUser } from "../../../../../../lib/auth";
import { badRequest } from "../../../../../../lib/serverState";
import { prisma } from "../../../../../../lib/prisma";
import { isModuleEnabled } from "../../../../../../lib/brand";
import {
  serializeDisposalBatch,
  resolveLotPrices,
  buildDisposalLineData,
  validateDisposalForSubmit,
  isMissingInventoryTableError
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
  if (existing.status !== "draft") return badRequest("이미 최종제출된 기록은 수정할 수 없습니다.");

  const body = await request.json();
  const replaceLines = Array.isArray(body.lines) ? body.lines : null;
  const nextStatus = body.status === "submitted" ? "submitted" : "draft";

  try {
    const effectiveLines = replaceLines
      ?? (await prisma.disposalLine.findMany({ where: { batchId }, orderBy: { lineIndex: "asc" } }));

    if (nextStatus === "submitted") {
      if (effectiveLines.length === 0) return badRequest("폐기 품목이 한 개 이상 필요합니다.");
      const errors = await validateDisposalForSubmit(effectiveLines);
      if (errors.length) {
        return Response.json({ error: "검증 오류로 최종제출할 수 없습니다.", errors }, { status: 422 });
      }
    }

    const priceByLot = replaceLines ? await resolveLotPrices(replaceLines) : new Map();

    const updated = await prisma.$transaction(async (tx) => {
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
          submittedAt: nextStatus === "submitted" ? new Date() : null,
          disposalDate: body.disposalDate ? new Date(body.disposalDate) : undefined,
          sourceText: typeof body.sourceText === "string" ? body.sourceText : undefined
        },
        include: { lines: { orderBy: { lineIndex: "asc" } } }
      });
    });

    // 구글시트 한 방향 연동(기본 비활성). 최종제출 전환 시에만, 비치명적.
    if (updated.status === "submitted") {
      try {
        const synced = await syncDisposalBatch(updated, { author: user.name });
        if (!synced.skipped) {
          await prisma.disposalBatch.update({ where: { id: batchId }, data: { syncedAt: new Date() } });
        }
      } catch (syncError) {
        console.error("disposal_sheet_sync_failed", syncError);
      }
    }

    return Response.json(serializeDisposalBatch(updated));
  } catch (error) {
    if (isMissingInventoryTableError(error)) {
      return Response.json({ error: "재고 테이블이 아직 준비되지 않았습니다." }, { status: 503 });
    }
    throw error;
  }
}
