function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// http(s) URL 또는 앱 내부 경로(/work/...)를 클릭 가능한 링크로 만든다.
const URL_PATTERN = /(https?:\/\/[^\s]+|\/work\/[^\s]+)/g;

function renderWithLinks(text, keyPrefix) {
  const value = String(text ?? "");
  const nodes = [];
  let lastIndex = 0;
  for (const match of value.matchAll(URL_PATTERN)) {
    if (match.index > lastIndex) {
      nodes.push(<span key={`${keyPrefix}-t${lastIndex}`}>{value.slice(lastIndex, match.index)}</span>);
    }
    const url = match[0];
    const external = /^https?:\/\//.test(url);
    nodes.push(
      <a
        key={`${keyPrefix}-l${match.index}`}
        className="message-link"
        href={url}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {url}
      </a>
    );
    lastIndex = match.index + url.length;
  }
  if (lastIndex < value.length) {
    nodes.push(<span key={`${keyPrefix}-t${lastIndex}`}>{value.slice(lastIndex)}</span>);
  }
  return nodes.length ? nodes : value;
}

export default function MentionText({ text, users = [], className }) {
  const body = String(text ?? "");
  const mentionNames = users
    .flatMap((user) => [user.name, user.handle].filter(Boolean))
    .sort((a, b) => b.length - a.length);
  const pattern = mentionNames.length ? new RegExp(`@(${mentionNames.map(escapeRegExp).join("|")})`, "g") : null;

  if (!pattern) return <span className={className}>{renderWithLinks(body, "nm")}</span>;

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
        part.mention
          ? <span className="mention-token" key={`${part.text}-${index}`}>{part.text}</span>
          : <span key={`${part.text}-${index}`}>{renderWithLinks(part.text, `p${index}`)}</span>
      ))}
    </span>
  );
}
