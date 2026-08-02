"use client";

import { useState } from "react";
import { Mail, CheckCircle2, AlertCircle, Loader2, Send } from "lucide-react";

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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-[#002a5c] to-primary-dark p-6 sm:p-10 text-white shadow-xl shadow-primary/10 ring-1 ring-white/10">
      {/* Background Decorative Rings */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-secondary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-64 w-64 rounded-full bg-primary-light/10 blur-3xl" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
        {/* Left Column: Heading & Info */}
        <div className="lg:col-span-6 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300 backdrop-blur-md">
            <Mail size={14} className="text-amber-300" />
            <span>Newsletter Eksklusif</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight">
            Berita Bandung Terkini Langsung ke Inbocks Anda
          </h2>
          <p className="text-sm text-stone-200 leading-relaxed">
            Dapatkan rangkuman isu ekonomi, kebijakan publik, dan peristiwa terkini setiap pagi tanpa spam.
          </p>
        </div>

        {/* Right Column: Interactive Form */}
        <div className="lg:col-span-6">
          {status === "success" ? (
            <div className="flex items-start gap-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 p-4 text-emerald-100 backdrop-blur-md animate-fade-in">
              <CheckCircle2 size={24} className="shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-white">Pendaftaran Berhasil!</h4>
                <p className="text-xs text-emerald-200 mt-0.5 leading-relaxed">{message}</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="relative flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Masukkan alamat email Anda..."
                    required
                    disabled={status === "loading"}
                    className="w-full rounded-xl border border-white/20 bg-white/10 py-3.5 pl-11 pr-4 text-sm text-white placeholder-stone-300 backdrop-blur-md outline-none transition duration-200 focus:border-amber-400 focus:bg-white/15 focus:ring-2 focus:ring-amber-400/30 disabled:opacity-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={status === "loading" || !email}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-secondary/30 transition-all duration-200 hover:bg-secondary-dark hover:shadow-secondary/50 focus:outline-none focus:ring-2 focus:ring-secondary/50 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Mengirim...</span>
                    </>
                  ) : (
                    <>
                      <span>Langganan</span>
                      <Send size={15} />
                    </>
                  )}
                </button>
              </div>

              {status === "error" && (
                <div className="flex items-center gap-2 text-xs text-rose-300 mt-1">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{message}</span>
                </div>
              )}

              <p className="text-[11px] text-stone-300">
                Kami menghormati privasi Anda. Anda dapat berhenti berlangganan kapan saja melalui link di footer email.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
