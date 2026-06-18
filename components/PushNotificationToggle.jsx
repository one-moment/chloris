"use client";

import { useCallback, useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

// status: loading | unsupported | ios-not-installed | unconfigured | denied | off | on | working
export default function PushNotificationToggle() {
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    // iOS는 홈 화면 설치(standalone) 전에는 구독 불가 → 먼저 안내
    if (isIos() && !isStandalone()) {
      setStatus("ios-not-installed");
      return;
    }
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) {
      setStatus("unsupported");
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      setStatus("unconfigured");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    } catch {
      setStatus("off");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setStatus("working");
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: { endpoint: json.endpoint, keys: json.keys },
          userAgent: navigator.userAgent
        })
      });
      if (!res.ok) throw new Error("save failed");
      setStatus("on");
    } catch {
      setMessage("알림을 켜지 못했습니다. 다시 시도해 주세요.");
      await refresh();
    }
  }, [refresh]);

  const disable = useCallback(async () => {
    setStatus("working");
    setMessage("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const { endpoint } = sub;
        await sub.unsubscribe().catch(() => {});
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, {
          method: "DELETE",
          credentials: "same-origin"
        }).catch(() => {});
      }
      setStatus("off");
    } catch {
      await refresh();
    }
  }, [refresh]);

  if (status === "loading") return null;

  if (status === "unsupported") {
    return (
      <div className="push-toggle">
        <small>이 브라우저는 알림을 지원하지 않습니다.</small>
      </div>
    );
  }
  if (status === "ios-not-installed") {
    return (
      <div className="push-toggle">
        <small>알림을 받으려면 먼저 공유 버튼 → &quot;홈 화면에 추가&quot;로 설치하세요.</small>
      </div>
    );
  }
  if (status === "unconfigured") {
    return (
      <div className="push-toggle">
        <small>알림이 아직 구성되지 않았습니다.</small>
      </div>
    );
  }
  if (status === "denied") {
    return (
      <div className="push-toggle">
        <small>알림이 차단됨 — 브라우저/기기 설정에서 이 사이트의 알림을 허용해 주세요.</small>
      </div>
    );
  }

  const working = status === "working";
  const on = status === "on";
  return (
    <div className="push-toggle">
      <button className="ghost-button" type="button" onClick={on ? disable : enable} disabled={working}>
        {working ? "처리 중…" : on ? "알림 끄기" : "알림 받기"}
      </button>
      {message ? <small>{message}</small> : null}
    </div>
  );
}
