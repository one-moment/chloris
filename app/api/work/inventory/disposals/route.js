// 폐기 기록 생성/목록 API (보로 inventory 모듈). status: "draft"(임시저장) | "review"(검수대기).
// 작성자의 "검수요청"(review)은 서버 검증 게이트(한 줄이라도 오류면 422, 미저장)를 통과해야 한다.
// 시트 반영은 매니저 승인(→submitted) 시점뿐 — 여기서는 절대 시트에 쓰지 않는다(검수 전 미반영).
// 검수요청 시 담당 매니저 태그 + 지점 채널에 스윗형 폐기기록 게시글을 자동 생성한다(R4).
import { requireCurrentUser } from "../../../../../lib/auth";
import { badRequest } from "../../../../../lib/serverState";
import { prisma } from "../../../../../lib/prisma";
import { isModuleEnabled } from "../../../../../lib/brand";
import { normalizeAuthorStatus, attachmentCount } from "../../../../../lib/inventory";
import {
  serializeDisposalBatch,
  resolveLotPrices,
  buildDisposalLineData,
  validateDisposalForSubmit,
  isMissingInventoryTableError,
  postDisposalReviewRequest,
  allBranchManagers,
  branchManagers
} from "../../../../../lib/inventoryServer";

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

  // 지점 목록·담당 매니저 후보는 폼/필터를 위해 항상 반환한다(폐기 테이블 부재와 무관, 예약 라우트와 동일 패턴).
  const [branches, managers] = await Promise.all([
    prisma.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    allBranchManagers()
  ]);

  try {
    const batches = await prisma.disposalBatch.findMany({
      where,
      orderBy: { disposalDate: "desc" },
      take: 50,
      include: { lines: { orderBy: { lineIndex: "asc" } } }
    });
    return Response.json({ batches: batches.map(serializeDisposalBatch), branches, managers });
  } catch (error) {
    if (isMissingInventoryTableError(error)) return Response.json({ batches: [], branches, managers });
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
  // 작성자는 draft(임시저장) 또는 review(검수요청)만 생성할 수 있다. submitted는 매니저 승인으로만 도달.
  const status = normalizeAuthorStatus(body.status);

  try {
    if (status === "review") {
      // 검수요청에는 폐기 사진이 1장 이상 필요하다(매니저가 사진 보고 승인). draft/임시저장은 사진 없이 허용.
      if (attachmentCount(body.attachments) < 1) {
        return badRequest("검수요청에는 폐기 사진이 1장 이상 필요합니다.");
      }
      // 담당 매니저로 지정한 사용자는 해당 지점의 매니저여야 한다(멘션 대상 무결성).
      if (body.reviewerId) {
        const managers = await branchManagers(branchId);
        if (!managers.some((manager) => manager.id === body.reviewerId)) {
          return badRequest("담당 매니저는 해당 지점의 매니저여야 합니다.");
        }
      }
      const errors = await validateDisposalForSubmit(lines);
      if (errors.length) {
        return Response.json({ error: "검증 오류로 검수 요청할 수 없습니다.", errors }, { status: 422 });
      }
    }

    const priceByLot = await resolveLotPrices(lines);
    const batchId = `disposal-batch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let created = await prisma.disposalBatch.create({
      data: {
        id: batchId,
        branchId,
        channelId: body.channelId || null,
        messageId: body.messageId || null,
        disposalDate: new Date(body.disposalDate),
        status,
        reviewerId: status === "review" ? (body.reviewerId || null) : null,
        reviewerName: status === "review" ? (body.reviewerName || null) : null,
        reviewRequestedAt: status === "review" ? new Date() : null,
        sourceText: typeof body.sourceText === "string" ? body.sourceText : "",
        attachmentsJson: JSON.stringify(Array.isArray(body.attachments) ? body.attachments : []),
        createdById: user.id,
        lines: { create: buildDisposalLineData(lines, priceByLot, batchId) }
      },
      include: { lines: { orderBy: { lineIndex: "asc" } } }
    });

    // R4: 검수요청 시 지점 채널에 스윗형 폐기기록 게시글 자동 생성(담당 매니저 멘션, 상태: 검수대기). 실패는 비치명적.
    if (created.status === "review") {
      created = await postDisposalReviewRequest(created, user);
    }

    return Response.json(serializeDisposalBatch(created), { status: 201 });
  } catch (error) {
    if (isMissingInventoryTableError(error)) {
      return Response.json({ error: "재고 테이블이 아직 준비되지 않았습니다." }, { status: 503 });
    }
    throw error;
  }
}
