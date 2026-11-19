"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Send, CheckCircle2 } from "lucide-react";
import Turnstile from "@/components/ui/Turnstile";

const PACKAGES = [
  "Banner Display (Header/Sidebar/In-Article)",
  "Advertorial / Berita Berbayar",
  "Kerjasama Media / Pemerintah Daerah",
  "Paket Bundling / Lainnya",
];

export default function AdInquiryForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    whatsapp: "",
    company: "",
    pkg: "",
    message: "",
  });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const onCaptchaVerify = useCallback((token: string) => setCaptchaToken(token), []);
  const resetCaptcha = useCallback(() => {
    setCaptchaToken("");
    setCaptchaResetKey((k) => k + 1);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSending(true);

    // Bundle the ad-specific fields into the contact message body so we can
    // reuse the existing /api/contact endpoint (ContactMessage model) without a
    // new table/migration.
    const composed = [
      `Jenis kerjasama: ${form.pkg || "-"}`,
      `Perusahaan/Instansi: ${form.company || "-"}`,
      `WhatsApp: ${form.whatsapp || "-"}`,
      "",
      form.message,
    ].join("\n");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          subject: "iklan",
          message: composed,
          captchaToken,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Gagal mengirim. Coba lagi.");
        return;
      }
      setSent(true);
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      resetCaptcha();
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border border-l-4 border-l-primary bg-surface p-8 text-center shadow-card">
        <div>
          <CheckCircle2 size={36} className="mx-auto text-primary" />
          <h3 className="mt-4 text-lg font-bold text-txt-primary">Permintaan Terkirim!</h3>
          <p className="mt-2 text-sm text-txt-secondary">
            Terima kasih. Tim pemasaran Lensaplus akan menghubungi Anda dalam 1&ndash;2 hari kerja
            dengan media kit &amp; penawaran tarif.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface p-6 shadow-card">
      <h2 className="text-lg font-bold text-txt-primary">Minta Penawaran &amp; Media Kit</h2>
      <p className="mt-1 text-sm text-txt-secondary">
        Isi formulir di bawah, tim kami akan mengirim tarif lengkap &amp; data audiens terbaru.
      </p>
      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ad-nama" className="mb-1 block text-sm font-medium text-txt-primary">
              Nama <span className="text-red-600">*</span>
            </label>
            <input
              id="ad-nama"
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input w-full"
            />
          </div>
          <div>
            <label htmlFor="ad-email" className="mb-1 block text-sm font-medium text-txt-primary">
              Email <span className="text-red-600">*</span>
            </label>
            <input
              id="ad-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input w-full"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ad-wa" className="mb-1 block text-sm font-medium text-txt-primary">
              WhatsApp
            </label>
            <input
              id="ad-wa"
              type="tel"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              className="input w-full"
              placeholder="08xxxxxxxxxx"
            />
          </div>
          <div>
            <label htmlFor="ad-company" className="mb-1 block text-sm font-medium text-txt-primary">
              Perusahaan / Instansi
            </label>
            <input
              id="ad-company"
              type="text"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="input w-full"
            />
          </div>
        </div>
        <div>
          <label htmlFor="ad-pkg" className="mb-1 block text-sm font-medium text-txt-primary">
            Jenis Kerjasama <span className="text-red-600">*</span>
          </label>
          <select
            id="ad-pkg"
            required
            value={form.pkg}
            onChange={(e) => setForm({ ...form, pkg: e.target.value })}
            className="input w-full"
          >
            <option value="">Pilih jenis kerjasama</option>
            {PACKAGES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ad-pesan" className="mb-1 block text-sm font-medium text-txt-primary">
            Pesan <span className="text-red-600">*</span>
          </label>
          <textarea
            id="ad-pesan"
            required
            rows={4}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="input w-full"
            placeholder="Ceritakan kebutuhan kampanye Anda (durasi, target, anggaran perkiraan)."
          />
        </div>
        <Turnstile onVerify={onCaptchaVerify} onExpire={() => setCaptchaToken("")} resetKey={captchaResetKey} />
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <p className="text-xs text-txt-muted">
          Dengan mengirim, Anda menyetujui pemrosesan data sesuai{" "}
          <Link href="/privasi" className="text-primary underline hover:text-primary-dark">
            Kebijakan Privasi
          </Link>{" "}
          (UU PDP No. 27/2022).
        </p>
        <button
          type="submit"
          disabled={sending || !captchaToken}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Send size={16} /> {sending ? "Mengirim..." : "Kirim Permintaan"}
        </button>
      </div>
    </form>
  );
}
