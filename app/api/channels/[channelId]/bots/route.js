import { requireCurrentUser } from "../../../../../lib/auth";
import { listChannelBots } from "../../../../../lib/botIntegrations/service";
import { prisma } from "../../../../../lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function GET(_request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { channelId } = await params;
  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true } });
  if (!channel) return Response.json({ error: "Channel not found." }, { status: 404 });

  const bots = await listChannelBots(channelId);
  return Response.json({ bots });
}
