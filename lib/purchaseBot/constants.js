export const PURCHASE_BOT_MENTION = "@구매봇";

export const PURCHASE_REQUEST_STATUS = {
  DRAFT: "draft",
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
  QUEUED: "queued",
  RUNNING: "running",
  NEEDS_HUMAN: "needs_human",
  CART_READY: "cart_ready",
  CHECKOUT_READY: "checkout_ready",
  COMPLETED_MANUALLY: "completed_manually",
  FAILED: "failed",
  CANCELLED: "cancelled"
};

export const PURCHASE_WORKER_TASK_STATUS = {
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed"
};

export const SAFE_WORKER_RESULT_STATUSES = new Set([
  PURCHASE_REQUEST_STATUS.NEEDS_HUMAN,
  PURCHASE_REQUEST_STATUS.CART_READY,
  PURCHASE_REQUEST_STATUS.CHECKOUT_READY,
  PURCHASE_REQUEST_STATUS.FAILED
]);

export const VENDOR_LABELS = {
  coupang: "쿠팡",
  swadpia: "성원애드피아"
};

export const AUTOMATION_LEVEL_LABELS = {
  open_page: "상품 페이지 열기까지",
  add_to_cart: "장바구니 담기까지",
  checkout_ready: "결제 직전 화면까지"
};
