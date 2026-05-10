"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";

type State = "loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out.buffer as ArrayBuffer;
}

export default function PushSubscribeButton({
  categorySlug,
  className = "",
}: {
  categorySlug?: string;
  className?: string;
}) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    async function init() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancel) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancel) setState("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/push-sw.js");
        const sub = await reg.pushManager.getSubscription();
        if (!cancel) setState(sub ? "subscribed" : "unsubscribed");
      } catch {
        if (!cancel) setState("unsupported");
      }
    }
    init();
    return () => {
      cancel = true;
    };
  }, []);

  async function subscribe() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "unsubscribed");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/push/vapid-key");
      const keyJson = await keyRes.json();
      if (!keyJson?.data?.publicKey) {
        alert("Push notification belum dikonfigurasi server");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyJson.data.publicKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          categorySlugs: categorySlug ? [categorySlug] : [],
        }),
      });
      if (!res.ok) throw new Error("Subscribe failed");
      setState("subscribed");
    } catch (e) {
      console.error("Subscribe error:", e);
      alert("Gagal subscribe notification");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("unsubscribed");
    } catch (e) {
      console.error("Unsubscribe error:", e);
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 text-xs text-txt-muted ${className}`}
      >
        <Loader2 size={12} className="animate-spin" />
        <span>...</span>
      </div>
    );
  }
  if (state === "unsupported") return null; // hide on browsers without support
  if (state === "denied") {
    return (
      <p className={`text-xs text-txt-muted ${className}`}>
        Notifikasi ditolak. Aktifkan di pengaturan browser.
      </p>
    );
  }
  if (state === "subscribed") {
    return (
      <button
        onClick={unsubscribe}
        disabled={busy}
        aria-label="Nonaktifkan notifikasi push"
        className={`inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-white transition-all ${className}`}
      >
        {busy ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Bell size={12} />
        )}
        Notifikasi Aktif
      </button>
    );
  }
  // state === "unsubscribed"
  return (
    <button
      onClick={subscribe}
      disabled={busy}
      aria-label="Aktifkan notifikasi push"
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-txt-primary hover:border-primary hover:text-primary transition-all ${className}`}
    >
      {busy ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <BellOff size={12} />
      )}
      Aktifkan Notifikasi
    </button>
  );
}
