"use client";

import { useEffect } from "react";

export default function EditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Editor error]", error);
  }, [error]);

  return (
    <div className="container-main py-12 text-center">
      <h2 className="font-serif text-2xl text-on-surface mb-4">Editor Mengalami Masalah</h2>
      <p className="text-on-surface-variant mb-6">
        Editor TipTap mengalami error. Coba muat ulang halaman ini. Perubahan yang belum tersimpan mungkin hilang.
      </p>
      <button className="btn-primary" onClick={reset}>
        Muat Ulang Editor
      </button>
    </div>
  );
}
