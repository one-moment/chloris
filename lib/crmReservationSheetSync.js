// 예약 → 구글시트 한 줄 append (CRM Phase 3 Part B). 기본 비활성(env 미설정 시 no-op).
// import 소스 시트와 분리된 NEW 시트에만 쓴다. 베스트-에포트: 시트 실패가 예약 생성을 깨면 안 된다
// (호출 측에서 try/catch로 감싸 비치명적으로 처리). 고객 데이터는 시트(운영 기록)로만 나가며
// 로그/커밋에는 남기지 않는다(AGENTS.md).
//
// 활성 env:
//   CRM_RESERVATION_SHEET_ID = 새 스프레드시트 ID (import 소스 시트와 분리)
//   + 자격증명: GOOGLE_APPLICATION_CREDENTIALS(파일경로) | GOOGLE_SA_CLIENT_EMAIL+GOOGLE_SA_PRIVATE_KEY
//   (선택) CRM_RESERVATION_SHEET_TAB (기본 "예약")
import { appendSheetRows, hasServiceAccount } from "./googleSheets";

export function isReservationSheetConfigured() {
  return Boolean(process.env.CRM_RESERVATION_SHEET_ID) && hasServiceAccount();
}

function toDateStr(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function toDateTimeStr(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16).replace("T", " ");
}

// 시트 컬럼 순서와 1:1 (순수, 테스트 가능).
export function reservationSheetRow(reservation, { branchName } = {}) {
  return [
    toDateStr(reservation.reservedAt),
    toDateTimeStr(reservation.pickupAt),
    branchName ?? reservation.branchId ?? "",
    reservation.customerName ?? "",
    reservation.customerPhone ?? "",
    reservation.product ?? "",
    reservation.amount ?? "",
    reservation.source ?? "",
    reservation.receiveMethod ?? "",
    reservation.status ?? "",
    reservation.note ?? "",
    reservation.id ?? ""
  ];
}

export async function syncReservation(reservation, options = {}) {
  if (!isReservationSheetConfigured()) return { skipped: true, reason: "sheet_sync_disabled" };
  const row = reservationSheetRow(reservation, options);
  await appendSheetRows(
    process.env.CRM_RESERVATION_SHEET_ID,
    process.env.CRM_RESERVATION_SHEET_TAB ?? "예약",
    [row]
  );
  return { skipped: false, count: 1 };
}
