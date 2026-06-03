import { useEffect, useState } from "react";
import AttachmentList from "./AttachmentList";
import { EmptyState } from "./common";
import PostCard from "./PostCard";

export default function IdeasView({
  channel,
  posts,
  counts,
  activeFilter,
  onFilterChange,
  attachments,
  error,
  onAttachmentsChange,
  onRemoveAttachment,
  onCreatePost,
  commentDrafts,
  onCommentDraftChange,
  onAddComment,
  onStatusChange,
  postStatuses
}) {
  const [draft, setDraft] = useState({ title: "", body: "", status: postStatuses[0] });

  useEffect(() => {
    setDraft({ title: "", body: "", status: postStatuses[0] });
  }, [channel.id, postStatuses]);

  async function submitPost() {
    const nextDraft = {
      title: draft.title.trim(),
      body: draft.body.trim(),
      status: draft.status
    };
    if (!nextDraft.title && !nextDraft.body && attachments.length === 0) return;
    setDraft({ title: "", body: "", status: postStatuses[0] });
    const result = await onCreatePost(nextDraft);
    if (result?.ok === false) setDraft(nextDraft);
  }

  return (
    <section className="content-column">
      <div className="composer">
        <div className="composer-grid">
          <label className="field-stack title-field" htmlFor="post-title-input">
            <span>게시글 제목</span>
            <input
              id="post-title-input"
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder={`${channel.name}에 올릴 제목`}
            />
          </label>
          <label className="field-stack" htmlFor="post-status-select">
            <span>상태</span>
            <select id="post-status-select" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
              {postStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        </div>
        <textarea
          value={draft.body}
          onChange={(event) => setDraft({ ...draft, body: event.target.value })}
          placeholder="업무 요청, 공유사항, 자동화봇에 전달할 내용을 작성하세요. @멘션을 사용할 수 있습니다."
        />
        <AttachmentList attachments={attachments} onRemove={onRemoveAttachment} />
        <div className="composer-actions">
          <div className="post-filters">
            <button type="button" className={activeFilter === "all" ? "active" : ""} onClick={() => onFilterChange("all")}>전체</button>
            <button type="button" className={activeFilter === "open" ? "active" : ""} onClick={() => onFilterChange("open")}>열린 글</button>
            <button type="button" className={activeFilter === "mentions" ? "active" : ""} onClick={() => onFilterChange("mentions")}>멘션</button>
          </div>
          <div className="composer-submit">
            <label className="attachment-button">
              파일 첨부
              <input type="file" multiple onChange={(event) => onAttachmentsChange(event.target.files)} />
            </label>
            <button className="primary-button" type="button" onClick={submitPost} disabled={!draft.title.trim() && !draft.body.trim() && attachments.length === 0}>Post</button>
          </div>
        </div>
        {error && <p className="action-error">{error}</p>}
      </div>

      <div className="status-summary">
        <span>{postStatuses[0]} {counts.review}</span>
        <span>{postStatuses[1]} {counts.progress}</span>
        <span>{postStatuses[2]} {counts.done}</span>
      </div>

      <div className="post-list">
        {posts.length === 0 ? (
          <EmptyState title="게시글이 없습니다" body="이 채널의 Ideas에 첫 업무 글을 작성해보세요." />
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              postStatuses={postStatuses}
              commentDraft={commentDrafts[post.id]}
              onStatusChange={onStatusChange}
              onCommentDraftChange={onCommentDraftChange}
              onAddComment={onAddComment}
            />
          ))
        )}
      </div>
    </section>
  );
}
