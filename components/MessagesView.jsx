import { useEffect, useRef } from "react";
import { EmptyState } from "./common";
import AttachmentList from "./AttachmentList";

export default function MessagesView({ channel, currentUser, draft, attachments, error, onDraftChange, onAttachmentsChange, onRemoveAttachment, onSend }) {
  const messages = [...channel.messages].reverse();
  const listRef = useRef(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [channel.id, messages.length]);

  function handleKeyDown(event) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    onSend();
  }

  return (
    <section className="content-column chat-column">
      <div className="chat-thread" ref={listRef} aria-label={`${channel.name} 메시지 목록`}>
        {messages.length === 0 ? (
          <EmptyState title="아직 메시지가 없습니다" body="채널 안에서 빠른 대화를 시작해보세요." />
        ) : (
          messages.map((message) => {
            const isMine = message.authorId && message.authorId === currentUser?.id;
            const className = [
              "chat-message",
              isMine ? "mine" : "",
              message.bot ? "bot" : ""
            ].filter(Boolean).join(" ");

            return (
              <article key={message.id} className={className}>
                {!message.bot && !isMine && <div className="chat-avatar">{message.author.slice(0, 1)}</div>}
                <div className="chat-bubble">
                  {!message.bot && (
                    <div className="chat-meta">
                      <strong>{message.author}</strong>
                      <span>{message.createdAt}</span>
                    </div>
                  )}
                  {message.bot && <span className="chat-system-label">{message.author}</span>}
                  <p>{message.body}</p>
                  <AttachmentList attachments={message.attachments} />
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="composer compact chat-composer">
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`${channel.name}에 메시지 보내기`}
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
