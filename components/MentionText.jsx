function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function MentionText({ text, users = [], className }) {
  const body = String(text ?? "");
  const mentionNames = users
    .flatMap((user) => [user.name, user.handle].filter(Boolean))
    .sort((a, b) => b.length - a.length);
  const pattern = mentionNames.length ? new RegExp(`@(${mentionNames.map(escapeRegExp).join("|")})`, "g") : null;

  if (!pattern) return <span className={className}>{body}</span>;

  const parts = [];
  let lastIndex = 0;
  for (const match of body.matchAll(pattern)) {
    if (match.index > lastIndex) parts.push({ text: body.slice(lastIndex, match.index), mention: false });
    parts.push({ text: match[0], mention: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) parts.push({ text: body.slice(lastIndex), mention: false });

  return (
    <span className={className}>
      {parts.map((part, index) => (
        part.mention ? <span className="mention-token" key={`${part.text}-${index}`}>{part.text}</span> : <span key={`${part.text}-${index}`}>{part.text}</span>
      ))}
    </span>
  );
}
