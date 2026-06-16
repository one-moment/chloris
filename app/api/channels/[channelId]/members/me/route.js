import { requireCurrentUser } from "../../../../../../lib/auth";
import { notFound } from "../../../../../../lib/serverState";
import { canManageChannelMembers } from "../../../../../../lib/permissions";
import { serializeMember } from "../../../../../../lib/channelMembers";
import { prisma } from "../../../../../../lib/prisma";

// 현재 사용자의 해당 채널 멤버십 상태 조회 (로그인 사용자 본인)
// UI 가 참가 요청 / 초대 수락 / 상태 표시 중 무엇을 보여줄지 결정하는 데 사용한다.
export async function GET(_request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { channelId } = await params;
  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true } });
  if (!channel) return notFound("Channel not found.");

  const membership = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: user.id } },
    include: { user: true }
  });

  return Response.json({
    membership: membership ? serializeMember(membership) : null,
    canManage: canManageChannelMembers(user, membership)
  });
}
