import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "./common";
import AttachmentList from "./AttachmentList";
import ChatDateDivider from "./ChatDateDivider";
import MentionInput from "./MentionInput";
import RichText from "./RichText";
import Timestamp from "./Timestamp";
import { isSameKoreanDate } from "../lib/time";
// 코어 작성기 → 모듈 액션 멘션(@예약 등) 데이터만 읽는다(모듈 import 아님 — registry 경유, 경계 안전).
import { getMentionActions } from "../modules/registry";

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
const PURCHASE_ORDER_DRAFT_ID_PATTERN = /초안 ID:\s*([^\s]+)/;
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
const PURCHASE_ORDER_DRAFT_STATUS_LABELS = {
  draft: "초안 검토",
  approved: "초안 승인됨",
  rejected: "초안 반려됨",
  converted: "작업 분리됨"
};
const DRAFT_LINE_STATUS_LABELS = {
  needs_review: "검토 필요",
  needs_item_match: "상품 매칭 필요",
  vendor_bot_needed: "거래처 봇 필요",
  queued: "worker 대기",
  ready: "준비됨"
};
const VENDOR_LABELS = {
  coupang: "쿠팡",
  swadpia: "성원애드피아",
  gmarket: "지마켓",
  hyundaideco: "현대데코"
};
const VENDOR_TASK_STATUS_LABELS = {
  queued: "worker 대기",
  partially_queued: "일부 대기",
  needs_item_match: "상품 매칭 필요",
  vendor_bot_needed: "거래처 봇 필요"
};

function getPurchaseRequestId(message) {
  if (!message.bot || !message.body?.startsWith("구매요청을 생성했습니다.")) return null;
  return message.body.match(PURCHASE_REQUEST_ID_PATTERN)?.[1] ?? null;
}

function getPurchaseWorkerTaskId(message) {
  if (!message.bot || !message.body?.startsWith("로컬 구매봇 작업 대기열에 등록되었습니다.")) return null;
  return message.body.match(PURCHASE_WORKER_TASK_ID_PATTERN)?.[1] ?? null;
}

function getPurchaseOrderDraftId(message) {
  if (!message.bot || !message.body?.includes("구매요청서 초안을 만들었습니다.")) return null;
  return message.body.match(PURCHASE_ORDER_DRAFT_ID_PATTERN)?.[1] ?? null;
}

function isLocalWorkerStartAvailable() {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

export default function MessagesView({
  channel,
  currentUser,
  users = [],
  attachments,
  error,
  onAttachmentsChange,
  onRemoveAttachment,
  onSend,
  onEditMessage,
  purchaseRequests = [],
  onPurchaseRequestAction,
  purchaseOrderDrafts = [],
  onPurchaseOrderDraftUpdate,
  onPurchaseOrderDraftApprove
}) {
  const [pendingMessages, setPendingMessages] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [purchaseActionBusy, setPurchaseActionBusy] = useState({});
  const [draftActionBusy, setDraftActionBusy] = useState({});
  const [editingDraft, setEditingDraft] = useState(null);
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
  const purchaseOrderDraftsById = useMemo(
    () => new Map(purchaseOrderDrafts.map((draft) => [draft.id, draft])),
    [purchaseOrderDrafts]
  );
  const listRef = useRef(null);
  const router = useRouter();
  const [draftBody, setDraftBody] = useState("");
  // @예약 등 모듈 선언 액션 멘션. registry가 brand·role·requiresBranch(채널 branchId)로 필터하므로,
  // branchId 없는 채널이면 빈 배열 → 액션 멘션 미노출(@유저 멘션은 그대로).
  const mentionActions = useMemo(
    () => getMentionActions(currentUser, channel),
    [currentUser, channel]
  );
  const mentionUsers = useMemo(() => {
    const channelUserIds = new Set([
      currentUser?.id,
      ...(channel.messages ?? []).map((message) => message.authorId)
    ].filter(Boolean));
    return [
      ...users.filter((user) => channelUserIds.has(user.id)),
      ...users.filter((user) => !channelUserIds.has(user.id))
    ];
  }, [channel.messages, currentUser?.id, users]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [channel.id, messages.length]);

  useEffect(() => {
    setDraftBody("");
    setPendingMessages([]);
  }, [channel.id]);

  useEffect(() => {
    setCanStartPurchaseWorker(isLocalWorkerStartAvailable());
  }, []);

  async function submitMessage() {
    const body = draftBody.trim();
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
    setDraftBody("");
    setPendingMessages((current) => [pendingMessage, ...current]);
    const result = await onSend(body);
    setPendingMessages((current) => current.filter((message) => message.id !== pendingMessage.id));
    if (result?.ok === false) {
      setDraftBody(body);
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

  async function submitDraftUpdate(draftId, payload) {
    const busyKey = `${draftId}:update`;
    setDraftActionBusy((current) => ({ ...current, [busyKey]: true }));
    const result = await onPurchaseOrderDraftUpdate?.(draftId, payload);
    setDraftActionBusy((current) => {
      const nextBusy = { ...current };
      delete nextBusy[busyKey];
      return nextBusy;
    });
    return result;
  }

  async function submitDraftApprove(draftId) {
    const busyKey = `${draftId}:approve`;
    setDraftActionBusy((current) => ({ ...current, [busyKey]: true }));
    const result = await onPurchaseOrderDraftApprove?.(draftId);
    setDraftActionBusy((current) => {
      const nextBusy = { ...current };
      delete nextBusy[busyKey];
      return nextBusy;
    });
    if (result?.ok !== false) setEditingDraft(null);
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
                        <p className="chat-text"><RichText text={message.body} users={mentionUsers} /></p>
                        <AttachmentList attachments={message.attachments} />
                        {(() => {
                          const requestId = getPurchaseRequestId(message);
                          const workerTaskId = getPurchaseWorkerTaskId(message);
                          const draftId = getPurchaseOrderDraftId(message);
                          const request = requestId
                            ? purchaseRequestsById.get(requestId)
                            : purchaseRequestsByWorkerTaskId.get(workerTaskId);
                          return (
                            <>
                              <PurchaseRequestActions
                                message={message}
                                request={request}
                                requestId={requestId ?? request?.id}
                                busy={purchaseActionBusy}
                                onAction={submitPurchaseAction}
                                canStartLocalWorker={canStartPurchaseWorker}
                              />
                              <PurchaseOrderDraftActions
                                draftId={draftId}
                                draft={draftId ? purchaseOrderDraftsById.get(draftId) : null}
                                busy={draftActionBusy}
                                onEdit={() => setEditingDraft(draftId ? purchaseOrderDraftsById.get(draftId) ?? { id: draftId, lines: [] } : null)}
                                onApprove={submitDraftApprove}
                              />
                            </>
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

      {editingDraft && (
        <PurchaseOrderDraftModal
          draft={editingDraft}
          busy={draftActionBusy}
          onClose={() => setEditingDraft(null)}
          onSave={submitDraftUpdate}
          onApprove={submitDraftApprove}
        />
      )}

      <div className="composer compact chat-composer">
        <MentionInput
          multiline
          value={draftBody}
          onChange={setDraftBody}
          users={mentionUsers}
          mentionActions={mentionActions}
          onAction={(action) => router.push(action.href)}
          onKeyDown={handleKeyDown}
          placeholder={`${channel.name}에 메시지 보내기 (@멘션, **굵게**)`}
        />
        <AttachmentList attachments={attachments} onRemove={onRemoveAttachment} />
        {error && <p className="action-error">{error}</p>}
        <div className="composer-actions">
          <label className="attachment-button">
            파일 첨부
            <input type="file" multiple onChange={(event) => onAttachmentsChange(event.target.files)} />
          </label>
          <button className="primary-button" type="button" onClick={submitMessage} disabled={!draftBody.trim() && attachments.length === 0}>Send</button>
        </div>
      </div>
    </section>
  );
}

function PurchaseOrderDraftActions({ draftId, draft, busy, onEdit, onApprove }) {
  if (!draftId) return null;

  const status = draft?.status ?? "draft";
  const approveBusy = Boolean(busy[`${draftId}:approve`]);
  const lineCount = draft?.lines?.length ?? 0;
  const vendorCount = draft?.lines ? new Set(draft.lines.map((line) => line.vendor)).size : 0;
  const taskCount = draft?.vendorTasks?.length ?? 0;

  return (
    <div className="purchase-action-card purchase-draft-card">
      <div>
        <span className={`purchase-status status-${status}`}>{PURCHASE_ORDER_DRAFT_STATUS_LABELS[status] ?? status}</span>
        <strong>구매요청서 초안</strong>
        <small>{draftId}{lineCount ? ` · ${lineCount}개 품목 · ${vendorCount}개 거래처` : ""}{taskCount ? ` · 작업 ${taskCount}건` : ""}</small>
        {taskCount > 0 && (
          <div className="purchase-draft-task-summary">
            {draft.vendorTasks.map((task) => (
              <span key={task.id}>{VENDOR_LABELS[task.vendor] ?? task.vendor}: {VENDOR_TASK_STATUS_LABELS[task.status] ?? task.status}</span>
            ))}
          </div>
        )}
      </div>
      <div className="purchase-action-buttons">
        <button type="button" onClick={onEdit}>초안 확인/수정</button>
        {status === "draft" && (
          <button className="primary-button" type="button" onClick={() => onApprove(draftId)} disabled={approveBusy}>
            {approveBusy ? "승인 중" : "초안 승인"}
          </button>
        )}
      </div>
    </div>
  );
}

function PurchaseOrderDraftModal({ draft, busy, onClose, onSave, onApprove }) {
  const [draftForm, setDraftForm] = useState(() => createDraftForm(draft));
  const [localError, setLocalError] = useState("");
  const saveBusy = Boolean(busy[`${draft.id}:update`]);
  const approveBusy = Boolean(busy[`${draft.id}:approve`]);
  const isLocked = draft.status !== "draft";
  const groupedLines = groupDraftLines(draftForm.lines);

  function updateDraftField(field, value) {
    setDraftForm((current) => ({ ...current, [field]: value }));
  }

  function updateLine(lineId, field, value) {
    setDraftForm((current) => ({
      ...current,
      lines: current.lines.map((line) => line.id === lineId ? { ...line, [field]: value } : line)
    }));
  }

  async function save() {
    setLocalError("");
    const invalidLine = draftForm.lines.find((line) => !line.itemName.trim() || (line.quantity !== "" && Number(line.quantity) < 1));
    if (invalidLine) {
      setLocalError("품목명과 수량을 확인해주세요.");
      return;
    }

    const result = await onSave(draft.id, {
      requesterName: draftForm.requesterName,
      requesterTeam: draftForm.requesterTeam,
      lines: draftForm.lines.map((line) => ({
        id: line.id,
        itemName: line.itemName,
        quantity: line.quantity === "" ? null : Number(line.quantity),
        unitLabel: line.unitLabel,
        url: line.url,
        notes: line.notes,
        status: line.status
      }))
    });
    if (result?.ok !== false) onClose();
  }

  async function approve() {
    const result = await onApprove(draft.id);
    if (result?.ok !== false) onClose();
  }

  return (
    <div className="next-dialog-fallback">
      <section className="modal-card purchase-draft-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-draft-title">
        <div className="purchase-draft-modal-header">
          <div>
            <h2 id="purchase-draft-title">구매요청서 초안</h2>
            <p>{draft.id}</p>
          </div>
          <span className={`purchase-status status-${draft.status}`}>{PURCHASE_ORDER_DRAFT_STATUS_LABELS[draft.status] ?? draft.status}</span>
        </div>

        <div className="purchase-draft-requester">
          <label className="settings-field">
            이름
            <input value={draftForm.requesterName} onChange={(event) => updateDraftField("requesterName", event.target.value)} disabled={isLocked} />
          </label>
          <label className="settings-field">
            소속
            <input value={draftForm.requesterTeam} onChange={(event) => updateDraftField("requesterTeam", event.target.value)} disabled={isLocked} />
          </label>
        </div>

        <div className="purchase-draft-lines">
          {(draft.vendorTasks?.length ?? 0) > 0 && (
            <section className="purchase-draft-vendor-tasks">
              <h3>거래처별 작업</h3>
              <div className="purchase-draft-task-summary">
                {draft.vendorTasks.map((task) => (
                  <span key={task.id}>
                    {VENDOR_LABELS[task.vendor] ?? task.vendor}: {VENDOR_TASK_STATUS_LABELS[task.status] ?? task.status}
                    {task.purchaseRequestIds?.length ? ` / worker ${task.purchaseRequestIds.length}건` : ""}
                  </span>
                ))}
              </div>
            </section>
          )}
          {groupedLines.map(([vendor, lines]) => (
            <section className="purchase-draft-vendor" key={vendor}>
              <h3>{VENDOR_LABELS[vendor] ?? vendor}</h3>
              {lines.map((line) => (
                <div className="purchase-draft-line" key={line.id}>
                  <label>
                    품목
                    <input value={line.itemName} onChange={(event) => updateLine(line.id, "itemName", event.target.value)} disabled={isLocked} />
                  </label>
                  <label>
                    수량
                    <input type="number" min="1" value={line.quantity} onChange={(event) => updateLine(line.id, "quantity", event.target.value)} disabled={isLocked} />
                  </label>
                  <label>
                    단위
                    <input value={line.unitLabel} onChange={(event) => updateLine(line.id, "unitLabel", event.target.value)} disabled={isLocked} />
                  </label>
                  <label>
                    URL
                    <input value={line.url} onChange={(event) => updateLine(line.id, "url", event.target.value)} disabled={isLocked} />
                  </label>
                  <label>
                    메모
                    <input value={line.notes} onChange={(event) => updateLine(line.id, "notes", event.target.value)} disabled={isLocked} />
                  </label>
                  <label>
                    상태
                    <select value={line.status} onChange={(event) => updateLine(line.id, "status", event.target.value)} disabled={isLocked}>
                      {Object.entries(DRAFT_LINE_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
            </section>
          ))}
        </div>

        {localError && <p className="action-error">{localError}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>닫기</button>
          {!isLocked && <button type="button" onClick={save} disabled={saveBusy}>{saveBusy ? "저장 중" : "저장"}</button>}
          {!isLocked && (
            <button className="primary-button" type="button" onClick={approve} disabled={approveBusy}>
              {approveBusy ? "승인 중" : "초안 승인"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function createDraftForm(draft) {
  return {
    requesterName: draft.requesterName ?? "",
    requesterTeam: draft.requesterTeam ?? "",
    lines: (draft.lines ?? []).map((line) => ({
      ...line,
      itemName: line.itemName ?? "",
      quantity: line.quantity ?? "",
      unitLabel: line.unitLabel ?? "",
      url: line.url ?? "",
      notes: line.notes ?? "",
      status: line.status ?? "needs_review"
    }))
  };
}

function groupDraftLines(lines) {
  const grouped = new Map();
  for (const line of lines) {
    const current = grouped.get(line.vendor) ?? [];
    current.push(line);
    grouped.set(line.vendor, current);
  }
  return [...grouped.entries()];
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
