// 보로 "[보로] 지점별 예약현황" 구글시트 → CRM(Customer/Reservation) import.
// 현재 모드: DRY-RUN only (읽기+파싱+검증, DB 미접속). --apply 경로는 프리뷰 승인 후 추가 예정.
// 인증: 서비스계정 키를 env GOOGLE_APPLICATION_CREDENTIALS(파일 경로)로 받음. 키는 레포에 저장하지 않음.
// 실행: GOOGLE_APPLICATION_CREDENTIALS=/path/key.json node scripts/import-boro-reservations.mjs
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

const SHEET_ID = process.env.BORO_SHEET_ID || "1Fdgg0fadn4F3gfCW3d8EoNv-KE-KOoLuB1_V8Qz-r7A";
const BRANCH_BY_HO = { 1: "강남1호점", 2: "강남2호점", 3: "잠실점" };
const HEADERS = ["성함", "연락처", "예약 날짜", "픽업 일시", "상품", "결제금액", "예약 경로", "수령방법", "비고"];

const key = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"));
const b64url = (buf) => Buffer.from(buf).toString("base64url");

async function getToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const sig = crypto.sign("RSA-SHA256", Buffer.from(`${header}.${claim}`), key.private_key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claim}.${sig}` })
  });
  const json = await res.json();
  if (!json.access_token) throw new Error("token error: " + JSON.stringify(json));
  return json.access_token;
}

const api = (token, path) => fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${path}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

// "(26년 6월)3호점" → { year:2026, month:6, ho:3 }. 무년도 "(7월)1호점" → 2023(가장 오래된 데이터).
// "…의 사본" 복사본 탭은 제외(중복 방지).
function parseTabName(title) {
  if (title.includes("사본")) return null;
  let m = title.match(/\((\d{2})년\s*(\d{1,2})월\)\s*(\d)호점/);
  if (m) return { year: 2000 + Number(m[1]), month: Number(m[2]), ho: Number(m[3]) };
  m = title.match(/^\((\d{1,2})월\)\s*(\d)호점/);
  if (m) return { year: 2023, month: Number(m[1]), ho: Number(m[2]) };
  return null;
}
// 제목 셀 "2026년 6월 1호점 예약현황" → ho 숫자(불일치 점검용)
function hoFromTitleCell(text) {
  const m = String(text ?? "").match(/(\d)호점/);
  return m ? Number(m[1]) : null;
}
// "26/06/02" → "2026-06-02" (실패 시 null)
function parseDate(v) {
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{2})\/(\d{1,2})\/(\d{1,2})/);
  if (m) return `20${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  return null;
}
function parseAmount(v) {
  const digits = String(v ?? "").replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
}

const token = await getToken();
const meta = await api(token, `?fields=properties.title,sheets.properties(title,sheetId)`);
const allTabs = (meta.sheets ?? []).map((s) => s.properties.title);
const monthTabs = allTabs.filter((t) => parseTabName(t));
const skippedTabs = allTabs.filter((t) => !parseTabName(t));

// batchGet 으로 월탭 값 일괄 조회(A1:I1000)
const ranges = monthTabs.map((t) => `ranges=${encodeURIComponent(`${t}!A1:I1000`)}`).join("&");
const batch = await api(token, `/values:batchGet?${ranges}&majorDimension=ROWS`);
const valueRanges = batch.valueRanges ?? [];

const report = {
  sheetTitle: meta.properties?.title,
  totalTabs: allTabs.length,
  monthTabs: monthTabs.length,
  skippedTabs,
  perBranch: { 강남1호점: { rows: 0 }, 강남2호점: { rows: 0 }, 잠실점: { rows: 0 } },
  totalRows: 0,
  validRows: 0,
  skippedNonReservation: 0,
  distinctCustomers: 0,
  issues: { badDate: 0, emptyDate: 0, badAmount: 0, emptyAmount: 0, missingPhone: 0, missingReceiveMethod: 0, branchTitleMismatch: 0 },
  badDateSamples: [],
  badAmountSamples: [],
  mismatchTabs: [],
  dateRange: { min: null, max: null },
  samples: []
};
const phones = new Set();

monthTabs.forEach((tab, i) => {
  const info = parseTabName(tab);
  const branchName = BRANCH_BY_HO[info.ho];
  const rows = valueRanges[i]?.values ?? [];
  // 제목 셀 호점 vs 탭명 호점 불일치 점검
  const titleHo = hoFromTitleCell(rows[0]?.[0]);
  if (titleHo && titleHo !== info.ho) {
    report.issues.branchTitleMismatch += 1;
    report.mismatchTabs.push({ tab, tabHo: info.ho, titleHo });
  }
  // 헤더 행 찾기(성함 포함 행)
  const headerIdx = rows.findIndex((r) => (r ?? []).some((c) => String(c).includes("성함")));
  const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows.slice(2);
  for (const r of dataRows) {
    const name = String(r?.[0] ?? "").trim();
    const phone = String(r?.[1] ?? "").trim();
    const phoneDigits = phone.replace(/[^0-9]/g, "");
    // 진짜 예약 행은 B열에 유효 전화번호(식별키)가 있다. 하단 요약·통계 행(#REF!/비중%/카운트)은 제외.
    if (!/^0\d{8,10}$/.test(phoneDigits)) {
      if (name || phone) report.skippedNonReservation += 1;
      continue;
    }
    report.totalRows += 1;
    report.validRows += 1;
    report.perBranch[branchName].rows += 1;
    phones.add(phone);
    const reservedAt = parseDate(r?.[2]);
    const pickupAt = parseDate(r?.[3]);
    const amount = parseAmount(r?.[5]);
    if (!reservedAt && !pickupAt) {
      report.issues.badDate += 1;
      if (!String(r?.[2] ?? "").trim() && !String(r?.[3] ?? "").trim()) report.issues.emptyDate += 1;
      else if (report.badDateSamples.length < 12) report.badDateSamples.push({ tab, c: r?.[2] ?? "", d: r?.[3] ?? "" });
    }
    if (amount === null) {
      report.issues.badAmount += 1;
      if (!String(r?.[5] ?? "").trim()) report.issues.emptyAmount += 1;
      else if (report.badAmountSamples.length < 12) report.badAmountSamples.push({ tab, f: r?.[5] ?? "" });
    }
    if (!String(r?.[7] ?? "").trim()) report.issues.missingReceiveMethod += 1;
    const d = reservedAt || pickupAt;
    if (d) {
      if (!report.dateRange.min || d < report.dateRange.min) report.dateRange.min = d;
      if (!report.dateRange.max || d > report.dateRange.max) report.dateRange.max = d;
    }
    if (report.samples.length < 5) {
      report.samples.push({ branch: branchName, name, phone, reservedAt, pickupAt, product: r?.[4], amount, source: r?.[6], receiveMethod: r?.[7] || null, note: r?.[8] || null });
    }
  }
});
report.distinctCustomers = phones.size;

console.log(JSON.stringify(report, null, 2));
