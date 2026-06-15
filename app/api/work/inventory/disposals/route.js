// 폐기 기록 생성/목록 API (보로 inventory 모듈). status: "draft"(임시저장) | "submitted"(최종제출).
// 최종제출은 서버 검증 게이트(한 줄이라도 오류면 422, 미저장). 출처 lot 단가를 폐기행에 스냅샷한다.
// 구글시트 자동 연동은 Phase 5(승인 후) — 여기서는 syncedAt을 남기지 않는다.
import { requireCurrentUser } from "../../../../../lib/auth";
import { badRequest } from "../../../../../lib/serverState";
import { prisma } from "../../../../../lib/prisma";
import { isModuleEnabled } from "../../../../../lib/brand";
import {
  serializeDisposalBatch,
  resolveLotPrices,
  buildDisposalLineData,
  validateDisposalForSubmit,
  isMissingInventoryTableError
} from "../../../../../lib/inventoryServer";
import { syncDisposalBatch } from "../../../../../lib/inventorySheetSync";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function GET(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (!isModuleEnabled("disposal")) return Response.json({ batches: [] });

  const params = new URL(request.url).searchParams;
  const where = {};
  if (params.get("branchId")) where.branchId = params.get("branchId");
  if (params.get("status")) where.status = params.get("status");
  const from = params.get("from");
  const to = params.get("to");
  if (from || to) {
    where.disposalDate = {};
    if (from) where.disposalDate.gte = new Date(from);
    if (to) where.disposalDate.lte = new Date(to);
  }

  // 지점 목록은 폼/필터를 위해 항상 반환한다(폐기 테이블 부재와 무관, 예약 라우트와 동일 패턴).
  const branches = await prisma.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  try {
    const batches = await prisma.disposalBatch.findMany({
      where,
      orderBy: { disposalDate: "desc" },
      take: 50,
      include: { lines: { orderBy: { lineIndex: "asc" } } }
    });
    return Response.json({ batches: batches.map(serializeDisposalBatch), branches });
  } catch (error) {
    if (isMissingInventoryTableError(error)) return Response.json({ batches: [], branches });
    throw error;
  }
}

export async function POST(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (!isModuleEnabled("disposal")) return Response.json({ error: "Disposal module is not enabled." }, { status: 404 });

  const body = await request.json();
  const branchId = (body.branchId ?? "").toString().trim();
  if (!branchId) return badRequest("지점(branchId)이 필요합니다.");
  if (!body.disposalDate) return badRequest("폐기일(disposalDate)이 필요합니다.");
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length === 0) return badRequest("폐기 품목이 한 개 이상 필요합니다.");
  const status = body.status === "submitted" ? "submitted" : "draft";

  try {
    if (status === "submitted") {
      const errors = await validateDisposalForSubmit(lines);
      if (errors.length) {
        return Response.json({ error: "검증 오류로 최종제출할 수 없습니다.", errors }, { status: 422 });
      }
    }

    const priceByLot = await resolveLotPrices(lines);
    const batchId = `disposal-batch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const created = await prisma.disposalBatch.create({
      data: {
        id: batchId,
        branchId,
        channelId: body.channelId || null,
        messageId: body.messageId || null,
        disposalDate: new Date(body.disposalDate),
        status,
        sourceText: typeof body.sourceText === "string" ? body.sourceText : "",
        attachmentsJson: JSON.stringify(Array.isArray(body.attachments) ? body.attachments : []),
        createdById: user.id,
        submittedAt: status === "submitted" ? new Date() : null,
        lines: { create: buildDisposalLineData(lines, priceByLot, batchId) }
      },
      include: { lines: { orderBy: { lineIndex: "asc" } } }
    });

    // 구글시트 한 방향 연동(기본 비활성; env 설정 시에만 동작). 실패는 비치명적.
    if (created.status === "submitted") {
      try {
        const synced = await syncDisposalBatch(created, { author: user.name });
        if (!synced.skipped) {
          await prisma.disposalBatch.update({ where: { id: created.id }, data: { syncedAt: new Date() } });
        }
      } catch (syncError) {
        console.error("disposal_sheet_sync_failed", syncError);
      }
    }

    return Response.json(serializeDisposalBatch(created), { status: 201 });
  } catch (error) {
    if (isMissingInventoryTableError(error)) {
      return Response.json({ error: "재고 테이블이 아직 준비되지 않았습니다." }, { status: 503 });
    }
    throw error;
  }
}
