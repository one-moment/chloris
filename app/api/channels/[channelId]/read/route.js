import { requireCurrentUser } from "../../../../../lib/auth";
import { notFound } from "../../../../../lib/serverState";
import { prisma } from "../../../../../lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

function isMissingReadStateTableError(error) {
  return error?.code === "P2021" || String(error?.message ?? "").includes("ChannelReadState");
}

export async function POST(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { channelId } = await params;
  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true } });
  if (!channel) return notFound("Channel not found.");

  const now = new Date();
  try {
    await prisma.channelReadState.upsert({
      where: { userId_channelId: { userId: user.id, channelId } },
      create: {
        id: `read-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        userId: user.id,
        channelId,
        lastReadAt: now
      },
      update: { lastReadAt: now }
    });
  } catch (error) {
    if (isMissingReadStateTableError(error)) {
      return Response.json({ ok: false, reason: "read_state_table_unavailable" });
    }
    throw error;
  }

  return Response.json({ ok: true, lastReadAt: now.toISOString() });
}
