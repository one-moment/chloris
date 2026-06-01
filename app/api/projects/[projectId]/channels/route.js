import { requireCurrentUser } from "../../../../../lib/auth";
import { badRequest, createChannelRecord, findProject, notFound, readState, updateState } from "../../../../../lib/serverState";

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
  const { name, type } = await request.json();
  const trimmedName = name?.trim();
  if (!trimmedName) return badRequest("Channel name is required.");

  const created = await updateState((state) => {
    const project = findProject(state, projectId);
    if (!project) return null;

    const channel = createChannelRecord({ name: trimmedName, type });
    project.channels.push(channel);
    state.selectedProjectId = project.id;
    state.selectedChannelId = channel.id;
    return channel;
  });

  if (!created) return notFound("Project not found.");
  return Response.json(created, { status: 201 });
}
