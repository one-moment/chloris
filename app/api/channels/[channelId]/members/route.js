import { requireCurrentUser } from "../../../../../lib/auth";
import { badRequest, notFound } from "../../../../../lib/serverState";
import {
  canManageChannelMembers,
  CHANNEL_MEMBER_ROLE,
  CHANNEL_MEMBER_STATUS
} from "../../../../../lib/permissions";
import { memberId, serializeMember } from "../../../../../lib/channelMembers";
import { prisma } from "../../../../../lib/prisma";

const VALID_STATUSES = Object.values(CHANNEL_MEMBER_STATUS);

async function loadRequesterMembership(channelId, userId) {
  return prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } }
  });
}

// 멤버 목록 / 대기 요청 목록 보기 (관리자 또는 채널 owner)
export async function GET(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { channelId } = await params;
  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true } });
  if (!channel) return notFound("Channel not found.");

  const membership = await loadRequesterMembership(channelId, user.id);
  if (!canManageChannelMembers(user, membership)) {
    return Response.json({ error: "Admin or channel owner role required." }, { status: 403 });
  }

  const statusFilter = request.nextUrl.searchParams.get("status")?.trim();
  if (statusFilter && !VALID_STATUSES.includes(statusFilter)) {
    return badRequest("Invalid status filter.");
  }

  const members = await prisma.channelMember.findMany({
    where: { channelId, ...(statusFilter ? { status: statusFilter } : {}) },
    orderBy: { createdAt: "asc" },
    include: { user: true }
  });

  return Response.json({ members: members.map(serializeMember) });
}

// 초대하기 (관리자 또는 채널 owner) — 대상 사용자를 invited 상태로 추가
export async function POST(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { channelId } = await params;
  const { userId } = await request.json();
  if (!userId) return badRequest("userId is required.");
  if (userId === user.id) return badRequest("자기 자신은 초대할 수 없습니다.");

  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true } });
  if (!channel) return notFound("Channel not found.");

  const membership = await loadRequesterMembership(channelId, user.id);
  if (!canManageChannelMembers(user, membership)) {
    return Response.json({ error: "Admin or channel owner role required." }, { status: 403 });
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) return notFound("User not found.");

  const existing = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } }
  });
  if (existing) {
    if (existing.status === CHANNEL_MEMBER_STATUS.ACTIVE) return badRequest("이미 채널 멤버입니다.");
    if (existing.status === CHANNEL_MEMBER_STATUS.INVITED) return badRequest("이미 초대된 사용자입니다.");
    if (existing.status === CHANNEL_MEMBER_STATUS.PENDING) {
      return badRequest("참가 요청이 대기 중입니다. 요청을 승인해주세요.");
    }
  }

  let created;
  try {
    created = await prisma.channelMember.create({
      data: {
        id: memberId(),
        channelId,
        userId,
        status: CHANNEL_MEMBER_STATUS.INVITED,
        role: CHANNEL_MEMBER_ROLE.MEMBER,
        invitedById: user.id
      },
      include: { user: true }
    });
  } catch (error) {
    // 동시 중복 요청으로 unique(channelId,userId) 충돌 시 친화적 응답으로 변환.
    if (error?.code === "P2002") return badRequest("이미 멤버이거나 초대된 사용자입니다.");
    throw error;
  }

  return Response.json({ member: serializeMember(created) }, { status: 201 });
}
