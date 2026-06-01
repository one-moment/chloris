import { EmptyState } from "./common";
import AttachmentList from "./AttachmentList";

export default function MessagesView({ channel, draft, attachments, error, onDraftChange, onAttachmentsChange, onRemoveAttachment, onSend }) {
  const messages = [...channel.messages].reverse();

  function handleKeyDown(event) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    onSend();
  }

  return (
    <section className="content-column chat-column">
      <div className="message-list chat-list">
        {messages.length === 0 ? (
          <EmptyState title="아직 메시지가 없습니다" body="채널 안에서 빠른 대화를 시작해보세요." />
        ) : (
          messages.map((message) => (
            <article key={message.id} className={message.bot ? "message-row bot" : "message-row"}>
              <strong>{message.author}</strong>
              <span>{message.createdAt}</span>
              <p>{message.body}</p>
              <AttachmentList attachments={message.attachments} />
            </article>
          ))
        )}
      </div>

      <div className="composer compact">
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`${channel.name} 채널에 메시지 작성`}
        />
        <AttachmentList attachments={attachments} onRemove={onRemoveAttachment} />
        {error && <p className="action-error">{error}</p>}
        <div className="composer-actions">
          <label className="attachment-button">
            파일 첨부
            <input type="file" multiple onChange={(event) => onAttachmentsChange(event.target.files)} />
          </label>
          <button className="primary-button" type="button" onClick={onSend} disabled={!draft.trim() && attachments.length === 0}>Send</button>
        </div>
      </div>
    </section>
  );
}
