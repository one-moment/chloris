import { requireCurrentUser } from "../../../../../../lib/auth";
import { badRequest, notFound } from "../../../../../../lib/serverState";
import { canManageChannelMembers, CHANNEL_MEMBER_STATUS } from "../../../../../../lib/permissions";
import { serializeMember } from "../../../../../../lib/channelMembers";
import { prisma } from "../../../../../../lib/prisma";

// 참가 요청 승인 / 거절 (관리자 또는 채널 owner)
export async function PATCH(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { channelId, memberId: targetMemberId } = await params;
  const { action } = await request.json();
  if (!["approve", "reject"].includes(action)) return badRequest("action must be 'approve' or 'reject'.");

  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true } });
  if (!channel) return notFound("Channel not found.");

  const requesterMembership = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: user.id } }
  });
  if (!canManageChannelMembers(user, requesterMembership)) {
    return Response.json({ error: "Admin or channel owner role required." }, { status: 403 });
  }

  const member = await prisma.channelMember.findUnique({
    where: { id: targetMemberId },
    include: { user: true }
  });
  if (!member || member.channelId !== channelId) return notFound("Member not found.");
  if (member.status !== CHANNEL_MEMBER_STATUS.PENDING) {
    return badRequest("대기 중인 참가 요청만 승인하거나 거절할 수 있습니다.");
  }

  if (action === "approve") {
    const updated = await prisma.channelMember.update({
      where: { id: member.id },
      data: { status: CHANNEL_MEMBER_STATUS.ACTIVE },
      include: { user: true }
    });
    return Response.json({ member: serializeMember(updated) });
  }

  // reject: 대기 요청 레코드를 삭제해 사용자가 다시 요청할 수 있게 한다.
  await prisma.channelMember.delete({ where: { id: member.id } });
  return Response.json({ deletedMemberId: member.id, channelId });
}
