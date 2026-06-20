import { requireCurrentUser } from "../../../../lib/auth";
import { isPushConfigured, sendToUser } from "../../../../lib/push";

// web-push는 Node 런타임 전용 — edge로 바뀌면 깨지므로 명시.
export const runtime = "nodejs";

export async function POST(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  // ① VAPID 미설정이면 "조용한 실패" 대신 분명히 알림.
  if (!isPushConfigured()) {
    return Response.json(
      { error: "Push is not configured (VAPID keys missing)." },
      { status: 503 }
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // 본인 기기에만 발송(userId=세션). 타 사용자 브로드캐스트는 4단계 범위.
  const result = await sendToUser(user.id, {
    title: typeof body.title === "string" ? body.title : "테스트 알림",
    body: typeof body.body === "string" ? body.body : "푸시가 정상 동작합니다.",
    url: typeof body.url === "string" ? body.url : "/"
  });

  return Response.json({ ok: true, ...result });
}
