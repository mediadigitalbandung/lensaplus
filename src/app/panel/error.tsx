"use client";

import { useEffect } from "react";

export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Panel error]", error);
  }, [error]);

  return (
    <div className="container-main py-12 text-center">
      <h2 className="font-serif text-2xl text-on-surface mb-4">Terjadi Kesalahan</h2>
      <p className="text-on-surface-variant mb-6">
        {error.message || "Tidak dapat memuat halaman panel ini."}
      </p>
      <button className="btn-primary" onClick={reset}>
        Coba Lagi
      </button>
    </div>
  );
}
