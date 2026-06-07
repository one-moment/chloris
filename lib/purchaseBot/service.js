import { prisma } from "../prisma";
import {
  PURCHASE_REQUEST_STATUS,
  PURCHASE_WORKER_TASK_STATUS,
  SAFE_WORKER_RESULT_STATUSES
} from "./constants";
import {
  purchaseBotInfoMessage,
  purchaseBotResultMessage,
  purchaseRequestCreatedMessage,
  purchaseRequestQueuedMessage,
  purchaseRequestRejectedMessage
} from "./messages";
import { isPurchaseBotCommand, matchPurchaseItems, parsePurchaseCommand } from "./parser";

function nowId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseApproverIds() {
  return String(process.env.PURCHASE_BOT_APPROVER_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function canApprovePurchase(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const approverIds = parseApproverIds();
  return approverIds.includes(user.id);
}

async function appendBotMessage(tx, channelId, body) {
  return tx.message.create({
    data: {
      id: nowId("msg"),
      channelId,
      author: "구매봇",
      body,
      attachmentsJson: "[]",
      bot: true
    }
  });
}

export async function handlePurchaseBotCommand({ body, channelId, messageId, requester }) {
  if (!isPurchaseBotCommand(body)) return null;
  const parsed = parsePurchaseCommand(body);
  if (!parsed?.itemQuery) {
    return prisma.$transaction(async (tx) => {
      await appendBotMessage(tx, channelId, purchaseBotInfoMessage(["품목명을 찾지 못했습니다.", "예: @구매봇 A4용지 2박스 주문"]));
      return { handled: true, created: false };
    });
  }

  const items = await prisma.purchaseItem.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  const matches = matchPurchaseItems(parsed, items);

  if (matches.length === 0) {
    await prisma.message.create({
      data: {
        id: nowId("msg"),
        channelId,
        author: "구매봇",
        body: purchaseBotInfoMessage([`'${parsed.itemQuery}'은 등록된 반복구매 품목이 아닙니다.`, "관리자에게 PurchaseItem seed를 추가해달라고 요청해주세요."]),
        attachmentsJson: "[]",
        bot: true
      }
    });
    return { handled: true, created: false };
  }

  if (matches.length > 1) {
    await prisma.message.create({
      data: {
        id: nowId("msg"),
        channelId,
        author: "구매봇",
        body: purchaseBotInfoMessage(["여러 품목이 매칭되었습니다.", ...matches.map((item) => `- ${item.name} (${item.id})`), "품목명을 더 구체적으로 입력해주세요."]),
        attachmentsJson: "[]",
        bot: true
      }
    });
    return { handled: true, created: false };
  }

  const item = matches[0];
  const quantity = parsed.quantity ?? item.defaultQuantity;
  if (quantity < item.minQuantity || quantity > item.maxQuantity) {
    await prisma.message.create({
      data: {
        id: nowId("msg"),
        channelId,
        author: "구매봇",
        body: purchaseBotInfoMessage([`${item.name} 수량은 ${item.minQuantity}${item.unitLabel}부터 ${item.maxQuantity}${item.unitLabel}까지만 요청할 수 있습니다.`, `요청 수량: ${quantity}${parsed.unitLabel ?? item.unitLabel}`]),
        attachmentsJson: "[]",
        bot: true
      }
    });
    return { handled: true, created: false };
  }

  return prisma.$transaction(async (tx) => {
    const request = await tx.purchaseRequest.create({
      data: {
        id: nowId("pr"),
        requesterId: requester.id,
        channelId,
        messageId,
        itemId: item.id,
        itemName: item.name,
        vendor: item.vendor,
        url: item.url,
        quantity,
        unitLabel: parsed.unitLabel ?? item.unitLabel,
        expectedPrice: item.expectedPrice,
        maxAllowedPrice: item.maxAllowedPrice,
        shippingLocation: item.defaultShippingLocation,
        approvalRequired: item.approvalRequired,
        status: item.approvalRequired ? PURCHASE_REQUEST_STATUS.PENDING_APPROVAL : PURCHASE_REQUEST_STATUS.APPROVED
      }
    });

    await appendBotMessage(tx, channelId, purchaseRequestCreatedMessage({
      ...request,
      automationLevel: item.automationLevel
    }));

    return { handled: true, created: true, requestId: request.id };
  });
}

export async function approvePurchaseRequest({ requestId, approver }) {
  if (!canApprovePurchase(approver)) {
    return { error: "Purchase approval is not allowed.", status: 403 };
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.purchaseRequest.findUnique({ where: { id: requestId }, include: { item: true } });
    if (!existing) return { error: "Purchase request not found.", status: 404 };
    if (![PURCHASE_REQUEST_STATUS.PENDING_APPROVAL, PURCHASE_REQUEST_STATUS.APPROVED].includes(existing.status)) {
      return { error: "Purchase request is not pending approval.", status: 400 };
    }

    const task = await tx.purchaseWorkerTask.upsert({
      where: { purchaseRequestId: existing.id },
      create: {
        id: nowId("task"),
        purchaseRequestId: existing.id,
        vendor: existing.vendor,
        url: existing.url,
        quantity: existing.quantity,
        automationLevel: existing.item.automationLevel,
        maxAllowedPrice: existing.maxAllowedPrice,
        status: PURCHASE_WORKER_TASK_STATUS.QUEUED
      },
      update: {
        status: PURCHASE_WORKER_TASK_STATUS.QUEUED,
        resultMessage: null,
        screenshotPath: null,
        observedPrice: null,
        errorCode: null,
        lockedAt: null
      }
    });

    const updated = await tx.purchaseRequest.update({
      where: { id: existing.id },
      data: {
        status: PURCHASE_REQUEST_STATUS.QUEUED,
        approvedBy: approver.id,
        approvedAt: new Date(),
        workerTaskId: task.id
      },
      include: { item: true }
    });

    if (updated.channelId) await appendBotMessage(tx, updated.channelId, purchaseRequestQueuedMessage(updated));
    return { request: updated, task };
  });
}

export async function rejectPurchaseRequest({ requestId, approver }) {
  if (!canApprovePurchase(approver)) {
    return { error: "Purchase rejection is not allowed.", status: 403 };
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.purchaseRequest.findUnique({ where: { id: requestId } });
    if (!existing) return { error: "Purchase request not found.", status: 404 };

    const updated = await tx.purchaseRequest.update({
      where: { id: existing.id },
      data: {
        status: PURCHASE_REQUEST_STATUS.REJECTED,
        approvedBy: approver.id,
        approvedAt: new Date()
      }
    });

    if (updated.channelId) await appendBotMessage(tx, updated.channelId, purchaseRequestRejectedMessage(updated));
    return { request: updated };
  });
}

export function validateWorkerToken(request) {
  const expected = process.env.PURCHASE_BOT_WORKER_TOKEN || (process.env.NODE_ENV === "production" ? "" : "local-dev-worker-token");
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return Boolean(expected && token && token === expected);
}

export async function claimNextWorkerTask() {
  return prisma.$transaction(async (tx) => {
    const task = await tx.purchaseWorkerTask.findFirst({
      where: { status: PURCHASE_WORKER_TASK_STATUS.QUEUED },
      orderBy: { createdAt: "asc" },
      include: { purchaseRequest: true }
    });
    if (!task) return null;

    const claimed = await tx.purchaseWorkerTask.updateMany({
      where: { id: task.id, status: PURCHASE_WORKER_TASK_STATUS.QUEUED },
      data: {
        status: PURCHASE_WORKER_TASK_STATUS.RUNNING,
        lockedAt: new Date()
      }
    });
    if (claimed.count === 0) return null;

    const updatedTask = await tx.purchaseWorkerTask.findUnique({
      where: { id: task.id },
      include: { purchaseRequest: true }
    });
    if (!updatedTask) return null;

    await tx.purchaseRequest.update({
      where: { id: task.purchaseRequestId },
      data: { status: PURCHASE_REQUEST_STATUS.RUNNING }
    });

    return updatedTask;
  });
}

export async function completeWorkerTask({ taskId, result }) {
  if (!SAFE_WORKER_RESULT_STATUSES.has(result.status)) {
    return { error: "Unsafe or unsupported worker result status.", status: 400 };
  }

  return prisma.$transaction(async (tx) => {
    const task = await tx.purchaseWorkerTask.findUnique({
      where: { id: taskId },
      include: { purchaseRequest: true }
    });
    if (!task) return { error: "Worker task not found.", status: 404 };

    await tx.purchaseWorkerTask.update({
      where: { id: task.id },
      data: {
        status: result.status === PURCHASE_REQUEST_STATUS.FAILED ? PURCHASE_WORKER_TASK_STATUS.FAILED : PURCHASE_WORKER_TASK_STATUS.COMPLETED,
        resultMessage: result.message,
        screenshotPath: result.screenshotPath,
        observedPrice: result.observedPrice,
        errorCode: result.errorCode
      }
    });

    const updatedRequest = await tx.purchaseRequest.update({
      where: { id: task.purchaseRequestId },
      data: {
        status: result.status,
        resultScreenshotUrl: result.screenshotPath,
        resultMessage: result.message
      }
    });

    if (updatedRequest.channelId) await appendBotMessage(tx, updatedRequest.channelId, purchaseBotResultMessage(updatedRequest));
    return { request: updatedRequest };
  });
}
