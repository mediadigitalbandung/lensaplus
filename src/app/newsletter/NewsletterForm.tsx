"use client";

import { useState, FormEvent } from "react";
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
              <Loader2 size={16} className="animate-spin" />
              Memproses...
            </>
          ) : (
            "Berlangganan"
          )}
        </button>
      </div>
      {result && (
        <div
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
            result.ok
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-800"
          }`}
        >
          {result.ok ? (
            <CheckCircle size={16} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
          )}
          <p>{result.message}</p>
        </div>
      )}
      <p className="text-[11px] text-txt-muted">
        Dengan berlangganan, Anda menyetujui{" "}
        <a href="/privasi" className="underline">
          Kebijakan Privasi
        </a>{" "}
        Lensaplus.
      </p>
    </form>
  );
}
