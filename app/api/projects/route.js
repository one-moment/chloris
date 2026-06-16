import { requireCurrentUser } from "../../../lib/auth";
import { badRequest, createProjectRecord, readState } from "../../../lib/serverState";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const state = await readState();
  return Response.json({ projects: state.projects });
}

export async function POST(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { name } = await request.json();
  const trimmedName = name?.trim();
  if (!trimmedName) return badRequest("Project name is required.");

  const { project } = createProjectRecord(trimmedName);

  await prisma.project.create({
    data: {
      id: project.id,
      name: project.name,
      description: project.description,
      channels: {
        create: project.channels.map((channel) => ({
          id: channel.id,
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
        }))
      }
    }
  });

  return Response.json(project, { status: 201 });
}
