import "dotenv/config";
import assert from "node:assert/strict";
import { hashSecret } from "../lib/auth.js";
import {
  disableChannelBot,
  enableChannelBot,
  issueBotCredential,
  installBot,
  PURCHASE_BOT_SLUG,
  updateChannelBotConfig
} from "../lib/botIntegrations/service.js";
import { prisma } from "../lib/prisma.js";
import { PURCHASE_REQUEST_STATUS } from "../lib/purchaseBot/constants.js";
import { handlePurchaseBotCommand } from "../lib/purchaseBot/service.js";

const runId = `bot-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const admin = {
  id: `${runId}-admin`,
  email: `${runId}-admin@example.com`,
  name: "봇 관리자",
  handle: `@${runId}-admin`,
  role: "admin",
  passwordHash: "test"
};
const member = {
  id: `${runId}-member`,
  email: `${runId}-member@example.com`,
  name: "일반 사용자",
  handle: `@${runId}-member`,
  role: "member",
  passwordHash: "test"
};
const itemId = `${runId}-item`;
const projectId = `${runId}-project`;
const installedChannelId = `${runId}-installed`;
const uninstalledChannelId = `${runId}-uninstalled`;
const disabledChannelId = `${runId}-disabled`;
let externalBot = null;

async function countRequests(channelId) {
  return prisma.purchaseRequest.count({ where: { channelId } });
}

async function main() {
  await prisma.botApp.upsert({
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
      name: "구매봇",
      type: "local_worker",
      status: "active",
      eventSubscriptionsJson: JSON.stringify(["message.created"])
    }
  });

  externalBot = await prisma.botApp.create({
    data: {
      id: `${runId}-external-bot`,
      slug: `${runId}-external`,
      name: "외부 테스트 봇",
      type: "external",
      status: "active",
      webhookUrl: "https://example.test/bot",
      signingSecretHash: hashSecret("external-secret"),
      eventSubscriptionsJson: JSON.stringify(["message.created"])
    }
  });

  await prisma.user.createMany({ data: [admin, member] });
  await prisma.project.create({
    data: {
      id: projectId,
      name: "Bot Integration Test",
      description: "integration test project",
      channels: {
        create: [
          { id: installedChannelId, name: "installed", type: "general" },
          { id: uninstalledChannelId, name: "uninstalled", type: "general" },
          { id: disabledChannelId, name: "disabled", type: "general" }
        ]
      }
    }
  });
  await prisma.purchaseItem.create({
    data: {
      id: itemId,
      name: "테스트소모품",
      aliasesJson: JSON.stringify(["테스트소모품", "테스트 소모품"]),
      vendor: "coupang",
      url: "https://example.test/item",
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

  const projectInstall = await installBot({
    botId: PURCHASE_BOT_SLUG,
    projectId,
    actor: admin
  });
  assert.equal(projectInstall.bot.slug, PURCHASE_BOT_SLUG);

  const nonAdminEnable = await enableChannelBot({
    channelId: installedChannelId,
    botId: PURCHASE_BOT_SLUG,
    actor: member
  });
  assert.equal(nonAdminEnable.status, 403);

  await enableChannelBot({
    channelId: installedChannelId,
    botId: PURCHASE_BOT_SLUG,
    config: {
      allowedVendors: ["coupang"],
      defaultApproverUserIds: [member.id],
      maxAutoApprovedAmount: 5000,
      automationLevel: "open_page",
      requireApproval: true
    },
    actor: admin
  });

  const installedResult = await handlePurchaseBotCommand({
    body: "@구매봇 테스트소모품 3개 주문",
    channelId: installedChannelId,
    messageId: `${runId}-message-installed`,
    requester: member
  });
  assert.equal(installedResult.created, true);
  assert.equal(installedResult.requestIds.length, 1);

  const createdRequest = await prisma.purchaseRequest.findUnique({ where: { id: installedResult.requestId } });
  assert.equal(createdRequest.quantity, 3);
  assert.equal(createdRequest.status, PURCHASE_REQUEST_STATUS.APPROVED);
  assert.equal(createdRequest.approvalRequired, false);

  const uninstalledBefore = await countRequests(uninstalledChannelId);
  const uninstalledResult = await handlePurchaseBotCommand({
    body: "@구매봇 테스트소모품 2개 주문",
    channelId: uninstalledChannelId,
    messageId: `${runId}-message-uninstalled`,
    requester: member
  });
  assert.equal(uninstalledResult.created, false);
  assert.equal(await countRequests(uninstalledChannelId), uninstalledBefore);

  await enableChannelBot({
    channelId: disabledChannelId,
    botId: PURCHASE_BOT_SLUG,
    actor: admin
  });
  await disableChannelBot({
    channelId: disabledChannelId,
    botId: PURCHASE_BOT_SLUG,
    actor: admin
  });
  const disabledBefore = await countRequests(disabledChannelId);
  const disabledResult = await handlePurchaseBotCommand({
    body: "@구매봇 테스트소모품 1개 주문",
    channelId: disabledChannelId,
    messageId: `${runId}-message-disabled`,
    requester: member
  });
  assert.equal(disabledResult.created, false);
  assert.equal(await countRequests(disabledChannelId), disabledBefore);

  await updateChannelBotConfig({
    channelId: installedChannelId,
    botId: PURCHASE_BOT_SLUG,
    config: { allowedVendors: ["swadpia"], requireApproval: true },
    actor: admin
  });
  const excludedVendorResult = await handlePurchaseBotCommand({
    body: "@구매봇 테스트소모품 1개 주문",
    channelId: installedChannelId,
    messageId: `${runId}-message-excluded-vendor`,
    requester: member
  });
  assert.equal(excludedVendorResult.created, false);

  const credentialResult = await issueBotCredential({
    botId: externalBot.id,
    name: "external bot test token",
    scopes: ["message.created"],
    actor: admin
  });
  assert.ok(credentialResult.token);
  assert.equal(credentialResult.credential.tokenHash, undefined);

  const storedCredential = await prisma.botCredential.findUnique({
    where: { id: credentialResult.credential.id }
  });
  assert.notEqual(storedCredential.tokenHash, credentialResult.token);
  assert.equal(storedCredential.tokenHash, hashSecret(credentialResult.token));

  console.log("bot integration tests passed");
}

try {
  await main();
} finally {
  await prisma.purchaseRequest.deleteMany({ where: { itemId } }).catch(() => {});
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.purchaseItem.deleteMany({ where: { id: itemId } });
  if (externalBot?.id) await prisma.botApp.deleteMany({ where: { id: externalBot.id } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: [admin.id, member.id] } } });
  await prisma.$disconnect();
}
