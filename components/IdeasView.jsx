import { useEffect, useState } from "react";
import AttachmentList from "./AttachmentList";
import { EmptyState } from "./common";
import MentionInput from "./MentionInput";
import PostCard from "./PostCard";

export default function IdeasView({
  channel,
  posts,
  currentUser,
  users = [],
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
  onEditPost,
  onEditComment,
  onTogglePin,
  postStatuses
}) {
  const [draft, setDraft] = useState({ title: "", body: "", status: postStatuses[0] });
  const [pendingPosts, setPendingPosts] = useState([]);
  const pinnedPosts = posts.filter((post) => post.pinned);
  const visiblePosts = [...pendingPosts, ...posts.filter((post) => !post.pinned)];
  const channelUserIds = new Set([
    currentUser?.id,
    ...(channel.messages ?? []).map((message) => message.authorId),
    ...(channel.posts ?? []).map((post) => post.authorId),
    ...(channel.posts ?? []).flatMap((post) => (post.comments ?? []).map((comment) => comment.authorId))
  ].filter(Boolean));
  const mentionUsers = [
    ...users.filter((user) => channelUserIds.has(user.id)),
    ...users.filter((user) => !channelUserIds.has(user.id))
  ];

  useEffect(() => {
    setDraft({ title: "", body: "", status: postStatuses[0] });
    setPendingPosts([]);
  }, [channel.id, postStatuses]);

  async function submitPost() {
    const title = draft.title.trim()
      || draft.body.trim().slice(0, 40)
      || attachments[0]?.name
      || "";
    const nextDraft = {
      title,
      body: draft.body.trim(),
      status: draft.status
    };
    if (!nextDraft.title && !nextDraft.body && attachments.length === 0) return;
    const pendingPost = {
      id: `pending-post-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: nextDraft.title,
      body: nextDraft.body,
      status: nextDraft.status,
      author: currentUser?.name ?? "나",
      createdAt: "전송 중",
      attachments,
      comments: [],
      pending: true
    };
    setDraft({ title: "", body: "", status: postStatuses[0] });
    setPendingPosts((current) => [pendingPost, ...current]);
    onFilterChange("all");
    const result = await onCreatePost(nextDraft);
    setPendingPosts((current) => current.filter((post) => post.id !== pendingPost.id));
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
        <MentionInput
          multiline
          value={draft.body}
          onChange={(value) => setDraft({ ...draft, body: value })}
          users={mentionUsers}
          placeholder="업무 요청, 공유사항, 자동화봇에 전달할 내용을 작성하세요. @멘션과 **굵게**를 사용할 수 있습니다."
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

      {pinnedPosts.length > 0 && (
        <div className="post-list pinned-post-list" aria-label="고정된 공지">
          {pinnedPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              postStatuses={postStatuses}
              currentUser={currentUser}
              users={mentionUsers}
              commentDraft={commentDrafts[post.id]}
              onStatusChange={onStatusChange}
              onCommentDraftChange={onCommentDraftChange}
              onAddComment={onAddComment}
              onEditPost={onEditPost}
              onEditComment={onEditComment}
              onTogglePin={onTogglePin}
            />
          ))}
        </div>
      )}

      <div className="post-list">
        {visiblePosts.length === 0 && pinnedPosts.length === 0 ? (
          <EmptyState title="게시글이 없습니다" body="이 채널의 Ideas에 첫 업무 글을 작성해보세요." />
        ) : (
          visiblePosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              postStatuses={postStatuses}
              currentUser={currentUser}
              users={mentionUsers}
              commentDraft={commentDrafts[post.id]}
              onStatusChange={onStatusChange}
              onCommentDraftChange={onCommentDraftChange}
              onAddComment={onAddComment}
              onEditPost={onEditPost}
              onEditComment={onEditComment}
              onTogglePin={onTogglePin}
            />
          ))
        )}
      </div>
    </section>
  );
}
