import { claimWorkerTask, validateWorkerToken } from "../../../../../../lib/purchaseBot/service";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

function serializeWorkerTask(task) {
  return {
    id: task.id,
    purchaseRequestId: task.purchaseRequestId,
    vendor: task.vendor,
    url: task.url,
    quantity: task.quantity,
    automationLevel: task.automationLevel,
    maxAllowedPrice: task.maxAllowedPrice,
    itemName: task.purchaseRequest.itemName,
    unitLabel: task.purchaseRequest.unitLabel
  };
}

export async function GET(request, { params }) {
  if (!validateWorkerToken(request)) return Response.json({ error: "Invalid worker token." }, { status: 401 });

  const { taskId } = await params;
  const result = await claimWorkerTask(taskId);
  if (result.error) return Response.json({ error: result.error }, { status: result.status });

  return Response.json({ task: serializeWorkerTask(result.task) });
}
