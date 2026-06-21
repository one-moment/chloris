import { sendToUser, isPushConfigured } from "./push";

// 알림 body 미리보기 — 1줄화 + n자 컷(줄바꿈/본문 과다노출 방지). 로그엔 쓰지 않음.
function preview(text, max = 100) {
  const oneLine = String(text ?? "").replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

// 4단계 이벤트→알림 템플릿. 멘션 알림: 대상 = 멘션 userId − 작성자(본인 제외).
// 비차단(fire-and-forget) 호출 전제 — 내부에서 기기별 에러는 sendToUser가 격리.
// 민감값(구독 endpoint·본문 전체) 로그 금지.
export async function notifyMention({ recipientIds = [], authorId, authorName, channelId, body } = {}) {
  if (!isPushConfigured()) return { configured: false, targets: 0, sent: 0 };

  const targets = [...new Set(recipientIds)].filter((id) => id && id !== authorId);
  if (targets.length === 0) return { configured: true, targets: 0, sent: 0 };

  const payload = {
    title: `${authorName || "보로"}님이 멘션했어요`,
    body: preview(body),
    url: channelId ? `/chat/${channelId}` : "/"
  };

  const results = await Promise.allSettled(targets.map((id) => sendToUser(id, payload)));
  let sent = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled") sent += r.value?.sent ?? 0;
    else failed += 1;
  }
  if (failed > 0) console.error(`mention push: ${failed}/${targets.length} target(s) failed`);
  return { configured: true, targets: targets.length, sent };
}
