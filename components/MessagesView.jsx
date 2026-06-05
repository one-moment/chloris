import { useEffect, useRef, useState } from "react";
import { EmptyState } from "./common";
import AttachmentList from "./AttachmentList";
import ChatDateDivider from "./ChatDateDivider";
import Timestamp from "./Timestamp";
import { isSameKoreanDate } from "../lib/time";

function getInitial(author) {
  return String(author || "?").trim().slice(0, 1).toUpperCase();
}

function getAuthorKey(message) {
  return message.authorId || message.author || "unknown";
}

function canEditMessage(message, currentUser) {
  if (!currentUser || message.pending || message.bot) return false;
  if (currentUser.role === "admin") return true;
  if (message.authorId) return message.authorId === currentUser.id;
  return message.author === currentUser.name;
}

function messageTime(message) {
  const date = new Date(message.createdAtIso ?? message.createdAt);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export default function MessagesView({ channel, currentUser, attachments, error, onAttachmentsChange, onRemoveAttachment, onSend, onEditMessage }) {
  const [pendingMessages, setPendingMessages] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const messages = [...channel.messages, ...pendingMessages].sort((a, b) => messageTime(a) - messageTime(b));
  const listRef = useRef(null);
  const textareaRef = useRef(null);
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [channel.id, messages.length]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.value = "";
    setHasDraft(false);
    setPendingMessages([]);
  }, [channel.id]);

  function updateHasDraft(event) {
    const nextHasDraft = Boolean(event.target.value.trim());
    setHasDraft((current) => current === nextHasDraft ? current : nextHasDraft);
  }

  async function submitMessage() {
    const textarea = textareaRef.current;
    const body = textarea?.value.trim() ?? "";
    if (!body && attachments.length === 0) return;
    const pendingMessage = {
      id: `pending-message-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      authorId: currentUser?.id,
      author: currentUser?.name ?? "나",
      body,
      attachments,
      createdAt: "전송 중",
      createdAtIso: new Date().toISOString(),
      bot: false,
      pending: true
    };
    if (textarea) textarea.value = "";
    setHasDraft(false);
    setPendingMessages((current) => [pendingMessage, ...current]);
    const result = await onSend(body);
    setPendingMessages((current) => current.filter((message) => message.id !== pendingMessage.id));
    if (result?.ok === false && textarea) {
      textarea.value = body;
      setHasDraft(Boolean(body));
    }
  }

  function beginEdit(message) {
    setEditingId(message.id);
    setEditBody(message.body);
  }

  async function saveEdit(message) {
    const body = editBody.trim();
    if (!body) return;
    if (body === message.body) {
      setEditingId(null);
      return;
    }
    setSavingEdit(true);
    const result = await onEditMessage(message.id, body);
    setSavingEdit(false);
    if (result?.ok !== false) setEditingId(null);
  }

  function handleKeyDown(event) {
    if (event.isComposing || event.nativeEvent?.isComposing || event.keyCode === 229) return;
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    submitMessage();
  }

  return (
    <section className="content-column chat-column">
      <div className="chat-thread" ref={listRef} aria-label={`${channel.name} 메시지 목록`}>
        {messages.length === 0 ? (
          <EmptyState title="아직 메시지가 없습니다" body="채널 안에서 빠른 대화를 시작해보세요." />
        ) : (
          messages.map((message, index) => {
            const previousMessage = messages[index - 1];
            const showDivider = !previousMessage || !isSameKoreanDate(previousMessage.createdAtIso ?? previousMessage.createdAt, message.createdAtIso ?? message.createdAt);
            const isStacked = !showDivider && previousMessage && !message.bot && !previousMessage.bot && getAuthorKey(previousMessage) === getAuthorKey(message);

            return (
              <div key={message.id}>
                {showDivider && <ChatDateDivider date={message.createdAtIso ?? message.createdAt} />}
                <article className={`chat-message${message.bot ? " bot" : ""}${isStacked ? " stacked" : ""}${message.pending ? " pending" : ""}`}>
                  {isStacked ? (
                    <div className="chat-avatar-spacer" aria-hidden="true" />
                  ) : (
                    <div className="chat-avatar" aria-hidden="true">{getInitial(message.author)}</div>
                  )}
                  <div className="chat-message-content">
                    {!isStacked && (
                      <div className="chat-meta">
                        <strong>{message.author}</strong>
                        {message.pending ? <span>전송 중</span> : <Timestamp createdAt={message.createdAtIso ?? message.createdAt} updatedAt={message.updatedAtIso} isEdited={message.isEdited} />}
                      </div>
                    )}
                    {editingId === message.id ? (
                      <div className="inline-editor">
                        <textarea value={editBody} onChange={(event) => setEditBody(event.target.value)} onKeyDown={(event) => {
                          if (event.key === "Escape") setEditingId(null);
                          if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
                            event.preventDefault();
                            saveEdit(message);
                          }
                        }} />
                        <div className="inline-editor-actions">
                          <button type="button" onClick={() => saveEdit(message)} disabled={savingEdit || !editBody.trim()}>저장</button>
                          <button type="button" onClick={() => setEditingId(null)} disabled={savingEdit}>취소</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="chat-text">{message.body}</p>
                        <AttachmentList attachments={message.attachments} />
                      </>
                    )}
                  </div>
                  {canEditMessage(message, currentUser) && editingId !== message.id && (
                    <div className="message-actions">
                      <button type="button" onClick={() => beginEdit(message)}>수정</button>
                    </div>
                  )}
                </article>
              </div>
            );
          })
        )}
      </div>

      <div className="composer compact chat-composer">
        <textarea
          ref={textareaRef}
          onInput={updateHasDraft}
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
          <button className="primary-button" type="button" onClick={submitMessage} disabled={!hasDraft && attachments.length === 0}>Send</button>
        </div>
      </div>
    </section>
  );
}
