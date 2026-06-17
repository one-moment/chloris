import "dotenv/config";
import assert from "node:assert/strict";
import { enableChannelAgent } from "../lib/agents/service.js";
import { createVendorTasksForApprovedDraft } from "../lib/agents/purchaseAgent/draftTasks.js";
import { handleMessageWithAgentGateway } from "../lib/agentGateway/service.js";
import { enableChannelBot, PURCHASE_BOT_SLUG } from "../lib/botIntegrations/service.js";
import { prisma } from "../lib/prisma.js";
import { PURCHASE_REQUEST_STATUS } from "../lib/purchaseBot/constants.js";

const runId = `agent-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const projectId = `${runId}-project`;
const channelId = `${runId}-purchase`;
const disabledChannelId = `${runId}-disabled-purchase`;
const itemId = `${runId}-item`;
const admin = {
  id: `${runId}-admin`,
  email: `${runId}-admin@example.com`,
  name: "에이전트 관리자",
  handle: `@${runId}-admin`,
  role: "admin",
  passwordHash: "test"
};
const requester = {
  id: `${runId}-requester`,
  email: `${runId}-requester@example.com`,
  name: "요청자",
  handle: `@${runId}-requester`,
  role: "member",
  passwordHash: "test"
};

async function seedAgentLayer() {
  const purchaseBot = await prisma.botApp.upsert({
    where: { slug: PURCHASE_BOT_SLUG },
    create: {
      id: "botapp-purchase-bot",
      slug: PURCHASE_BOT_SLUG,
      name: "구매봇",
      type: "local_worker",
      status: "active",
      description: "반복 구매 요청을 승인 흐름과 로컬 worker 장바구니 준비 작업으로 연결합니다.",
      eventSubscriptionsJson: JSON.stringify(["message.created"]),
      configJson: JSON.stringify({
        allowedVendors: ["coupang", "swadpia"],
        defaultApproverUserIds: [],
        maxAutoApprovedAmount: null,
        automationLevel: "add_to_cart",
        requireApproval: true
      })
    },
    update: {
      status: "active",
      configJson: JSON.stringify({
        allowedVendors: ["coupang", "swadpia"],
        defaultApproverUserIds: [],
        maxAutoApprovedAmount: null,
        automationLevel: "add_to_cart",
        requireApproval: true
      })
    }
  });

  const agent = await prisma.agentApp.upsert({
    where: { slug: "purchase-agent" },
    create: {
      id: "agentapp-purchase-agent",
      slug: "purchase-agent",
      name: "구매 에이전트",
      role: "purchase",
      status: "active",
      description: "구매 요청을 이해하고 승인 흐름과 공급처 봇/worker 작업을 조율합니다.",
      configJson: JSON.stringify({
        mentions: ["@구매에이전트", "@구매 에이전트"],
        requireApproval: true,
        paymentAutomationAllowed: false
      })
    },
    update: {
      status: "active"
    }
  });

  await prisma.agentTool.upsert({
    where: { agentAppId_slug: { agentAppId: agent.id, slug: "purchase.create_request" } },
    create: {
      id: `${runId}-create-request-tool`,
      agentAppId: agent.id,
      slug: "purchase.create_request",
      name: "구매요청 생성",
      type: "internal_service",
      status: "active",
      botAppId: purchaseBot.id,
      configJson: JSON.stringify({ source: "purchaseBot.handlePurchaseBotCommand" })
    },
    update: {
      status: "active",
      botAppId: purchaseBot.id
    }
  });

  await prisma.agentApp.upsert({
    where: { slug: "hermes-agent" },
    create: {
      id: "agentapp-hermes-agent",
      slug: "hermes-agent",
      name: "헤르메스",
      role: "concierge",
      status: "active",
      description: "발주·예약·입고·폐기를 채팅으로 안내·라우팅하는 업무지원 비서(1단계: 안내만).",
      configJson: JSON.stringify({ mentions: ["@헤르메스", "@hermes", "@Hermes"] })
    },
    update: {
      status: "active"
    }
  });

  return { agent, purchaseBot };
}

async function main() {
  await seedAgentLayer();

  await prisma.user.createMany({ data: [admin, requester] });
  await prisma.project.create({
    data: {
      id: projectId,
      name: "Agent Layer Test",
      description: "agent gateway integration test",
      channels: {
        create: [
          { id: channelId, name: "구매요청", type: "purchase" },
          { id: disabledChannelId, name: "비활성 구매요청", type: "purchase" }
        ]
      }
    }
  });
  await prisma.purchaseItem.create({
    data: {
      id: itemId,
      name: "에이전트테스트소모품",
      aliasesJson: JSON.stringify(["에이전트테스트소모품", "에이전트 테스트 소모품"]),
      vendor: "coupang",
      url: "https://example.test/agent-item",
      defaultQuantity: 1,
      unitLabel: "개",
      minQuantity: 1,
      maxQuantity: 10,
      expectedPrice: 1000,
      maxAllowedPrice: 5000,
      defaultShippingLocation: "본사",
      approvalRequired: true,
      automationLevel: "add_to_cart",
      isActive: true
    }
  });

  await enableChannelBot({
    channelId,
    botId: PURCHASE_BOT_SLUG,
    config: {
      allowedVendors: ["coupang"],
      defaultApproverUserIds: [admin.id],
      maxAutoApprovedAmount: null,
      automationLevel: "add_to_cart",
      requireApproval: true
    },
    actor: admin
  });

  await enableChannelAgent({
    channelId,
    agentId: "purchase-agent",
    config: {
      allowedTools: ["purchase.create_request", "purchase.request_approval", "purchase.enqueue_worker_task"],
      paymentAutomationAllowed: false
    },
    actor: admin
  });

  await enableChannelAgent({ channelId, agentId: "hermes-agent", config: {}, actor: admin });

  const result = await handleMessageWithAgentGateway({
    body: "@구매에이전트 에이전트테스트소모품 3개 주문",
    channelId,
    messageId: `${runId}-message`,
    requester
  });

  assert.equal(result.handled, true);
  assert.equal(result.created, true);
  assert.equal(result.requestIds.length, 1);
  assert.equal(result.approvalRequestIds.length, 1);

  const purchaseRequest = await prisma.purchaseRequest.findUnique({ where: { id: result.requestIds[0] } });
  assert.equal(purchaseRequest.channelId, channelId);
  assert.equal(purchaseRequest.quantity, 3);
  assert.equal(purchaseRequest.status, PURCHASE_REQUEST_STATUS.PENDING_APPROVAL);

  const agentRun = await prisma.agentRun.findUnique({
    where: { id: result.agentRunId },
    include: { toolCalls: true, approvalRequests: true }
  });
  assert.equal(agentRun.status, "completed");
  assert.equal(agentRun.toolCalls.length, 1);
  assert.equal(agentRun.toolCalls[0].toolSlug, "purchase.create_request");
  assert.equal(agentRun.approvalRequests.length, 1);
  assert.equal(agentRun.approvalRequests[0].entityId, purchaseRequest.id);
  assert.equal(agentRun.approvalRequests[0].status, "pending");

  const successMessage = await prisma.message.findFirst({
    where: {
      channelId,
      author: "구매 에이전트",
      body: { contains: "호출된 도구: purchase.create_request" }
    },
    orderBy: { createdAt: "desc" }
  });
  assert.ok(successMessage);
  assert.match(successMessage.body, /최종 결제는 사람이 직접 진행해야 합니다/);

  const disabledResult = await handleMessageWithAgentGateway({
    body: "@구매에이전트 에이전트테스트소모품 3개 주문",
    channelId: disabledChannelId,
    messageId: `${runId}-disabled-message`,
    requester
  });
  assert.equal(disabledResult.handled, false);
  assert.equal(disabledResult.reason, "purchase_agent_not_installed");

  const invalidResult = await handleMessageWithAgentGateway({
    body: "@구매에이전트 에이전트테스트소모품 주문",
    channelId,
    messageId: `${runId}-invalid-message`,
    requester
  });
  assert.equal(invalidResult.handled, true);
  assert.equal(invalidResult.created, false);
  assert.equal(invalidResult.reason, "missing_quantity");

  const invalidRun = await prisma.agentRun.findUnique({ where: { id: invalidResult.agentRunId } });
  assert.equal(invalidRun.status, "skipped");
  const invalidMessage = await prisma.message.findFirst({
    where: {
      channelId,
      author: "구매 에이전트",
      body: { contains: "수량을 확인하지 못했습니다." }
    },
    orderBy: { createdAt: "desc" }
  });
  assert.ok(invalidMessage);

  const unknownResult = await handleMessageWithAgentGateway({
    body: "@구매에이전트 미등록소모품 1개 주문",
    channelId,
    messageId: `${runId}-unknown-message`,
    requester
  });
  assert.equal(unknownResult.handled, true);
  assert.equal(unknownResult.created, false);
  assert.equal(unknownResult.requestIds.length, 0);
  const unknownRun = await prisma.agentRun.findUnique({
    where: { id: unknownResult.agentRunId },
    include: { toolCalls: true, approvalRequests: true }
  });
  assert.equal(unknownRun.status, "skipped");
  assert.equal(unknownRun.toolCalls[0].toolSlug, "purchase.create_request");
  assert.equal(unknownRun.toolCalls[0].status, "skipped");
  assert.equal(unknownRun.approvalRequests.length, 0);

  const bulkResult = await handleMessageWithAgentGateway({
    body: `@구매에이전트
이름/소속 : 유경화/플라워팀
(쿠팡)
-락스 / 1
-버터무드용 스티커 / 1
https://link.coupang.com/a/dU8MJL4A5A
(성원에드피아)
정사각 스티커 (화이트) / 500개
가로명함 / 500개
(지마켓)
-키티 / 30개
(현대데코)
-pa225s / 30개
-pa225m/20개`,
    channelId,
    messageId: `${runId}-bulk-message`,
    requester
  });
  assert.equal(bulkResult.handled, true);
  assert.equal(bulkResult.created, true);
  assert.equal(bulkResult.lineCount, 7);
  assert.equal(bulkResult.vendors.length, 4);

  const draft = await prisma.purchaseOrderDraft.findUnique({
    where: { id: bulkResult.draftId },
    include: { lines: { orderBy: { lineIndex: "asc" } } }
  });
  assert.equal(draft.requesterName, "유경화");
  assert.equal(draft.requesterTeam, "플라워팀");
  assert.equal(draft.lines.length, 7);
  assert.equal(draft.lines.filter((line) => line.vendor === "coupang").length, 2);
  assert.equal(draft.lines.filter((line) => line.vendor === "swadpia").length, 2);

  const bulkRun = await prisma.agentRun.findUnique({
    where: { id: bulkResult.agentRunId },
    include: { toolCalls: true }
  });
  assert.equal(bulkRun.status, "completed");
  assert.equal(bulkRun.toolCalls[0].toolSlug, "purchase.structure_order_draft");

  const draftMessage = await prisma.message.findFirst({
    where: {
      channelId,
      author: "구매 에이전트",
      body: { contains: "구매요청서 초안을 만들었습니다." }
    },
    orderBy: { createdAt: "desc" }
  });
  assert.ok(draftMessage);
  assert.match(draftMessage.body, /거래처: 쿠팡, 성원애드피아, 지마켓, 현대데코/);

  const approvedDraft = await prisma.purchaseOrderDraft.update({
    where: { id: draft.id },
    data: { status: "approved" },
    include: { lines: { orderBy: { lineIndex: "asc" } } }
  });
  const conversion = await prisma.$transaction((tx) => createVendorTasksForApprovedDraft({
    tx,
    draft: approvedDraft,
    approver: admin
  }));
  assert.equal(conversion.tasks.length, 4);
  const coupangTask = conversion.tasks.find((task) => task.vendor === "coupang");
  assert.equal(coupangTask.status, "partially_queued");
  assert.equal(JSON.parse(coupangTask.purchaseRequestIdsJson).length, 1);

  const queuedPurchaseRequest = await prisma.purchaseRequest.findFirst({
    where: {
      requesterId: requester.id,
      itemName: "버터무드용 스티커"
    },
    include: { workerTask: true }
  });
  assert.ok(queuedPurchaseRequest);
  assert.equal(queuedPurchaseRequest.status, PURCHASE_REQUEST_STATUS.QUEUED);
  assert.equal(queuedPurchaseRequest.workerTask.status, "queued");

  // 헤르메스 2단계: 키 없음 → 분류 skip → 1단계 안내로 안전 degrade.
  // 이 DB 통합 테스트는 degrade 경로를 결정적으로 검증한다 — OPENAI_API_KEY를 강제 unset해 실 OpenAI 호출을 막는다.
  // (실제 분류·라우팅 확인은 §4.2에서 사람이 키를 넣고 dev에서 한다.)
  const savedHermesKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const hermesResult = await handleMessageWithAgentGateway({
    body: "@헤르메스 안녕",
    channelId,
    messageId: `${runId}-hermes-message`,
    requester
  });
  assert.equal(hermesResult.handled, true);
  assert.equal(hermesResult.action, "help");

  const hermesRun = await prisma.agentRun.findUnique({ where: { id: hermesResult.agentRunId } });
  assert.equal(hermesRun.status, "completed");

  const hermesMessage = await prisma.message.findFirst({
    where: { channelId, author: "헤르메스" },
    orderBy: { createdAt: "desc" }
  });
  assert.ok(hermesMessage);
  assert.match(hermesMessage.body, /업무지원 비서 헤르메스/);

  // 회귀: 헤르메스 미설치 채널에서는 @헤르메스가 헤르메스로 처리되지 않고 통과
  const hermesDisabledResult = await handleMessageWithAgentGateway({
    body: "@헤르메스 안녕",
    channelId: disabledChannelId,
    messageId: `${runId}-hermes-disabled-message`,
    requester
  });
  assert.equal(hermesDisabledResult.handled, false);

  if (savedHermesKey !== undefined) process.env.OPENAI_API_KEY = savedHermesKey;

  console.log("agent layer tests passed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.approvalRequest.deleteMany({ where: { requesterId: requester.id } }).catch(() => {});
    await prisma.agentToolCall.deleteMany({ where: { agentRun: { requesterId: requester.id } } }).catch(() => {});
    await prisma.agentRun.deleteMany({ where: { requesterId: requester.id } }).catch(() => {});
    await prisma.purchaseOrderDraft.deleteMany({ where: { requesterId: requester.id } }).catch(() => {});
    await prisma.purchaseRequest.deleteMany({ where: { requesterId: requester.id } }).catch(() => {});
    await prisma.purchaseItem.deleteMany({ where: { notes: { contains: "Purchase Agent 복수주문" } } }).catch(() => {});
    await prisma.purchaseItem.deleteMany({ where: { id: itemId } }).catch(() => {});
    await prisma.channelAgentInstallation.deleteMany({ where: { channelId } }).catch(() => {});
    await prisma.channelBotInstallation.deleteMany({ where: { channelId } }).catch(() => {});
    await prisma.botEventLog.deleteMany({ where: { channelId } }).catch(() => {});
    await prisma.message.deleteMany({ where: { channelId: { in: [channelId, disabledChannelId] } } }).catch(() => {});
    await prisma.channel.deleteMany({ where: { id: { in: [channelId, disabledChannelId] } } }).catch(() => {});
    await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, requester.id] } } }).catch(() => {});
    await prisma.$disconnect();
  });
