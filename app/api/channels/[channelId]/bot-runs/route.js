import { buildAutomationPayload, makeBotRun } from "../../../../../lib/automation";
import { createMessageRecord, findChannelContext, notFound, updateState } from "../../../../../lib/serverState";

export async function POST(request, { params }) {
  const { channelId } = await params;
  const { botId, requester } = await request.json();

  const created = await updateState((state) => {
    const context = findChannelContext(state, channelId);
    const bot = state.bots.find((item) => item.id === botId);
    if (!context || !bot) return null;

    const payload = buildAutomationPayload({ project: context.project, channel: context.channel, bot, requester });
    const run = makeBotRun({ bot, channel: context.channel, payload });
    context.channel.botRuns.unshift(run);
    context.channel.messages.unshift(createMessageRecord({ body: `${bot.name} 실행 요청을 보냈습니다.`, author: "자동화 허브", bot: true }));
    return run;
  });

  if (!created) return notFound("Channel or bot not found.");
  return Response.json(created, { status: 201 });
}
