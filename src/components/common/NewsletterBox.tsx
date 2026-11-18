"use client";

import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

export default function NewsletterBox() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "homepage_footer_box" }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setStatus("success");
        setMessage(json.data?.message || "Terima kasih! Silakan cek email Anda untuk konfirmasi berlangganan.");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(json.error || "Gagal mendaftar. Silakan coba lagi.");
      }
    } catch {
      setStatus("error");
      setMessage("Terjadi kesalahan jaringan. Coba beberapa saat lagi.");
    }
  };

  return (
    <div className="rounded-2xl bg-white p-6 sm:p-10 text-on-surface border border-stone-200/80 shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:gap-8 items-center">
        {/* Left Column: Heading & Info */}
        <div className="lg:col-span-6">
          <div className="border-l-4 border-secondary pl-3.5 sm:pl-4">
            <p className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-secondary-dark">
              Newsletter Eksklusif
            </p>
            <h2 className="mt-1 sm:mt-1.5 font-serif text-title-lg sm:text-headline-md leading-tight text-on-surface">
              Berita Terkini Langsung ke Kotak Masuk Anda
            </h2>
          </div>
          <p className="mt-2.5 sm:mt-3 text-body-sm sm:text-body-md text-stone-600 leading-relaxed">
            Dapatkan rangkuman isu ekonomi, kebijakan publik, dan peristiwa terkini setiap pagi tanpa spam.
          </p>
        </div>

        {/* Right Column: Interactive Form */}
        <div className="lg:col-span-6">
          {status === "success" ? (
            <div className="border-l-4 border-secondary pl-4 py-2 text-on-surface animate-fade-in">
              <h3 className="font-serif text-title-md font-bold text-on-surface">Pendaftaran Berhasil</h3>
              <p className="text-body-sm text-stone-600 mt-1 leading-relaxed">{message}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Masukkan alamat email Anda..."
                  aria-label="Alamat email"
                  required
                  disabled={status === "loading"}
                  className="flex-1 rounded-xl border border-stone-300 bg-surface px-4 py-3 text-body-sm text-on-surface placeholder:text-stone-400 outline-none transition-colors focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={status === "loading" || !email}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary-dark px-6 py-3 text-label-md font-bold uppercase tracking-wider text-white transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-secondary/40 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      <span>Mengirim...</span>
                    </>
                  ) : (
                    <span>Langganan</span>
                  )}
                </button>
              </div>

              {status === "error" && (
                <div role="alert" className="flex items-center gap-2 border-l-4 border-l-red-600 pl-3 py-1 text-xs text-red-700">
                  <AlertCircle size={14} className="shrink-0 text-red-600" aria-hidden="true" />
                  <span>{message}</span>
                </div>
              )}

              <p className="text-[11px] text-stone-500">
                Kami menghormati privasi Anda. Anda dapat berhenti berlangganan kapan saja melalui link di footer email.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
