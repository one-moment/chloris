import { requireCurrentUser } from "../../../../lib/auth";
import { badRequest, notFound } from "../../../../lib/serverState";
import { prisma } from "../../../../lib/prisma";

export async function PATCH(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (user.role !== "admin") {
    return Response.json({ error: "Only admins can change channel settings." }, { status: 403 });
  }

  const { channelId } = await params;
  const { branchId } = await request.json();
  if (branchId === undefined) return badRequest("No changes provided.");

  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true } });
  if (!channel) return notFound("Channel not found.");

  let resolvedBranchId = null;
  if (branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } });
    if (!branch) return badRequest("Branch not found.");
    resolvedBranchId = branch.id;
  }

  const updated = await prisma.channel.update({
    where: { id: channelId },
    data: { branchId: resolvedBranchId },
    select: { id: true, branchId: true }
  });

  return Response.json(updated);
}

export async function DELETE(_request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { channelId } = await params;
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, projectId: true }
  });
  if (!channel) return notFound("Channel not found.");

  const channelCount = await prisma.channel.count({ where: { projectId: channel.projectId } });
  if (channelCount <= 1) return badRequest("At least one channel must remain in the project.");

  await prisma.channel.delete({ where: { id: channelId } });

  const nextChannel = await prisma.channel.findFirst({
    where: { projectId: channel.projectId },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });

  return Response.json({
    deletedChannelId: channelId,
    projectId: channel.projectId,
    selectedChannelId: nextChannel?.id
  });
}
