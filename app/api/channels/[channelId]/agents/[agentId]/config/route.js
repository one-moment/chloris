import { requireCurrentUser } from "../../../../../../../lib/auth";
import { updateChannelAgentConfig } from "../../../../../../../lib/agents/service";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function PATCH(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { channelId, agentId } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await updateChannelAgentConfig({
    channelId,
    agentId,
    config: body.config ?? body,
    actor: user
  });
  if (result.error) return Response.json({ error: result.error }, { status: result.status });

  return Response.json(result);
}
