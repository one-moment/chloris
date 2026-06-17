import { prisma } from "../../prisma";
import { isModuleEnabled } from "../../brand";
import { classifyJson } from "../llm";
import {
  buildReservationPrefillQuery,
  buildRouteMessageLines,
  buildWorkIntentMessages,
  HERMES_AGENT_SLUG,
  HERMES_HELP_LINES,
  isHermesAgentCommand,
  stripHermesAgentMention,
  WORK_ROUTES
} from "./prompts";

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
    // 분류는 자체 try/catch로 감싼다 — 키없음·파싱실패·API/네트워크 throw 등 어떤 실패든 안전 degrade(area/reservation=null).
    let area = null;
    let reservation = null;
    try {
      const cls = await classifyJson({ messages: buildWorkIntentMessages(stripHermesAgentMention(body)) });
      if (cls?.ok) {
        area = cls.data?.area ?? null;
        reservation = cls.data?.reservation ?? null;
      }
    } catch {
      area = null;
      reservation = null;
    }

    const route = area ? WORK_ROUTES[area] : null;
    const canRoute = Boolean(route) && area !== "other" && isModuleEnabled(route.moduleSlug);

    // 3단계: area=reservation이고 비PII 예약정보가 있으면 미리채운 양식 링크 안내(없으면 일반 라우트/도움말로 degrade).
    const prefillQuery = area === "reservation" && canRoute ? buildReservationPrefillQuery(reservation) : "";
    let action;
    let href = null;
    let lines;
    if (prefillQuery) {
      const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { branchId: true } });
      const branchPart = channel?.branchId ? `&branch=${encodeURIComponent(channel.branchId)}` : "";
      href = `/work/reservations?new=1&channel=${encodeURIComponent(channelId)}${branchPart}&${prefillQuery}`;
      action = "reservation_prefill";
      lines = ["예약 정보를 채워뒀어요. 확인하고 제출해 주세요:", href];
    } else if (canRoute) {
      action = "route";
      href = route.href;
      lines = buildRouteMessageLines(route);
    } else {
      action = "help";
      lines = HERMES_HELP_LINES;
    }

    await appendHermesAgentMessage(channelId, lines);
    const output = {
      handled: true,
      action,
      area: area ?? null,
      href
    };
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
