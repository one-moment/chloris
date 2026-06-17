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

// 3단계: 예약 미리채움용 비PII 옵션(crm 모듈과 값 일치 — lib는 modules를 import하지 않으므로 여기 상수로 둔다).
export const RESERVATION_SOURCE_OPTIONS = ["인스타", "네이버플레이스", "네이버톡톡", "네이버검색", "매장방문", "전화예약", "지인"];
export const RESERVATION_RECEIVE_OPTIONS = ["방문수령", "퀵"];

function todayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

// 2·3단계: 직원 메시지를 업무 영역으로 분류 + area=reservation이면 비PII 예약정보 추출.
export function buildWorkIntentMessages(text) {
  const instruction = [
    "다음 직원 메시지를 purchase(발주)/reservation(예약)/stockin(입고)/disposal(폐기)/other(기타) 중 하나로 분류하라.",
    "area가 reservation이면 메시지에서 비PII 예약 정보도 함께 추출하라(모르는 값은 null).",
    `오늘 날짜(Asia/Seoul)는 ${todayInSeoul()}이다. "내일 오후 3시" 같은 상대 표현은 이 기준으로 해석하라.`,
    "pickupAt은 시간대 표기 없는 로컬 \"YYYY-MM-DDTHH:mm\" 형식으로만 출력하라.",
    `source는 다음 중 하나이거나 null: ${RESERVATION_SOURCE_OPTIONS.join(" / ")}.`,
    `receiveMethod는 다음 중 하나이거나 null: ${RESERVATION_RECEIVE_OPTIONS.join(" / ")}.`,
    "고객 성함·연락처는 절대 추출하거나 출력하지 마라.",
    "설명 없이 JSON만 출력:",
    "{\"area\":\"...\",\"reservation\":{\"product\":string|null,\"amount\":number|null,\"pickupAt\":\"YYYY-MM-DDTHH:mm\"|null,\"receiveMethod\":\"방문수령\"|\"퀵\"|null,\"source\":string|null}}",
    "area가 reservation이 아니면 reservation은 null로 둬라."
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

// 3단계: 추출된 비PII 예약 정보를 미리채움 쿼리스트링으로. 성함·연락처(name/phone)는 절대 포함하지 않는다(PII).
export function buildReservationPrefillQuery(reservation) {
  if (!reservation || typeof reservation !== "object") return "";
  const params = [];
  const add = (key, value) => {
    if (value === null || value === undefined) return;
    const text = String(value).trim();
    if (!text) return;
    params.push(`${key}=${encodeURIComponent(text)}`);
  };
  add("product", reservation.product);
  if (typeof reservation.amount === "number" && Number.isFinite(reservation.amount)) {
    add("amount", reservation.amount);
  }
  add("pickup", reservation.pickupAt);
  if (RESERVATION_RECEIVE_OPTIONS.includes(reservation.receiveMethod)) add("receive", reservation.receiveMethod);
  if (RESERVATION_SOURCE_OPTIONS.includes(reservation.source)) add("source", reservation.source);
  return params.join("&");
}
