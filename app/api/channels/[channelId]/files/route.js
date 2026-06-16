import { requireCurrentUser } from "../../../../../lib/auth";
import { badRequest, createFileRecord, notFound } from "../../../../../lib/serverState";
import { prisma } from "../../../../../lib/prisma";

export async function POST(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { channelId } = await params;
  const { name, source } = await request.json();
  const trimmedName = name?.trim();
  if (!trimmedName) return badRequest("File name is required.");

  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true } });
  if (!channel) return notFound("Channel not found.");

  const file = createFileRecord({ name: trimmedName, source });
  await prisma.file.create({
    data: {
      id: file.id,
      channelId,
      name: file.name,
      source: file.source
    }
  });

  return Response.json(file, { status: 201 });
}
