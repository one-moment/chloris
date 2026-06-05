function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function mentionTokensForUser(user) {
  return [user.name, user.handle, user.email]
    .filter(Boolean)
    .map((value) => `@${value}`);
}

export function getMentionedUserIds(text, users = []) {
  const body = String(text ?? "");
  return users
    .filter((user) => mentionTokensForUser(user).some((token) => body.includes(token)))
    .map((user) => user.id);
}

export function normalizeMentionIds(mentions, users = []) {
  const allowedIds = new Set(users.map((user) => user.id));
  return Array.from(new Set((mentions ?? []).filter((id) => allowedIds.has(id))));
}

export function filterMentionUsers(query, users = [], limit = 6) {
  const term = normalized(query);
  const ranked = users
    .filter((user) => {
      if (!term) return true;
      return [user.name, user.handle, user.email].some((value) => normalized(value).includes(term));
    })
    .sort((a, b) => normalized(a.name).localeCompare(normalized(b.name), "ko"));
  return ranked.slice(0, limit);
}
