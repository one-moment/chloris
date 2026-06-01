export default function AttachmentList({ attachments = [], onRemove }) {
  if (!attachments.length) return null;

  return (
    <div className="attachment-list">
      {attachments.map((attachment, index) => {
        const key = attachment.id ?? `${attachment.name}-${index}`;
        const isImage = attachment.type?.startsWith("image/");
        const href = attachment.url || attachment.dataUrl || "#";
        return (
          <div key={key} className={isImage ? "attachment-item image" : "attachment-item"}>
            {isImage && href !== "#" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={href} alt={attachment.name} />
            ) : (
              <div className="attachment-icon">FILE</div>
            )}
            <div>
              <a href={href} download={attachment.url ? undefined : attachment.name} target={attachment.url ? "_blank" : undefined} rel={attachment.url ? "noreferrer" : undefined}>{attachment.name}</a>
              <span>{formatSize(attachment.size)}{attachment.storage === "s3" ? " · S3" : ""}</span>
            </div>
            {onRemove && (
              <button type="button" onClick={() => onRemove(index)} aria-label={`${attachment.name} 첨부 제거`}>
                삭제
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatSize(size = 0) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}
