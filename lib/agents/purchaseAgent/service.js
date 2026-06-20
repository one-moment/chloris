import { prisma } from "../../prisma";
import {
  callCreatePurchaseRequestTool,
  callStructurePurchaseOrderDraftTool,
  createPurchaseApprovalRequests,
  purchaseOrderDraftMessage
} from "./tools";
import { parseBulkPurchaseOrder } from "./bulkOrderParser";
import { isPurchaseAgentCommand, PURCHASE_AGENT_SLUG, validatePurchaseAgentCommand } from "./prompts";

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

async function appendPurchaseAgentMessage(channelId, lines) {
  return prisma.message.create({
    data: {
      id: nowId("msg"),
      channelId,
      author: "구매 에이전트",
      body: ["구매 에이전트", "", ...lines].join("\n"),
      attachmentsJson: "[]",
      bot: true
    }
  });
}

function invalidCommandLines(reason) {
  const examples = [
    "예: @구매에이전트 키친타올 2개 주문",
    "예: @구매에이전트 A4용지 5개 주문"
  ];

  if (reason === "missing_quantity" || reason === "invalid_quantity") {
    return [
      "수량을 확인하지 못했습니다.",
      "품목명과 수량을 함께 입력해주세요.",
      ...examples
    ];
  }

  if (reason === "missing_item") {
    return [
      "품목명을 확인하지 못했습니다.",
      "등록된 반복구매 품목명과 수량을 함께 입력해주세요.",
      ...examples
    ];
  }

  return [
    "아직 처리할 수 없는 구매 요청 형식입니다.",
    "현재 v1에서는 품목명과 수량이 들어간 주문 문장만 지원합니다.",
    ...examples
  ];
}

function successLines({ result, approvals }) {
  if (!result?.created) {
    return [
      "구매요청을 생성하지 못했습니다.",
      "등록된 반복구매 품목명과 수량을 다시 확인해주세요.",
      "호출된 도구: purchase.create_request",
      "최종 결제는 사람이 직접 진행해야 합니다."
    ];
  }

  return [
    "구매요청 생성이 완료되었습니다.",
    `생성된 구매요청: ${(result.requestIds ?? []).length}건`,
    approvals.length > 0 ? `승인 대기: ${approvals.length}건` : "승인 대기: 없음",
    "호출된 도구: purchase.create_request",
    "장바구니 구성 이후 최종 결제는 사람이 직접 진행해야 합니다."
  ];
}

export async function getPurchaseAgentInstallation(channelId) {
  if (!prisma.agentApp) return null;
  return prisma.channelAgentInstallation.findFirst({
    where: {
      channelId,
      enabled: true,
      agentApp: {
        slug: PURCHASE_AGENT_SLUG,
        status: "active"
      }
    },
    include: {
      agentApp: {
        include: { tools: true }
      }
    }
  });
}

export async function runPurchaseAgent({ body, channelId, messageId, requester }) {
  if (!isPurchaseAgentCommand(body)) return { handled: false, reason: "not_purchase_agent_command" };

  const installation = await getPurchaseAgentInstallation(channelId);
  if (!installation) {
    return { handled: false, reason: "purchase_agent_not_installed" };
  }

  const validation = validatePurchaseAgentCommand(body);
  const createRequestTool = installation.agentApp.tools.find((tool) => tool.slug === "purchase.create_request");
  const structureOrderTool = installation.agentApp.tools.find((tool) => tool.slug === "purchase.structure_order_draft");
  const bulkOrder = parseBulkPurchaseOrder(body);
  const run = await prisma.agentRun.create({
    data: {
      id: nowId("agentrun"),
      agentAppId: installation.agentAppId,
      channelId,
      messageId,
      requesterId: requester.id,
      status: validation.valid || bulkOrder.isBulkOrder ? "running" : "skipped",
      inputText: body,
      intentJson: stringifyJson({
        source: "deterministic_mention",
        agent: PURCHASE_AGENT_SLUG,
        action: bulkOrder.isBulkOrder
          ? "purchase.structure_order_draft"
          : validation.valid
            ? "purchase.create_request"
            : "unsupported_command",
        validation,
        bulkOrder: bulkOrder.isBulkOrder
          ? {
            lineCount: bulkOrder.lines.length,
            vendors: [...new Set(bulkOrder.lines.map((line) => line.vendor))]
          }
          : null
      })
    }
  });

  try {
    if (bulkOrder.isBulkOrder) {
      const { draft } = await callStructurePurchaseOrderDraftTool({
        agentRun: run,
        tool: structureOrderTool,
        parsedOrder: bulkOrder,
        channelId,
        messageId,
        requester
      });
      await appendPurchaseAgentMessage(channelId, purchaseOrderDraftMessage(draft).split("\n"));
      const output = {
        handled: true,
        created: true,
        draftId: draft.id,
        lineCount: draft.lines.length,
        vendors: [...new Set(draft.lines.map((line) => line.vendor))],
        requestIds: [],
        approvalRequestIds: [],
        skipped: 0
      };
      const updated = await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: "completed",
          outputJson: stringifyJson(output)
        }
      });
      return { ...output, agentRunId: updated.id };
    }

    if (!validation.valid) {
      await appendPurchaseAgentMessage(channelId, invalidCommandLines(validation.reason));
      const output = {
        handled: true,
        created: false,
        requestIds: [],
        approvalRequestIds: [],
        skipped: 1,
        reason: validation.reason
      };
      await prisma.agentRun.update({
        where: { id: run.id },
        data: { outputJson: stringifyJson(output) }
      });
      return { ...output, agentRunId: run.id };
    }

    const { result } = await callCreatePurchaseRequestTool({
      agentRun: run,
      tool: createRequestTool,
      body,
      channelId,
      messageId,
      requester
    });

    const approvals = await createPurchaseApprovalRequests({
      agentRun: run,
      channelId,
      requester,
      requestIds: result?.requestIds ?? []
    });

    const output = {
      handled: true,
      created: Boolean(result?.created),
      requestIds: result?.requestIds ?? [],
      approvalRequestIds: approvals.map((approval) => approval.id),
      skipped: result?.skipped ?? 0
    };

    await appendPurchaseAgentMessage(channelId, successLines({ result, approvals }));

    const updated = await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: output.created ? "completed" : "skipped",
        outputJson: stringifyJson(output)
      }
    });

    return { ...output, agentRunId: updated.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        error: message.slice(0, 2000)
      }
    });
    throw error;
  }
}
