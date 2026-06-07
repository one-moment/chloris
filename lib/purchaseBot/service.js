import { prisma } from "../prisma";
import {
  getPurchaseBotInstallation,
  logBotEvent,
  resolvePurchaseBotConfig
} from "../botIntegrations/service";
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
import { isPurchaseBotCommand, matchPurchaseItems, parsePurchaseCommands } from "./parser";

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

function canApprovePurchaseWithConfig(user, config) {
  if (canApprovePurchase(user)) return true;
  return config?.defaultApproverUserIds?.includes(user?.id);
}

async function lookupPurchaseBotInstallation(channelId) {
  try {
    return await getPurchaseBotInstallation(channelId);
  } catch (error) {
    console.error("purchase_bot_installation_lookup_failed", error);
    return null;
  }
}

async function appendBotMessage(tx, channelId, body, attachments = []) {
  return tx.message.create({
    data: {
      id: nowId("msg"),
      channelId,
      author: "구매봇",
      body,
      attachmentsJson: JSON.stringify(attachments),
      bot: true
    }
  });
}

export async function handlePurchaseBotCommand({ body, channelId, messageId, requester }) {
  if (!isPurchaseBotCommand(body)) return null;
  const startedAt = Date.now();
  const installation = await lookupPurchaseBotInstallation(channelId);
  if (!installation) {
    if (process.env.BOT_DEBUG_UNINSTALLED === "true") {
      const botApp = await prisma.botApp.findUnique({ where: { slug: "purchase-bot" }, select: { id: true } });
      if (botApp) {
        await prisma.$transaction(async (tx) => {
          await appendBotMessage(tx, channelId, purchaseBotInfoMessage([
            "이 채널에는 구매봇이 연결되어 있지 않습니다.",
            "관리자에게 채널 봇 설정에서 purchase-bot을 enable 해달라고 요청해주세요."
          ]));
        });
      }
    }
    return { handled: false, created: false, reason: "purchase_bot_not_installed" };
  }

  const config = resolvePurchaseBotConfig(installation);
  const parsedCommands = parsePurchaseCommands(body);
  if (!parsedCommands.length) {
    await logBotEvent({
      botAppId: installation.botAppId,
      channelId,
      eventType: "purchase_bot.command",
      status: "invalid",
      requestPayload: { body, requesterId: requester.id },
      durationMs: Date.now() - startedAt
    });
    return prisma.$transaction(async (tx) => {
      await appendBotMessage(tx, channelId, purchaseBotInfoMessage([
        "품목명을 찾지 못했습니다.",
        "예: @구매봇 A4용지 2박스 주문",
        "복수 예: @구매봇 A4용지 2박스, 보로 강남점 명함 500매 주문"
      ]));
      return { handled: true, created: false };
    });
  }

  const items = await prisma.purchaseItem.findMany({
    where: {
      isActive: true,
      ...(config.allowedVendors.length > 0 ? { vendor: { in: config.allowedVendors } } : {})
    },
    orderBy: { name: "asc" }
  });

  const result = await prisma.$transaction(async (tx) => {
    const createdRequests = [];
    let skipped = 0;

    for (const parsed of parsedCommands) {
      const matches = matchPurchaseItems(parsed, items);

      if (matches.length === 0) {
        skipped += 1;
        await appendBotMessage(tx, channelId, purchaseBotInfoMessage([
          `'${parsed.itemQuery}'은 등록된 반복구매 품목이 아닙니다.`,
          "관리자에게 PurchaseItem seed를 추가해달라고 요청해주세요."
        ]));
        continue;
      }

      if (matches.length > 1) {
        skipped += 1;
        await appendBotMessage(tx, channelId, purchaseBotInfoMessage([
          `'${parsed.itemQuery}'에 여러 품목이 매칭되었습니다.`,
          ...matches.map((item) => `- ${item.name} (${item.id})`),
          "품목명을 더 구체적으로 입력해주세요."
        ]));
        continue;
      }

      const item = matches[0];
      const quantity = parsed.quantity ?? item.defaultQuantity;
      const expectedTotal = typeof item.expectedPrice === "number" ? item.expectedPrice * quantity : null;
      const approvalRequired = config.requireApproval && !(
        typeof config.maxAutoApprovedAmount === "number"
        && typeof expectedTotal === "number"
        && expectedTotal <= config.maxAutoApprovedAmount
      );
      if (quantity < item.minQuantity || quantity > item.maxQuantity) {
        skipped += 1;
        await appendBotMessage(tx, channelId, purchaseBotInfoMessage([
          `${item.name} 수량은 ${item.minQuantity}${item.unitLabel}부터 ${item.maxQuantity}${item.unitLabel}까지만 요청할 수 있습니다.`,
          `요청 수량: ${quantity}${parsed.unitLabel ?? item.unitLabel}`
        ]));
        continue;
      }

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
          approvalRequired,
          status: approvalRequired ? PURCHASE_REQUEST_STATUS.PENDING_APPROVAL : PURCHASE_REQUEST_STATUS.APPROVED
        }
      });

      createdRequests.push(request);
      await appendBotMessage(tx, channelId, purchaseRequestCreatedMessage({
        ...request,
        automationLevel: config.automationLevel || item.automationLevel
      }));
    }

    return {
      handled: true,
      created: createdRequests.length > 0,
      requestId: createdRequests[0]?.id,
      requestIds: createdRequests.map((request) => request.id),
      skipped
    };
  });

  await logBotEvent({
    botAppId: installation.botAppId,
    channelId,
    eventType: "purchase_bot.command",
    status: result.created ? "created" : "skipped",
    requestPayload: { body, requesterId: requester.id, messageId },
    responsePayload: { requestIds: result.requestIds, skipped: result.skipped },
    durationMs: Date.now() - startedAt
  });

  return result;
}

export async function approvePurchaseRequest({ requestId, approver }) {
  const existingForPermission = await prisma.purchaseRequest.findUnique({
    where: { id: requestId },
    select: { id: true, channelId: true }
  });
  if (!existingForPermission) return { error: "Purchase request not found.", status: 404 };

  const installation = existingForPermission.channelId
    ? await lookupPurchaseBotInstallation(existingForPermission.channelId)
    : null;
  const config = installation ? resolvePurchaseBotConfig(installation) : null;
  if (!canApprovePurchaseWithConfig(approver, config)) return { error: "Purchase approval is not allowed.", status: 403 };

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
        automationLevel: config?.automationLevel || existing.item.automationLevel,
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

export async function claimWorkerTask(taskId) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.purchaseWorkerTask.findUnique({
      where: { id: taskId },
      include: { purchaseRequest: true }
    });
    if (!task) return { error: "Worker task not found.", status: 404 };
    if (task.status !== PURCHASE_WORKER_TASK_STATUS.QUEUED) {
      return { error: "Worker task is not queued.", status: 400 };
    }

    const claimed = await tx.purchaseWorkerTask.updateMany({
      where: { id: task.id, status: PURCHASE_WORKER_TASK_STATUS.QUEUED },
      data: {
        status: PURCHASE_WORKER_TASK_STATUS.RUNNING,
        lockedAt: new Date()
      }
    });
    if (claimed.count === 0) return { error: "Worker task is already claimed.", status: 409 };

    const updatedTask = await tx.purchaseWorkerTask.findUnique({
      where: { id: task.id },
      include: { purchaseRequest: true }
    });
    if (!updatedTask) return { error: "Worker task not found.", status: 404 };

    await tx.purchaseRequest.update({
      where: { id: task.purchaseRequestId },
      data: { status: PURCHASE_REQUEST_STATUS.RUNNING }
    });

    return { task: updatedTask };
  });
}

export async function getRunnablePurchaseRequest({ requestId, actor }) {
  const request = await prisma.purchaseRequest.findUnique({
    where: { id: requestId },
    include: { workerTask: true }
  });
  if (!request) return { error: "Purchase request not found.", status: 404 };
  if (actor.role !== "admin" && request.requesterId !== actor.id) return { error: "Purchase worker start is not allowed.", status: 403 };
  if (!request.workerTaskId || !request.workerTask) return { error: "Purchase request has no worker task.", status: 400 };
  if (request.status !== PURCHASE_REQUEST_STATUS.QUEUED || request.workerTask.status !== PURCHASE_WORKER_TASK_STATUS.QUEUED) {
    return { error: "Purchase request is not queued.", status: 400 };
  }
  return { request };
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

    if (updatedRequest.channelId) {
      await appendBotMessage(
        tx,
        updatedRequest.channelId,
        purchaseBotResultMessage(updatedRequest),
        resultAttachments(result, task.id)
      );
    }
    return { request: updatedRequest };
  });
}

function resultAttachments(result, taskId) {
  if (!result.screenshotDataUrl) return [];
  return [{
    id: `purchase-screenshot-${taskId}`,
    name: result.screenshotName ?? `purchase-screenshot-${taskId}.png`,
    type: result.screenshotType ?? "image/png",
    size: result.screenshotSize ?? 0,
    dataUrl: result.screenshotDataUrl,
    storage: "inline"
  }];
}
