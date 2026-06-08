import { PURCHASE_AGENT_MENTIONS } from "./prompts";

const VENDOR_ALIASES = new Map([
  ["쿠팡", "coupang"],
  ["coupang", "coupang"],
  ["성원에드피아", "swadpia"],
  ["성원애드피아", "swadpia"],
  ["성원", "swadpia"],
  ["지마켓", "gmarket"],
  ["gmarket", "gmarket"],
  ["g마켓", "gmarket"],
  ["현대데코", "hyundaideco"]
]);

export const VENDOR_LABELS = {
  coupang: "쿠팡",
  swadpia: "성원애드피아",
  gmarket: "지마켓",
  hyundaideco: "현대데코",
  unknown: "미분류"
};

const URL_PATTERN = /(https?:\/\/\S+)/gi;
const SECTION_PATTERN = /^\(?\s*([^)]+?)\s*\)?$/u;
const QUANTITY_PATTERN = /(\d+)\s*(개씩|박스|개|매|권|세트|묶음|봉|롤)?/u;

function cleanLine(value) {
  return String(value ?? "")
    .replace(/^[\s*-]+/u, "")
    .replace(/^\d+\.\s*/u, "")
    .trim();
}

function stripMention(value) {
  let text = String(value ?? "");
  for (const mention of PURCHASE_AGENT_MENTIONS) text = text.replaceAll(mention, "");
  return text.trim();
}

function normalizeVendor(value) {
  const key = String(value ?? "").trim().toLowerCase();
  for (const [alias, vendor] of VENDOR_ALIASES.entries()) {
    if (key === alias.toLowerCase()) return vendor;
  }
  return null;
}

function parseRequester(line) {
  const match = cleanLine(line).match(/^이름\s*\/\s*소속\s*:\s*([^/]+)\s*\/\s*(.+)$/u);
  if (!match) return null;
  return {
    requesterName: match[1].trim(),
    requesterTeam: match[2].trim()
  };
}

function parseSection(line) {
  const cleaned = cleanLine(line);
  if (!cleaned) return null;
  const match = cleaned.match(SECTION_PATTERN);
  if (!match) return null;
  return normalizeVendor(match[1]);
}

function parseQuantity(value) {
  const match = String(value ?? "").match(QUANTITY_PATTERN);
  if (!match) return { quantity: null, unitLabel: null, notes: null };
  const rawUnit = match[2] ?? null;
  return {
    quantity: Number(match[1]),
    unitLabel: rawUnit === "개씩" ? "개" : rawUnit,
    notes: rawUnit === "개씩" ? "각 URL 1개씩" : null
  };
}

function parseItemLine(line, vendor, lineIndex) {
  const cleaned = cleanLine(line);
  if (/^(주문상품\s*내역|주문\s*내역)\s*:?$/u.test(cleaned)) return null;
  const urls = [...cleaned.matchAll(URL_PATTERN)].map((match) => match[1]);
  const withoutUrls = cleaned.replace(URL_PATTERN, "").trim();
  const [namePart, quantityPart] = withoutUrls.includes("/")
    ? withoutUrls.split("/").map((part) => part.trim())
    : [withoutUrls, ""];
  const parsedQuantity = parseQuantity(quantityPart || namePart);
  const itemName = (quantityPart ? namePart : namePart.replace(QUANTITY_PATTERN, "")).trim();
  if (!itemName && urls.length === 0) return null;

  return {
    lineIndex,
    vendor,
    itemName: itemName || "URL 상품",
    quantity: parsedQuantity.quantity,
    unitLabel: parsedQuantity.unitLabel,
    url: urls[0] ?? null,
    notes: parsedQuantity.notes,
    rawText: cleaned
  };
}

function appendUrlToLine(lines, url) {
  const last = lines.at(-1);
  if (!last) return false;
  if (!last.url) {
    last.url = url;
    last.rawText = `${last.rawText}\n${url}`;
    return true;
  }
  if (last.notes?.includes("각 URL")) {
    lines.push({
      ...last,
      lineIndex: lines.length + 1,
      url,
      rawText: `${last.itemName} / ${last.quantity ?? ""}${last.unitLabel ?? ""}\n${url}`
    });
    return true;
  }
  return false;
}

export function parseBulkPurchaseOrder(body) {
  const sourceText = stripMention(body);
  const rawLines = sourceText.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  let currentVendor = null;
  const lines = [];
  const requester = { requesterName: null, requesterTeam: null };

  for (const rawLine of rawLines) {
    const requesterInfo = parseRequester(rawLine);
    if (requesterInfo) {
      Object.assign(requester, requesterInfo);
      continue;
    }

    const sectionVendor = parseSection(rawLine);
    if (sectionVendor) {
      currentVendor = sectionVendor;
      continue;
    }

    const cleaned = cleanLine(rawLine);
    const urls = [...cleaned.matchAll(URL_PATTERN)].map((match) => match[1]);
    if (urls.length > 0 && cleaned.replace(URL_PATTERN, "").trim() === "") {
      for (const url of urls) {
        if (!appendUrlToLine(lines, url)) {
          lines.push({
            lineIndex: lines.length + 1,
            vendor: currentVendor ?? "unknown",
            itemName: "URL 상품",
            quantity: 1,
            unitLabel: "개",
            url,
            notes: "품목명 확인 필요",
            rawText: cleaned
          });
        }
      }
      continue;
    }

    const parsed = parseItemLine(cleaned, currentVendor ?? "unknown", lines.length + 1);
    if (parsed) lines.push(parsed);
  }

  const vendorCount = new Set(lines.map((line) => line.vendor)).size;
  return {
    ...requester,
    lines,
    sourceText,
    isBulkOrder: lines.length >= 2 || vendorCount >= 2
  };
}
