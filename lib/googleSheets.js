// 구글 시트 v4 공용 헬퍼 (Service Account JWT → access token → values:append / spreadsheets.get).
// 시크릿은 env로만 주입한다 — 키/JSON을 레포 파일에 저장·커밋 금지(AGENTS.md, .gitignore).
//
// 자격증명 해석 우선순위:
//   1) GOOGLE_APPLICATION_CREDENTIALS = 서비스계정 JSON 파일 경로 (로컬/표준 GCP 관례)
//   2) GOOGLE_SA_CLIENT_EMAIL + GOOGLE_SA_PRIVATE_KEY = 인라인 (Vercel 등 파일 없는 환경)
// 둘 다 없으면 null → 호출 측이 no-op로 degrade한다(외부 연결 시도 안 함).
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

export function resolveServiceAccount() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    try {
      const json = JSON.parse(readFileSync(credPath, "utf8"));
      if (json.client_email && json.private_key) {
        return { clientEmail: json.client_email, privateKey: json.private_key };
      }
    } catch {
      return null;
    }
  }
  const clientEmail = process.env.GOOGLE_SA_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SA_PRIVATE_KEY;
  if (clientEmail && privateKey) {
    return { clientEmail, privateKey: String(privateKey).replace(/\\n/g, "\n") };
  }
  return null;
}

export function hasServiceAccount() {
  return Boolean(resolveServiceAccount());
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

// 설정된 경우에만 호출된다(호출 측이 hasServiceAccount로 게이팅).
export async function getAccessToken(scope = "https://www.googleapis.com/auth/spreadsheets") {
  const sa = resolveServiceAccount();
  if (!sa) throw new Error("No Google service account configured");
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: sa.clientEmail,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = signer.sign(sa.privateKey).toString("base64url");
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

export async function appendSheetRows(sheetId, tabName, rows) {
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

// 읽기 전용 메타데이터(제목·탭) — 자격증명/공유 상태 헬스 체크용.
export async function getSpreadsheetMeta(sheetId) {
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title,sheets.properties.title`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Sheets get failed (${response.status})`);
  return response.json();
}
