import MentionText from "./MentionText";

const BOLD_PATTERN = /\*\*([^*\n]+)\*\*/g;

export default function RichText({ text, users = [], className }) {
  const body = String(text ?? "");
  const parts = [];
  let lastIndex = 0;
  for (const match of body.matchAll(BOLD_PATTERN)) {
    if (match.index > lastIndex) parts.push({ text: body.slice(lastIndex, match.index), bold: false });
    parts.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) parts.push({ text: body.slice(lastIndex), bold: false });

  if (parts.length === 0) return <span className={className} />;

  return (
    <span className={className}>
      {parts.map((part, index) => (
        part.bold
          ? <strong key={index}><MentionText text={part.text} users={users} /></strong>
          : <MentionText key={index} text={part.text} users={users} />
      ))}
    </span>
  );
}
