import { requireCurrentUser } from "../../../../../../../lib/auth";
import { disableChannelAgent } from "../../../../../../../lib/agents/service";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function POST(_request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { channelId, agentId } = await params;
  const result = await disableChannelAgent({ channelId, agentId, actor: user });
  if (result.error) return Response.json({ error: result.error }, { status: result.status });

  return Response.json(result);
}
