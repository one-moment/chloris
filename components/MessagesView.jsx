import { EmptyState } from "./common";

export default function MessagesView({ channel, draft, onDraftChange, onSend }) {
  return (
    <section className="content-column">
      <div className="composer compact">
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={`${channel.name} 채널에 메시지 작성`}
        />
        <div className="composer-actions">
          <button className="primary-button" onClick={onSend} disabled={!draft.trim()}>Send</button>
        </div>
      </div>

      <div className="message-list">
        {channel.messages.length === 0 ? (
          <EmptyState title="아직 메시지가 없습니다" body="채널 안에서 빠른 대화를 시작해보세요." />
        ) : (
          channel.messages.map((message) => (
            <article key={message.id} className={message.bot ? "message-row bot" : "message-row"}>
              <strong>{message.author}</strong>
              <span>{message.createdAt}</span>
              <p>{message.body}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
