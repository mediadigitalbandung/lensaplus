"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  /** Increment or change this value to reset the single-use Turnstile widget after submit/error. */
  resetKey?: number | string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad";
const loadListeners = new Set<() => void>();
const errorListeners = new Set<() => void>();
let scriptState: "idle" | "loading" | "ready" | "error" = "idle";

function loadTurnstileScript(onReady: () => void, onError: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  if (window.turnstile) {
    scriptState = "ready";
    onReady();
    return () => {};
  }

  loadListeners.add(onReady);
  errorListeners.add(onError);

  if (scriptState === "error") {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    existing?.remove();
    scriptState = "idle";
  }

  if (scriptState === "idle") {
    scriptState = "loading";
    window.onTurnstileLoad = () => {
      scriptState = "ready";
      loadListeners.forEach((cb) => cb());
      loadListeners.clear();
      errorListeners.clear();
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (!existing) {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        scriptState = "error";
        errorListeners.forEach((cb) => cb());
        loadListeners.clear();
        errorListeners.clear();
      };
      document.head.appendChild(script);
    }
  }

  return () => {
    loadListeners.delete(onReady);
    errorListeners.delete(onError);
  };
}

export default function Turnstile({ onVerify, onExpire, resetKey }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const prevResetKeyRef = useRef(resetKey);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || widgetIdRef.current) return;
    setFailed(false);
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token: string) => {
        setFailed(false);
        onVerifyRef.current(token);
      },
      "expired-callback": () => onExpireRef.current?.(),
      "error-callback": () => {
        setFailed(true);
        onExpireRef.current?.();
      },
      theme: "light",
      size: "normal",
    });
  }, [siteKey]);

  useEffect(() => {
    if (!siteKey) {
      // Unlock forms automatically when Turnstile is unconfigured on this environment;
      // server-side verifyTurnstile also skips when TURNSTILE_SECRET_KEY is absent.
      onVerifyRef.current("turnstile-disabled");
      return;
    }

    if (window.turnstile) {
      renderWidget();
    }

    const cleanup = loadTurnstileScript(renderWidget, () => setFailed(true));

    return () => {
      cleanup();
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, renderWidget, attempt]);

  useEffect(() => {
    if (prevResetKeyRef.current === resetKey) return;
    prevResetKeyRef.current = resetKey;

    if (!siteKey) {
      onVerifyRef.current("turnstile-disabled");
      return;
    }

    if (widgetIdRef.current && window.turnstile) {
      try {
        setFailed(false);
        window.turnstile.reset(widgetIdRef.current);
        return;
      } catch {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore removal failure before re-render attempt
        }
        widgetIdRef.current = null;
      }
    }

    setFailed(false);
    setAttempt((n) => n + 1);
  }, [resetKey, siteKey]);

  if (!siteKey) return null;

  return (
    <div className="my-2">
      <div ref={containerRef} />
      {failed && (
        <div role="alert" className="mt-1.5 flex items-center gap-2 text-xs text-red-700">
          <span>Verifikasi keamanan gagal dimuat.</span>
          <button
            type="button"
            onClick={() => {
              if (widgetIdRef.current && window.turnstile) {
                window.turnstile.remove(widgetIdRef.current);
                widgetIdRef.current = null;
              }
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
            className="font-semibold text-primary underline hover:text-primary-dark"
          >
            Muat ulang verifikasi
          </button>
        </div>
      )}
    </div>
  );
}
