import { useState } from "react";
import AttachmentList from "./AttachmentList";
import MentionInput from "./MentionInput";
import RichText from "./RichText";
import Timestamp from "./Timestamp";

const LONG_BODY_CHARS = 320;
const LONG_BODY_LINES = 6;

function canEditRecord(record, currentUser) {
  if (!currentUser || record.pending) return false;
  if (currentUser.role === "admin") return true;
  if (record.authorId) return record.authorId === currentUser.id;
  return record.author === currentUser.name;
}

function isLongBody(body) {
  return body.length > LONG_BODY_CHARS || body.split("\n").length > LONG_BODY_LINES;
}

function truncateBody(body) {
  const lines = body.split("\n").slice(0, LONG_BODY_LINES).join("\n");
  return `${lines.slice(0, LONG_BODY_CHARS).trimEnd()}…`;
}

export default function PostCard({
  post,
  postStatuses,
  commentDraft,
  currentUser,
  users,
  onStatusChange,
  onCommentDraftChange,
  onAddComment,
  onEditPost,
  onEditComment,
  onTogglePin
}) {
  const statusOptions = postStatuses.includes(post.status) ? postStatuses : [post.status, ...postStatuses];
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [postDraft, setPostDraft] = useState({ title: post.title, body: post.body });
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [commentEditDraft, setCommentEditDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const isTruncatable = isLongBody(post.body);
  const visibleBody = !isTruncatable || isExpanded ? post.body : truncateBody(post.body);
  const canPin = currentUser?.role === "admin" && !post.pending && onTogglePin;
  const commentCount = (post.comments ?? []).length;

  function beginPostEdit() {
    setPostDraft({ title: post.title, body: post.body });
    setIsEditingPost(true);
  }

  async function savePostEdit() {
    const title = postDraft.title.trim();
    const body = postDraft.body.trim();
    if (!title) return;
    if (title === post.title && body === post.body) {
      setIsEditingPost(false);
      return;
    }
    setIsSaving(true);
    const result = await onEditPost(post.id, { title, body });
    setIsSaving(false);
    if (result?.ok !== false) setIsEditingPost(false);
  }

  function beginCommentEdit(comment) {
    setEditingCommentId(comment.id);
    setCommentEditDraft(comment.body);
  }

  async function saveCommentEdit(comment) {
    const body = commentEditDraft.trim();
    if (!body) return;
    if (body === comment.body) {
      setEditingCommentId(null);
      return;
    }
    setIsSaving(true);
    const result = await onEditComment(post.id, comment.id, body);
    setIsSaving(false);
    if (result?.ok !== false) setEditingCommentId(null);
  }

  return (
    <article className={`post-card${post.pending ? " pending" : ""}${post.pinned ? " pinned" : ""}`}>
      <div className="post-card-header">
        <div>
          {isEditingPost ? (
            <input
              className="inline-title-input"
              value={postDraft.title}
              onChange={(event) => setPostDraft({ ...postDraft, title: event.target.value })}
              placeholder="게시글 제목"
            />
          ) : (
            <strong className="post-title">
              {post.pinned && <span className="pin-badge">고정</span>}
              {post.title}
            </strong>
          )}
          <span className="post-meta">
            <span className="post-author">{post.author}</span>
            <span className="post-meta-divider" aria-hidden="true">·</span>
            <Timestamp createdAt={post.createdAtIso ?? post.createdAt} updatedAt={post.updatedAtIso} isEdited={post.isEdited} />
            {commentCount > 0 && (
              <>
                <span className="post-meta-divider" aria-hidden="true">·</span>
                <span>댓글 {commentCount}</span>
              </>
            )}
          </span>
        </div>
        <div className="post-header-actions">
          {canPin && !isEditingPost && (
            <button className="text-button" type="button" onClick={() => onTogglePin(post.id, !post.pinned)}>
              {post.pinned ? "고정 해제" : "고정"}
            </button>
          )}
          {canEditRecord(post, currentUser) && !isEditingPost && (
            <button className="text-button" type="button" onClick={beginPostEdit}>수정</button>
          )}
          <select className="status-select" value={post.status} onChange={(event) => onStatusChange(post.id, event.target.value)} disabled={post.pending}>
            {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
      </div>

      {isEditingPost ? (
        <div className="inline-editor">
          <textarea value={postDraft.body} onChange={(event) => setPostDraft({ ...postDraft, body: event.target.value })} />
          <div className="inline-editor-actions">
            <button type="button" onClick={savePostEdit} disabled={isSaving || !postDraft.title.trim()}>저장</button>
            <button type="button" onClick={() => setIsEditingPost(false)} disabled={isSaving}>취소</button>
          </div>
        </div>
      ) : (
        <>
          <p className="post-body"><RichText text={visibleBody} users={users} /></p>
          {isTruncatable && (
            <button className="text-button post-expand-button" type="button" onClick={() => setIsExpanded((current) => !current)}>
              {isExpanded ? "접기" : "더보기"}
            </button>
          )}
        </>
      )}
      <AttachmentList attachments={post.attachments} />

      <div className="comment-list">
        {(post.comments ?? []).map((comment) => (
          <div key={comment.id} className="comment-row">
            <div className="comment-meta">
              <strong>{comment.author}</strong>
              <span><Timestamp createdAt={comment.createdAtIso ?? comment.createdAt} updatedAt={comment.updatedAtIso} isEdited={comment.isEdited} /></span>
              {canEditRecord(comment, currentUser) && editingCommentId !== comment.id && (
                <button className="text-button" type="button" onClick={() => beginCommentEdit(comment)}>수정</button>
              )}
            </div>
            {editingCommentId === comment.id ? (
              <div className="inline-editor">
                <MentionInput
                  value={commentEditDraft}
                  onChange={setCommentEditDraft}
                  users={users}
                  placeholder="@멘션을 포함해 댓글 수정"
                />
                <div className="inline-editor-actions">
                  <button type="button" onClick={() => saveCommentEdit(comment)} disabled={isSaving || !commentEditDraft.trim()}>저장</button>
                  <button type="button" onClick={() => setEditingCommentId(null)} disabled={isSaving}>취소</button>
                </div>
              </div>
            ) : (
              <p><RichText text={comment.body} users={users} /></p>
            )}
          </div>
        ))}
      </div>

      <div className="comment-composer">
        <MentionInput
          value={commentDraft ?? ""}
          onChange={(value) => onCommentDraftChange(post.id, value)}
          users={users}
          placeholder="@멘션을 포함해 댓글 작성"
          disabled={post.pending}
        />
        <button onClick={() => onAddComment(post.id)} disabled={post.pending || !commentDraft?.trim()}>댓글</button>
      </div>
    </article>
  );
}
