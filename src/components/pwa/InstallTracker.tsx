"use client";

import { useEffect } from "react";

/**
 * InstallTracker — fire-and-forget client component yang track:
 *   1. PWA install events (browser fires `appinstalled` saat user click "Pasang aplikasi")
 *   2. Standalone mode detection (kalau halaman dibuka dari home screen — berarti
 *      user sudah install sebelumnya)
 *   3. APK download click (delegated handler untuk anchor di /unduh)
 *
 * Data dikirim ke /api/install-tracking (no-op kalau endpoint belum ada).
 * Tujuan: tau breakdown channel install (PWA vs APK vs sideload) tanpa pakai
 * Google Analytics (privacy-first).
 */
export default function InstallTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. PWA install event
    const onAppInstalled = () => {
      track("pwa-install", { display: detectDisplayMode() });
    };
    window.addEventListener("appinstalled", onAppInstalled);

    // 2. Standalone detection (user opens from home screen) — fire once per session
    const sessionKey = "kartawarta_pwa_session_logged";
    if (!sessionStorage.getItem(sessionKey)) {
      const display = detectDisplayMode();
      if (display !== "browser") {
        track("pwa-launch", { display });
        sessionStorage.setItem(sessionKey, "1");
      }
    }

    // 3. APK download click — delegated listener
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const a = target.closest("a") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (href.endsWith(".apk") || href.includes("/downloads/kartawarta")) {
        track("apk-download", { source: location.pathname });
      }
    };
    document.addEventListener("click", onClick);

    return () => {
      window.removeEventListener("appinstalled", onAppInstalled);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}

function detectDisplayMode(): "standalone" | "minimal-ui" | "fullscreen" | "browser" {
  if (typeof window === "undefined") return "browser";
  if (window.matchMedia("(display-mode: standalone)").matches) return "standalone";
  if (window.matchMedia("(display-mode: minimal-ui)").matches) return "minimal-ui";
  if (window.matchMedia("(display-mode: fullscreen)").matches) return "fullscreen";
  // iOS Safari standalone signal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((navigator as any).standalone === true) return "standalone";
  return "browser";
}

function track(event: string, payload: Record<string, unknown>) {
  // Non-blocking — never wait, never throw. Use sendBeacon kalau available
  // (delivered even kalau tab di-close), fallback ke fetch.
  try {
    const body = JSON.stringify({
      event,
      payload,
      url: location.pathname,
      ua: navigator.userAgent.slice(0, 200),
      ts: Date.now(),
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/install-tracking",
        new Blob([body], { type: "application/json" }),
      );
    } else {
      fetch("/api/install-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* swallow */
  }
}
