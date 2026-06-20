import popbill from "popbill";

// ---------------------------------------------------------------------------
// 팝빌 SDK 공용 코어 (설정 + 공용 헬퍼)
// - 모든 팝빌 어댑터(은행/홈택스/세금계산서)가 이 모듈만 거쳐 SDK를 씁니다.
// - 시크릿은 .env 에서만 읽습니다. 코드/레포에 직접 쓰지 마세요.
// - popbill 은 CommonJS 패키지이며 기본 import 로 config/서비스 팩토리에 접근됩니다(검증됨).
// ---------------------------------------------------------------------------

let configured = false;

function getConfig() {
  return {
    LinkID: process.env.POPBILL_LINK_ID,
    SecretKey: process.env.POPBILL_SECRET_KEY,
    IsTest: process.env.POPBILL_IS_TEST !== "false", // 기본 테스트환경(true)
    IPRestrictOnOff: process.env.POPBILL_IP_RESTRICT !== "false",
    UseStaticIP: process.env.POPBILL_USE_STATIC_IP === "true",
    UseLocalTimeYN: process.env.POPBILL_USE_LOCAL_TIME !== "false"
  };
}

// 워밍된 서버리스 인스턴스에서 config 를 매번 다시 부르지 않도록 1회만 설정
export function ensureConfigured() {
  if (configured) return;
  const cfg = getConfig();
  if (!cfg.LinkID || !cfg.SecretKey) {
    throw new Error("POPBILL_LINK_ID / POPBILL_SECRET_KEY 환경변수가 필요합니다.");
  }
  popbill.config({
    LinkID: cfg.LinkID,
    SecretKey: cfg.SecretKey,
    IsTest: cfg.IsTest,
    IPRestrictOnOff: cfg.IPRestrictOnOff,
    UseStaticIP: cfg.UseStaticIP,
    UseLocalTimeYN: cfg.UseLocalTimeYN,
    defaultErrorHandler: (err) => {
      console.error(JSON.stringify({ kind: "popbill_error", code: err?.code, message: err?.message }));
    }
  });
  configured = true;
}

// 설정이 끝난 popbill 모듈을 반환. 어댑터는 여기서 서비스 팩토리를 얻습니다.
export function getPopbill() {
  ensureConfigured();
  return popbill;
}

// 공급자(우리) 사업자번호 — '-' 제외 10자리.
export function supplierCorpNum() {
  const corpNum = process.env.POPBILL_CORP_NUM;
  if (!corpNum) throw new Error("POPBILL_CORP_NUM 환경변수가 필요합니다.");
  return corpNum.replace(/[^0-9]/g, "");
}

// 팝빌 회원 아이디(부서사용자 등). 미설정 시 "" — 콜백 자리를 밀지 않도록 빈 문자열 사용.
export function popbillUserId() {
  return process.env.POPBILL_USER_ID || "";
}

// 콜백 기반 SDK 함수를 Promise 로 감쌉니다.
// executor: (onSuccess, onError) => void  — success/error 콜백은 항상 SDK 호출의 마지막 두 인자.
export function callAsync(executor) {
  return new Promise((resolve, reject) => {
    executor(
      (result) => resolve(result),
      (err) => reject(normalizeError(err))
    );
  });
}

export function normalizeError(err) {
  const e = new Error(err?.message || "팝빌 API 오류");
  e.popbillCode = err?.code ?? null;
  e.isPopbillError = true;
  return e;
}
