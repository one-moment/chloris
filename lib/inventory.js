// 입고·폐기 모듈 공용 상수 (코어 lib — API 라우트·서버 코드가 공유한다).
// 구분(category)은 변경 빈도가 낮고 통계 키라 코드 상수로 고정한다(박선영 표준, 2026-06-15 확정).
// 폐기원인(cause)은 DisposalCause 마스터(관리자 관리). 설계: docs/inventory-stockin-disposal.md

export const DISPOSAL_CATEGORIES = ["기타", "제작폐기_꽃다발", "제작폐기_오늘의꽃"];

// 폐기 시 출처 lot 자동 추천 창(일). 폐기일 기준 [date - N일, date] 입고 lot을 추천한다.
export const DEFAULT_LOT_WINDOW_DAYS = 4;

export function isValidDisposalCategory(value) {
  return DISPOSAL_CATEGORIES.includes(value);
}
