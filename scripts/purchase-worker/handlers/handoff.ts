import type { PurchaseWorkerTask, WorkerResult } from "../client";
import { openHumanBrowser } from "./shared";

export async function runHandoffTask(task: PurchaseWorkerTask): Promise<WorkerResult> {
  await openHumanBrowser(task.url);

  return {
    status: "needs_human",
    errorCode: "HUMAN_BROWSER_HANDOFF",
    message: [
      "실제 Chrome으로 상품 페이지를 열었습니다.",
      "사람이 장바구니, 주문서, 결제 직전 화면을 직접 확인해야 합니다.",
      "주문서/장바구니 화면은 purchase-worker:capture 명령으로 채널에 기록할 수 있습니다.",
      "최종 결제는 사람이 직접 진행해야 합니다."
    ].join(" ")
  };
}
