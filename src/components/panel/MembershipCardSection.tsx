"use client";

/**
 * Membership card (KTA) section for the user's own profile page.
 * Shows status, a completeness warning (which required fields are missing),
 * a live preview image, and download buttons (PNG + PDF).
 */

import { useState, useEffect, useCallback } from "react";
import { CreditCard, AlertTriangle, Loader2, Download, FileText, RefreshCw, CheckCircle2 } from "lucide-react";

interface CardData {
  number: string;
  status: string;
  statusLabel: string;
  issuedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
}
interface CardResponse {
  card: CardData | null;
  completeness: { complete: boolean; missing: { key: string; label: string }[] };
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-green-50 text-green-700 ring-green-600/20",
  PENDING: "bg-yellow-50 text-yellow-700 ring-yellow-600/20",
  DRAFT: "bg-surface-tertiary text-txt-secondary ring-border",
  SUSPENDED: "bg-red-50 text-red-700 ring-red-600/20",
  REVOKED: "bg-red-50 text-red-700 ring-red-600/20",
  EXPIRED: "bg-red-50 text-red-700 ring-red-600/20",
};

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-";
}

export default function MembershipCardSection() {
  const [data, setData] = useState<CardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [downloading, setDownloading] = useState<"png" | "pdf" | null>(null);

  const fetchCard = useCallback(async () => {
    try {
      const res = await fetch("/api/users/me/card");
      if (res.ok) setData((await res.json()).data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPreview = useCallback(async () => {
    setImgLoading(true);
    try {
      const res = await fetch("/api/users/me/card/render");
      if (res.ok) {
        const blob = await res.blob();
        setImgUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      }
    } catch {
      /* ignore */
    } finally {
      setImgLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCard();
  }, [fetchCard]);

  useEffect(() => {
    if (data) loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    return () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl);
    };
  }, [imgUrl]);

  async function download(kind: "png" | "pdf") {
    setDownloading(kind);
    try {
      const res = await fetch(`/api/users/me/card/render${kind === "pdf" ? "?pdf=1" : ""}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `KTA-${data?.card?.number || "kartawarta"}.${kind}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  if (loading) {
    return (
      <div className="mt-6 rounded-[12px] border border-border bg-surface p-6 shadow-card">
        <Loader2 className="mx-auto animate-spin text-primary" size={22} />
      </div>
    );
  }

  const card = data?.card;
  const missing = data?.completeness.missing || [];
  const complete = data?.completeness.complete ?? false;
  const status = card?.status || "DRAFT";

  return (
    <div className="mt-6 rounded-[12px] border border-border bg-surface p-6 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CreditCard size={20} className="text-primary" />
          <h3 className="text-lg font-semibold text-txt-primary">Kartu Tanda Anggota (KTA) Pers</h3>
        </div>
        {card && (
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLE[status] || STATUS_STYLE.DRAFT}`}>
            {card.statusLabel}
          </span>
        )}
      </div>

      {/* Completeness warning */}
      {!complete && (
        <div className="mb-4 flex items-start gap-3 rounded-[12px] border border-yellow-300 bg-yellow-50/70 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-yellow-600" />
          <div className="text-sm text-yellow-800">
            <p className="font-semibold">Lengkapi data berikut agar kartu bisa diterbitkan:</p>
            <ul className="mt-1 list-inside list-disc">
              {missing.map((m) => (
                <li key={m.key}>{m.label}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-yellow-700">
              Setelah lengkap, kartu Anda akan diverifikasi & diterbitkan oleh admin.
            </p>
          </div>
        </div>
      )}
      {complete && status === "DRAFT" && (
        <div className="mb-4 flex items-center gap-2 rounded-[12px] border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
          <CheckCircle2 size={16} /> Data lengkap. Menunggu verifikasi & penerbitan oleh admin.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Card preview */}
        <div className="md:col-span-2">
          <div className="overflow-hidden rounded-xl border border-border bg-surface-secondary">
            {imgLoading && !imgUrl ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={22} />
              </div>
            ) : imgUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgUrl} alt="Pratinjau KTA" className="w-full" />
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-txt-muted">Pratinjau tidak tersedia</div>
            )}
          </div>
          <button
            onClick={loadPreview}
            className="btn-ghost mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
          >
            <RefreshCw size={12} /> Segarkan pratinjau
          </button>
        </div>

        {/* Meta + downloads */}
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-txt-muted">Nomor Anggota</p>
            <p className="font-mono font-semibold text-txt-primary">{card?.number || "-"}</p>
          </div>
          <div>
            <p className="text-txt-muted">Masa Berlaku</p>
            <p className="font-medium text-txt-primary">
              {card?.issuedAt ? `${fmt(card.issuedAt)} — ${fmt(card.expiresAt)}` : "Belum diterbitkan"}
            </p>
          </div>
          {card?.notes && (
            <div>
              <p className="text-txt-muted">Catatan Admin</p>
              <p className="text-txt-secondary">{card.notes}</p>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <button
              onClick={() => download("png")}
              disabled={downloading !== null}
              className="btn-primary flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {downloading === "png" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Unduh PNG
            </button>
            <button
              onClick={() => download("pdf")}
              disabled={downloading !== null}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-semibold text-txt-secondary hover:bg-surface-secondary disabled:opacity-50"
            >
              {downloading === "pdf" ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              Unduh PDF
            </button>
            {status !== "ACTIVE" && (
              <p className="text-[11px] text-txt-muted">
                Kartu yang diunduh menampilkan status saat ini. Status <strong>Aktif</strong> muncul setelah diterbitkan admin.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
