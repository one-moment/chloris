import { runPurchaseAgent } from "../agents/purchaseAgent/service";
import { isHermesAgentCommand } from "../agents/hermes/prompts";
import { runHermesAgent } from "../agents/hermes/service";

function isMissingAgentTableError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /AgentApp|AgentRun|AgentTool|ApprovalRequest|ChannelAgentInstallation|does not exist|no such table/i.test(message);
}

export async function handleMessageWithAgentGateway({ body, channelId, messageId, requester }) {
  try {
    if (isHermesAgentCommand(body)) {
      const hermesResult = await runHermesAgent({ body, channelId, messageId, requester });
      if (hermesResult.handled) return hermesResult;
    }
    return await runPurchaseAgent({ body, channelId, messageId, requester });
  } catch (error) {
    if (isMissingAgentTableError(error)) {
      console.warn("agent_gateway_tables_unavailable", error instanceof Error ? error.message : String(error));
      return { handled: false, reason: "agent_tables_unavailable" };
    }
    console.error("agent_gateway_failed", error);
    return { handled: false, reason: "agent_gateway_failed" };
  }
}
