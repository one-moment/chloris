import { requireCurrentUser } from "../../../lib/auth";
import { badRequest, createProjectRecord, readState, updateState } from "../../../lib/serverState";

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

  const created = await updateState((state) => {
    const { project, firstChannel } = createProjectRecord(trimmedName);
    state.projects.push(project);
    state.selectedProjectId = project.id;
    state.selectedChannelId = firstChannel.id;
    return project;
  });

  return Response.json(created, { status: 201 });
}
