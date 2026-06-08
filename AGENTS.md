## 작업 원칙

- 운영 자동화 코드는 추측으로 수정하지 않는다.
- 브라우저 자동화 오류는 먼저 debug artifact를 확인한다.
- selector 수정 전 screenshot, HTML, trace를 확보한다.
- 전체 플로우 리팩토링은 명시적 승인 없이는 하지 않는다.
- DB schema 변경은 명시적 승인 없이는 하지 않는다.
- 결제 자동화는 구현하지 않는다. 최종 결제는 사람 검토로 넘긴다.

## Playwright 원칙

- page 전체에서 input/button을 직접 찾지 않는다.
- 먼저 대상 row/container를 특정한 뒤, 그 내부에서 locator를 찾는다.
- 클릭 후에는 반드시 상태 검증을 한다.
- 수량 변경 실패 시 다음 단계로 진행하지 않는다.
- 실패 시 screenshot, outerHTML, page HTML, trace를 저장한다.

## 보고 형식

수정 전:
- 원인 후보
- 근거 코드
- 최소 수정 범위
- 리스크
- 테스트 방법

수정 후:
- 변경 파일
- 변경 함수
- 테스트 결과
- 남은 리스크
