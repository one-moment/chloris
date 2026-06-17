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

// 2단계: 직원 메시지를 업무 영역으로 분류하기 위한 OpenAI Responses input.
export function buildWorkIntentMessages(text) {
  const instruction = [
    "다음 직원 메시지를 purchase(발주)/reservation(예약)/stockin(입고)/disposal(폐기)/other(기타) 중 하나로 분류하라.",
    "설명 없이 JSON만 출력: {\"area\":\"...\"}."
  ].join("\n");
  return [
    {
      role: "user",
      content: [{ type: "input_text", text: `${instruction}\n\n직원 메시지: ${String(text ?? "")}` }]
    }
  ];
}

// area → 해당 업무 화면. moduleSlug는 lib/brand의 isModuleEnabled 게이팅에 쓴다.
export const WORK_ROUTES = {
  purchase: { moduleSlug: "purchase", label: "발주(구매 관리)", href: "/work/purchase" },
  reservation: { moduleSlug: "reservations", label: "예약 관리", href: "/work/reservations" },
  stockin: { moduleSlug: "stockin", label: "입고 관리", href: "/work/stock-in" },
  disposal: { moduleSlug: "disposal", label: "폐기 관리", href: "/work/disposal" }
};

export function buildRouteMessageLines({ label, href }) {
  return [
    `이건 ${label} 업무로 보여요.`,
    `여기서 처리하실 수 있어요: ${href}`
  ];
}
