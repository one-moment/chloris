import { CHANNEL_TYPES } from "../lib/constants";
import BotRunList from "./BotRunList";
import { Badge } from "./common";

export default function AutomationPanel({ channel, bots, onRunBot, onCompleteRun, onApproveRun, onRejectRun }) {
  const type = CHANNEL_TYPES[channel.type];

  return (
    <aside className="automation-panel">
      <div className="panel-section">
        <div className="panel-heading">
          <span>채널 목적</span>
          <Badge tone={type?.tone}>{type?.label}</Badge>
        </div>
        <p>{type?.description}</p>
      </div>

      <div className="panel-section">
        <div className="panel-heading">
          <span>자동화 실행</span>
          <small>{bots.length} bots</small>
        </div>
        <div className="bot-list">
          {bots.map((bot) => (
            <article key={bot.id} className="bot-card">
              <div>
                <strong>{bot.name}</strong>
                <span>{bot.provider} · {bot.command}</span>
              </div>
              <button onClick={() => onRunBot(bot)}>실행</button>
            </article>
          ))}
        </div>
      </div>

      <BotRunList
        runs={channel.botRuns}
        onCompleteRun={onCompleteRun}
        onApproveRun={onApproveRun}
        onRejectRun={onRejectRun}
      />
    </aside>
  );
}
