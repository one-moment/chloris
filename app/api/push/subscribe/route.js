import { requireCurrentUser } from "../../../../lib/auth";
import { badRequest } from "../../../../lib/serverState";
import { prisma } from "../../../../lib/prisma";

// 구독 정보(endpoint·키)는 민감 데이터 — 로그/응답 에코 금지.
function pushId() {
  return `push-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function POST(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const subscription = body?.subscription;
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  const userAgent = typeof body?.userAgent === "string" ? body.userAgent.slice(0, 255) : null;

  if (!endpoint || !p256dh || !auth) {
    return badRequest("Push subscription is incomplete.");
  }

  // 같은 endpoint 재구독은 새 행 대신 upsert. userId는 세션에서만 취득.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: user.id, p256dh, auth, userAgent },
    create: { id: pushId(), userId: user.id, endpoint, p256dh, auth, userAgent }
  });

  return Response.json({ ok: true }, { status: 201 });
}

export async function DELETE(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  let endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!endpoint) {
    try {
      const body = await request.json();
      endpoint = body?.endpoint || body?.subscription?.endpoint || null;
    } catch {
      endpoint = null;
    }
  }
  if (!endpoint) return badRequest("endpoint is required.");

  // 본인 행만 삭제(남의 구독 조작 방지).
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });

  return Response.json({ ok: true });
}
