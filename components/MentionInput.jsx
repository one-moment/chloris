import { useMemo } from "react";
import { filterMentionUsers } from "../lib/mentions";

function activeMentionQuery(value) {
  const text = String(value ?? "");
  const cursor = text.length;
  const beforeCursor = text.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
  if (!match) return null;
  return {
    query: match[1],
    start: beforeCursor.lastIndexOf(`@${match[1]}`)
  };
}

export default function MentionInput({
  value,
  onChange,
  users = [],
  placeholder,
  disabled,
  multiline = false,
  onKeyDown
}) {
  const activeQuery = activeMentionQuery(value);
  const query = activeQuery?.query ?? null;
  const suggestions = useMemo(
    () => query !== null ? filterMentionUsers(query, users) : [],
    [query, users]
  );
  const Field = multiline ? "textarea" : "input";

  function insertMention(user) {
    const text = String(value ?? "");
    const active = activeMentionQuery(text);
    if (!active) return;
    const before = text.slice(0, active.start);
    const after = text.slice(active.start + active.query.length + 1);
    onChange(`${before}@${user.name} ${after}`.replace(/\s+$/, " "));
  }

  return (
    <div className="mention-input">
      <Field
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
      {suggestions.length > 0 && (
        <div className="mention-popover" role="listbox">
          {suggestions.map((user) => (
            <button type="button" key={user.id} onClick={() => insertMention(user)}>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
