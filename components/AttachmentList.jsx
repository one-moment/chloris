import { useState } from "react";

export default function AttachmentList({ attachments = [], onRemove }) {
  const [previewAttachment, setPreviewAttachment] = useState(null);
  if (!attachments.length) return null;

  return (
    <>
      <div className="attachment-list">
        {attachments.map((attachment, index) => {
          const key = attachment.id ?? `${attachment.name}-${index}`;
          const isImage = attachment.type?.startsWith("image/");
          const href = attachment.url || attachment.dataUrl || "#";
          return (
            <div key={key} className={isImage ? "attachment-item image" : "attachment-item"}>
              {isImage && href !== "#" ? (
                <button className="attachment-preview-trigger" type="button" onClick={() => setPreviewAttachment({ ...attachment, href })} aria-label={`${attachment.name} 미리보기`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={href} alt={attachment.name} />
                </button>
              ) : (
                <div className="attachment-icon">FILE</div>
              )}
              <div>
                {isImage && href !== "#" ? (
                  <button className="attachment-name-button" type="button" onClick={() => setPreviewAttachment({ ...attachment, href })}>
                    {attachment.name}
                  </button>
                ) : (
                  <a href={href} download={attachment.url ? undefined : attachment.name} target={attachment.url ? "_blank" : undefined} rel={attachment.url ? "noreferrer" : undefined}>{attachment.name}</a>
                )}
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
      {previewAttachment && (
        <div className="attachment-preview-backdrop" role="dialog" aria-modal="true" aria-label={`${previewAttachment.name} 미리보기`} onClick={() => setPreviewAttachment(null)}>
          <div className="attachment-preview-modal" onClick={(event) => event.stopPropagation()}>
            <div className="attachment-preview-header">
              <div>
                <strong>{previewAttachment.name}</strong>
                <span>{formatSize(previewAttachment.size)}</span>
              </div>
              <div className="attachment-preview-actions">
                <a href={previewAttachment.href} target="_blank" rel="noreferrer">새 탭에서 열기</a>
                <button type="button" onClick={() => setPreviewAttachment(null)}>닫기</button>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewAttachment.href} alt={previewAttachment.name} />
          </div>
        </div>
      )}
    </>
  );
}

function formatSize(size = 0) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}
