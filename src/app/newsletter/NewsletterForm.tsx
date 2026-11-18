"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { Loader2, Mail, CheckCircle, AlertCircle } from "lucide-react";

export default function NewsletterForm({ source }: { source: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setResult({
          ok: true,
          message:
            json.data?.message ||
            "Cek email Anda untuk menyelesaikan langganan.",
        });
        setEmail("");
      } else {
        setResult({
          ok: false,
          message: json.error || "Gagal mendaftarkan email. Coba lagi.",
        });
      }
    } catch {
      setResult({ ok: false, message: "Koneksi gagal. Coba lagi nanti." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-xs font-semibold text-txt-secondary uppercase tracking-wider">
        Email Anda
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Mail
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted pointer-events-none"
          />
          <input
            type="email"
            required
            placeholder="anda@email.com"
            aria-label="Alamat email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input w-full pl-9 min-h-[44px]"
            disabled={busy}
          />
        </div>
        <button
          type="submit"
          disabled={busy || !email}
          className="btn-primary inline-flex items-center justify-center gap-2 min-h-[44px] px-5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Memproses...
            </>
          ) : (
            "Berlangganan"
          )}
        </button>
      </div>
      {result && (
        <div
          role={result.ok ? "status" : "alert"}
          className={`flex items-start gap-2 border-l-4 pl-3 py-1 text-sm ${
            result.ok
              ? "border-secondary text-emerald-800"
              : "border-red-600 text-red-700"
          }`}
        >
          {result.ok ? (
            <CheckCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          )}
          <p>{result.message}</p>
        </div>
      )}
      <p className="text-[11px] text-txt-muted">
        Dengan berlangganan, Anda menyetujui{" "}
        <Link href="/privasi" className="underline hover:text-primary">
          Kebijakan Privasi
        </Link>{" "}
        Lensaplus.
      </p>
    </form>
  );
}
