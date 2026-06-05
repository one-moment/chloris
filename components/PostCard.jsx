import { useState } from "react";
import AttachmentList from "./AttachmentList";
import MentionInput from "./MentionInput";
import MentionText from "./MentionText";
import Timestamp from "./Timestamp";

function canEditRecord(record, currentUser) {
  if (!currentUser || record.pending) return false;
  if (currentUser.role === "admin") return true;
  if (record.authorId) return record.authorId === currentUser.id;
  return record.author === currentUser.name;
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
  onEditComment
}) {
  const statusOptions = postStatuses.includes(post.status) ? postStatuses : [post.status, ...postStatuses];
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [postDraft, setPostDraft] = useState({ title: post.title, body: post.body });
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [commentEditDraft, setCommentEditDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
    <article className={post.pending ? "post-card pending" : "post-card"}>
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
            <strong>{post.title}</strong>
          )}
          <span className="post-meta">{post.author} · <Timestamp createdAt={post.createdAtIso ?? post.createdAt} updatedAt={post.updatedAtIso} isEdited={post.isEdited} /></span>
        </div>
        <div className="post-header-actions">
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
        <p className="post-body">{post.body}</p>
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
              <p><MentionText text={comment.body} users={users} /></p>
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
