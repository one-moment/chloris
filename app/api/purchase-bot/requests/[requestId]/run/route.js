import { spawn } from "node:child_process";
import { requireCurrentUser } from "../../../../../../lib/auth";
import { getRunnablePurchaseRequest } from "../../../../../../lib/purchaseBot/service";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function POST(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (process.env.VERCEL) return Response.json({ error: "Local purchase worker can only be started from the local Mac server." }, { status: 400 });

  const { requestId } = await params;
  const result = await getRunnablePurchaseRequest({ requestId, actor: user });
  if (result.error) return Response.json({ error: result.error }, { status: result.status });

  const taskId = result.request.workerTaskId;
  const serverUrl = request.nextUrl.origin;
  const child = spawn("npm", ["run", "purchase-worker:task", "--", taskId], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      PURCHASE_BOT_SERVER_URL: serverUrl,
      PURCHASE_BOT_WORKER_TOKEN: process.env.PURCHASE_BOT_WORKER_TOKEN || "local-dev-worker-token"
    }
  });
  child.unref();

  return Response.json({
    ok: true,
    requestId,
    taskId,
    message: "Local purchase worker started."
  }, { status: 202 });
}
