import { formatChatDateDivider } from "../lib/time";

export default function ChatDateDivider({ date }) {
  const label = formatChatDateDivider(date);
  if (!label) return null;
  return (
    <div className="chat-date-divider" role="separator">
      <span>{label}</span>
    </div>
  );
}
