import { EmptyState } from "./common";
import AttachmentList from "./AttachmentList";

export default function MessagesView({ channel, draft, attachments, onDraftChange, onAttachmentsChange, onRemoveAttachment, onSend }) {
  return (
    <section className="content-column">
      <div className="composer compact">
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={`${channel.name} 채널에 메시지 작성`}
        />
        <AttachmentList attachments={attachments} onRemove={onRemoveAttachment} />
        <div className="composer-actions">
          <label className="attachment-button">
            파일 첨부
            <input type="file" multiple onChange={(event) => onAttachmentsChange(event.target.files)} />
          </label>
          <button className="primary-button" onClick={onSend} disabled={!draft.trim() && attachments.length === 0}>Send</button>
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
              <AttachmentList attachments={message.attachments} />
            </article>
          ))
        )}
      </div>
    </section>
  );
}
