import AttachmentList from "./AttachmentList";

export default function PostCard({ post, postStatuses, commentDraft, onStatusChange, onCommentDraftChange, onAddComment }) {
  const statusOptions = postStatuses.includes(post.status) ? postStatuses : [post.status, ...postStatuses];

  return (
    <article className={post.pending ? "post-card pending" : "post-card"}>
      <div className="post-card-header">
        <div>
          <strong>{post.title}</strong>
          <span>{post.author} · {post.createdAt}</span>
        </div>
        <select className="status-select" value={post.status} onChange={(event) => onStatusChange(post.id, event.target.value)} disabled={post.pending}>
          {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </div>

      <p className="post-body">{post.body}</p>
      <AttachmentList attachments={post.attachments} />

      <div className="comment-list">
        {(post.comments ?? []).map((comment) => (
          <div key={comment.id} className="comment-row">
            <strong>{comment.author}</strong>
            <p>{comment.body}</p>
          </div>
        ))}
      </div>

      <div className="comment-composer">
        <input
          value={commentDraft ?? ""}
          onChange={(event) => onCommentDraftChange(post.id, event.target.value)}
          placeholder="@멘션을 포함해 댓글 작성"
          disabled={post.pending}
        />
        <button onClick={() => onAddComment(post.id)} disabled={post.pending || !commentDraft?.trim()}>댓글</button>
      </div>
    </article>
  );
}
