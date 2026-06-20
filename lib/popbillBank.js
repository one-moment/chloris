import { getPopbill, supplierCorpNum, popbillUserId, callAsync } from "./popbill.js";

// ---------------------------------------------------------------------------
// 팝빌 계좌조회(EasyFinBank) 어댑터 — 은행 입금 내역 수집
// 흐름: requestJob(수집요청 → JobID) → getJobState(완료까지 폴링) → search(결과 조회)
// 정규 시그니처(검증됨, success/error 는 항상 마지막):
//   requestJob(CorpNum, BankCode, AccountNumber, SDate, EDate, UserID, success, error)
//   getJobState(CorpNum, JobID, UserID, success, error)
//   search(CorpNum, JobID, TradeType, SearchString, Page, PerPage, Order, UserID, success, error)
//   summary(CorpNum, JobID, TradeType, SearchString, UserID, success, error)
//   listBankAccount(CorpNum, UserID, success, error)
// TradeType: 배열. "I"=입금, "O"=출금. 입금 확인이 목적이므로 기본 ["I"].
// Order: "D"=내림차순(최신순), "A"=오름차순.
// ---------------------------------------------------------------------------

let _service = null;
function service() {
  if (!_service) _service = getPopbill().EasyFinBankService();
  return _service;
}

// 팝빌에 등록된 계좌 목록(연결 확인용).
export function listBankAccount() {
  const corpNum = supplierCorpNum();
  const userId = popbillUserId();
  return callAsync((onSuccess, onError) =>
    service().listBankAccount(corpNum, userId, onSuccess, onError)
  );
}

// 기간 입출금내역 수집 요청. SDate/EDate: "yyyyMMdd". → JobID 반환.
export function requestJob({ bankCode, accountNumber, sDate, eDate }) {
  const corpNum = supplierCorpNum();
  const userId = popbillUserId();
  return callAsync((onSuccess, onError) =>
    service().requestJob(corpNum, bankCode, accountNumber, sDate, eDate, userId, onSuccess, onError)
  );
}

// 수집 작업 상태 조회.
export function getJobState(jobID) {
  const corpNum = supplierCorpNum();
  const userId = popbillUserId();
  return callAsync((onSuccess, onError) =>
    service().getJobState(corpNum, jobID, userId, onSuccess, onError)
  );
}

// 수집 결과(거래내역) 페이지 조회.
export function search({ jobID, tradeType = ["I"], searchString = "", page = 1, perPage = 100, order = "D" }) {
  const corpNum = supplierCorpNum();
  const userId = popbillUserId();
  return callAsync((onSuccess, onError) =>
    service().search(corpNum, jobID, tradeType, searchString, page, perPage, order, userId, onSuccess, onError)
  );
}

// 수집 결과 요약(건수/합계).
export function summary({ jobID, tradeType = ["I"], searchString = "" }) {
  const corpNum = supplierCorpNum();
  const userId = popbillUserId();
  return callAsync((onSuccess, onError) =>
    service().summary(corpNum, jobID, tradeType, searchString, userId, onSuccess, onError)
  );
}
