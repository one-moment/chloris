import { requireCurrentUser } from "../../../../../lib/auth";
import { badRequest, createChannelRecord, findProject, notFound, readState } from "../../../../../lib/serverState";
import { prisma } from "../../../../../lib/prisma";

export async function GET(_request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { projectId } = await params;
  const project = findProject(await readState(), projectId);
  if (!project) return notFound("Project not found.");

  return Response.json({ channels: project.channels });
}

export async function POST(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { projectId } = await params;
  const { name, type, branchId } = await request.json();
  const trimmedName = name?.trim();
  if (!trimmedName) return badRequest("Channel name is required.");

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return notFound("Project not found.");

  let resolvedBranchId = null;
  if (branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } });
    if (!branch) return badRequest("Branch not found.");
    resolvedBranchId = branch.id;
  }

  const channel = createChannelRecord({ name: trimmedName, type });
  await prisma.channel.create({
    data: {
      id: channel.id,
      projectId,
      branchId: resolvedBranchId,
      name: channel.name,
      type: channel.type,
      messages: {
        create: channel.messages.map((message) => ({
          id: message.id,
          authorId: message.authorId,
          author: message.author,
          body: message.body,
          attachmentsJson: JSON.stringify(message.attachments ?? []),
          bot: Boolean(message.bot)
        }))
      }
    }
  });

  return Response.json({ ...channel, branchId: resolvedBranchId }, { status: 201 });
}
