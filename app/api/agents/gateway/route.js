import { requireCurrentUser } from "../../../../lib/auth";
import { handleMessageWithAgentGateway } from "../../../../lib/agentGateway/service";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function POST(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (!body.channelId || !body.messageId || !body.body) {
    return Response.json({ error: "channelId, messageId, and body are required." }, { status: 400 });
  }

  const result = await handleMessageWithAgentGateway({
    body: body.body,
    channelId: body.channelId,
    messageId: body.messageId,
    requester: user
  });

  return Response.json(result);
}
