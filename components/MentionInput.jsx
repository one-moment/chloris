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

// 액션형 멘션(@예약 등) 후보 필터. 유저 멘션과 동일한 매칭 규칙(빈 쿼리→전체, 아니면 부분일치).
// 데이터는 모듈 매니페스트(modules/registry.js getMentionActions)에서 prop으로만 들어온다 — 코어는 모듈 비의존.
function filterMentionActions(query, actions) {
  const term = String(query ?? "").trim().toLowerCase();
  return actions.filter((action) => {
    if (!term) return true;
    return [action.token, action.label].some((value) => String(value ?? "").toLowerCase().includes(term));
  });
}

export default function MentionInput({
  value,
  onChange,
  users = [],
  mentionActions = [],
  onAction,
  placeholder,
  disabled,
  multiline = false,
  onKeyDown
}) {
  const activeQuery = activeMentionQuery(value);
  const query = activeQuery?.query ?? null;
  const userSuggestions = useMemo(
    () => query !== null ? filterMentionUsers(query, users) : [],
    [query, users]
  );
  const actionSuggestions = useMemo(
    () => query !== null ? filterMentionActions(query, mentionActions) : [],
    [query, mentionActions]
  );
  // 통합 후보 리스트: 액션 멘션을 먼저(상단), 그다음 유저 멘션. 방향키/Enter/Tab 내비는 이 리스트 기준.
  const items = useMemo(
    () => [
      ...actionSuggestions.map((action) => ({ kind: "action", action })),
      ...userSuggestions.map((user) => ({ kind: "user", user }))
    ],
    [actionSuggestions, userSuggestions]
  );
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const Field = multiline ? "textarea" : "input";
  const isOpen = items.length > 0 && !dismissed;
  const activeIndex = Math.min(highlightIndex, items.length - 1);

  useEffect(() => {
    setHighlightIndex(0);
    setDismissed(false);
  }, [query]);

  // 활성 "@쿼리" 조각을 입력에서 제거(액션 선택 시 텍스트 삽입 대신 동작 위임 → 잔여 토큰 제거).
  function clearActiveMention() {
    const text = String(value ?? "");
    const active = activeMentionQuery(text);
    if (!active) return;
    const before = text.slice(0, active.start);
    const after = text.slice(active.start + active.query.length + 1);
    onChange(`${before}${after}`);
  }

  function insertMention(user) {
    const text = String(value ?? "");
    const active = activeMentionQuery(text);
    if (!active) return;
    const before = text.slice(0, active.start);
    const after = text.slice(active.start + active.query.length + 1);
    onChange(`${before}@${user.name} ${after}`.replace(/\s+$/, " "));
  }

  function selectItem(item) {
    if (!item) return;
    if (item.kind === "action") {
      // 액션 멘션: 텍스트를 넣지 않고 모듈이 선언한 동작(딥링크 등)으로 위임한다.
      clearActiveMention();
      setDismissed(true);
      onAction?.(item.action);
      return;
    }
    insertMention(item.user);
  }

  function handleKeyDown(event) {
    if (isOpen && !isComposingEvent(event)) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightIndex((index) => (index + 1) % items.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightIndex((index) => (index - 1 + items.length) % items.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const choice = items[activeIndex];
        if (choice) {
          event.preventDefault();
          selectItem(choice);
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
          {items.map((item, index) =>
            item.kind === "action" ? (
              <button
                type="button"
                key={`action:${item.action.token}`}
                role="option"
                aria-selected={index === activeIndex}
                className={`mention-action${index === activeIndex ? " active" : ""}`}
                onMouseEnter={() => setHighlightIndex(index)}
                onClick={() => selectItem(item)}
              >
                <strong>@{item.action.token}</strong>
                <span>{item.action.description || item.action.label}</span>
              </button>
            ) : (
              <button
                type="button"
                key={item.user.id}
                role="option"
                aria-selected={index === activeIndex}
                className={index === activeIndex ? "active" : ""}
                onMouseEnter={() => setHighlightIndex(index)}
                onClick={() => selectItem(item)}
              >
                <strong>{item.user.name}</strong>
                <span>{item.user.email}</span>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
