"use client";

/**
 * Admin modal to manage a user's press membership card (KTA):
 * view status + completeness, then issue / renew / suspend / reactivate / revoke.
 * SUPER_ADMIN only (the API enforces it too).
 */

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { CreditCard, Loader2, X, CheckCircle, Ban, RotateCcw, ShieldCheck, AlertTriangle } from "lucide-react";

interface CardInfo {
  number: string;
  status: string;
  statusLabel: string;
  issuedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  completeness: { complete: boolean; missing: { key: string; label: string }[] };
}

type Action = "issue" | "renew" | "suspend" | "reactivate" | "revoke";

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-green-50 text-green-700",
  PENDING: "bg-yellow-50 text-yellow-700",
  DRAFT: "bg-surface-tertiary text-txt-secondary",
  SUSPENDED: "bg-red-50 text-red-700",
  REVOKED: "bg-red-50 text-red-700",
  EXPIRED: "bg-red-50 text-red-700",
};

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-";
}

export default function UserCardManager({
  userId,
  userName,
  onClose,
}: {
  userId: string;
  userName: string;
  onClose: () => void;
}) {
  const { success, error: showError } = useToast();
  const { confirm } = useConfirm();
  const [card, setCard] = useState<CardInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Action | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${userId}/card`);
      const json = await res.json();
      if (json.success) setCard(json.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: Action, opts?: { danger?: boolean; needNote?: boolean; label: string }) {
    const ok = await confirm({
      title: `${opts?.label} KTA`,
      message: `Yakin ingin ${opts?.label.toLowerCase()} kartu anggota milik ${userName}?`,
      variant: opts?.danger ? "danger" : "default",
    });
    if (!ok) return;
    let notes: string | undefined;
    if (opts?.needNote) {
      notes = window.prompt(`Alasan ${opts.label.toLowerCase()} (opsional):`) || undefined;
    }
    setBusy(action);
    try {
      const res = await fetch(`/api/users/${userId}/card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal");
      success(`KTA berhasil di-${opts?.label.toLowerCase()}.`);
      await load();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal memproses KTA");
    } finally {
      setBusy(null);
    }
  }

  const status = card?.status;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard size={20} className="text-primary" />
            <h2 className="text-lg font-bold text-txt-primary">Kartu Anggota — {userName}</h2>
          </div>
          <button onClick={onClose} className="text-txt-muted hover:text-txt-primary" aria-label="Tutup">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto animate-spin text-primary" size={22} />
          </div>
        ) : !card ? (
          <p className="py-6 text-center text-sm text-txt-secondary">Kartu tidak ditemukan.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-txt-primary">{card.number}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[status || "DRAFT"]}`}>
                {card.statusLabel}
              </span>
            </div>

            <div className="space-y-1 text-sm text-txt-secondary">
              <div className="flex justify-between">
                <span className="text-txt-muted">Berlaku</span>
                <span>{card.issuedAt ? `${fmt(card.issuedAt)} — ${fmt(card.expiresAt)}` : "Belum diterbitkan"}</span>
              </div>
              {card.notes && (
                <div className="flex justify-between gap-3">
                  <span className="text-txt-muted">Catatan</span>
                  <span className="text-right">{card.notes}</span>
                </div>
              )}
            </div>

            {!card.completeness.complete && (
              <div className="flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50/70 p-3 text-xs text-yellow-800">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  Data belum lengkap: {card.completeness.missing.map((m) => m.label).join(", ")}. Kartu tidak bisa
                  diterbitkan sampai anggota melengkapinya.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              {(status === "DRAFT" || status === "PENDING") && (
                <button
                  onClick={() => run("issue", { label: "Terbitkan" })}
                  disabled={!card.completeness.complete || busy !== null}
                  className="btn-primary col-span-2 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {busy === "issue" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Terbitkan Kartu (Aktif 5 tahun)
                </button>
              )}
              {status === "ACTIVE" && (
                <>
                  <button
                    onClick={() => run("suspend", { label: "Tangguhkan", danger: true, needNote: true })}
                    disabled={busy !== null}
                    className="flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-yellow-700 hover:bg-yellow-50 disabled:opacity-50"
                  >
                    {busy === "suspend" ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
                    Tangguhkan
                  </button>
                  <button
                    onClick={() => run("revoke", { label: "Cabut", danger: true, needNote: true })}
                    disabled={busy !== null}
                    className="flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {busy === "revoke" ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                    Cabut
                  </button>
                  <button
                    onClick={() => run("renew", { label: "Perpanjang" })}
                    disabled={busy !== null}
                    className="col-span-2 flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
                  >
                    {busy === "renew" ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                    Perpanjang 5 tahun
                  </button>
                </>
              )}
              {(status === "SUSPENDED" || status === "REVOKED" || status === "EXPIRED") && (
                <button
                  onClick={() => run("reactivate", { label: "Aktifkan kembali" })}
                  disabled={!card.completeness.complete || busy !== null}
                  className="btn-primary col-span-2 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {busy === "reactivate" ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  Aktifkan Kembali
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
