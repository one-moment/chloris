// 기존 구글시트 → Chloris inventory DB 1회 import (Phase 5-2).
// 기존 시트는 건드리지 않는다(읽기 전용 CSV export 입력). 과거 lot/폐기를 적재해 과거 폐기가
// 과거 lot에 연결되도록 한다(폐기의 LotID(출처) → DisposalLine.sourceLotId).
//
// 사용법(먼저 시트의 입고/폐기 탭을 CSV로 export):
//   node scripts/import-inventory-sheet.mjs --stockin=입고.csv --disposal=폐기.csv          # dry-run(기본, DB 미접속)
//   node scripts/import-inventory-sheet.mjs --stockin=입고.csv --disposal=폐기.csv --branch=branch-gangnam-1 --commit
//
// 안전장치: --commit 없이는 절대 DB에 쓰지 않는다(파싱·검증 요약만 출력). --commit에는 --branch 필수.
// 운영 DB 쓰기는 사람 승인 후에만 실행할 것(AGENTS.md / HANDOFF).

import { readFileSync } from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.length ? rest.join("=") : true];
}));

const CATEGORY_MAP = { "오늘의꽃": "제작폐기_오늘의꽃", "오늘의 꽃": "제작폐기_오늘의꽃", "꽃다발": "제작폐기_꽃다발", "제작 꽃다발": "제작폐기_꽃다발", "기타": "기타" };

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ""));
}

function toNumber(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[₩,\s]/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function splitReason(raw) {
  const text = String(raw ?? "").trim();
  const match = text.match(/^(.+?)\((.+)\)$/);
  if (match) return { category: CATEGORY_MAP[match[1].trim()] ?? "기타", cause: match[2].trim() };
  return { category: "기타", cause: text };
}

function headerIndex(header, names) {
  for (const name of names) {
    const idx = header.findIndex((h) => String(h).trim() === name);
    if (idx >= 0) return idx;
  }
  return -1;
}

function loadCsv(path) {
  const rows = parseCsv(readFileSync(path, "utf8"));
  if (rows.length < 2) return { header: [], data: [] };
  return { header: rows[0].map((h) => String(h).trim()), data: rows.slice(1) };
}

function parseStockIn(path) {
  const { header, data } = loadCsv(path);
  const col = {
    lotId: headerIndex(header, ["LotID"]),
    supplier: headerIndex(header, ["거래처"]),
    date: headerIndex(header, ["입고일"]),
    item: headerIndex(header, ["품목"]),
    unitPrice: headerIndex(header, ["단가(원/송이)", "단가"]),
    quantity: headerIndex(header, ["입고수량"]),
    amount: headerIndex(header, ["입고가액(원)", "입고가액"])
  };
  const warnings = [];
  const lines = [];
  data.forEach((row, i) => {
    const itemName = String(row[col.item] ?? "").trim();
    const lotId = String(row[col.lotId] ?? "").trim();
    if (!itemName || !lotId) return;
    const quantity = toNumber(row[col.quantity]) ?? 0;
    const unitPrice = toNumber(row[col.unitPrice]) ?? 0;
    lines.push({
      lotId,
      supplier: String(row[col.supplier] ?? "").trim(),
      stockInDate: String(row[col.date] ?? "").trim(),
      itemName,
      unitPrice,
      quantity,
      amount: toNumber(row[col.amount]) ?? Math.round(unitPrice * quantity)
    });
    if (!unitPrice) warnings.push(`입고 ${i + 2}행(${itemName}): 단가 없음`);
  });
  return { lines, warnings };
}

function parseDisposal(path) {
  const { header, data } = loadCsv(path);
  const col = {
    date: headerIndex(header, ["폐기일"]),
    item: headerIndex(header, ["품목"]),
    quantity: headerIndex(header, ["폐기수량"]),
    sourceLot: headerIndex(header, ["LotID(출처)", "LotID"]),
    unitPrice: headerIndex(header, ["단가(원/송이)", "단가"]),
    amount: headerIndex(header, ["폐기가액(원)", "폐기가액"]),
    reason: headerIndex(header, ["폐기원인"])
  };
  if (col.date < 0) col.date = 0; // 폐기일 컬럼 헤더가 비어있는 export(첫 칸) 대응
  const warnings = [];
  const lines = [];
  data.forEach((row, i) => {
    const itemName = String(row[col.item] ?? "").trim();
    if (!itemName) return;
    const { category, cause } = splitReason(row[col.reason]);
    const sourceLotId = String(row[col.sourceLot] ?? "").trim() || null;
    lines.push({
      disposalDate: String(row[col.date] ?? "").trim(),
      itemName,
      quantity: toNumber(row[col.quantity]) ?? 0,
      sourceLotId,
      unitPrice: toNumber(row[col.unitPrice]),
      amount: toNumber(row[col.amount]),
      category,
      cause
    });
    if (!sourceLotId) warnings.push(`폐기 ${i + 2}행(${itemName}): 출처 LotID 없음(원가 미연결)`);
  });
  return { lines, warnings };
}

function summarize(label, lines, warnings) {
  console.log(`\n[${label}] ${lines.length}행`);
  if (lines[0]) console.log("  예시:", JSON.stringify(lines[0]));
  console.log(`  경고 ${warnings.length}건`);
  warnings.slice(0, 8).forEach((w) => console.log("   -", w));
  if (warnings.length > 8) console.log(`   ... 외 ${warnings.length - 8}건`);
}

async function main() {
  if (!args.stockin && !args.disposal) {
    console.log("사용법: node scripts/import-inventory-sheet.mjs --stockin=입고.csv --disposal=폐기.csv [--branch=<id> --commit]");
    process.exit(0);
  }

  const stockIn = args.stockin ? parseStockIn(args.stockin) : { lines: [], warnings: [] };
  const disposal = args.disposal ? parseDisposal(args.disposal) : { lines: [], warnings: [] };

  summarize("입고", stockIn.lines, stockIn.warnings);
  summarize("폐기", disposal.lines, disposal.warnings);

  const lotIds = new Set(stockIn.lines.map((l) => l.lotId));
  const linkable = disposal.lines.filter((l) => l.sourceLotId && lotIds.has(l.sourceLotId)).length;
  console.log(`\n폐기→입고 lot 연결 가능: ${linkable}/${disposal.lines.length}`);

  if (!args.commit) {
    console.log("\n[dry-run] DB에 쓰지 않았습니다. 실제 적재는 --branch=<id> --commit 을 붙여 (승인 후) 실행하세요.");
    return;
  }
  if (!args.branch) {
    console.error("\n[중단] --commit 에는 --branch=<branchId> 가 필요합니다(과거 행의 지점 귀속).");
    process.exit(1);
  }

  // 실제 DB 적재(운영 승인 후). prisma는 여기서만 동적 import → dry-run은 DB 미접속.
  const { prisma } = await import("../lib/prisma.js");
  const branchId = String(args.branch);
  const now = () => new Date();
  const gid = (p) => `${p}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  // 입고: (입고일+거래처)별 StockInDelivery로 묶어 적재(lotId 보존).
  const byDelivery = new Map();
  for (const line of stockIn.lines) {
    const key = `${line.stockInDate}__${line.supplier}`;
    if (!byDelivery.has(key)) byDelivery.set(key, []);
    byDelivery.get(key).push(line);
  }
  let stockInCount = 0;
  for (const [key, group] of byDelivery) {
    const [date, supplier] = key.split("__");
    const deliveryId = gid("stockin-import");
    await prisma.stockInDelivery.create({
      data: {
        id: deliveryId, branchId, supplier, statementDate: new Date(date), status: "submitted",
        sourceText: "[과거 시트 import]", createdAt: now(), updatedAt: now(),
        totalAmount: group.reduce((s, l) => s + (l.amount ?? 0), 0),
        lines: { create: group.map((l, i) => ({
          id: `${deliveryId}-line-${i + 1}`, lineIndex: i + 1, lotId: l.lotId, itemName: l.itemName,
          supplier, stockInDate: new Date(l.stockInDate || date), unit: "송이",
          unitPrice: l.unitPrice, quantity: l.quantity, amount: l.amount, status: "ok"
        })) }
      }
    });
    stockInCount += group.length;
  }

  // 폐기: 폐기일별 DisposalBatch로 묶어 적재(sourceLotId 보존).
  const byBatch = new Map();
  for (const line of disposal.lines) {
    if (!byBatch.has(line.disposalDate)) byBatch.set(line.disposalDate, []);
    byBatch.get(line.disposalDate).push(line);
  }
  let disposalCount = 0;
  for (const [date, group] of byBatch) {
    const batchId = gid("disposal-import");
    await prisma.disposalBatch.create({
      data: {
        id: batchId, branchId, disposalDate: new Date(date), status: "submitted",
        sourceText: "[과거 시트 import]", createdAt: now(), updatedAt: now(),
        lines: { create: group.map((l, i) => ({
          id: `${batchId}-line-${i + 1}`, lineIndex: i + 1, itemName: l.itemName, quantity: l.quantity,
          unit: "송이", category: l.category, cause: l.cause, sourceLotId: l.sourceLotId,
          unitPrice: l.unitPrice, amount: l.amount
        })) }
      }
    });
    disposalCount += group.length;
  }

  console.log(`\n[commit] 입고 ${stockInCount}행 / 폐기 ${disposalCount}행 적재 완료 (지점 ${branchId}).`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
