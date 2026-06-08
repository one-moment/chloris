import { prisma } from "../../prisma";
import { handlePurchaseBotCommand } from "../../purchaseBot/service";
import { toPurchaseBotCommand } from "./prompts";
import { VENDOR_LABELS } from "./bulkOrderParser";

function nowId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function stringifyJson(value, fallback = {}) {
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

export async function callCreatePurchaseRequestTool({ agentRun, tool, body, channelId, messageId, requester }) {
  const startedAt = Date.now();
  const translatedBody = toPurchaseBotCommand(body);
  const requestPayload = {
    source: "purchase-agent",
    originalBody: body,
    translatedBody,
    channelId,
    messageId,
    requesterId: requester.id
  };

  let toolCall = null;
  try {
    const result = await handlePurchaseBotCommand({
      body: translatedBody,
      channelId,
      messageId,
      requester
    });

    toolCall = await prisma.agentToolCall.create({
      data: {
        id: nowId("agenttoolcall"),
        agentRunId: agentRun.id,
        agentToolId: tool?.id ?? null,
        toolSlug: "purchase.create_request",
        toolType: "internal_service",
        status: result?.created ? "ok" : "skipped",
        requestJson: stringifyJson(requestPayload),
        responseJson: stringifyJson(result ?? {}),
        durationMs: Date.now() - startedAt
      }
    });

    return { result, toolCall };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.agentToolCall.create({
      data: {
        id: nowId("agenttoolcall"),
        agentRunId: agentRun.id,
        agentToolId: tool?.id ?? null,
        toolSlug: "purchase.create_request",
        toolType: "internal_service",
        status: "error",
        requestJson: stringifyJson(requestPayload),
        responseJson: "{}",
        error: message.slice(0, 2000),
        durationMs: Date.now() - startedAt
      }
    });
    throw error;
  }
}

export async function callStructurePurchaseOrderDraftTool({ agentRun, tool, parsedOrder, channelId, messageId, requester }) {
  const startedAt = Date.now();
  const requestPayload = {
    source: "purchase-agent",
    requesterId: requester.id,
    channelId,
    messageId,
    lineCount: parsedOrder.lines.length
  };

  try {
    const draft = await prisma.purchaseOrderDraft.create({
      data: {
        id: nowId("podraft"),
        requesterId: requester.id,
        channelId,
        messageId,
        requesterName: parsedOrder.requesterName,
        requesterTeam: parsedOrder.requesterTeam,
        status: "draft",
        sourceText: parsedOrder.sourceText,
        lines: {
          create: parsedOrder.lines.map((line) => ({
            id: nowId("podraftline"),
            lineIndex: line.lineIndex,
            vendor: line.vendor,
            itemName: line.itemName,
            quantity: line.quantity,
            unitLabel: line.unitLabel,
            url: line.url,
            notes: line.notes,
            rawText: line.rawText,
            status: line.url || line.vendor !== "coupang" ? "needs_review" : "needs_item_match"
          }))
        }
      },
      include: { lines: { orderBy: { lineIndex: "asc" } } }
    });

    const toolCall = await prisma.agentToolCall.create({
      data: {
        id: nowId("agenttoolcall"),
        agentRunId: agentRun.id,
        agentToolId: tool?.id ?? null,
        toolSlug: "purchase.structure_order_draft",
        toolType: "internal_service",
        status: "ok",
        requestJson: stringifyJson(requestPayload),
        responseJson: stringifyJson({
          draftId: draft.id,
          lineCount: draft.lines.length,
          vendors: [...new Set(draft.lines.map((line) => line.vendor))]
        }),
        durationMs: Date.now() - startedAt
      }
    });

    return { draft, toolCall };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.agentToolCall.create({
      data: {
        id: nowId("agenttoolcall"),
        agentRunId: agentRun.id,
        agentToolId: tool?.id ?? null,
        toolSlug: "purchase.structure_order_draft",
        toolType: "internal_service",
        status: "error",
        requestJson: stringifyJson(requestPayload),
        responseJson: "{}",
        error: message.slice(0, 2000),
        durationMs: Date.now() - startedAt
      }
    });
    throw error;
  }
}

export function purchaseOrderDraftMessage(draft) {
  const linesByVendor = new Map();
  for (const line of draft.lines) {
    const current = linesByVendor.get(line.vendor) ?? [];
    current.push(line);
    linesByVendor.set(line.vendor, current);
  }

  const vendorSections = [...linesByVendor.entries()].flatMap(([vendor, lines]) => [
    "",
    `[${VENDOR_LABELS[vendor] ?? vendor}]`,
    ...lines.map((line) => {
      const quantity = line.quantity ? ` / ${line.quantity}${line.unitLabel ?? ""}` : " / 수량 확인 필요";
      const url = line.url ? " / URL 있음" : "";
      const notes = line.notes ? ` / ${line.notes}` : "";
      return `- ${line.itemName}${quantity}${url}${notes}`;
    })
  ]);

  return [
    "구매요청서 초안을 만들었습니다.",
    "",
    draft.requesterName || draft.requesterTeam
      ? `요청자: ${draft.requesterName ?? "미등록"}${draft.requesterTeam ? ` / ${draft.requesterTeam}` : ""}`
      : "요청자: 메시지 작성자 기준",
    `초안 ID: ${draft.id}`,
    `총 품목: ${draft.lines.length}개`,
    `거래처: ${[...linesByVendor.keys()].map((vendor) => VENDOR_LABELS[vendor] ?? vendor).join(", ")}`,
    ...vendorSections,
    "",
    "다음 단계: 누락 옵션과 수량을 확인한 뒤 거래처별 작업으로 분리합니다.",
    "최종 결제는 사람이 직접 진행해야 합니다."
  ].join("\n");
}

export async function createPurchaseApprovalRequests({ agentRun, channelId, requester, requestIds = [] }) {
  if (!requestIds.length) return [];

  const requests = await prisma.purchaseRequest.findMany({
    where: { id: { in: requestIds } },
    select: {
      id: true,
      itemName: true,
      quantity: true,
      unitLabel: true,
      vendor: true,
      expectedPrice: true,
      maxAllowedPrice: true,
      status: true
    }
  });

  const created = [];
  for (const request of requests) {
    const approval = await prisma.approvalRequest.create({
      data: {
        id: nowId("approval"),
        agentRunId: agentRun.id,
        channelId,
        requesterId: requester.id,
        subject: `${request.itemName} ${request.quantity}${request.unitLabel} 구매 승인`,
        body: [
          "Purchase Agent 승인 요청",
          "",
          `품목: ${request.itemName}`,
          `수량: ${request.quantity}${request.unitLabel}`,
          `공급처: ${request.vendor}`,
          request.expectedPrice ? `예상금액: ${request.expectedPrice.toLocaleString("ko-KR")}원` : null,
          request.maxAllowedPrice ? `가격상한: ${request.maxAllowedPrice.toLocaleString("ko-KR")}원` : null,
          "",
          "장바구니 구성 후 최종 결제는 사람이 직접 진행해야 합니다."
        ].filter(Boolean).join("\n"),
        status: "pending",
        entityType: "purchase_request",
        entityId: request.id
      }
    });
    created.push(approval);
  }

  return created;
}
