# 팝빌(popbill) 전자세금계산서 SDK 검증 노트

오늘꽃 전용 "계산서 발행" 기능 1단계 검증 결과. `lib/popbill.js` 어댑터 구현(3단계)·리뷰의 근거 문서.

- **패키지:** `popbill@1.64.2`
- **import:** `import popbill from "popbill"` 기본 import 정상 (`popbill.config`, `popbill.TaxinvoiceService` 모두 function).
- **SDK 구조:** `BaseService.addMethod`로 **인자 개수별 오버로드** 디스패치. **모든 메서드에서 `success`/`error` 콜백이 항상 마지막 두 인자.** `UserID`는 콜백 바로 앞. 미설정 시 `""`(빈 문자열)로 넘겨 자리 유지.

## SDK 정규 시그니처 (`node_modules/popbill/lib/TaxinvoiceService.js` 소스 확인)

| 메서드 | 정규 시그니처 | 비고 |
|---|---|---|
| `getBalance` | `(CorpNum, success, error)` | |
| `getInfo` | `(CorpNum, KeyType, MgtKey, UserID, success, error)` | 5-arg 오버로드 `(CorpNum, KeyType, MgtKey, success, error)` 있음 |
| `delete` | `(CorpNum, KeyType, MgtKey, UserID, success, error)` | 5-arg 오버로드 있음 |
| `cancelIssue` | `(CorpNum, KeyType, MgtKey, Memo, UserID, success, error)` | 6-arg 오버로드 있음 |
| `registIssue` | `(CorpNum, Taxinvoice, writeSpecification, forceIssue, memo, emailSubject, dealInvoiceMgtKey, UserID, success, error)` | 4~9-arg 오버로드 있음 |

## 첨부 드롭인(`lib/popbill.js`) 대비 — 정정 필요

- ✅ `getBalance`, `getInfo` — 순서 맞음. 그대로 사용.
- ❌ `registIssue` — 콜백이 잘못된 자리에 들어가 동작 안 함. **정정 호출 순서:**
  `registIssue(corpNum, taxinvoice, writeSpecification, forceIssue, memo, emailSubject, dealInvoiceMgtKey, userId, onSuccess, onError)`
- ❌ `cancelIssue` — **정정:** `cancelIssue(corpNum, KeyType, mgtKey, memo, userId, onSuccess, onError)`
- ❌ `delete` — **정정:** `delete(corpNum, KeyType, mgtKey, userId, onSuccess, onError)`

→ 드롭인 `lib/popbill.js`를 그대로 복사하면 발행/취소/삭제가 실패한다. 3단계에서 위 정정 순서로 구현할 것. (`userId`는 `process.env.POPBILL_USER_ID || ""`.)

## 미검증 (자격증명 필요)
- `getBalance`/`getInfo` 실제 통신 및 `getInfo` 응답 필드 casing은 팝빌 테스트 LinkID/SecretKey/사업자번호 확보 후 확인.
