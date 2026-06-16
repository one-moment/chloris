// 입고·폐기 모듈 공용 상수 (코어 lib — API 라우트·서버 코드가 공유한다).
// 구분(category)은 변경 빈도가 낮고 통계 키라 코드 상수로 고정한다(박선영 표준, 2026-06-15 확정).
// 폐기원인(cause)은 DisposalCause 마스터(관리자 관리). 설계: docs/inventory-stockin-disposal.md

export const DISPOSAL_CATEGORIES = ["기타", "제작폐기_꽃다발", "제작폐기_오늘의꽃"];

// 폐기 시 출처 lot 자동 추천 창(일). 폐기일 기준 [date - N일, date] 입고 lot을 추천한다.
export const DEFAULT_LOT_WINDOW_DAYS = 4;

export function isValidDisposalCategory(value) {
  return DISPOSAL_CATEGORIES.includes(value);
}

// 최종제출 검증 게이트(서버 권위). itemNames/causeNames 는 활성 마스터 이름 Set.
// 한 줄이라도 오류면 저장 불가(박선영 요청 4). 반환: [{ lineIndex, field, message }].
export function validateDisposalLines(lines, { itemNames, causeNames }) {
  const errors = [];
  (Array.isArray(lines) ? lines : []).forEach((line, index) => {
    const lineNo = index + 1;
    const name = String(line?.itemName ?? "").trim();
    if (!name) {
      errors.push({ lineIndex: lineNo, field: "itemName", message: `${lineNo}행: 품목명을 입력하세요.` });
    } else if (!itemNames.has(name)) {
      errors.push({ lineIndex: lineNo, field: "itemName", message: `${lineNo}행: 등록된 품목명과 일치하지 않습니다 (${name}).` });
    }

    const qty = Number(line?.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      errors.push({ lineIndex: lineNo, field: "quantity", message: `${lineNo}행: 수량은 0보다 커야 합니다.` });
    }

    if (!isValidDisposalCategory(line?.category)) {
      errors.push({ lineIndex: lineNo, field: "category", message: `${lineNo}행: 구분을 선택하세요.` });
    }

    const cause = String(line?.cause ?? "").trim();
    if (!cause || !causeNames.has(cause)) {
      errors.push({ lineIndex: lineNo, field: "cause", message: `${lineNo}행: 등록된 폐기원인을 선택하세요.` });
    }
  });
  return errors;
}

// ── 검수·승인 상태 머신 ────────────────────────────────────────────────────
// draft(임시저장) → review(검수대기: 작성자 검수요청, 시트 미반영)
// review → submitted(매니저 승인: 시트 반영) / rejected(매니저 반려)
// rejected → draft|review(작성자 수정 후 재요청). submitted는 종착(metrics·시트 기준 유지).
export const DISPOSAL_STATUS_LABELS = {
  draft: "임시저장",
  review: "검수대기",
  submitted: "승인",
  rejected: "반려"
};

export const DISPOSAL_TRANSITIONS = {
  draft: ["draft", "review"],
  review: ["submitted", "rejected"],
  rejected: ["draft", "review"],
  submitted: []
};

export function canTransitionDisposal(from, to) {
  return (DISPOSAL_TRANSITIONS[from] ?? []).includes(to);
}

// 작성자가 폼에서 보낼 수 있는 상태(최종제출=검수요청). submitted는 매니저 승인으로만 도달.
export function normalizeAuthorStatus(value) {
  return value === "review" || value === "submitted" ? "review" : "draft";
}

// ── 스윗형 폐기기록 본문 생성 (순수) ──────────────────────────────────────
// 헤더(작성자/소속/폐기일) → 구분별 그룹(품목 수량단위 / 폐기원인) → 첨부/담당매니저/상태.
// 시트 컬럼 매핑(disposalSheetRows)과 같은 폐기 record에서 파생해 본문·시트 불일치를 막는다.
function toDateText(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function formatDisposalPostBody({
  authorName,
  branchName,
  disposalDate,
  lines = [],
  managerHandle,
  status = "review",
  attachmentCount = 0
} = {}) {
  const head = [
    `작성자 : ${authorName ?? ""}`,
    `소속 : ${branchName ?? ""}`,
    `폐기일 : ${toDateText(disposalDate)}`
  ].join("\n");

  // 구분 순서는 표준 3종 우선, 그 외 카테고리는 뒤에 등장 순으로.
  const order = [...DISPOSAL_CATEGORIES];
  for (const line of lines) {
    if (line?.category && !order.includes(line.category)) order.push(line.category);
  }
  const sections = order
    .map((category) => {
      const rows = lines.filter((line) => (line?.category ?? "") === category);
      if (rows.length === 0) return null;
      const body = rows
        .map((line) => `${line.itemName} ${line.quantity}${line.unit ?? ""} / ${line.cause}`)
        .join("\n");
      return `(${category})\n${body}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const footer = [
    attachmentCount > 0 ? `첨부사진 ${attachmentCount}장` : "첨부사진",
    managerHandle ? `담당매니저 : ${managerHandle}` : null,
    `상태 : ${DISPOSAL_STATUS_LABELS[status] ?? status}`
  ].filter(Boolean).join("\n");

  return [head, "---", sections || "(폐기 항목 없음)", "---", footer].join("\n\n");
}
