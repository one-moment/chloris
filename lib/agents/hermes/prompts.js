export const HERMES_AGENT_SLUG = "hermes-agent";

export const HERMES_AGENT_MENTIONS = ["@헤르메스", "@hermes", "@Hermes"];

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function isHermesAgentCommand(body) {
  const text = String(body ?? "");
  return HERMES_AGENT_MENTIONS.some((mention) => text.includes(mention));
}

export function stripHermesAgentMention(body) {
  let text = normalizeText(body);
  for (const mention of HERMES_AGENT_MENTIONS) {
    text = normalizeText(text.replaceAll(mention, ""));
  }
  return text;
}

export const HERMES_HELP_LINES = [
  "안녕하세요, 업무지원 비서 헤르메스입니다.",
  "앞으로 발주·예약·입고·폐기를 채팅으로 바로 도와드릴게요.",
  "지금은 준비 단계라 인사만 드립니다.",
  "",
  "예) @헤르메스 발주 도와줘 · @헤르메스 예약 확인"
];
