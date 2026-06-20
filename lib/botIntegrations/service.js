import { createHmac } from "node:crypto";
import { createSecureToken, hashSecret } from "../auth";
import { prisma } from "../prisma";

export const PURCHASE_BOT_SLUG = "purchase-bot";

export const DEFAULT_PURCHASE_BOT_CONFIG = {
  allowedVendors: ["coupang", "swadpia"],
  defaultApproverUserIds: [],
  maxAutoApprovedAmount: null,
  automationLevel: "add_to_cart",
  requireApproval: true
};

function nowId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function isBotAdmin(user) {
  return user?.role === "admin";
}

export function parseJsonObject(value, fallback = {}) {
  try {
    const parsed = JSON.parse(value ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function parseJsonArray(value, fallback = []) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function stringifyJson(value, fallback) {
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

export function normalizePurchaseBotConfig(config = {}) {
  const allowedVendors = Array.isArray(config.allowedVendors)
    ? config.allowedVendors.map((vendor) => String(vendor).trim()).filter(Boolean)
    : DEFAULT_PURCHASE_BOT_CONFIG.allowedVendors;
  const defaultApproverUserIds = Array.isArray(config.defaultApproverUserIds)
    ? config.defaultApproverUserIds.map((userId) => String(userId).trim()).filter(Boolean)
    : DEFAULT_PURCHASE_BOT_CONFIG.defaultApproverUserIds;
  const maxAutoApprovedAmount = Number.isFinite(Number(config.maxAutoApprovedAmount))
    ? Number(config.maxAutoApprovedAmount)
    : null;
  const automationLevel = String(config.automationLevel || DEFAULT_PURCHASE_BOT_CONFIG.automationLevel).trim();
  const requireApproval = typeof config.requireApproval === "boolean"
    ? config.requireApproval
    : DEFAULT_PURCHASE_BOT_CONFIG.requireApproval;

  return {
    allowedVendors,
    defaultApproverUserIds,
    maxAutoApprovedAmount,
    automationLevel,
    requireApproval
  };
}

export function serializeBotApp(botApp) {
  if (!botApp) return null;
  return {
    id: botApp.id,
    slug: botApp.slug,
    name: botApp.name,
    type: botApp.type,
    status: botApp.status,
    description: botApp.description,
    webhookUrl: botApp.webhookUrl,
    hasSigningSecret: Boolean(botApp.signingSecretHash),
    eventSubscriptions: parseJsonArray(botApp.eventSubscriptionsJson),
    config: parseJsonObject(botApp.configJson),
    createdAt: botApp.createdAt,
    updatedAt: botApp.updatedAt
  };
}

export function serializeChannelBotInstallation(installation) {
  if (!installation) return null;
  return {
    id: installation.id,
    botAppId: installation.botAppId,
    channelId: installation.channelId,
    enabled: installation.enabled,
    config: parseJsonObject(installation.configJson),
    enabledAt: installation.enabledAt,
    disabledAt: installation.disabledAt,
    createdAt: installation.createdAt,
    updatedAt: installation.updatedAt,
    bot: serializeBotApp(installation.botApp)
  };
}

export async function getBotAppByIdOrSlug(botId) {
  return prisma.botApp.findFirst({
    where: {
      OR: [
        { id: botId },
        { slug: botId }
      ]
    }
  });
}

export async function listBots() {
  const bots = await prisma.botApp.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] });
  return bots.map(serializeBotApp);
}

export async function getChannelBotInstallation({ channelId, slug }) {
  return prisma.channelBotInstallation.findFirst({
    where: {
      channelId,
      enabled: true,
      botApp: {
        slug,
        status: "active"
      }
    },
    include: { botApp: true }
  });
}

export async function getPurchaseBotInstallation(channelId) {
  const installation = await getChannelBotInstallation({ channelId, slug: PURCHASE_BOT_SLUG });
  if (installation?.botApp?.slug !== PURCHASE_BOT_SLUG) return null;
  return installation;
}

export function resolvePurchaseBotConfig(installation) {
  const appConfig = parseJsonObject(installation?.botApp?.configJson, DEFAULT_PURCHASE_BOT_CONFIG);
  const channelConfig = parseJsonObject(installation?.configJson, {});
  return normalizePurchaseBotConfig({
    ...DEFAULT_PURCHASE_BOT_CONFIG,
    ...appConfig,
    ...channelConfig
  });
}

export async function listChannelBots(channelId) {
  const [bots, channelInstallations] = await Promise.all([
    prisma.botApp.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] }),
    prisma.channelBotInstallation.findMany({
      where: { channelId },
      include: { botApp: true },
      orderBy: { updatedAt: "desc" }
    })
  ]);

  const byBotId = new Map(channelInstallations.map((installation) => [installation.botAppId, installation]));
  return bots.map((bot) => {
    const installation = byBotId.get(bot.id);
    return {
      bot: serializeBotApp(bot),
      installation: serializeChannelBotInstallation(installation),
      enabled: Boolean(installation?.enabled)
    };
  });
}

async function requireAdminResult(actor) {
  if (!isBotAdmin(actor)) return { error: "Bot administration is not allowed.", status: 403 };
  return null;
}

export async function installBot({ botId, projectId, channelId, config = {}, actor }) {
  const forbidden = await requireAdminResult(actor);
  if (forbidden) return forbidden;

  const botApp = await getBotAppByIdOrSlug(botId);
  if (!botApp) return { error: "Bot app not found.", status: 404 };

  const channel = channelId
    ? await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true, projectId: true } })
    : null;
  if (channelId && !channel) return { error: "Channel not found.", status: 404 };

  const resolvedProjectId = projectId ?? channel?.projectId;
  const project = resolvedProjectId
    ? await prisma.project.findUnique({ where: { id: resolvedProjectId }, select: { id: true } })
    : null;
  if (resolvedProjectId && !project) return { error: "Project not found.", status: 404 };

  const installation = resolvedProjectId
    ? await prisma.botInstallation.upsert({
      where: { botAppId_projectId: { botAppId: botApp.id, projectId: resolvedProjectId } },
      create: {
        id: nowId("botinst"),
        botAppId: botApp.id,
        projectId: resolvedProjectId,
        status: "installed",
        configJson: "{}",
        installedById: actor.id
      },
      update: {
        status: "installed",
        installedById: actor.id
      }
    }).catch(async () => {
      const existing = await prisma.botInstallation.findFirst({
        where: { botAppId: botApp.id, projectId: resolvedProjectId }
      });
      if (existing) return existing;
      throw new Error("Failed to install bot.");
    })
    : null;

  const channelInstallation = channelId
    ? await enableChannelBot({ channelId, botId: botApp.id, config, actor })
    : null;
  if (channelInstallation?.error) return channelInstallation;

  return {
    bot: serializeBotApp(botApp),
    installation,
    channelInstallation: channelInstallation?.installation ?? null
  };
}

export async function enableChannelBot({ channelId, botId, config = {}, actor }) {
  const forbidden = await requireAdminResult(actor);
  if (forbidden) return forbidden;

  const botApp = await getBotAppByIdOrSlug(botId);
  if (!botApp) return { error: "Bot app not found.", status: 404 };

  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true } });
  if (!channel) return { error: "Channel not found.", status: 404 };

  const existing = await prisma.channelBotInstallation.findUnique({
    where: { botAppId_channelId: { botAppId: botApp.id, channelId } },
    include: { botApp: true }
  });
  const mergedConfig = {
    ...parseJsonObject(botApp.configJson, {}),
    ...parseJsonObject(existing?.configJson, {}),
    ...config
  };

  const installation = await prisma.channelBotInstallation.upsert({
    where: { botAppId_channelId: { botAppId: botApp.id, channelId } },
    create: {
      id: nowId("chanbot"),
      botAppId: botApp.id,
      channelId,
      enabled: true,
      enabledAt: new Date(),
      disabledAt: null,
      installedById: actor.id,
      configJson: stringifyJson(mergedConfig, {})
    },
    update: {
      enabled: true,
      enabledAt: new Date(),
      disabledAt: null,
      installedById: actor.id,
      configJson: stringifyJson(mergedConfig, {})
    },
    include: { botApp: true }
  });

  await logBotEvent({
    botAppId: botApp.id,
    channelId,
    eventType: "bot.enabled",
    status: "ok",
    requestPayload: { actorId: actor.id, config: mergedConfig }
  });

  return { installation: serializeChannelBotInstallation(installation) };
}

export async function disableChannelBot({ channelId, botId, actor }) {
  const forbidden = await requireAdminResult(actor);
  if (forbidden) return forbidden;

  const botApp = await getBotAppByIdOrSlug(botId);
  if (!botApp) return { error: "Bot app not found.", status: 404 };

  const installation = await prisma.channelBotInstallation.findUnique({
    where: { botAppId_channelId: { botAppId: botApp.id, channelId } },
    include: { botApp: true }
  });
  if (!installation) return { error: "Channel bot installation not found.", status: 404 };

  const updated = await prisma.channelBotInstallation.update({
    where: { id: installation.id },
    data: {
      enabled: false,
      disabledAt: new Date()
    },
    include: { botApp: true }
  });

  await logBotEvent({
    botAppId: botApp.id,
    channelId,
    eventType: "bot.disabled",
    status: "ok",
    requestPayload: { actorId: actor.id }
  });

  return { installation: serializeChannelBotInstallation(updated) };
}

export async function updateChannelBotConfig({ channelId, botId, config = {}, actor }) {
  const forbidden = await requireAdminResult(actor);
  if (forbidden) return forbidden;

  const botApp = await getBotAppByIdOrSlug(botId);
  if (!botApp) return { error: "Bot app not found.", status: 404 };

  const installation = await prisma.channelBotInstallation.findUnique({
    where: { botAppId_channelId: { botAppId: botApp.id, channelId } },
    include: { botApp: true }
  });
  if (!installation) return { error: "Channel bot installation not found.", status: 404 };

  const nextConfig = {
    ...parseJsonObject(installation.configJson, {}),
    ...config
  };
  const updated = await prisma.channelBotInstallation.update({
    where: { id: installation.id },
    data: { configJson: stringifyJson(nextConfig, {}) },
    include: { botApp: true }
  });

  await logBotEvent({
    botAppId: botApp.id,
    channelId,
    eventType: "bot.config.updated",
    status: "ok",
    requestPayload: { actorId: actor.id, config: nextConfig }
  });

  return { installation: serializeChannelBotInstallation(updated) };
}

export async function issueBotCredential({
  botId,
  installationId = null,
  channelBotInstallationId = null,
  name = "API token",
  scopes = [],
  actor
}) {
  const forbidden = await requireAdminResult(actor);
  if (forbidden) return forbidden;

  const botApp = await getBotAppByIdOrSlug(botId);
  if (!botApp) return { error: "Bot app not found.", status: 404 };

  const token = createSecureToken(32);
  const credential = await prisma.botCredential.create({
    data: {
      id: nowId("botcred"),
      botAppId: botApp.id,
      installationId,
      channelBotInstallationId,
      name,
      tokenHash: hashSecret(token),
      scopesJson: stringifyJson(scopes, []),
      createdById: actor.id
    },
    select: {
      id: true,
      botAppId: true,
      installationId: true,
      channelBotInstallationId: true,
      name: true,
      scopesJson: true,
      createdById: true,
      createdAt: true
    }
  });

  return {
    token,
    credential: {
      ...credential,
      scopes: parseJsonArray(credential.scopesJson)
    }
  };
}

export async function logBotEvent({
  botAppId,
  channelId = null,
  eventType,
  status,
  requestPayload = {},
  responsePayload = {},
  error = null,
  durationMs = null
}) {
  try {
    return await prisma.botEventLog.create({
      data: {
        id: nowId("botlog"),
        botAppId,
        channelId,
        eventType,
        status,
        requestPayloadJson: stringifyJson(requestPayload, {}),
        responsePayloadJson: stringifyJson(responsePayload, {}),
        error: error ? String(error).slice(0, 2000) : null,
        durationMs
      }
    });
  } catch (logError) {
    console.error("bot_event_log_failed", logError);
    return null;
  }
}

export function signWebhookPayload(payload, signingSecret) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return createHmac("sha256", signingSecret).update(body).digest("hex");
}

export async function dispatchBotEvent({ channelId, eventType, payload }) {
  const startedAt = Date.now();
  const installations = await prisma.channelBotInstallation.findMany({
    where: {
      channelId,
      enabled: true,
      botApp: {
        type: "external",
        status: "active"
      }
    },
    include: { botApp: true }
  });

  for (const installation of installations) {
    const subscriptions = parseJsonArray(installation.botApp.eventSubscriptionsJson);
    if (!subscriptions.includes(eventType)) continue;

    await logBotEvent({
      botAppId: installation.botAppId,
      channelId,
      eventType,
      status: "prepared",
      requestPayload: {
        channelBotInstallationId: installation.id,
        webhookUrl: installation.botApp.webhookUrl,
        eventType,
        payload
      },
      responsePayload: {
        delivery: "skeleton",
        note: "External webhook dispatch is prepared but not sent in this MVP."
      },
      durationMs: Date.now() - startedAt
    });
  }
}
