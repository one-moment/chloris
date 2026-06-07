import { AUTOMATION_LEVEL_LABELS, VENDOR_LABELS } from "./constants";

function priceLabel(value) {
  return typeof value === "number" ? `${value.toLocaleString("ko-KR")}원` : "미등록";
}

export function purchaseRequestCreatedMessage(request) {
  return [
    "구매요청을 생성했습니다.",
    "",
    `품목: ${request.itemName}`,
    `공급처: ${VENDOR_LABELS[request.vendor] ?? request.vendor}`,
    `수량: ${request.quantity}${request.unitLabel}`,
    `예상금액: ${priceLabel(request.expectedPrice)}`,
    `가격상한: ${priceLabel(request.maxAllowedPrice)}`,
    `배송지: ${request.shippingLocation ?? "미등록"}`,
    `자동화: ${AUTOMATION_LEVEL_LABELS[request.automationLevel] ?? request.automationLevel}`,
    "",
    `승인: POST /api/purchase-bot/requests/${request.id}/approve`,
    `반려: POST /api/purchase-bot/requests/${request.id}/reject`
  ].join("\n");
}

export function purchaseRequestQueuedMessage(request) {
  return [
    "로컬 구매봇 작업 대기열에 등록되었습니다.",
    "",
    `품목: ${request.itemName}`,
    `수량: ${request.quantity}${request.unitLabel}`,
    request.workerTaskId ? `작업 ID: ${request.workerTaskId}` : null,
    "맥북의 purchase-worker가 작업을 가져가면 실제 Chrome으로 상품 페이지를 엽니다.",
    request.workerTaskId ? `주문서/장바구니 화면 캡쳐: npm run purchase-worker:capture -- ${request.workerTaskId}` : null
  ].filter(Boolean).join("\n");
}

export function purchaseRequestRejectedMessage(request) {
  return [
    "구매요청이 반려되었습니다.",
    "",
    `품목: ${request.itemName}`,
    `수량: ${request.quantity}${request.unitLabel}`
  ].join("\n");
}

export function purchaseBotResultMessage(request) {
  const heading = request.status === "failed"
    ? "구매봇 작업 실패"
    : request.status === "needs_human"
      ? "구매봇 작업 중단"
      : "구매봇 작업 완료";
  return [
    heading,
    "",
    `품목: ${request.itemName}`,
    `공급처: ${VENDOR_LABELS[request.vendor] ?? request.vendor}`,
    `수량: ${request.quantity}${request.unitLabel}`,
    `상태: ${request.status}`,
    request.resultMessage ? `메시지: ${request.resultMessage}` : null,
    request.resultScreenshotUrl ? `스크린샷: ${request.resultScreenshotUrl}` : null,
    "",
    "최종 결제는 사람이 직접 진행해야 합니다."
  ].filter(Boolean).join("\n");
}

export function purchaseBotInfoMessage(lines) {
  return ["구매봇 안내", "", ...lines].join("\n");
}
