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

// ── 지표 집계 헬퍼 (순수 함수 — DB 미접속, metrics 라우트가 공유) ─────────────
// 폐기율 정의는 가액 기준(폐기가액 ÷ 입고가액). 집계 대상은 호출 측에서 submitted만 넘긴다.

const TREND_GRANULARITIES = new Set(["day", "week", "month"]);

// 백분율(소수 1자리). 분모 0이면 0. metrics 라우트와 동일 정의를 공유한다.
export function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function normalizeGranularity(value) {
  return TREND_GRANULARITIES.has(value) ? value : "month";
}

function isoDateUtc(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 일자 버킷 키. UTC 기준(코드베이스 일관 — analytics 라우트와 동일). 주=월요일 시작, 월=1일.
// 잘못된 날짜는 null(호출 측에서 스킵).
export function bucketKeyForDate(value, granularity) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const gran = normalizeGranularity(granularity);
  if (gran === "month") {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }
  if (gran === "week") {
    const dow = date.getUTCDay(); // 0=일 … 6=토
    const backToMonday = dow === 0 ? 6 : dow - 1;
    return isoDateUtc(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - backToMonday)));
  }
  return isoDateUtc(date);
}

// 품목별 폐기량(수량)·폐기가액 집계. 폐기가액 desc 정렬.
export function aggregateDisposalByItem(batches) {
  const map = new Map();
  for (const batch of batches ?? []) {
    for (const line of batch.lines ?? []) {
      const key = line.itemName ?? "";
      const entry = map.get(key) ?? { itemName: key, quantity: 0, amount: 0 };
      entry.quantity += line.quantity ?? 0;
      entry.amount += line.amount ?? 0;
      map.set(key, entry);
    }
  }
  return [...map.values()]
    .map((entry) => ({ ...entry, quantity: Math.round(entry.quantity * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
}

// 폐기율 추이(시계열). 폐기=disposalDate, 입고=statementDate 기준 버킷팅.
// 각 버킷에 지점별(branches) 분해를 함께 담아 화면에서 전체=다선 / 단일지점=단선으로 피벗한다.
export function buildWasteTrend(disposalBatches, stockDeliveries, granularity, branchNameMap) {
  const gran = normalizeGranularity(granularity);
  const buckets = new Map();
  const ensureBucket = (key) => {
    if (!buckets.has(key)) buckets.set(key, { bucket: key, disposalAmount: 0, stockInAmount: 0, branches: new Map() });
    return buckets.get(key);
  };
  const ensureBranch = (bucket, branchId) => {
    if (!bucket.branches.has(branchId)) {
      bucket.branches.set(branchId, {
        branchId,
        branchName: branchNameMap?.get(branchId) ?? branchId,
        disposalAmount: 0,
        stockInAmount: 0
      });
    }
    return bucket.branches.get(branchId);
  };

  for (const batch of disposalBatches ?? []) {
    const key = bucketKeyForDate(batch.disposalDate, gran);
    if (!key) continue;
    const bucket = ensureBucket(key);
    const branch = ensureBranch(bucket, batch.branchId);
    for (const line of batch.lines ?? []) {
      const amount = line.amount ?? 0;
      bucket.disposalAmount += amount;
      branch.disposalAmount += amount;
    }
  }

  for (const delivery of stockDeliveries ?? []) {
    const key = bucketKeyForDate(delivery.statementDate, gran);
    if (!key) continue;
    const bucket = ensureBucket(key);
    const branch = ensureBranch(bucket, delivery.branchId);
    for (const line of delivery.lines ?? []) {
      const amount = line.amount ?? 0;
      bucket.stockInAmount += amount;
      branch.stockInAmount += amount;
    }
  }

  const points = [...buckets.values()]
    .sort((a, b) => a.bucket.localeCompare(b.bucket))
    .map((bucket) => ({
      bucket: bucket.bucket,
      disposalAmount: bucket.disposalAmount,
      stockInAmount: bucket.stockInAmount,
      wasteRate: pct(bucket.disposalAmount, bucket.stockInAmount),
      branches: [...bucket.branches.values()]
        .map((branch) => ({ ...branch, wasteRate: pct(branch.disposalAmount, branch.stockInAmount) }))
        .sort((a, b) => String(a.branchName).localeCompare(String(b.branchName)))
    }));

  return { granularity: gran, points };
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
