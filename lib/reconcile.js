// lib/reconcile.js
//
// 순수 대조(정산) 로직 — 외부 의존성 없음.
//
// 이 파일은 "이미 정리된(정규화된) 객체"만 입력으로 받습니다.
// 팝빌 응답 형식이나 구글시트 칸 이름에 의존하지 않습니다.
//   · 정규화 = 팝빌/시트의 들쭉날쭉한 데이터를 아래 입력 규격에 맞춰 변환하는 작업.
//   · 그 변환은 이 파일이 아니라 별도의 얇은 "변환 층"이 담당합니다(나중에 작업).
// 덕분에 자격증명·시트 칸 없이도 이 핵심 매칭 로직을 합성 데이터로 완전히 검증할 수 있습니다.

// ────────────────────────────────────────────────────────────
// 공통 정규화 헬퍼
// ────────────────────────────────────────────────────────────

/** 사업자등록번호에서 숫자만 남깁니다. "123-45-67890" → "1234567890" */
export function normalizeBizNo(value) {
  if (value == null) return "";
  return String(value).replace(/\D/g, "");
}

/**
 * 이름 비교용 정규화. 회사 형태 표기·공백·특수문자를 제거합니다.
 * "(주)오늘꽃 " → "오늘꽃"  /  "오늘 꽃" → "오늘꽃"
 * (참고: 일부러 '유사도'까지는 하지 않습니다. 돈이 걸린 매칭이라 보수적으로,
 *  정규화 후 정확히 같거나 별칭표에 등록된 경우만 자동 매칭합니다.)
 */
export function normalizeName(value) {
  if (value == null) return "";
  return String(value)
    .replace(/\(주\)|（주）|㈜|주식회사|\(유\)|유한회사/g, "")
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();
}

/** 금액을 숫자로. "1,100,000원" → 1100000 */
export function toAmount(value) {
  if (typeof value === "number") return value;
  if (value == null) return NaN;
  const n = Number(String(value).replace(/[,\s₩원]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

/** 날짜를 '일 단위' Date로. 문자열/타임스탬프/Date 모두 허용. 실패 시 null */
export function toDateOnly(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** 두 날짜의 일수 차이(정수). 입력이 비면 Infinity */
export function daysBetween(a, b) {
  if (!a || !b) return Infinity;
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// ────────────────────────────────────────────────────────────
// 상태 코드 + 한글 라벨
//   · 로직은 영문 코드로 다룹니다(안정적).
//   · 시트에 표시할 때는 STATUS_LABELS_KO로 한글로 바꿔 쓰면 됩니다.
// ────────────────────────────────────────────────────────────

export const PURCHASE_STATUS = {
  CONFIRMED: "CONFIRMED", // 계산서 발행 확인됨 → 송금 가능
  NOT_FOUND: "NOT_FOUND", // 대응하는 계산서를 못 찾음
  AMBIGUOUS: "AMBIGUOUS", // 조건에 맞는 게 여러 건 → 사람이 확인
};

export const DEPOSIT_STATUS = {
  SETTLED: "SETTLED", // 정산완료(청구=입금)
  PARTIAL: "PARTIAL", // 부분입금(일부만 들어옴)
  UNPAID: "UNPAID", // 미입금
  OVERPAID: "OVERPAID", // 과입금(청구보다 많이 들어옴) → 사람이 확인
};

export const STATUS_LABELS_KO = {
  CONFIRMED: "계산서 확인",
  NOT_FOUND: "계산서 미발행",
  AMBIGUOUS: "확인 필요",
  SETTLED: "정산완료",
  PARTIAL: "부분입금",
  UNPAID: "미입금",
  OVERPAID: "과입금(확인 필요)",
};

// ────────────────────────────────────────────────────────────
// 1) 매입 계산서 대조
//
// 입력 규격(정규화된 객체):
//   ledgerEntries: [{ id, supplierBizNo, amount, date }]   // 거래원장 사입 건
//   invoices:      [{ approvalNo, supplierBizNo, amount, writeDate, issueDate }] // 홈택스 수집분
//   options:       { dateToleranceDays=5, amountTolerance=0 }
//
// 매칭 기준: 공급자 사업자번호 + 합계금액(허용오차) + 작성일자(±허용일).
// 안전 규칙: '원장 1건 ↔ 계산서 1건'이 서로 유일하게 맞을 때만 CONFIRMED.
//   한 계산서가 여러 원장 행과 겹치거나, 한 원장 행에 계산서 후보가 여럿이면
//   임의로 고르지 않고 AMBIGUOUS(확인 필요)로 둡니다. (추측 금지)
// ────────────────────────────────────────────────────────────

export function reconcilePurchaseInvoices({ ledgerEntries = [], invoices = [], options = {} } = {}) {
  const dateToleranceDays = options.dateToleranceDays ?? 5;
  const amountTolerance = options.amountTolerance ?? 0;

  const candForLedger = new Map(); // ledgerId  -> [invoiceIndex...]
  const candForInvoice = new Map(); // invoiceIdx -> [ledgerId...]

  for (const entry of ledgerEntries) {
    const eBiz = normalizeBizNo(entry.supplierBizNo);
    const eAmt = toAmount(entry.amount);
    const eDate = toDateOnly(entry.date);
    const matches = [];

    invoices.forEach((inv, idx) => {
      const bizOk = eBiz && eBiz === normalizeBizNo(inv.supplierBizNo);
      const iAmt = toAmount(inv.amount);
      const amtOk =
        Number.isFinite(eAmt) && Number.isFinite(iAmt) && Math.abs(eAmt - iAmt) <= amountTolerance;
      const dDate = toDateOnly(inv.writeDate);
      const dateOk = eDate && dDate ? Math.abs(daysBetween(eDate, dDate)) <= dateToleranceDays : false;

      if (bizOk && amtOk && dateOk) {
        matches.push(idx);
        if (!candForInvoice.has(idx)) candForInvoice.set(idx, []);
        candForInvoice.get(idx).push(entry.id);
      }
    });

    candForLedger.set(entry.id, matches);
  }

  const entries = ledgerEntries.map((entry) => {
    const cand = candForLedger.get(entry.id) || [];

    if (cand.length === 0) {
      return { ledgerId: entry.id, status: PURCHASE_STATUS.NOT_FOUND, invoice: null, reason: "발행된 계산서를 찾지 못함" };
    }
    if (cand.length > 1) {
      return {
        ledgerId: entry.id,
        status: PURCHASE_STATUS.AMBIGUOUS,
        invoice: null,
        reason: `조건에 맞는 계산서가 ${cand.length}건`,
        candidates: cand.map((i) => invoices[i].approvalNo),
      };
    }

    const idx = cand[0];
    const back = candForInvoice.get(idx) || [];
    if (back.length > 1) {
      return {
        ledgerId: entry.id,
        status: PURCHASE_STATUS.AMBIGUOUS,
        invoice: null,
        reason: "같은 계산서가 여러 원장 행과 매칭됨",
        candidates: [invoices[idx].approvalNo],
      };
    }

    const inv = invoices[idx];
    return {
      ledgerId: entry.id,
      status: PURCHASE_STATUS.CONFIRMED,
      invoice: {
        approvalNo: inv.approvalNo,
        issueDate: inv.issueDate ?? null,
        amount: toAmount(inv.amount),
        writeDate: inv.writeDate ?? null,
      },
      reason: null,
    };
  });

  // 원장에 대응 사입 건이 없는 계산서(후보가 0건인 계산서)
  const extraInvoices = invoices
    .map((inv, idx) => ({ inv, idx }))
    .filter(({ idx }) => !(candForInvoice.get(idx)?.length))
    .map(({ inv }) => ({
      approvalNo: inv.approvalNo,
      supplierBizNo: normalizeBizNo(inv.supplierBizNo),
      amount: toAmount(inv.amount),
      writeDate: inv.writeDate ?? null,
    }));

  const summary = {
    total: entries.length,
    confirmed: entries.filter((e) => e.status === PURCHASE_STATUS.CONFIRMED).length,
    notFound: entries.filter((e) => e.status === PURCHASE_STATUS.NOT_FOUND).length,
    ambiguous: entries.filter((e) => e.status === PURCHASE_STATUS.AMBIGUOUS).length,
    extraInvoices: extraInvoices.length,
  };

  return { entries, extraInvoices, summary };
}

// ────────────────────────────────────────────────────────────
// 2) 입금 대조 + 정산
//
// 입력 규격(정규화된 객체):
//   ledgerEntries: [{ id, customerName, billedAmount, date }] // 거래원장 납품 건
//   deposits:      [{ id, depositorName, amount, date }]       // 은행 입금 내역
//   aliases:       [{ depositorName, customerName }]           // 입금자명 별칭표
//   options:       { looseNameMatch=false }
//
// 처리: 거래처별로 청구액을 합치고, 입금을 거래처에 귀속시켜 누적합니다(부분입금 자동 처리).
//   잔여 정산금액 = 청구합계 − 입금합계.
//   입금자명이 거래처명과 정확히 같거나(정규화 후) 별칭표에 있으면 자동 귀속,
//   아니면 unattributedDeposits(확인 필요)로 분리합니다. (추측으로 엮지 않음)
//   looseNameMatch=true면 정규화된 이름의 포함관계까지 허용(기본 꺼짐, 보수적 운영 권장).
// ────────────────────────────────────────────────────────────

export function reconcileDeposits({ ledgerEntries = [], deposits = [], aliases = [], options = {} } = {}) {
  const looseNameMatch = options.looseNameMatch ?? false;

  // 거래처별 청구 합계 집계
  const customers = new Map(); // normKey -> { customerName, billedAmount, depositedAmount, entries, deposits }
  for (const e of ledgerEntries) {
    const key = normalizeName(e.customerName);
    if (!key) continue;
    if (!customers.has(key)) {
      customers.set(key, {
        customerName: e.customerName,
        billedAmount: 0,
        depositedAmount: 0,
        entries: [],
        deposits: [],
      });
    }
    const c = customers.get(key);
    const amt = toAmount(e.billedAmount) || 0;
    c.billedAmount += amt;
    c.entries.push({ id: e.id, billedAmount: amt, date: e.date ?? null });
  }

  // 별칭표: 입금자명(정규화) -> 거래처명(정규화)
  const aliasMap = new Map();
  for (const a of aliases) {
    aliasMap.set(normalizeName(a.depositorName), normalizeName(a.customerName));
  }

  const unattributedDeposits = [];
  for (const d of deposits) {
    const dn = normalizeName(d.depositorName);
    let custKey = null;

    if (customers.has(dn)) {
      custKey = dn;
    } else if (aliasMap.has(dn) && customers.has(aliasMap.get(dn))) {
      custKey = aliasMap.get(dn);
    } else if (looseNameMatch && dn) {
      for (const key of customers.keys()) {
        if (key && (key.includes(dn) || dn.includes(key))) {
          custKey = key;
          break;
        }
      }
    }

    if (custKey) {
      const c = customers.get(custKey);
      const amt = toAmount(d.amount) || 0;
      c.depositedAmount += amt;
      c.deposits.push({ id: d.id, depositorName: d.depositorName, amount: amt, date: d.date ?? null });
    } else {
      unattributedDeposits.push({
        id: d.id,
        depositorName: d.depositorName,
        amount: toAmount(d.amount),
        date: d.date ?? null,
        reason: "일치하는 거래처/별칭 없음",
      });
    }
  }

  const customerResults = [...customers.values()].map((c) => {
    const billed = round2(c.billedAmount);
    const deposited = round2(c.depositedAmount);
    const remaining = round2(billed - deposited);

    let status;
    if (deposited <= 0) status = DEPOSIT_STATUS.UNPAID;
    else if (remaining > 0) status = DEPOSIT_STATUS.PARTIAL;
    else if (remaining === 0) status = DEPOSIT_STATUS.SETTLED;
    else status = DEPOSIT_STATUS.OVERPAID;

    return {
      customerName: c.customerName,
      billedAmount: billed,
      depositedAmount: deposited,
      remainingAmount: remaining,
      status,
      needsReview: status === DEPOSIT_STATUS.OVERPAID,
      entries: c.entries,
      deposits: c.deposits,
    };
  });

  const summary = {
    customers: customerResults.length,
    settled: customerResults.filter((c) => c.status === DEPOSIT_STATUS.SETTLED).length,
    partial: customerResults.filter((c) => c.status === DEPOSIT_STATUS.PARTIAL).length,
    unpaid: customerResults.filter((c) => c.status === DEPOSIT_STATUS.UNPAID).length,
    overpaid: customerResults.filter((c) => c.status === DEPOSIT_STATUS.OVERPAID).length,
    unattributedDeposits: unattributedDeposits.length,
    totalBilled: round2(customerResults.reduce((s, c) => s + c.billedAmount, 0)),
    totalDeposited: round2(
      customerResults.reduce((s, c) => s + c.depositedAmount, 0) +
        unattributedDeposits.reduce((s, d) => s + (toAmount(d.amount) || 0), 0)
    ),
  };

  return { customers: customerResults, unattributedDeposits, summary };
}
