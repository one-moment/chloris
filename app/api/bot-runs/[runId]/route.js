import { createFileRecord, findChannelContext, notFound, readState, updateBotRunForAction, updateState } from "../../../../lib/serverState";

function findRunContext(state, runId) {
  for (const project of state.projects) {
    for (const channel of project.channels) {
      const runIndex = channel.botRuns.findIndex((run) => run.id === runId);
      if (runIndex >= 0) return { project, channel, runIndex, run: channel.botRuns[runIndex] };
    }
  }
  return null;
}

export async function GET(_request, { params }) {
  const { runId } = await params;
  const context = findRunContext(await readState(), runId);
  if (!context) return notFound("Bot run not found.");

  return Response.json(context.run);
}

export async function PATCH(request, { params }) {
  const { runId } = await params;
  const { action } = await request.json();

  const updated = await updateState((state) => {
    const context = findRunContext(state, runId);
    if (!context) return null;

    const nextRun = updateBotRunForAction(context.run, context.channel.type, action);
    context.channel.botRuns[context.runIndex] = nextRun;

    if (action === "complete" && context.channel.type === "purchase") {
      context.channel.files.unshift(createFileRecord({ name: "purchase-review-draft.json", source: "Codex 구매봇" }));
    } else if (action === "complete" && nextRun.payload?.sheetSync) {
      context.channel.files.unshift(createFileRecord({
        name: `${nextRun.payload.sheetSync.target}-sync-log.json`,
        source: nextRun.botName
      }));
    }

    return nextRun;
  });

  if (!updated) return notFound("Bot run not found.");
  return Response.json(updated);
}
