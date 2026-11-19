"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global error]", error);
    Sentry.captureException(error, {
      tags: {
        boundary: "global",
        ...(error.digest ? { digest: error.digest } : {}),
      },
    });
  }, [error]);

  return (
    <html lang="id">
      <body>
        <div
          role="alert"
          style={{
            padding: 40,
            textAlign: "center",
            fontFamily: "sans-serif",
            maxWidth: 480,
            margin: "80px auto",
          }}
        >
          <h1 style={{ fontSize: 22, marginBottom: 12 }}>Lensaplus — Error Sistem</h1>
          <p style={{ color: "#44474e", marginBottom: 8 }}>
            Terjadi kesalahan kritis. Tim kami sudah diberitahu.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#74777f", marginBottom: 16 }}>
              Kode: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 8,
              padding: "10px 24px",
              background: "#2E1065",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Muat Ulang
          </button>
        </div>
      </body>
    </html>
  );
}
