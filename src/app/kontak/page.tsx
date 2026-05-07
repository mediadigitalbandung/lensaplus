"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import Turnstile from "@/components/ui/Turnstile";

export default function KontakPage() {
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const onCaptchaVerify = useCallback((token: string) => setCaptchaToken(token), []);

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
      <div className="container-main py-12">
        <div className="mx-auto max-w-4xl">
          <h1 className="flex items-center gap-3 text-xl font-bold text-txt-primary sm:text-2xl lg:text-3xl">
            <span className="block h-8 w-[3px] rounded-full bg-primary" />
            Hubungi Kami
          </h1>

          <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Contact info */}
            <div className="space-y-4">
              <div className="rounded-[12px] border border-border bg-surface p-5">
                <MapPin size={20} className="text-primary" />
                <h3 className="mt-2 font-bold text-txt-primary">Alamat</h3>
                <p className="mt-1 text-sm text-txt-secondary">
                  Bandung, Jawa Barat<br />Indonesia
                </p>
              </div>
              <div className="rounded-[12px] border border-border bg-surface p-5">
                <Mail size={20} className="text-primary" />
                <h3 className="mt-2 font-bold text-txt-primary">Email</h3>
                <p className="mt-1 text-sm text-txt-secondary">
                  redaksi@kartawarta.com
                </p>
              </div>
              <div className="rounded-[12px] border border-border bg-surface p-5">
                <Phone size={20} className="text-primary" />
                <h3 className="mt-2 font-bold text-txt-primary">Telepon</h3>
                <p className="mt-1 text-sm text-txt-secondary">
                  Hubungi via email
                </p>
              </div>
            </div>

            {/* Contact form */}
            <div className="md:col-span-2">
              {sent ? (
                <div className="flex h-full items-center justify-center rounded-[12px] border border-primary/20 bg-primary-light p-8 text-center">
                  <div>
                    <Send size={40} className="mx-auto text-primary" />
                    <h3 className="mt-4 text-lg font-bold text-primary-dark">
                      Pesan Terkirim!
                    </h3>
                    <p className="mt-2 text-sm text-primary">
                      Terima kasih telah menghubungi kami. Tim redaksi akan merespons dalam 1-2 hari kerja.
                    </p>
                    <button
                      onClick={() => { setSent(false); setFormData({ name: "", email: "", subject: "", message: "" }); }}
                      className="mt-4 text-sm text-primary hover:underline"
                    >
                      Kirim pesan lagi
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="rounded-[12px] border border-border bg-surface p-6">
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
                        <option value="umum">Pertanyaan Umum</option>
                        <option value="redaksi">Kirim Tulisan / Opini</option>
                        <option value="iklan">Pasang Iklan</option>
                        <option value="koreksi">Koreksi Berita</option>
                        <option value="kerjasama">Kerjasama</option>
                        <option value="lainnya">Lainnya</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="kontak-pesan" className="mb-1 block text-sm font-medium text-txt-primary">Pesan</label>
                      <textarea id="kontak-pesan" required aria-required="true" rows={5} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} className="input w-full" />
                    </div>
                    <Turnstile onVerify={onCaptchaVerify} onExpire={() => setCaptchaToken("")} />
                    {error && (
                      <p className="text-sm text-red-600">{error}</p>
                    )}
                    <p className="text-sm text-on-surface-variant">
                      Dengan mengirim, Anda menyetujui pemrosesan data sesuai{" "}
                      <Link href="/privasi" className="text-primary underline hover:text-primary-dark">
                        Kebijakan Privasi
                      </Link>{" "}
                      Kartawarta sesuai UU PDP No. 27/2022.
                    </p>
                    <button type="submit" disabled={sending || !captchaToken} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                      <Send size={16} /> {sending ? "Mengirim..." : "Kirim Pesan"}
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
