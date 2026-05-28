import { createInitialState } from "../../../lib/initialData";
import { badRequest, readState, writeState } from "../../../lib/serverState";

export async function GET() {
  return Response.json(await readState());
}

export async function PUT(request) {
  const state = await request.json();
  if (!state?.projects?.[0]?.channels || !state?.bots) {
    return badRequest("Invalid app state payload.");
  }

  return Response.json(await writeState(state));
}

export async function DELETE() {
  const initialState = createInitialState();
  return Response.json(await writeState(initialState));
}
