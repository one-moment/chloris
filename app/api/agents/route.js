import { requireCurrentUser } from "../../../lib/auth";
import { listAgents } from "../../../lib/agents/service";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function GET() {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const agents = await listAgents();
  return Response.json({ agents });
}
