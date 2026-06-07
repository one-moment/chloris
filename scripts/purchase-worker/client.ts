import { config } from "./config";

export type PurchaseWorkerTask = {
  id: string;
  purchaseRequestId: string;
  vendor: "coupang" | "swadpia";
  url: string;
  quantity: number;
  automationLevel: "open_page" | "add_to_cart" | "checkout_ready";
  maxAllowedPrice?: number;
  itemName: string;
  unitLabel: string;
};

export type WorkerResult = {
  status: "needs_human" | "cart_ready" | "checkout_ready" | "failed";
  message: string;
  screenshotPath?: string;
  observedPrice?: number;
  errorCode?: string;
};

function headers() {
  return {
    Authorization: `Bearer ${config.token}`,
    "Content-Type": "application/json"
  };
}

export async function fetchNextTask(): Promise<PurchaseWorkerTask | null> {
  const response = await fetch(`${config.serverUrl}/api/purchase-bot/worker/tasks`, {
    headers: headers()
  });
  if (!response.ok) throw new Error(`Failed to fetch worker task: ${response.status}`);
  const data = await response.json();
  return data.task ?? null;
}

export async function reportTaskResult(taskId: string, result: WorkerResult) {
  const response = await fetch(`${config.serverUrl}/api/purchase-bot/worker/tasks/${taskId}/result`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(result)
  });
  if (!response.ok) throw new Error(`Failed to report worker result: ${response.status}`);
  return response.json();
}
