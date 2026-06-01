export default function AttachmentList({ attachments = [], onRemove }) {
  if (!attachments.length) return null;

  return (
    <div className="attachment-list">
      {attachments.map((attachment, index) => {
        const key = attachment.id ?? `${attachment.name}-${index}`;
        const isImage = attachment.type?.startsWith("image/");
        return (
          <div key={key} className={isImage ? "attachment-item image" : "attachment-item"}>
            {isImage && attachment.dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={attachment.dataUrl} alt={attachment.name} />
            ) : (
              <div className="attachment-icon">FILE</div>
            )}
            <div>
              <a href={attachment.dataUrl} download={attachment.name}>{attachment.name}</a>
              <span>{formatSize(attachment.size)}</span>
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
