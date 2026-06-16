import { requireCurrentUser } from "../../../../../../lib/auth";
import { badRequest, notFound } from "../../../../../../lib/serverState";
import { CHANNEL_MEMBER_STATUS } from "../../../../../../lib/permissions";
import { serializeMember } from "../../../../../../lib/channelMembers";
import { prisma } from "../../../../../../lib/prisma";

// 초대 수락 (로그인 사용자 본인) — invited -> active
export async function POST(_request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { channelId } = await params;
  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true } });
  if (!channel) return notFound("Channel not found.");

  const membership = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: user.id } }
  });
  if (!membership) return notFound("초대 내역이 없습니다.");
  if (membership.status === CHANNEL_MEMBER_STATUS.ACTIVE) return badRequest("이미 채널 멤버입니다.");
  if (membership.status === CHANNEL_MEMBER_STATUS.PENDING) {
    return badRequest("참가 요청은 관리자 승인이 필요합니다.");
  }

  const updated = await prisma.channelMember.update({
    where: { id: membership.id },
    data: { status: CHANNEL_MEMBER_STATUS.ACTIVE },
    include: { user: true }
  });

  return Response.json({ member: serializeMember(updated) });
}
