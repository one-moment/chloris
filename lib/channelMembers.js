import { CHANNEL_MEMBER_ROLE, CHANNEL_MEMBER_STATUS } from "./permissions";

export function memberId() {
  return `cmember-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// API 응답용 직렬화. user 가 include 되어 있으면 표시용 정보를 함께 내려준다.
export function serializeMember(member) {
  return {
    id: member.id,
    channelId: member.channelId,
    userId: member.userId,
    status: member.status,
    role: member.role,
    invitedById: member.invitedById ?? null,
    createdAt: member.createdAt,
    user: member.user
      ? {
          id: member.user.id,
          name: member.user.name,
          handle: member.user.handle,
          email: member.user.email,
          role: member.user.role
        }
      : null
  };
}

// 채널 생성자를 owner/active 멤버로 등록한다. 이미 멤버면 그대로 둔다.
// owner 자동 등록은 부가 작업이므로, 실패하더라도(예: 마이그레이션 전 테이블 부재)
// 채널/프로젝트 생성 자체를 깨뜨리지 않도록 에러를 삼키고 로깅만 한다.
export async function addOwnerMembership(client, channelId, userId) {
  if (!channelId || !userId) return null;
  try {
    return await client.channelMember.upsert({
      where: { channelId_userId: { channelId, userId } },
      update: {},
      create: {
        id: memberId(),
        channelId,
        userId,
        status: CHANNEL_MEMBER_STATUS.ACTIVE,
        role: CHANNEL_MEMBER_ROLE.OWNER
      }
    });
  } catch (error) {
    console.error("addOwnerMembership failed", error);
    return null;
  }
}
