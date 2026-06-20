import { PURCHASE_BOT_MENTION } from "./constants";

const ORDER_WORD_PATTERN = /(재주문|주문|구매요청|구매)$/u;
const QUANTITY_PATTERN = /(\d+)\s*(박스|개|매|권|세트|묶음|봉|롤)/u;
const ITEM_SEPARATOR_PATTERN = /\s*(?:,|，|;|；|\n|\r|그리고|\/)\s*/u;

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function parseAliases(value) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isPurchaseBotCommand(body) {
  return normalizeText(body).includes(PURCHASE_BOT_MENTION);
}

export function parsePurchaseCommand(body) {
  const text = normalizeText(body);
  if (!isPurchaseBotCommand(text)) return null;

  const afterMention = normalizeText(text.slice(text.indexOf(PURCHASE_BOT_MENTION) + PURCHASE_BOT_MENTION.length));
  return parsePurchasePart(afterMention, text);
}

export function parsePurchaseCommands(body) {
  const text = String(body ?? "").trim();
  if (!isPurchaseBotCommand(text)) return [];

  const afterMention = text.slice(text.indexOf(PURCHASE_BOT_MENTION) + PURCHASE_BOT_MENTION.length);
  return afterMention
    .split(ITEM_SEPARATOR_PATTERN)
    .map((part) => parsePurchasePart(part, text))
    .filter((parsed) => parsed?.itemQuery);
}

function parsePurchasePart(value, rawText) {
  const afterMention = normalizeText(value);
  const withoutOrderWord = normalizeText(afterMention.replace(ORDER_WORD_PATTERN, ""));
  const quantityMatch = withoutOrderWord.match(QUANTITY_PATTERN);
  const quantity = quantityMatch ? Number(quantityMatch[1]) : null;
  const unitLabel = quantityMatch?.[2] ?? null;
  const itemQuery = normalizeText(withoutOrderWord.replace(QUANTITY_PATTERN, "").replace(ORDER_WORD_PATTERN, ""));

  return {
    raw: rawText,
    itemQuery,
    quantity,
    unitLabel
  };
}

export function matchPurchaseItems(parsedCommand, items) {
  if (!parsedCommand?.itemQuery) return [];
  const query = parsedCommand.itemQuery.toLowerCase();
  return items.filter((item) => {
    const aliases = parseAliases(item.aliasesJson);
    return [item.name, ...aliases].some((alias) => query.includes(String(alias).toLowerCase()) || String(alias).toLowerCase().includes(query));
  });
}
