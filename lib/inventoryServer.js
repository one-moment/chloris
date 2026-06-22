// 입고·폐기 서버 헬퍼 (prisma 사용). API 라우트가 공유한다(모듈 경계 유지 — 코어 lib).
// 순수 검증 로직은 lib/inventory.js, 여기는 DB 조회·직렬화·lot 단가 스냅샷.
import { prisma } from "./prisma";
import { validateDisposalLines, formatDisposalPostBody } from "./inventory";
import { createMessageRecord } from "./serverState";

export function isMissingInventoryTableError(error) {
  const message = String(error?.message ?? "");
  return error?.code === "P2021"
    || message.includes("DisposalBatch")
    || message.includes("DisposalLine")
    || message.includes("FlowerItem")
    || message.includes("DisposalCause")
    || message.includes("StockInLine");
}

export function serializeDisposalBatch(batch) {
  const lines = (batch.lines ?? []).map((line) => ({
    id: line.id,
    lineIndex: line.lineIndex,
    itemId: line.itemId ?? null,
    itemName: line.itemName,
    quantity: line.quantity,
    unit: line.unit,
    category: line.category,
    cause: line.cause,
    sourceLotId: line.sourceLotId ?? null,
    unitPrice: line.unitPrice ?? null,
    amount: line.amount ?? null,
    note: line.note ?? null
  }));
  return {
    id: batch.id,
    branchId: batch.branchId,
    channelId: batch.channelId ?? null,
    messageId: batch.messageId ?? null,
    disposalDate: batch.disposalDate?.toISOString?.() ?? batch.disposalDate,
    status: batch.status,
    reviewerId: batch.reviewerId ?? null,
    reviewerName: batch.reviewerName ?? null,
    reviewRequestedAt: batch.reviewRequestedAt?.toISOString?.() ?? batch.reviewRequestedAt ?? null,
    approvedById: batch.approvedById ?? null,
    approvedByName: batch.approvedByName ?? null,
    approvedAt: batch.approvedAt?.toISOString?.() ?? batch.approvedAt ?? null,
    rejectReason: batch.rejectReason ?? null,
    lineCount: lines.length,
    totalAmount: lines.reduce((sum, line) => sum + (line.amount ?? 0), 0),
    submittedAt: batch.submittedAt?.toISOString?.() ?? batch.submittedAt ?? null,
    syncedAt: batch.syncedAt?.toISOString?.() ?? batch.syncedAt ?? null,
    createdAt: batch.createdAt?.toISOString?.() ?? batch.createdAt,
    lines
  };
}

// ── 검수·승인: 지점 매니저 조회/권한 (BranchAssignment.role === "manager" + 전역 admin) ──
export async function branchManagers(branchId) {
  if (!branchId) return [];
  const assignments = await prisma.branchAssignment.findMany({
    where: { branchId, role: "manager" },
    select: { user: { select: { id: true, name: true, handle: true } } }
  });
  return assignments
    .map((assignment) => assignment.user)
    .filter(Boolean)
    .map((user) => ({ id: user.id, name: user.name, handle: user.handle }));
}

// 전 지점 매니저 목록(폼의 담당 매니저 드롭다운용). [{ branchId, id, name, handle }].
export async function allBranchManagers() {
  const assignments = await prisma.branchAssignment.findMany({
    where: { role: "manager" },
    select: { branchId: true, user: { select: { id: true, name: true, handle: true } } }
  });
  return assignments
    .filter((assignment) => assignment.user)
    .map((assignment) => ({
      branchId: assignment.branchId,
      id: assignment.user.id,
      name: assignment.user.name,
      handle: assignment.user.handle
    }));
}

// 해당 지점 폐기건을 승인/반려할 수 있는가: 전역 admin 이거나 그 지점의 매니저.
export async function canApproveDisposal(user, branchId) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (!branchId) return false;
  const assignment = await prisma.branchAssignment.findFirst({
    where: { userId: user.id, branchId, role: "manager" },
    select: { id: true }
  });
  return Boolean(assignment);
}

// ── R4: 폐기 검수요청 시 지점 채널에 스윗형 게시글 자동 생성 ──────────────────
// 채널은 batch.channelId 우선, 없으면 해당 지점(branchId)의 채널을 사용한다. 채널이 없으면 게시 생략(degrade).
export async function resolveDisposalChannelId(batch) {
  if (batch.channelId) return batch.channelId;
  if (!batch.branchId) return null;
  const channel = await prisma.channel.findFirst({
    where: { branchId: batch.branchId },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });
  return channel?.id ?? null;
}

// 채널에 봇 메시지를 게시한다(에이전트 재처리 없음). 생성된 messageId 반환.
export async function postChannelMessage(channelId, { body, authorName, authorId }) {
  const record = createMessageRecord({ body, author: authorName, authorId, bot: true, attachments: [] });
  await prisma.message.create({
    data: {
      id: record.id,
      channelId,
      authorId: authorId ?? null,
      author: record.author,
      body: record.body,
      attachmentsJson: "[]",
      bot: true
    }
  });
  return record.id;
}

// 검수요청(review) 시점의 폐기기록 본문을 구성한다(지점명·담당매니저 핸들 조회 + 첨부 수).
export async function composeDisposalPostBody(batch, { authorName } = {}) {
  const [branch, reviewer] = await Promise.all([
    batch.branchId ? prisma.branch.findUnique({ where: { id: batch.branchId }, select: { name: true } }) : null,
    batch.reviewerId ? prisma.user.findUnique({ where: { id: batch.reviewerId }, select: { handle: true, name: true } }) : null
  ]);
  let attachmentCount = 0;
  try {
    attachmentCount = JSON.parse(batch.attachmentsJson ?? "[]").length;
  } catch {
    attachmentCount = 0;
  }
  const managerHandle = reviewer?.handle
    ? `@${reviewer.handle}`
    : (batch.reviewerName ? `@${batch.reviewerName}` : null);
  return formatDisposalPostBody({
    authorName,
    branchName: branch?.name ?? batch.branchId,
    disposalDate: batch.disposalDate,
    lines: batch.lines ?? [],
    managerHandle,
    status: batch.status,
    attachmentCount
  });
}

// 검수요청(review) 처리: 지점 채널에 스윗형 게시글을 올리고 batch.channelId/messageId를 갱신한다.
// 반려 후 재요청 등으로 이미 우리가 올린 봇 게시글이 있으면 새 글을 또 만들지 않고 본문만 갱신한다.
// (원본 채팅 메시지를 가리키는 messageId는 건드리지 않는다 — 봇 메시지·동일 채널일 때만 갱신.)
// 게시 실패는 비치명적(폐기 기록은 이미 저장됨) — 갱신된 batch(또는 원본)를 반환한다.
export async function postDisposalReviewRequest(batch, author) {
  try {
    const channelId = await resolveDisposalChannelId(batch);
    if (!channelId) return batch;
    const body = await composeDisposalPostBody(batch, { authorName: author?.name });

    let messageId = batch.messageId ?? null;
    if (messageId) {
      const existing = await prisma.message.findUnique({
        where: { id: messageId },
        select: { bot: true, channelId: true }
      });
      if (existing?.bot && existing.channelId === channelId) {
        await prisma.message.update({ where: { id: messageId }, data: { body, editedAt: new Date() } });
      } else {
        messageId = null; // 원본 메시지/다른 채널 → 손대지 않고 새 봇 게시글 생성
      }
    }
    if (!messageId) {
      messageId = await postChannelMessage(channelId, {
        body,
        authorName: author?.name,
        authorId: author?.id ?? batch.createdById ?? null
      });
    }

    await prisma.disposalBatch.update({ where: { id: batch.id }, data: { channelId, messageId } });
    return { ...batch, channelId, messageId };
  } catch (error) {
    console.error("disposal_channel_post_failed", error);
    return batch;
  }
}

// 매니저 승인/반려 결과를 채널에 후속 메시지로 알린다(best-effort).
export async function postDisposalDecision(batch, { actorName, decision, reason } = {}) {
  try {
    const channelId = batch.channelId ?? (await resolveDisposalChannelId(batch));
    if (!channelId) return;
    const date = batch.disposalDate ? new Date(batch.disposalDate).toISOString().slice(0, 10) : "";
    const body = decision === "approved"
      ? `✅ 폐기 승인 — ${date} · ${(batch.lines ?? []).length}건${actorName ? ` · 승인 ${actorName}` : ""}`
      : `❌ 폐기 반려 — ${date}${reason ? `\n사유: ${reason}` : ""}`;
    await postChannelMessage(channelId, { body, authorName: actorName, authorId: null });
  } catch (error) {
    console.error("disposal_decision_post_failed", error);
  }
}

// 출처 lot 단가를 일괄 조회해 매핑 시점 스냅샷에 쓴다.
export async function resolveLotPrices(lines) {
  const lotIds = [...new Set((lines ?? []).map((line) => line.sourceLotId).filter(Boolean))];
  if (!lotIds.length) return new Map();
  const lots = await prisma.stockInLine.findMany({
    where: { lotId: { in: lotIds } },
    select: { lotId: true, unitPrice: true }
  });
  return new Map(lots.map((lot) => [lot.lotId, lot.unitPrice]));
}

// DisposalLine create payload. batchId 는 호출 측에서 nested create(부모 암시) 또는 명시적으로 붙인다.
export function buildDisposalLineData(lines, priceByLot, batchId) {
  return (lines ?? []).map((line, index) => {
    const qty = Number(line.quantity) || 0;
    const unitPrice = line.sourceLotId ? (priceByLot.get(line.sourceLotId) ?? null) : null;
    const amount = unitPrice != null ? Math.round(unitPrice * qty) : null;
    return {
      id: `${batchId}-line-${index + 1}`,
      lineIndex: index + 1,
      itemId: line.itemId || null,
      itemName: String(line.itemName ?? "").trim(),
      quantity: qty,
      unit: line.unit?.trim?.() || "송이",
      category: line.category ?? "",
      cause: String(line.cause ?? "").trim(),
      sourceLotId: line.sourceLotId || null,
      unitPrice,
      amount,
      note: line.note?.trim?.() || null,
      rawText: typeof line.rawText === "string" ? line.rawText : ""
    };
  });
}

// ── 입고(stock-in) ──────────────────────────────────────────────────────────

// LotID 포맷(기존 시트 계승): YYYYMMDD_품목_거래처_NNNN.
export function lotDatePrefix(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function buildLotId(prefix, itemName, supplier, seq) {
  return `${prefix}_${String(itemName ?? "").trim()}_${String(supplier ?? "").trim()}_${String(seq).padStart(4, "0")}`;
}

// 발주/영수증/실입고 3중 대조 → 라인 상태. 대체입고는 비고로 표시.
export function stockInLineStatus({ orderedQty, receiptQty, quantity, note }) {
  const received = Number(quantity) || 0;
  if (note && /대체/.test(note)) return "substitute";
  if (received === 0) return "missing";
  const ordered = orderedQty == null || orderedQty === "" ? null : Number(orderedQty);
  const receipt = receiptQty == null || receiptQty === "" ? null : Number(receiptQty);
  if (ordered != null && ordered !== received) return "discrepancy";
  if (receipt != null && receipt !== received) return "discrepancy";
  if (ordered != null && receipt != null && ordered !== receipt) return "discrepancy";
  return "ok";
}

export function serializeStockInDelivery(delivery) {
  const lines = (delivery.lines ?? []).map((line) => ({
    id: line.id,
    lineIndex: line.lineIndex,
    lotId: line.lotId,
    itemId: line.itemId ?? null,
    itemName: line.itemName,
    unit: line.unit,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    amount: line.amount,
    orderedQty: line.orderedQty ?? null,
    receiptQty: line.receiptQty ?? null,
    note: line.note ?? null,
    status: line.status
  }));
  return {
    id: delivery.id,
    branchId: delivery.branchId,
    supplier: delivery.supplier,
    statementDate: delivery.statementDate?.toISOString?.() ?? delivery.statementDate,
    status: delivery.status,
    lineCount: lines.length,
    totalAmount: delivery.totalAmount ?? lines.reduce((sum, line) => sum + (line.amount ?? 0), 0),
    discrepancyCount: lines.filter((line) => line.status !== "ok").length,
    createdAt: delivery.createdAt?.toISOString?.() ?? delivery.createdAt,
    lines
  };
}

// 최종제출 검증: 활성 품목·폐기원인 마스터와 대조.
export async function validateDisposalForSubmit(lines) {
  const [items, causes] = await Promise.all([
    prisma.flowerItem.findMany({ where: { isActive: true }, select: { name: true } }),
    prisma.disposalCause.findMany({ where: { isActive: true }, select: { name: true } })
  ]);
  return validateDisposalLines(lines, {
    itemNames: new Set(items.map((item) => item.name)),
    causeNames: new Set(causes.map((cause) => cause.name))
  });
}
