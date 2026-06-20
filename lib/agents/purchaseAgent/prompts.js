export const PURCHASE_AGENT_SLUG = "purchase-agent";

export const PURCHASE_AGENT_MENTIONS = [
  "@구매에이전트",
  "@구매 에이전트",
  "@PurchaseAgent",
  "@purchase-agent"
];

const PURCHASE_AGENT_ORDER_PATTERN = /(재주문|주문|구매요청|구매)$/u;
const PURCHASE_AGENT_QUANTITY_PATTERN = /(\d+)\s*(박스|개|매|권|세트|묶음|봉|롤)/u;

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function stripPurchaseAgentMention(body) {
  let text = normalizeText(body);
  for (const mention of PURCHASE_AGENT_MENTIONS) {
    text = normalizeText(text.replaceAll(mention, ""));
  }
  return text;
}

export function isPurchaseAgentCommand(body) {
  const text = String(body ?? "");
  return PURCHASE_AGENT_MENTIONS.some((mention) => text.includes(mention));
}

export function validatePurchaseAgentCommand(body) {
  if (!isPurchaseAgentCommand(body)) return { valid: false, reason: "not_purchase_agent_command" };

  const commandText = stripPurchaseAgentMention(body);
  const withoutOrderWord = normalizeText(commandText.replace(PURCHASE_AGENT_ORDER_PATTERN, ""));
  if (!withoutOrderWord) return { valid: false, reason: "missing_item" };

  const quantityMatch = withoutOrderWord.match(PURCHASE_AGENT_QUANTITY_PATTERN);
  if (!quantityMatch) return { valid: false, reason: "missing_quantity", itemQuery: withoutOrderWord };

  const quantity = Number(quantityMatch[1]);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { valid: false, reason: "invalid_quantity", itemQuery: withoutOrderWord };
  }

  const itemQuery = normalizeText(withoutOrderWord.replace(PURCHASE_AGENT_QUANTITY_PATTERN, ""));
  if (!itemQuery) return { valid: false, reason: "missing_item" };

  return {
    valid: true,
    itemQuery,
    quantity,
    unitLabel: quantityMatch[2]
  };
}

export function toPurchaseBotCommand(body) {
  let text = String(body ?? "");
  for (const mention of PURCHASE_AGENT_MENTIONS) {
    text = text.replaceAll(mention, "@구매봇");
  }
  return text;
}

export const PURCHASE_AGENT_SYSTEM_PROMPT = [
  "You are the Purchase Agent inside the Chloris internal communication tool.",
  "You coordinate purchase requests, approval requests, and local worker jobs.",
  "Never automate payment. Stop after cart preparation and request human approval/review.",
  "Use deterministic registered tools when possible before attempting natural-language inference."
].join("\n");
