"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ShieldX, Loader2, MailCheck } from "lucide-react";

type State = "loading" | "verified" | "already" | "invalid" | "expired" | "error";

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<State>("loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let done = false;
    (async () => {
      if (!token) {
        if (!done) setState("invalid");
        return;
      }
      try {
        const res = await fetch("/api/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = await res.json().catch(() => ({}));
        const status = json?.data?.status as State | undefined;
        if (done) return;
        setEmail(json?.data?.email || null);
        setState(status && ["verified", "already", "invalid", "expired"].includes(status) ? status : "error");
      } catch {
        if (!done) setState("error");
      }
    })();
    return () => { done = true; };
  }, [token]);

  const ui = {
    loading: { icon: <Loader2 size={48} className="animate-spin text-primary" />, title: "Memverifikasi…", desc: "Mohon tunggu sebentar." },
    verified: { icon: <ShieldCheck size={48} className="text-green-600" />, title: "Email Terverifikasi ✓", desc: email ? `${email} berhasil diverifikasi. Terima kasih!` : "Email Anda berhasil diverifikasi. Terima kasih!" },
    already: { icon: <MailCheck size={48} className="text-green-600" />, title: "Sudah Terverifikasi", desc: "Email ini sudah pernah diverifikasi sebelumnya." },
    expired: { icon: <ShieldX size={48} className="text-secondary" />, title: "Tautan Kedaluwarsa", desc: "Tautan verifikasi sudah lewat masa berlaku (24 jam). Minta tautan baru dari halaman Profil." },
    invalid: { icon: <ShieldX size={48} className="text-secondary" />, title: "Tautan Tidak Valid", desc: "Tautan verifikasi tidak dikenali atau sudah digunakan." },
    error: { icon: <ShieldX size={48} className="text-secondary" />, title: "Terjadi Kesalahan", desc: "Tidak dapat memproses verifikasi saat ini. Coba lagi nanti." },
  }[state];

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-card">
        <div className="mb-4 flex justify-center">{ui.icon}</div>
        <h1 className="text-xl font-bold text-txt-primary">{ui.title}</h1>
        <p className="mt-2 text-sm text-txt-secondary">{ui.desc}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/panel/profil" className="btn-primary rounded-md px-5 py-2 text-sm font-semibold">Ke Profil</Link>
          <Link href="/" className="rounded-md border border-border px-5 py-2 text-sm font-semibold text-txt-secondary hover:bg-surface-secondary">Beranda</Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>}>
      <VerifyInner />
    </Suspense>
  );
}
