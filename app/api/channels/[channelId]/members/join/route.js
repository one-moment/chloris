import { requireCurrentUser } from "../../../../../../lib/auth";
import { badRequest, notFound } from "../../../../../../lib/serverState";
import { CHANNEL_MEMBER_ROLE, CHANNEL_MEMBER_STATUS } from "../../../../../../lib/permissions";
import { memberId, serializeMember } from "../../../../../../lib/channelMembers";
import { prisma } from "../../../../../../lib/prisma";

// 참가 요청하기 (로그인 사용자 본인) — pending 상태로 등록
export async function POST(_request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { channelId } = await params;
  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true } });
  if (!channel) return notFound("Channel not found.");

  const existing = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: user.id } }
  });
  if (existing) {
    if (existing.status === CHANNEL_MEMBER_STATUS.ACTIVE) return badRequest("이미 채널 멤버입니다.");
    if (existing.status === CHANNEL_MEMBER_STATUS.PENDING) return badRequest("이미 참가 요청이 대기 중입니다.");
    if (existing.status === CHANNEL_MEMBER_STATUS.INVITED) {
      return badRequest("이미 초대를 받았습니다. 초대를 수락해주세요.");
    }
  }

  let created;
  try {
    created = await prisma.channelMember.create({
      data: {
        id: memberId(),
        channelId,
        userId: user.id,
        status: CHANNEL_MEMBER_STATUS.PENDING,
        role: CHANNEL_MEMBER_ROLE.MEMBER
      },
      include: { user: true }
    });
  } catch (error) {
    // 동시 중복 요청으로 unique(channelId,userId) 충돌 시 친화적 응답으로 변환.
    if (error?.code === "P2002") return badRequest("이미 참가 요청이 처리되었습니다.");
    throw error;
  }

  return Response.json({ member: serializeMember(created) }, { status: 201 });
}
