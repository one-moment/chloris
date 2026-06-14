import { prisma } from "../prisma";

function isMissingAgentTableError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /AgentApp|AgentRun|AgentTool|ApprovalRequest|ChannelAgentInstallation|does not exist|no such table/i.test(message);
}

function nowId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseJsonObject(value, fallback = {}) {
  try {
    const parsed = JSON.parse(value ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function stringifyJson(value, fallback = {}) {
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

export function isAgentAdmin(user) {
  return user?.role === "admin";
}

export function serializeAgentApp(agentApp) {
  if (!agentApp) return null;
  return {
    id: agentApp.id,
    slug: agentApp.slug,
    name: agentApp.name,
    role: agentApp.role,
    status: agentApp.status,
    description: agentApp.description,
    config: parseJsonObject(agentApp.configJson, {}),
    createdAt: agentApp.createdAt,
    updatedAt: agentApp.updatedAt
  };
}

export function serializeChannelAgentInstallation(installation) {
  if (!installation) return null;
  return {
    id: installation.id,
    agentAppId: installation.agentAppId,
    channelId: installation.channelId,
    enabled: installation.enabled,
    config: parseJsonObject(installation.configJson, {}),
    enabledAt: installation.enabledAt,
    disabledAt: installation.disabledAt,
    agent: serializeAgentApp(installation.agentApp)
  };
}

export async function listAgents() {
  if (!prisma.agentApp) return [];
  try {
    const agents = await prisma.agentApp.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] });
    return agents.map(serializeAgentApp);
  } catch (error) {
    if (isMissingAgentTableError(error)) return [];
    throw error;
  }
}

export async function getAgentAppByIdOrSlug(agentId) {
  if (!prisma.agentApp) return null;
  try {
    return await prisma.agentApp.findFirst({
      where: {
        OR: [
          { id: agentId },
          { slug: agentId }
        ]
      }
    });
  } catch (error) {
    if (isMissingAgentTableError(error)) return null;
    throw error;
  }
}

export async function listChannelAgents(channelId) {
  if (!prisma.agentApp || !prisma.channelAgentInstallation) return [];
  let agents = [];
  let installations = [];
  try {
    [agents, installations] = await Promise.all([
      prisma.agentApp.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] }),
      prisma.channelAgentInstallation.findMany({
        where: { channelId },
        include: { agentApp: true },
        orderBy: { updatedAt: "desc" }
      })
    ]);
  } catch (error) {
    if (isMissingAgentTableError(error)) return [];
    throw error;
  }

  const byAgentId = new Map(installations.map((installation) => [installation.agentAppId, installation]));
  return agents.map((agent) => {
    const installation = byAgentId.get(agent.id);
    return {
      agent: serializeAgentApp(agent),
      installation: serializeChannelAgentInstallation(installation),
      enabled: Boolean(installation?.enabled)
    };
  });
}

async function requireAgentAdminResult(actor) {
  if (!isAgentAdmin(actor)) return { error: "Agent administration is not allowed.", status: 403 };
  return null;
}

export async function enableChannelAgent({ channelId, agentId, config = {}, actor }) {
  const forbidden = await requireAgentAdminResult(actor);
  if (forbidden) return forbidden;

  const agentApp = await getAgentAppByIdOrSlug(agentId);
  if (!agentApp) return { error: "Agent app not found.", status: 404 };

  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true } });
  if (!channel) return { error: "Channel not found.", status: 404 };

  const existing = await prisma.channelAgentInstallation.findUnique({
    where: { agentAppId_channelId: { agentAppId: agentApp.id, channelId } },
    include: { agentApp: true }
  });
  const nextConfig = {
    ...parseJsonObject(agentApp.configJson, {}),
    ...parseJsonObject(existing?.configJson, {}),
    ...config
  };

  const installation = await prisma.channelAgentInstallation.upsert({
    where: { agentAppId_channelId: { agentAppId: agentApp.id, channelId } },
    create: {
      id: nowId("chanagent"),
      agentAppId: agentApp.id,
      channelId,
      enabled: true,
      enabledAt: new Date(),
      disabledAt: null,
      installedById: actor.id,
      configJson: stringifyJson(nextConfig, {})
    },
    update: {
      enabled: true,
      enabledAt: new Date(),
      disabledAt: null,
      installedById: actor.id,
      configJson: stringifyJson(nextConfig, {})
    },
    include: { agentApp: true }
  });

  return { installation: serializeChannelAgentInstallation(installation) };
}

export async function disableChannelAgent({ channelId, agentId, actor }) {
  const forbidden = await requireAgentAdminResult(actor);
  if (forbidden) return forbidden;

  const agentApp = await getAgentAppByIdOrSlug(agentId);
  if (!agentApp) return { error: "Agent app not found.", status: 404 };

  const installation = await prisma.channelAgentInstallation.findUnique({
    where: { agentAppId_channelId: { agentAppId: agentApp.id, channelId } },
    include: { agentApp: true }
  });
  if (!installation) return { error: "Channel agent installation not found.", status: 404 };

  const updated = await prisma.channelAgentInstallation.update({
    where: { id: installation.id },
    data: {
      enabled: false,
      disabledAt: new Date()
    },
    include: { agentApp: true }
  });

  return { installation: serializeChannelAgentInstallation(updated) };
}

export async function updateChannelAgentConfig({ channelId, agentId, config = {}, actor }) {
  const forbidden = await requireAgentAdminResult(actor);
  if (forbidden) return forbidden;

  const agentApp = await getAgentAppByIdOrSlug(agentId);
  if (!agentApp) return { error: "Agent app not found.", status: 404 };

  const installation = await prisma.channelAgentInstallation.findUnique({
    where: { agentAppId_channelId: { agentAppId: agentApp.id, channelId } },
    include: { agentApp: true }
  });
  if (!installation) return { error: "Channel agent installation not found.", status: 404 };

  const nextConfig = {
    ...parseJsonObject(installation.configJson, {}),
    ...config
  };
  const updated = await prisma.channelAgentInstallation.update({
    where: { id: installation.id },
    data: { configJson: stringifyJson(nextConfig, {}) },
    include: { agentApp: true }
  });

  return { installation: serializeChannelAgentInstallation(updated) };
}
