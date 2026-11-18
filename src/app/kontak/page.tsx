"use client";

import { Suspense, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, Send } from "lucide-react";
import Turnstile from "@/components/ui/Turnstile";

const SUBJECT_OPTIONS = [
  { value: "umum", label: "Pertanyaan Umum" },
  { value: "redaksi", label: "Kirim Tulisan / Opini" },
  { value: "iklan", label: "Pasang Iklan" },
  { value: "koreksi", label: "Koreksi Berita" },
  { value: "laporan", label: "Laporkan Berita" },
  { value: "kerjasama", label: "Kerjasama" },
  { value: "lainnya", label: "Lainnya" },
] as const;

function resolveInitialSubject(raw: string | null): string {
  if (!raw) return "";
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "laporkan berita" || normalized === "laporan" || normalized.includes("lapor")) {
    return "laporan";
  }
  const matched = SUBJECT_OPTIONS.find(
    (opt) => opt.value === normalized || opt.label.toLowerCase() === normalized
  );
  return matched ? matched.value : "";
}

function KontakFormContent() {
  const searchParams = useSearchParams();
  const initialSubject = resolveInitialSubject(searchParams.get("subject"));
  const [formData, setFormData] = useState({ name: "", email: "", subject: initialSubject, message: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const onCaptchaVerify = useCallback((token: string) => setCaptchaToken(token), []);

  useEffect(() => {
    if (initialSubject) {
      setFormData((prev) => (prev.subject ? prev : { ...prev, subject: initialSubject }));
    }
  }, [initialSubject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSending(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, captchaToken }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Gagal mengirim pesan");
        setSending(false);
        return;
      }

      setSent(true);
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-surface min-h-screen">
      <div className="container-main py-8 sm:py-10 lg:py-12 2xl:py-16">
        <div className="mx-auto max-w-4xl">
          <h1 className="flex items-center gap-3 font-serif text-headline-sm font-bold text-txt-primary sm:text-headline-md lg:text-headline-lg">
            <span className="block h-8 w-[3px] rounded-full bg-secondary" />
            Hubungi Kami
          </h1>

          <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Contact info */}
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-surface p-5">
                <h3 className="font-bold text-txt-primary">Alamat</h3>
                <p className="mt-1 text-sm text-txt-secondary">
                  Bandung, Jawa Barat<br />Indonesia
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-5">
                <h3 className="font-bold text-txt-primary">Email</h3>
                <p className="mt-1 text-sm text-txt-secondary">
                  redaksi@lensaplus.com
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-5">
                <h3 className="font-bold text-txt-primary">Telepon</h3>
                <p className="mt-1 text-sm text-txt-secondary">
                  {process.env.NEXT_PUBLIC_PUBLISHER_PHONE ? (
                    <a
                      href={`tel:${process.env.NEXT_PUBLIC_PUBLISHER_PHONE.replace(/[^+\d]/g, "")}`}
                      className="hover:text-primary"
                    >
                      {process.env.NEXT_PUBLIC_PUBLISHER_PHONE}
                    </a>
                  ) : (
                    "Hubungi via email"
                  )}
                </p>
              </div>
            </div>

            {/* Contact form */}
            <div className="md:col-span-2">
              {sent ? (
                <div className="flex h-full items-center justify-center rounded-lg border border-border border-l-4 border-l-primary bg-surface p-8 text-center">
                  <div>
                    <Mail size={32} className="mx-auto text-primary" aria-hidden="true" />
                    <h3 className="mt-4 text-lg font-bold text-txt-primary">
                      Pesan Terkirim!
                    </h3>
                    <p className="mt-2 text-sm text-txt-secondary">
                      Terima kasih telah menghubungi kami. Tim redaksi akan merespons dalam 1-2 hari kerja.
                    </p>
                    <button
                      type="button"
                      onClick={() => { setSent(false); setFormData({ name: "", email: "", subject: initialSubject, message: "" }); }}
                      className="mt-4 text-sm text-primary hover:underline"
                    >
                      Kirim pesan lagi
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-surface p-6">
                  <h2 className="mb-4 text-lg font-bold text-txt-primary">Kirim Pesan</h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="kontak-nama" className="mb-1 block text-sm font-medium text-txt-primary">Nama</label>
                        <input id="kontak-nama" type="text" required aria-required="true" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input w-full" />
                      </div>
                      <div>
                        <label htmlFor="kontak-email" className="mb-1 block text-sm font-medium text-txt-primary">Email</label>
                        <input id="kontak-email" type="email" required aria-required="true" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input w-full" />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="kontak-subjek" className="mb-1 block text-sm font-medium text-txt-primary">Subjek</label>
                      <select id="kontak-subjek" required aria-required="true" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} className="input w-full">
                        <option value="">Pilih subjek</option>
                        {SUBJECT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="kontak-pesan" className="mb-1 block text-sm font-medium text-txt-primary">Pesan</label>
                      <textarea id="kontak-pesan" required aria-required="true" rows={5} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} className="input w-full" />
                    </div>
                    <Turnstile onVerify={onCaptchaVerify} onExpire={() => setCaptchaToken("")} />
                    {error && (
                      <p role="alert" className="text-sm text-red-600">{error}</p>
                    )}
                    <p className="text-sm text-on-surface-variant">
                      Dengan mengirim, Anda menyetujui pemrosesan data sesuai{" "}
                      <Link href="/privasi" className="text-primary underline hover:text-primary-dark">
                        Kebijakan Privasi
                      </Link>{" "}
                      Lensaplus sesuai UU PDP No. 27/2022.
                    </p>
                    <button type="submit" disabled={sending || !captchaToken} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                      <Send size={16} aria-hidden="true" /> {sending ? "Mengirim..." : "Kirim Pesan"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KontakPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-surface min-h-screen">
          <div className="container-main py-8 sm:py-10 lg:py-12 2xl:py-16">
            <div className="mx-auto max-w-4xl">
              <p className="text-sm text-txt-muted">Memuat formulir kontak...</p>
            </div>
          </div>
        </div>
      }
    >
      <KontakFormContent />
    </Suspense>
  );
}
