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
