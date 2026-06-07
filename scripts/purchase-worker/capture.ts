import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { reportTaskResult } from "./client";
import { config } from "./config";

const execFileAsync = promisify(execFile);

async function captureScreen(taskId: string) {
  await mkdir(config.screenshotDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const screenshotPath = path.join(config.screenshotDir, `${timestamp}-${taskId}-human-order-screen.png`);

  if (process.platform !== "darwin") {
    throw new Error("purchase-worker:capture currently supports macOS screencapture only.");
  }

  await execFileAsync("screencapture", ["-x", screenshotPath]);
  return screenshotPath;
}

async function main() {
  const taskId = process.argv[2];
  if (!taskId) {
    console.error("Usage: npm run purchase-worker:capture -- <task-id>");
    process.exit(1);
  }

  try {
    const screenshotPath = await captureScreen(taskId);
    await reportTaskResult(taskId, {
      status: "needs_human",
      screenshotPath,
      errorCode: "HUMAN_ORDER_SCREEN_CAPTURED",
      message: "현재 Chrome/주문서 화면을 캡쳐했습니다. 주문 내역 확인용이며 최종 결제는 사람이 직접 진행해야 합니다."
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
