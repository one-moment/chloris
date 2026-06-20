import webpush from "web-push";
import crypto from "node:crypto";
import { prisma } from "./prisma";

// VAPID 비밀키는 .env/Vercel에만. 구독 endpoint·키는 민감 데이터 → 로그/에코 금지.
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@1moment.co.kr";

// 공개키는 비밀키에서 유도(단일 출처) → NEXT_PUBLIC 빌드변수 불필요.
// 명시 env(NEXT_PUBLIC_VAPID_PUBLIC_KEY/VAPID_PUBLIC_KEY)가 있으면 그걸 우선.
let cachedPublicKey;
export function getVapidPublicKey() {
  if (cachedPublicKey !== undefined) return cachedPublicKey;
  const explicit = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  if (explicit) {
    cachedPublicKey = explicit;
  } else if (PRIVATE_KEY) {
    try {
      const ecdh = crypto.createECDH("prime256v1");
      ecdh.setPrivateKey(Buffer.from(PRIVATE_KEY, "base64url"));
      cachedPublicKey = ecdh.getPublicKey().toString("base64url");
    } catch {
      cachedPublicKey = null;
    }
  } else {
    cachedPublicKey = null;
  }
  return cachedPublicKey;
}

// 공개키(유도)·비밀키가 있고 setVapidDetails가 통과해야 발송 준비됨.
let vapidReady = false;
const PUBLIC_KEY = getVapidPublicKey();
if (PUBLIC_KEY && PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
    vapidReady = true;
  } catch {
    vapidReady = false; // 키/subject 형식 오류 등
  }
}

export function isPushConfigured() {
  return vapidReady;
}

// 한 사용자의 모든 기기로 발송. 기기별 독립 처리(allSettled) — 죽은 기기 한 건의 실패가
// 나머지 발송을 막지 않음. 무효(410/404) 구독은 자동 삭제.
export async function sendToUser(userId, { title, body, url } = {}) {
  if (!isPushConfigured()) {
    return { configured: false, sent: 0, removed: 0, failed: 0 };
  }

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) {
    return { configured: true, sent: 0, removed: 0, failed: 0 };
  }

  // sw.js 핸들러 계약: top-level { title, body, url }
  const payload = JSON.stringify({
    title: title || "보로",
    body: body || "",
    url: url || "/"
  });

  const results = await Promise.allSettled(
    subscriptions.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      )
    )
  );

  let sent = 0;
  let failed = 0;
  const staleIds = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      sent += 1;
      return;
    }
    const code = r.reason?.statusCode;
    if (code === 410 || code === 404) {
      staleIds.push(subscriptions[i].id); // 만료/무효 → 정리 대상
    } else {
      failed += 1;
    }
  });

  let removed = 0;
  if (staleIds.length > 0) {
    const res = await prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } });
    removed = res.count;
  }

  return { configured: true, sent, removed, failed };
}
