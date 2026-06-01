import { requireCurrentUser } from "../../../../../lib/auth";
import { badRequest, createFileRecord, findChannelContext, notFound, updateState } from "../../../../../lib/serverState";

export async function POST(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { channelId } = await params;
  const { name, source } = await request.json();
  const trimmedName = name?.trim();
  if (!trimmedName) return badRequest("File name is required.");

  const created = await updateState((state) => {
    const context = findChannelContext(state, channelId);
    if (!context) return null;

    const file = createFileRecord({ name: trimmedName, source });
    context.channel.files.unshift(file);
    return file;
  });

  if (!created) return notFound("Channel not found.");
  return Response.json(created, { status: 201 });
}
