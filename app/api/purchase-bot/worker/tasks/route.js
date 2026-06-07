import { claimNextWorkerTask, validateWorkerToken } from "../../../../../lib/purchaseBot/service";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function GET(request) {
  if (!validateWorkerToken(request)) return Response.json({ error: "Invalid worker token." }, { status: 401 });

  const task = await claimNextWorkerTask();
  if (!task) return Response.json({ task: null });

  return Response.json({
    task: {
      id: task.id,
      purchaseRequestId: task.purchaseRequestId,
      vendor: task.vendor,
      url: task.url,
      quantity: task.quantity,
      automationLevel: task.automationLevel,
      maxAllowedPrice: task.maxAllowedPrice,
      itemName: task.purchaseRequest.itemName,
      unitLabel: task.purchaseRequest.unitLabel
    }
  });
}
