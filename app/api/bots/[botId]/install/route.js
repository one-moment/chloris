import { requireCurrentUser } from "../../../../../lib/auth";
import { installBot } from "../../../../../lib/botIntegrations/service";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function POST(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { botId } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await installBot({
    botId,
    projectId: body.projectId,
    channelId: body.channelId,
    config: body.config ?? {},
    actor: user
  });
  if (result.error) return Response.json({ error: result.error }, { status: result.status });

  return Response.json(result, { status: 201 });
}
