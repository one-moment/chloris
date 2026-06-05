const KOREA_TIME_ZONE = "Asia/Seoul";
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: KOREA_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "long",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23"
});

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function koreanParts(value) {
  const date = parseDate(value);
  if (!date) return null;
  const parts = Object.fromEntries(dateTimeFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: parts.weekday,
    hour: Number(parts.hour),
    minute: Number(parts.minute)
  };
}

function dayNumber(parts) {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / (24 * HOUR_MS));
}

function timeLabel(parts) {
  const period = parts.hour < 12 ? "오전" : "오후";
  const hour = parts.hour % 12 || 12;
  return `${period} ${hour}:${String(parts.minute).padStart(2, "0")}`;
}

export function isSameKoreanDate(a, b) {
  const first = koreanParts(a);
  const second = koreanParts(b);
  if (!first || !second) return false;
  return first.year === second.year && first.month === second.month && first.day === second.day;
}

export function formatRelativeDateTime(value, nowValue = new Date()) {
  const date = parseDate(value);
  if (!date) return value || "";

  const now = parseDate(nowValue) ?? new Date();
  const elapsedMs = Math.max(0, now.getTime() - date.getTime());
  if (elapsedMs < MINUTE_MS) return "방금 전";
  if (elapsedMs < HOUR_MS) return `${Math.floor(elapsedMs / MINUTE_MS)}분 전`;

  const parts = koreanParts(date);
  const nowParts = koreanParts(now);
  if (!parts || !nowParts) return "";

  const dayDiff = dayNumber(nowParts) - dayNumber(parts);
  if (dayDiff === 0) return timeLabel(parts);
  if (dayDiff === 1) return `어제 ${timeLabel(parts)}`;
  if (parts.year === nowParts.year) return `${parts.month}월 ${parts.day}일 ${timeLabel(parts)}`;
  return `${parts.year}년 ${parts.month}월 ${parts.day}일 ${timeLabel(parts)}`;
}

export function formatChatDateDivider(value, nowValue = new Date()) {
  const parts = koreanParts(value);
  const nowParts = koreanParts(nowValue);
  if (!parts || !nowParts) return "";

  const dayDiff = dayNumber(nowParts) - dayNumber(parts);
  if (dayDiff === 0) return "오늘";
  if (dayDiff === 1) return "어제";
  if (parts.year === nowParts.year) return `${parts.month}월 ${parts.day}일 ${parts.weekday}`;
  return `${parts.year}년 ${parts.month}월 ${parts.day}일 ${parts.weekday}`;
}
