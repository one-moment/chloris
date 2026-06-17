import { prisma } from "../../prisma";
import { HERMES_AGENT_SLUG, HERMES_HELP_LINES, isHermesAgentCommand } from "./prompts";

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

async function appendHermesAgentMessage(channelId, lines) {
  return prisma.message.create({
    data: {
      id: nowId("msg"),
      channelId,
      author: "헤르메스",
      body: ["헤르메스", "", ...lines].join("\n"),
      attachmentsJson: "[]",
      bot: true
    }
  });
}

export async function getHermesInstallation(channelId) {
  if (!prisma.agentApp) return null;
  return prisma.channelAgentInstallation.findFirst({
    where: {
      channelId,
      enabled: true,
      agentApp: {
        slug: HERMES_AGENT_SLUG,
        status: "active"
      }
    },
    include: {
      agentApp: true
    }
  });
}

export async function runHermesAgent({ body, channelId, messageId, requester }) {
  if (!isHermesAgentCommand(body)) return { handled: false, reason: "not_hermes_command" };

  const installation = await getHermesInstallation(channelId);
  if (!installation) {
    return { handled: false, reason: "hermes_not_installed" };
  }

  const run = await prisma.agentRun.create({
    data: {
      id: nowId("agentrun"),
      agentAppId: installation.agentAppId,
      channelId,
      messageId,
      requesterId: requester.id,
      status: "running",
      inputText: body,
      intentJson: stringifyJson({
        source: "deterministic_mention",
        agent: HERMES_AGENT_SLUG,
        action: "help"
      })
    }
  });

  try {
    await appendHermesAgentMessage(channelId, HERMES_HELP_LINES);
    const output = { handled: true, action: "help" };
    const updated = await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
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
