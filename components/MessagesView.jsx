import { useEffect, useMemo, useRef, useState } from "react";
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

const PURCHASE_REQUEST_ID_PATTERN = /\/api\/purchase-bot\/requests\/([^/\s]+)\/approve/;
const PURCHASE_WORKER_TASK_ID_PATTERN = /작업 ID:\s*([^\s]+)/;
const ACTIONABLE_PURCHASE_STATUSES = new Set(["pending_approval", "approved"]);
const RUNNABLE_PURCHASE_STATUSES = new Set(["queued"]);
const PURCHASE_STATUS_LABELS = {
  pending_approval: "승인 대기",
  approved: "승인 가능",
  queued: "작업 대기",
  running: "작업 중",
  cart_ready: "장바구니 준비됨",
  checkout_ready: "결제 전 확인",
  needs_human: "사람 확인 필요",
  rejected: "반려됨",
  failed: "실패"
};

function getPurchaseRequestId(message) {
  if (!message.bot || !message.body?.startsWith("구매요청을 생성했습니다.")) return null;
  return message.body.match(PURCHASE_REQUEST_ID_PATTERN)?.[1] ?? null;
}

function getPurchaseWorkerTaskId(message) {
  if (!message.bot || !message.body?.startsWith("로컬 구매봇 작업 대기열에 등록되었습니다.")) return null;
  return message.body.match(PURCHASE_WORKER_TASK_ID_PATTERN)?.[1] ?? null;
}

function isLocalWorkerStartAvailable() {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

export default function MessagesView({
  channel,
  currentUser,
  attachments,
  error,
  onAttachmentsChange,
  onRemoveAttachment,
  onSend,
  onEditMessage,
  purchaseRequests = [],
  onPurchaseRequestAction
}) {
  const [pendingMessages, setPendingMessages] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [purchaseActionBusy, setPurchaseActionBusy] = useState({});
  const [canStartPurchaseWorker, setCanStartPurchaseWorker] = useState(false);
  const messages = [...channel.messages, ...pendingMessages].sort((a, b) => messageTime(a) - messageTime(b));
  const purchaseRequestsById = useMemo(
    () => new Map(purchaseRequests.map((request) => [request.id, request])),
    [purchaseRequests]
  );
  const purchaseRequestsByWorkerTaskId = useMemo(
    () => new Map(purchaseRequests.filter((request) => request.workerTaskId).map((request) => [request.workerTaskId, request])),
    [purchaseRequests]
  );
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

  useEffect(() => {
    setCanStartPurchaseWorker(isLocalWorkerStartAvailable());
  }, []);

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

  async function submitPurchaseAction(requestId, action) {
    const busyKey = `${requestId}:${action}`;
    setPurchaseActionBusy((current) => ({ ...current, [busyKey]: true }));
    const result = await onPurchaseRequestAction?.(requestId, action);
    setPurchaseActionBusy((current) => {
      const nextBusy = { ...current };
      delete nextBusy[busyKey];
      return nextBusy;
    });
    return result;
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
                        {(() => {
                          const requestId = getPurchaseRequestId(message);
                          const workerTaskId = getPurchaseWorkerTaskId(message);
                          const request = requestId
                            ? purchaseRequestsById.get(requestId)
                            : purchaseRequestsByWorkerTaskId.get(workerTaskId);
                          return (
                            <PurchaseRequestActions
                              message={message}
                              request={request}
                              requestId={requestId ?? request?.id}
                              busy={purchaseActionBusy}
                              onAction={submitPurchaseAction}
                              canStartLocalWorker={canStartPurchaseWorker}
                            />
                          );
                        })()}
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

function PurchaseRequestActions({ message, request, requestId, busy, onAction, canStartLocalWorker }) {
  if (!requestId) return null;

  const status = request?.status ?? "pending_approval";
  const isActionable = ACTIONABLE_PURCHASE_STATUSES.has(status);
  const isRunnable = RUNNABLE_PURCHASE_STATUSES.has(status) && request?.workerTaskId;
  const showRunButton = isRunnable && canStartLocalWorker;
  const approveBusy = Boolean(busy[`${requestId}:approve`]);
  const rejectBusy = Boolean(busy[`${requestId}:reject`]);
  const runBusy = Boolean(busy[`${requestId}:run`]);
  const disabled = approveBusy || rejectBusy || runBusy;

  return (
    <div className="purchase-action-card">
      <div>
        <span className={`purchase-status status-${status}`}>{PURCHASE_STATUS_LABELS[status] ?? status}</span>
        <strong>{request?.itemName ?? extractPurchaseItemName(message.body)}</strong>
        <small>{requestId}</small>
      </div>
      {isActionable ? (
        <div className="purchase-action-buttons">
          <button className="primary-button" type="button" onClick={() => onAction(requestId, "approve")} disabled={disabled}>
            {approveBusy ? "승인 중" : "승인"}
          </button>
          <button type="button" onClick={() => onAction(requestId, "reject")} disabled={disabled}>
            {rejectBusy ? "반려 중" : "반려"}
          </button>
        </div>
      ) : showRunButton ? (
        <div className="purchase-action-buttons">
          <button className="primary-button" type="button" onClick={() => onAction(requestId, "run")} disabled={disabled}>
            {runBusy ? "실행 요청 중" : "작업 실행"}
          </button>
          <span className="purchase-action-note">Chrome에서 장바구니 준비를 시작합니다.</span>
        </div>
      ) : isRunnable ? (
        <span className="purchase-action-note">로컬 worker 대기 중입니다. 맥북 worker가 자동으로 가져가 처리합니다.</span>
      ) : (
        <span className="purchase-action-note">처리된 구매요청입니다.</span>
      )}
    </div>
  );
}

function extractPurchaseItemName(body) {
  return body.match(/^품목:\s*(.+)$/m)?.[1] ?? "구매요청";
}
