import { createInitialState } from "../../../lib/initialData";
import { requireCurrentUser } from "../../../lib/auth";
import { badRequest, readState, writeState } from "../../../lib/serverState";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function GET() {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  return Response.json(await readState());
}

export async function PUT(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const state = await request.json();
  if (!state?.projects?.[0]?.channels || !state?.bots) {
    return badRequest("Invalid app state payload.");
  }

  return Response.json(await writeState(state));
}

export async function DELETE() {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const initialState = createInitialState();
  return Response.json(await writeState(initialState));
}
