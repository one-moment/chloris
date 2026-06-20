// 임시 검증용 — 확인 후 삭제. 시크릿은 .env 에서만 읽습니다.
// 실행: node --env-file=.env scripts/settlement-probe.mjs   (자격증명 있을 때)
//      node scripts/settlement-probe.mjs                    (로드/시그니처 확인만)
//
// 정산 수집 어댑터(은행/홈택스)가 정상 로드되는지, 자격증명이 있으면 실제 연결까지
// 확인합니다. 개인정보(PII)는 마스킹하여 로그로만 출력합니다. 거래원장은 건드리지 않습니다.

import { getPopbill, supplierCorpNum } from "../lib/popbill.js";
import * as bank from "../lib/popbillBank.js";
import * as hometax from "../lib/popbillHomeTax.js";

function mask(value, keep = 4) {
  const s = String(value ?? "");
  if (s.length <= keep) return "*".repeat(s.length);
  return s.slice(0, keep) + "*".repeat(s.length - keep);
}

function hasCreds() {
  return Boolean(process.env.POPBILL_LINK_ID && process.env.POPBILL_SECRET_KEY && process.env.POPBILL_CORP_NUM);
}

async function main() {
  // 1) 어댑터/서비스 로드 확인 (자격증명 불필요한 부분은 try 로 보호)
  console.log("== 어댑터 export 확인 ==");
  console.log("bank:", Object.keys(bank).join(", "));
  console.log("hometax:", Object.keys(hometax).join(", "));

  if (!hasCreds()) {
    console.log("\n자격증명(.env POPBILL_LINK_ID/SECRET_KEY/CORP_NUM) 없음 → 연결 테스트 건너뜀.");
    console.log("준비물(팝빌 테스트베드/부서계정/계좌등록) 후 --env-file=.env 로 재실행하세요.");
    return;
  }

  console.log("\n공급자 사업자번호:", mask(supplierCorpNum(), 3));

  // 서비스 팩토리가 설정과 함께 잡히는지 확인
  const pb = getPopbill();
  console.log("EasyFinBankService:", typeof pb.EasyFinBankService);
  console.log("HTTaxinvoiceService:", typeof pb.HTTaxinvoiceService);

  // 2) 은행: 등록 계좌 목록 (입금 1건 수집 전 연결/등록 확인)
  try {
    const accounts = await bank.listBankAccount();
    const list = Array.isArray(accounts) ? accounts : [];
    console.log(`\n[은행] 등록 계좌 ${list.length}건`);
    for (const a of list) {
      console.log("  -", a?.bankCode, mask(a?.accountNumber), a?.state ?? "");
    }
  } catch (e) {
    console.log("\n[은행] listBankAccount 오류:", e.popbillCode ?? "", e.message);
  }

  // 3) 홈택스: 인증서 유효성 + 부서사용자 로그인 확인 (매입 1건 수집 전 연결 확인)
  try {
    const cert = await hometax.checkCertValidation();
    console.log("\n[홈택스] checkCertValidation:", JSON.stringify(cert));
  } catch (e) {
    console.log("\n[홈택스] checkCertValidation 오류:", e.popbillCode ?? "", e.message);
  }
  try {
    const dept = await hometax.checkLoginDeptUser();
    console.log("[홈택스] checkLoginDeptUser:", JSON.stringify(dept));
  } catch (e) {
    console.log("[홈택스] checkLoginDeptUser 오류:", e.popbillCode ?? "", e.message);
  }

  console.log("\n※ 매입 1건·입금 1건 실수집(requestJob→getJobState→search)은 계좌/부서사용자 등록 후 단계1에서 수행.");
}

main().catch((e) => {
  console.error("probe 실패:", e?.message ?? e);
  process.exitCode = 1;
});
