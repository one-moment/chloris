import { reportTaskResult } from "./client";
import { captureScreenFile, screenshotAttachmentFromPath } from "./handlers/shared";

async function main() {
  const taskId = process.argv[2];
  if (!taskId) {
    console.error("Usage: npm run purchase-worker:capture -- <task-id>");
    process.exit(1);
  }

  try {
    const screenshotPath = await captureScreenFile(taskId, "human-cart-screen");
    const screenshotAttachment = await screenshotAttachmentFromPath(screenshotPath);
    await reportTaskResult(taskId, {
      status: "needs_human",
      screenshotPath,
      ...screenshotAttachment,
      errorCode: "HUMAN_ORDER_SCREEN_CAPTURED",
      message: "현재 Chrome 장바구니/주문서 화면을 캡쳐해 소통채널 메시지에 첨부했습니다. 최종 결제는 사람이 직접 진행해야 합니다."
    });

    console.log(`[purchase-worker] captured ${screenshotPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await reportTaskResult(taskId, {
      status: "needs_human",
      errorCode: "SCREEN_CAPTURE_FAILED",
      message: `주문서 화면 캡쳐에 실패했습니다. macOS 화면 기록 권한을 확인한 뒤 다시 실행해주세요. 상세: ${message}`
    });
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
