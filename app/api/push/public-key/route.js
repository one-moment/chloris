import { getVapidPublicKey } from "../../../../lib/push";

// 공개키는 공개 정보 — 인증 불필요. web-push 유도는 Node 런타임 전용.
export const runtime = "nodejs";

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return Response.json({ error: "Push is not configured." }, { status: 503 });
  }
  return Response.json({ publicKey });
}
