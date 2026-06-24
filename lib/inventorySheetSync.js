// 구글시트 한 방향 연동 (Phase 5 — 사람 승인 후 활성). 기본은 비활성(skipped):
// env가 설정되지 않으면 외부 연결을 절대 시도하지 않는다. 기존 시트는 건드리지 않고
// 새로 만든 시트(분리)에만 append한다. Service Account 키는 env로만 주입(레포 저장 금지, AGENTS.md).
//
// 활성화에 필요한 env:
//   INVENTORY_SHEET_SYNC_ENABLED=1
//   INVENTORY_SHEET_ID=<새 스프레드시트 ID>
//   GOOGLE_SA_CLIENT_EMAIL / GOOGLE_SA_PRIVATE_KEY (Service Account)
//   (선택) INVENTORY_DISPOSAL_TAB(기본 "폐기"), INVENTORY_STOCKIN_TAB(기본 "입고")
import { createSign } from "node:crypto";

export function isSheetSyncConfigured() {
  return process.env.INVENTORY_SHEET_SYNC_ENABLED === "1"
    && Boolean(process.env.INVENTORY_SHEET_ID)
    && Boolean(process.env.GOOGLE_SA_CLIENT_EMAIL)
    && Boolean(process.env.GOOGLE_SA_PRIVATE_KEY);
}

function toDateStr(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

// 승인/반려 처리 시각: 한국시간(KST, UTC+9) "YYYY-MM-DD HH:mm". 라이브러리 없이 +9h 후 ISO 절단.
function toDateTimeKstStr(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16).replace("T", " ");
}

// 승인상태 칸 표기: 코드 상태값 → 사람이 읽는 말(승인/반려). 그 외 상태는 원값 노출.
const DISPOSAL_DECISION_LABEL = { submitted: "승인", rejected: "반려" };

// ── 컬럼 매핑 (순수, 테스트 가능) — 시트 컬럼 순서와 1:1 ──
// 기존 11칸(날짜~폐기가액)은 순서·내용 고정. 12~15칸(승인정보)은 "맨 뒤"에만 추가(이미 쌓인 시트 정렬 보존).
// 승인 행: 처리자/시각은 batch.approvedByName/approvedAt에서 자동. 반려 행: DB에 반려자/시각이 없어
// 호출 측이 decidedByName/decidedAt 옵션으로 전달한다(스키마 변경 회피).
export function disposalSheetRows(batch, { branchName, author, decidedByName, decidedAt } = {}) {
  const date = toDateStr(batch.disposalDate);
  const decidedBy = decidedByName ?? batch.approvedByName ?? "";
  const decidedTime = toDateTimeKstStr(decidedAt ?? batch.approvedAt);
  const statusLabel = DISPOSAL_DECISION_LABEL[batch.status] ?? batch.status ?? "";
  const rejectReason = batch.rejectReason ?? "";
  return (batch.lines ?? []).map((line) => ([
    date,
    branchName ?? batch.branchId,
    author ?? "",
    line.itemName,
    line.quantity,
    line.unit,
    line.category,
    line.cause,
    line.sourceLotId ?? "",
    line.unitPrice ?? "",
    line.amount ?? "",
    decidedBy,      // 12 승인매니저(반려 시 반려를 처리한 매니저)
    decidedTime,    // 13 승인일시(반려 시 반려 처리 시각, KST)
    statusLabel,    // 14 승인상태 (승인 / 반려)
    rejectReason    // 15 반려사유 (승인 행은 빈칸)
  ]));
}

export function stockInSheetRows(delivery, { branchName } = {}) {
  const date = toDateStr(delivery.statementDate);
  return (delivery.lines ?? []).map((line) => ([
    line.lotId,
    delivery.supplier,
    date,
    branchName ?? delivery.branchId,
    line.itemName,
    line.unitPrice,
    line.quantity,
    line.amount,
    line.orderedQty ?? "",
    line.receiptQty ?? "",
    line.status,
    line.note ?? ""
  ]));
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

// Service Account JWT → access token (spreadsheets scope). 설정된 경우에만 호출된다.
async function getAccessToken() {
  const email = process.env.GOOGLE_SA_CLIENT_EMAIL;
  const privateKey = String(process.env.GOOGLE_SA_PRIVATE_KEY).replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = signer.sign(privateKey).toString("base64url");
  const assertion = `${header}.${claim}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion })
  });
  if (!response.ok) throw new Error(`Google token request failed (${response.status})`);
  const data = await response.json();
  return data.access_token;
}

async function appendRows(tabName, rows) {
  const sheetId = process.env.INVENTORY_SHEET_ID;
  const token = await getAccessToken();
  const range = `${tabName}!A1`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: rows })
  });
  if (!response.ok) throw new Error(`Sheets append failed (${response.status})`);
  return response.json();
}

export async function syncDisposalBatch(batch, options = {}) {
  if (!isSheetSyncConfigured()) return { skipped: true, reason: "sheet_sync_disabled" };
  const rows = disposalSheetRows(batch, options);
  if (rows.length === 0) return { skipped: true, reason: "no_rows" };
  await appendRows(process.env.INVENTORY_DISPOSAL_TAB ?? "폐기", rows);
  return { skipped: false, count: rows.length };
}

export async function syncStockInDelivery(delivery, options = {}) {
  if (!isSheetSyncConfigured()) return { skipped: true, reason: "sheet_sync_disabled" };
  const rows = stockInSheetRows(delivery, options);
  if (rows.length === 0) return { skipped: true, reason: "no_rows" };
  await appendRows(process.env.INVENTORY_STOCKIN_TAB ?? "입고", rows);
  return { skipped: false, count: rows.length };
}
