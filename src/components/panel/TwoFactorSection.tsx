"use client";

/**
 * Two-factor authentication (TOTP) management for the user's own profile.
 * Enable flow: setup (QR) → confirm code → show one-time backup codes.
 * Disable flow: password + current code (or backup code).
 */

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, ShieldOff, Loader2, KeyRound, Copy, Check } from "lucide-react";

type Step = "idle" | "enrolling" | "backup";

export default function TwoFactorSection() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // enrollment
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // disable
  const [showDisable, setShowDisable] = useState(false);
  const [pw, setPw] = useState("");
  const [disableCode, setDisableCode] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/users/me");
      if (res.ok) setEnabled(!!(await res.json()).data?.twoFactorEnabled);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function startSetup() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/users/me/2fa/setup", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Gagal memulai 2FA");
      setQr(json.data.qr);
      setSecret(json.data.secret);
      setStep("enrolling");
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Gagal memulai 2FA" });
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/users/me/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Gagal mengaktifkan 2FA");
      setBackupCodes(json.data.backupCodes || []);
      setEnabled(true);
      setStep("backup");
      setCode("");
      setQr(null);
      setSecret(null);
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Gagal mengaktifkan 2FA" });
    } finally {
      setBusy(false);
    }
  }

  async function disable2fa() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/users/me/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, code: disableCode }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Gagal menonaktifkan 2FA");
      setEnabled(false);
      setShowDisable(false);
      setPw("");
      setDisableCode("");
      setMsg({ type: "ok", text: "2FA telah dinonaktifkan." });
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Gagal menonaktifkan 2FA" });
    } finally {
      setBusy(false);
    }
  }

  function copyBackup() {
    navigator.clipboard?.writeText(backupCodes.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-card">
        <Loader2 className="mx-auto animate-spin text-primary" size={22} />
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-card">
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck size={20} className="text-primary" />
        <h3 className="text-lg font-semibold text-txt-primary">Autentikasi Dua Faktor (2FA)</h3>
        <span
          className={`ml-auto inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
            enabled ? "bg-green-50 text-green-700 ring-green-600/20" : "bg-surface-tertiary text-txt-secondary ring-border"
          }`}
        >
          {enabled ? "Aktif" : "Nonaktif"}
        </span>
      </div>
      <p className="mb-4 text-sm text-txt-secondary">
        Tambahkan lapisan keamanan: selain password, login butuh kode 6 digit dari aplikasi autentikator
        (Google Authenticator, Authy, dll).
      </p>

      {msg && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            msg.type === "ok" ? "border-primary/30 bg-primary/5 text-primary" : "border-red-300 bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Backup codes shown once after enabling */}
      {step === "backup" && backupCodes.length > 0 && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50/70 p-4">
          <p className="text-sm font-semibold text-yellow-800">2FA aktif! Simpan kode cadangan ini sekarang.</p>
          <p className="mb-3 text-xs text-yellow-700">
            Setiap kode hanya bisa dipakai sekali untuk login jika Anda kehilangan akses ke autentikator. Kode ini tidak akan ditampilkan lagi.
          </p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm text-txt-primary sm:grid-cols-2">
            {backupCodes.map((c) => (
              <div key={c} className="rounded-md border border-border bg-surface px-3 py-1.5 text-center">{c}</div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={copyBackup} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-txt-secondary hover:bg-surface-secondary">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Tersalin" : "Salin semua"}
            </button>
            <button onClick={() => setStep("idle")} className="btn-primary rounded-md px-4 py-1.5 text-xs font-semibold">Selesai</button>
          </div>
        </div>
      )}

      {/* Enrollment: QR + confirm */}
      {step === "enrolling" && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-txt-secondary">1. Pindai QR ini di aplikasi autentikator</p>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR 2FA" className="rounded-lg border border-border" width={200} height={200} />
            )}
            {secret && (
              <p className="mt-2 break-all text-xs text-txt-muted">
                Atau masukkan manual: <span className="font-mono text-txt-secondary">{secret}</span>
              </p>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-txt-secondary">2. Masukkan kode 6 digit untuk konfirmasi</p>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="input w-full tracking-widest"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={confirmEnable}
                disabled={busy || code.length < 6}
                className="btn-primary inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Aktifkan
              </button>
              <button onClick={() => { setStep("idle"); setQr(null); setSecret(null); setCode(""); }} className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-txt-secondary hover:bg-surface-secondary">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Idle: enable or disable */}
      {step === "idle" && (
        <>
          {!enabled ? (
            <button
              onClick={startSetup}
              disabled={busy}
              className="btn-primary inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Aktifkan 2FA
            </button>
          ) : !showDisable ? (
            <button
              onClick={() => setShowDisable(true)}
              className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <ShieldOff size={16} /> Nonaktifkan 2FA
            </button>
          ) : (
            <div className="max-w-md space-y-3 rounded-lg border border-border bg-surface-secondary p-4">
              <p className="text-sm font-medium text-txt-primary">Konfirmasi untuk menonaktifkan</p>
              <div>
                <label className="mb-1 block text-xs font-medium text-txt-secondary">Password</label>
                <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" className="input w-full" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-txt-secondary">Kode 2FA / kode cadangan</label>
                <input type="text" value={disableCode} onChange={(e) => setDisableCode(e.target.value.slice(0, 12))} className="input w-full tracking-widest" />
              </div>
              <div className="flex gap-2">
                <button onClick={disable2fa} disabled={busy || !pw || disableCode.length < 6} className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldOff size={14} />} Nonaktifkan
                </button>
                <button onClick={() => { setShowDisable(false); setPw(""); setDisableCode(""); }} className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-txt-secondary hover:bg-surface">
                  Batal
                </button>
              </div>
            </div>
          )}
          {enabled && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-txt-muted">
              <KeyRound size={12} /> Kehilangan autentikator? Gunakan salah satu kode cadangan saat login.
            </p>
          )}
        </>
      )}
    </div>
  );
}
