import { requireCurrentUser } from "../../../lib/auth";
import { listBots } from "../../../lib/botIntegrations/service";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function GET() {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const bots = await listBots();
  return Response.json({ bots });
}
