import { formatRelativeDateTime } from "../lib/time";

export default function Timestamp({ createdAt, updatedAt, isEdited }) {
  const label = formatRelativeDateTime(createdAt);
  return (
    <>
      <span>{label}</span>
      {isEdited && <span className="edited-label">수정됨</span>}
      {isEdited && updatedAt && <span className="sr-only">수정 시각 {formatRelativeDateTime(updatedAt)}</span>}
    </>
  );
}
