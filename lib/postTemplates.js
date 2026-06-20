// Post template helpers (core, client-safe). Templates are free text; the first
// line becomes the post title and the rest becomes the body. Insert-time tokens
// are resolved against the current channel/user.

function formatToday(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function resolveTemplateTokens(text, { branchName, userName, date } = {}) {
  return String(text ?? "")
    .replaceAll("{{지점}}", branchName || "")
    .replaceAll("{{오늘}}", formatToday(date))
    .replaceAll("{{작성자}}", userName || "");
}

export function applyTemplate(template, context = {}) {
  const resolved = resolveTemplateTokens(template?.body, context);
  const lines = resolved.split("\n");
  return {
    title: (lines[0] ?? "").trim(),
    body: lines.slice(1).join("\n").trim()
  };
}
