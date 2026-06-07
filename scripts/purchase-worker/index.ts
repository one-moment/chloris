import { withBrowser } from "./browser";
import { fetchNextTask, reportTaskResult, type PurchaseWorkerTask, type WorkerResult } from "./client";
import { config } from "./config";
import { runCoupangTask } from "./handlers/coupang";
import { runHandoffTask } from "./handlers/handoff";
import { runSwadpiaTask } from "./handlers/swadpia";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTask(task: PurchaseWorkerTask): Promise<WorkerResult> {
  if (config.handoffOnly) return runHandoffTask(task);

  return withBrowser(async ({ page }) => {
    if (task.vendor === "coupang") return runCoupangTask(page, task);
    if (task.vendor === "swadpia") return runSwadpiaTask(page, task);
    return {
      status: "failed",
      errorCode: "UNSUPPORTED_VENDOR",
      message: `지원하지 않는 공급처입니다: ${task.vendor}`
    };
  });
}

async function tick() {
  const task = await fetchNextTask();
  if (!task) return;

  console.log(`[purchase-worker] claimed ${task.id} ${task.vendor} ${task.itemName} ${task.quantity}${task.unitLabel}`);
  let result: WorkerResult;
  try {
    result = await runTask(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result = {
      status: "failed",
      errorCode: "WORKER_ERROR",
      message
    };
  }
  await reportTaskResult(task.id, result);
  console.log(`[purchase-worker] reported ${task.id} ${result.status}`);
}

async function main() {
  console.log(`[purchase-worker] server=${config.serverUrl} headless=${config.headless} interval=${config.pollIntervalMs}ms`);
  if (config.runOnce) {
    await tick();
    return;
  }

  for (;;) {
    try {
      await tick();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[purchase-worker] ${message}`);
    }
    await delay(config.pollIntervalMs);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
