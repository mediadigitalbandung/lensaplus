"use client";

import { useEffect, useRef, useCallback } from "react";

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
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

export default function Turnstile({ onVerify, onExpire }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token: string) => onVerifyRef.current(token),
      "expired-callback": () => onExpireRef.current?.(),
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

    // If turnstile already loaded
    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Load script
    window.onTurnstileLoad = renderWidget;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, renderWidget]);

  if (!siteKey) return null;

  return <div ref={containerRef} className="my-2" />;
}
