export function canEditRecord(user, record) {
  if (!user || !record) return false;
  if (user.role === "admin") return true;
  if (record.authorId && record.authorId === user.id) return true;
  return Boolean(record.author && record.author === user.name);
}

export const CHANNEL_MEMBER_STATUS = {
  ACTIVE: "active",
  PENDING: "pending",
  INVITED: "invited"
};

export const CHANNEL_MEMBER_ROLE = {
  OWNER: "owner",
  MEMBER: "member"
};

// 전역 admin 이거나, 해당 채널의 owner 멤버십을 가진 사용자만 멤버를 관리할 수 있다.
// membership 은 요청 사용자의 해당 채널 ChannelMember 레코드(없으면 null).
export function canManageChannelMembers(user, membership) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return Boolean(membership && membership.role === CHANNEL_MEMBER_ROLE.OWNER);
}
