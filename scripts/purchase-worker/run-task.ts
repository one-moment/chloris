import { withBrowser } from "./browser";
import { reportTaskResult, type PurchaseWorkerTask, type WorkerResult } from "./client";
import { config } from "./config";
import { runCoupangTask } from "./handlers/coupang";
import { runHandoffTask } from "./handlers/handoff";
import { runSwadpiaTask } from "./handlers/swadpia";

async function fetchTask(taskId: string): Promise<PurchaseWorkerTask> {
  const response = await fetch(`${config.serverUrl}/api/purchase-bot/worker/tasks/${taskId}`, {
    headers: {
      Authorization: `Bearer ${config.token}`
    }
  });
  if (!response.ok) throw new Error(`Failed to claim worker task ${taskId}: ${response.status}`);
  const data = await response.json();
  if (!data.task) throw new Error(`Worker task ${taskId} was not returned.`);
  return data.task;
}

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

async function main() {
  const taskId = process.argv[2];
  if (!taskId) {
    console.error("Usage: npm run purchase-worker:task -- <task-id>");
    process.exit(1);
  }

  const task = await fetchTask(taskId);
  console.log(`[purchase-worker] claimed ${task.id} ${task.vendor} ${task.itemName} ${task.quantity}${task.unitLabel}`);

  let result: WorkerResult;
  try {
    result = await runTask(task);
  } catch (error) {
    result = {
      status: "failed",
      errorCode: "WORKER_ERROR",
      message: error instanceof Error ? error.message : String(error)
    };
  }

  await reportTaskResult(task.id, result);
  console.log(`[purchase-worker] reported ${task.id} ${result.status}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
