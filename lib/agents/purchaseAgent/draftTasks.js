import { PURCHASE_REQUEST_STATUS, PURCHASE_WORKER_TASK_STATUS } from "../../purchaseBot/constants";
import { matchPurchaseItems } from "../../purchaseBot/parser";

const VENDOR_LABELS = {
  coupang: "쿠팡",
  swadpia: "성원애드피아",
  gmarket: "지마켓",
  hyundaideco: "현대데코"
};

function nowId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function stringifyJson(value, fallback = []) {
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

function groupByVendor(lines) {
  const grouped = new Map();
  for (const line of lines) {
    const current = grouped.get(line.vendor) ?? [];
    current.push(line);
    grouped.set(line.vendor, current);
  }
  return grouped;
}

function normalizeAutomationLevel(value) {
  return value || "add_to_cart";
}

function adHocPurchaseItemId(line) {
  return `purchaseitem-${line.id}`;
}

function adHocPurchaseRequestId(line) {
  return `pr-${line.id}`;
}

function adHocWorkerTaskId(line) {
  return `task-${line.id}`;
}

async function resolveCoupangItem(tx, line, knownItems) {
  if (line.url) {
    return tx.purchaseItem.upsert({
      where: { id: adHocPurchaseItemId(line) },
      create: {
        id: adHocPurchaseItemId(line),
        name: line.itemName,
        aliasesJson: stringifyJson([line.itemName]),
        vendor: "coupang",
        url: line.url,
        defaultQuantity: line.quantity ?? 1,
        unitLabel: line.unitLabel ?? "개",
        minQuantity: 1,
        maxQuantity: 99999,
        expectedPrice: null,
        maxAllowedPrice: null,
        defaultShippingLocation: "본사",
        approvalRequired: true,
        automationLevel: "add_to_cart",
        isActive: true,
        notes: "Purchase Agent 복수주문 초안에서 생성된 임시 품목입니다."
      },
      update: {
        name: line.itemName,
        aliasesJson: stringifyJson([line.itemName]),
        url: line.url,
        defaultQuantity: line.quantity ?? 1,
        unitLabel: line.unitLabel ?? "개",
        isActive: true
      }
    });
  }

  const matches = matchPurchaseItems({ itemQuery: line.itemName }, knownItems);
  return matches.length === 1 ? matches[0] : null;
}

async function createCoupangRequests({ tx, draft, lines, approver }) {
  const knownItems = await tx.purchaseItem.findMany({
    where: { vendor: "coupang", isActive: true },
    orderBy: { name: "asc" }
  });
  const queuedRequestIds = [];
  let needsItemMatch = 0;

  for (const line of lines) {
    const quantity = line.quantity ?? 1;
    const item = await resolveCoupangItem(tx, line, knownItems);
    if (!item?.url) {
      needsItemMatch += 1;
      await tx.purchaseOrderDraftLine.update({
        where: { id: line.id },
        data: { status: "needs_item_match" }
      });
      continue;
    }

    const request = await tx.purchaseRequest.upsert({
      where: { id: adHocPurchaseRequestId(line) },
      create: {
        id: adHocPurchaseRequestId(line),
        requesterId: draft.requesterId,
        channelId: draft.channelId,
        messageId: draft.messageId,
        itemId: item.id,
        itemName: line.itemName,
        vendor: "coupang",
        url: item.url,
        quantity,
        unitLabel: line.unitLabel ?? item.unitLabel ?? "개",
        expectedPrice: item.expectedPrice,
        maxAllowedPrice: item.maxAllowedPrice,
        shippingLocation: item.defaultShippingLocation ?? "본사",
        approvalRequired: true,
        approvedBy: approver.id,
        approvedAt: new Date(),
        status: PURCHASE_REQUEST_STATUS.QUEUED
      },
      update: {
        itemName: line.itemName,
        url: item.url,
        quantity,
        unitLabel: line.unitLabel ?? item.unitLabel ?? "개",
        approvedBy: approver.id,
        approvedAt: new Date(),
        status: PURCHASE_REQUEST_STATUS.QUEUED,
        resultMessage: null,
        resultScreenshotUrl: null
      }
    });

    const workerTask = await tx.purchaseWorkerTask.upsert({
      where: { purchaseRequestId: request.id },
      create: {
        id: adHocWorkerTaskId(line),
        purchaseRequestId: request.id,
        vendor: "coupang",
        url: request.url,
        quantity: request.quantity,
        automationLevel: normalizeAutomationLevel(item.automationLevel),
        maxAllowedPrice: request.maxAllowedPrice,
        status: PURCHASE_WORKER_TASK_STATUS.QUEUED
      },
      update: {
        vendor: "coupang",
        url: request.url,
        quantity: request.quantity,
        automationLevel: normalizeAutomationLevel(item.automationLevel),
        maxAllowedPrice: request.maxAllowedPrice,
        status: PURCHASE_WORKER_TASK_STATUS.QUEUED,
        resultMessage: null,
        screenshotPath: null,
        observedPrice: null,
        errorCode: null,
        lockedAt: null
      }
    });

    await tx.purchaseRequest.update({
      where: { id: request.id },
      data: { workerTaskId: workerTask.id }
    });
    await tx.purchaseOrderDraftLine.update({
      where: { id: line.id },
      data: { status: "queued" }
    });
    queuedRequestIds.push(request.id);
  }

  return { queuedRequestIds, needsItemMatch };
}

export async function createVendorTasksForApprovedDraft({ tx, draft, approver }) {
  const existingTasks = await tx.purchaseOrderVendorTask.findMany({
    where: { draftId: draft.id }
  });
  if (existingTasks.length > 0) {
    return {
      created: false,
      tasks: existingTasks,
      summaryLines: vendorTaskSummaryLines(existingTasks)
    };
  }

  const grouped = groupByVendor(draft.lines ?? []);
  const tasks = [];

  for (const [vendor, lines] of grouped.entries()) {
    let purchaseRequestIds = [];
    let status = "vendor_bot_needed";
    let resultMessage = `${VENDOR_LABELS[vendor] ?? vendor} 전용 봇 또는 수동 처리 연결이 필요합니다.`;
    let automationLevel = null;

    if (vendor === "coupang") {
      const result = await createCoupangRequests({ tx, draft, lines, approver });
      purchaseRequestIds = result.queuedRequestIds;
      automationLevel = "add_to_cart";
      if (purchaseRequestIds.length === lines.length) {
        status = "queued";
        resultMessage = "쿠팡 장바구니 구성 worker 작업이 생성되었습니다.";
      } else if (purchaseRequestIds.length > 0) {
        status = "partially_queued";
        resultMessage = `쿠팡 ${purchaseRequestIds.length}개 품목은 worker 대기열에 등록했고, ${result.needsItemMatch}개 품목은 상품 URL 또는 매칭 확인이 필요합니다.`;
      } else {
        status = "needs_item_match";
        resultMessage = "쿠팡 품목의 상품 URL 또는 반복구매 품목 매칭이 필요합니다.";
      }
    } else {
      await tx.purchaseOrderDraftLine.updateMany({
        where: { id: { in: lines.map((line) => line.id) } },
        data: { status: "vendor_bot_needed" }
      });
    }

    const task = await tx.purchaseOrderVendorTask.create({
      data: {
        id: nowId("povtask"),
        draftId: draft.id,
        vendor,
        status,
        automationLevel,
        lineIdsJson: stringifyJson(lines.map((line) => line.id)),
        purchaseRequestIdsJson: stringifyJson(purchaseRequestIds),
        resultMessage
      }
    });
    tasks.push(task);
  }

  return {
    created: true,
    tasks,
    summaryLines: vendorTaskSummaryLines(tasks)
  };
}

export function vendorTaskSummaryLines(tasks) {
  return tasks.map((task) => {
    const requestIds = JSON.parse(task.purchaseRequestIdsJson || "[]");
    const lines = JSON.parse(task.lineIdsJson || "[]");
    const queueNote = requestIds.length > 0 ? ` / worker 작업 ${requestIds.length}건` : "";
    return `- ${VENDOR_LABELS[task.vendor] ?? task.vendor}: ${task.status} / ${lines.length}개 품목${queueNote}`;
  });
}
