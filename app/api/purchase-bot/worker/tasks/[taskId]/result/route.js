import { completeWorkerTask, validateWorkerToken } from "../../../../../../../lib/purchaseBot/service";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function POST(request, { params }) {
  if (!validateWorkerToken(request)) return Response.json({ error: "Invalid worker token." }, { status: 401 });

  const { taskId } = await params;
  const resultBody = await request.json();
  const result = await completeWorkerTask({ taskId, result: resultBody });
  if (result.error) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result);
}
