import { useEffect, useMemo, useState } from "react";
import { filterMentionUsers } from "../lib/mentions";

function activeMentionQuery(value) {
  const text = String(value ?? "");
  const cursor = text.length;
  const beforeCursor = text.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|\s)@([^\s@]*)$/u);
  if (!match) return null;
  return {
    query: match[1],
    start: beforeCursor.lastIndexOf(`@${match[1]}`)
  };
}

function isComposingEvent(event) {
  return event.isComposing || event.nativeEvent?.isComposing || event.keyCode === 229;
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
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const Field = multiline ? "textarea" : "input";
  const isOpen = suggestions.length > 0 && !dismissed;
  const activeIndex = Math.min(highlightIndex, suggestions.length - 1);

  useEffect(() => {
    setHighlightIndex(0);
    setDismissed(false);
  }, [query]);

  function insertMention(user) {
    const text = String(value ?? "");
    const active = activeMentionQuery(text);
    if (!active) return;
    const before = text.slice(0, active.start);
    const after = text.slice(active.start + active.query.length + 1);
    onChange(`${before}@${user.name} ${after}`.replace(/\s+$/, " "));
  }

  function handleKeyDown(event) {
    if (isOpen && !isComposingEvent(event)) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightIndex((index) => (index + 1) % suggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const choice = suggestions[activeIndex];
        if (choice) {
          event.preventDefault();
          insertMention(choice);
          return;
        }
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setDismissed(true);
        return;
      }
    }
    onKeyDown?.(event);
  }

  return (
    <div className="mention-input">
      <Field
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
      {isOpen && (
        <div className="mention-popover" role="listbox">
          {suggestions.map((user, index) => (
            <button
              type="button"
              key={user.id}
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? "active" : ""}
              onMouseEnter={() => setHighlightIndex(index)}
              onClick={() => insertMention(user)}
            >
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
