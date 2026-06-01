import { POST_STATUSES } from "../lib/constants";
import AttachmentList from "./AttachmentList";
import { EmptyState } from "./common";
import PostCard from "./PostCard";

export default function IdeasView({
  channel,
  posts,
  counts,
  activeFilter,
  onFilterChange,
  draft,
  onDraftChange,
  attachments,
  onAttachmentsChange,
  onRemoveAttachment,
  onCreatePost,
  commentDrafts,
  onCommentDraftChange,
  onAddComment,
  onStatusChange
}) {
  return (
    <section className="content-column">
      <div className="composer">
        <div className="composer-grid">
          <label className="field-stack title-field" htmlFor="post-title-input">
            <span>게시글 제목</span>
            <input
              id="post-title-input"
              value={draft.title}
              onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
              placeholder={`${channel.name}에 올릴 제목`}
            />
          </label>
          <label className="field-stack" htmlFor="post-status-select">
            <span>상태</span>
            <select id="post-status-select" value={draft.status} onChange={(event) => onDraftChange({ ...draft, status: event.target.value })}>
              {POST_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        </div>
        <textarea
          value={draft.body}
          onChange={(event) => onDraftChange({ ...draft, body: event.target.value })}
          placeholder="업무 요청, 공유사항, 자동화봇에 전달할 내용을 작성하세요. @멘션을 사용할 수 있습니다."
        />
        <AttachmentList attachments={attachments} onRemove={onRemoveAttachment} />
        <div className="composer-actions">
          <div className="post-filters">
            <button className={activeFilter === "all" ? "active" : ""} onClick={() => onFilterChange("all")}>전체</button>
            <button className={activeFilter === "open" ? "active" : ""} onClick={() => onFilterChange("open")}>열린 글</button>
            <button className={activeFilter === "mentions" ? "active" : ""} onClick={() => onFilterChange("mentions")}>멘션</button>
          </div>
          <div className="composer-submit">
            <label className="attachment-button">
              파일 첨부
              <input type="file" multiple onChange={(event) => onAttachmentsChange(event.target.files)} />
            </label>
            <button className="primary-button" type="button" onClick={onCreatePost} disabled={!draft.title.trim() && !draft.body.trim() && attachments.length === 0}>Post</button>
          </div>
        </div>
      </div>

      <div className="status-summary">
        <span>검토중 {counts.review}</span>
        <span>진행중 {counts.progress}</span>
        <span>완료 {counts.done}</span>
      </div>

      <div className="post-list">
        {posts.length === 0 ? (
          <EmptyState title="게시글이 없습니다" body="이 채널의 Ideas에 첫 업무 글을 작성해보세요." />
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
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
