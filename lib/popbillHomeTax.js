import { getPopbill, supplierCorpNum, popbillUserId, callAsync } from "./popbill.js";

// ---------------------------------------------------------------------------
// 팝빌 홈택스 전자세금계산서(HTTaxinvoice) 어댑터 — 매입 계산서 수집
// 흐름: requestJob(수집요청 → JobID) → getJobState(완료까지 폴링) → search(결과 조회)
// 정규 시그니처(검증됨, success/error 는 항상 마지막):
//   requestJob(CorpNum, QueryType, DType, SDate, EDate, UserID, success, error)
//   getJobState(CorpNum, JobID, UserID, success, error)
//   search(CorpNum, JobID, Type, TaxType, PurposeType, TaxRegIDType, TaxRegIDYN, TaxRegID,
//          Page, PerPage, Order, UserID, SearchString, success, error)
//   summary(CorpNum, JobID, Type, TaxType, PurposeType, TaxRegIDType, TaxRegIDYN, TaxRegID,
//           UserID, SearchString, success, error)
//   checkCertValidation(CorpNum, success, error)   // 공동인증서 유효성
//   checkLoginDeptUser(CorpNum, success, error)     // 홈택스 부서사용자 로그인 확인
// QueryType: "BUY"(매입)/"SELL"(매출)/"TRUSTEE". DType: "W"(작성)/"I"(발행)/"S"(전송).
// Type/TaxType/PurposeType: 배열 코드값(빈 배열이면 전체). 자세한 코드는 팝빌 문서 참조.
// ---------------------------------------------------------------------------

let _service = null;
function service() {
  if (!_service) _service = getPopbill().HTTaxinvoiceService();
  return _service;
}

// 등록된 공동인증서 유효성 확인(연결 확인용).
export function checkCertValidation() {
  const corpNum = supplierCorpNum();
  return callAsync((onSuccess, onError) =>
    service().checkCertValidation(corpNum, onSuccess, onError)
  );
}

// 홈택스 부서사용자 로그인 가능 여부 확인(연결 확인용).
export function checkLoginDeptUser() {
  const corpNum = supplierCorpNum();
  return callAsync((onSuccess, onError) =>
    service().checkLoginDeptUser(corpNum, onSuccess, onError)
  );
}

// 매입(기본) 계산서 수집 요청. SDate/EDate: "yyyyMMdd". → JobID 반환.
export function requestJob({ queryType = "BUY", dType = "W", sDate, eDate }) {
  const corpNum = supplierCorpNum();
  const userId = popbillUserId();
  return callAsync((onSuccess, onError) =>
    service().requestJob(corpNum, queryType, dType, sDate, eDate, userId, onSuccess, onError)
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

// 수집 결과(계산서 목록) 페이지 조회. 종사업장 옵션(TaxRegID*)은 기본 미사용("").
export function search({
  jobID,
  type = [],
  taxType = [],
  purposeType = [],
  page = 1,
  perPage = 100,
  order = "D",
  searchString = ""
}) {
  const corpNum = supplierCorpNum();
  const userId = popbillUserId();
  return callAsync((onSuccess, onError) =>
    service().search(
      corpNum, jobID, type, taxType, purposeType,
      "", "", "",            // TaxRegIDType, TaxRegIDYN, TaxRegID
      page, perPage, order, userId, searchString,
      onSuccess, onError
    )
  );
}
