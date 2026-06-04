"use client";

/**
 * Membership card section for the user's own profile page.
 * Offers TWO formats via a toggle: the landscape KTA card and the portrait
 * lanyard. For each, shows status, a completeness warning, a live preview of
 * BOTH sides (front + back), and download buttons (PNG front, PNG back, PDF).
 */

import { useState, useEffect, useCallback } from "react";
import { CreditCard, AlertTriangle, Loader2, Download, FileText, RefreshCw, CheckCircle2, Tag } from "lucide-react";

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

type Side = "front" | "back";
type DL = "png-front" | "png-back" | "pdf";
type Variant = "kta" | "lanyard";

export default function MembershipCardSection() {
  const [data, setData] = useState<CardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [variant, setVariant] = useState<Variant>("kta");
  const [imgFront, setImgFront] = useState<string | null>(null);
  const [imgBack, setImgBack] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [downloading, setDownloading] = useState<DL | null>(null);

  // Build a render URL for the active variant (KTA or lanyard).
  const renderUrl = useCallback(
    (opts: { side?: Side; pdf?: boolean } = {}) => {
      const p = new URLSearchParams();
      if (variant === "lanyard") p.set("type", "lanyard");
      if (opts.side === "back") p.set("side", "back");
      if (opts.pdf) p.set("pdf", "1");
      const qs = p.toString();
      return `/api/users/me/card/render${qs ? `?${qs}` : ""}`;
    },
    [variant],
  );

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
      const [frontRes, backRes] = await Promise.all([
        fetch(renderUrl()),
        fetch(renderUrl({ side: "back" })),
      ]);
      if (frontRes.ok) {
        const blob = await frontRes.blob();
        setImgFront((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      }
      if (backRes.ok) {
        const blob = await backRes.blob();
        setImgBack((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      }
    } catch {
      /* ignore */
    } finally {
      setImgLoading(false);
    }
  }, [renderUrl]);

  useEffect(() => {
    fetchCard();
  }, [fetchCard]);

  // (Re)load the preview whenever the card loads OR the variant switches.
  useEffect(() => {
    if (data) loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, variant]);

  useEffect(() => {
    return () => {
      if (imgFront) URL.revokeObjectURL(imgFront);
      if (imgBack) URL.revokeObjectURL(imgBack);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgFront, imgBack]);

  async function download(kind: DL) {
    setDownloading(kind);
    try {
      const path =
        kind === "pdf" ? renderUrl({ pdf: true }) : kind === "png-back" ? renderUrl({ side: "back" }) : renderUrl();
      const res = await fetch(path);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const num = data?.card?.number || "kartawarta";
      const label = variant === "lanyard" ? "Lanyard" : "KTA";
      a.href = url;
      a.download =
        kind === "pdf"
          ? `${label}-${num}.pdf`
          : kind === "png-back"
          ? `${label}-${num}-belakang.png`
          : `${label}-${num}-depan.png`;
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
      <div className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-card">
        <Loader2 className="mx-auto animate-spin text-primary" size={22} />
      </div>
    );
  }

  const card = data?.card;
  const missing = data?.completeness.missing || [];
  const complete = data?.completeness.complete ?? false;
  const status = card?.status || "DRAFT";
  const isLanyard = variant === "lanyard";
  const aspect = isLanyard ? "aspect-[648/1024]" : "aspect-[1012/638]";

  const sides: { key: Side; label: string; img: string | null }[] = [
    { key: "front", label: "Depan", img: imgFront },
    { key: "back", label: "Belakang", img: imgBack },
  ];

  function switchVariant(v: Variant) {
    if (v === variant) return;
    // Clear previews so the placeholder (correct aspect) shows while reloading.
    setImgFront((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setImgBack((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setVariant(v);
  }

  return (
    <div className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CreditCard size={20} className="text-primary" />
          <h3 className="text-lg font-semibold text-txt-primary">Kartu Anggota & Lanyard Pers</h3>
        </div>
        {card && (
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLE[status] || STATUS_STYLE.DRAFT}`}>
            {card.statusLabel}
          </span>
        )}
      </div>

      {/* Format toggle: KTA card vs lanyard */}
      <div className="mb-4 inline-flex rounded-lg border border-border bg-surface-secondary p-1">
        <button
          onClick={() => switchVariant("kta")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
            !isLanyard ? "bg-primary text-on-primary shadow-sm" : "text-txt-secondary hover:text-txt-primary"
          }`}
        >
          <CreditCard size={14} /> KTA (Kartu)
        </button>
        <button
          onClick={() => switchVariant("lanyard")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
            isLanyard ? "bg-primary text-on-primary shadow-sm" : "text-txt-secondary hover:text-txt-primary"
          }`}
        >
          <Tag size={14} /> Lanyard
        </button>
      </div>

      {/* Completeness warning */}
      {!complete && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50/70 p-4">
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
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
          <CheckCircle2 size={16} /> Data lengkap. Menunggu verifikasi & penerbitan oleh admin.
        </div>
      )}

      {/* Both sides preview */}
      <div className={`grid grid-cols-1 gap-4 ${isLanyard ? "sm:grid-cols-2 lg:max-w-md" : "lg:grid-cols-2"}`}>
        {sides.map((s) => (
          <div key={s.key}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-txt-muted">{s.label}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="overflow-hidden rounded-lg border border-border bg-surface-secondary">
              {imgLoading && !s.img ? (
                <div className={`flex ${aspect} items-center justify-center`}>
                  <Loader2 className="animate-spin text-primary" size={22} />
                </div>
              ) : s.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.img} alt={`Pratinjau ${isLanyard ? "lanyard" : "KTA"} ${s.label}`} className="w-full" />
              ) : (
                <div className={`flex ${aspect} items-center justify-center text-sm text-txt-muted`}>
                  Pratinjau tidak tersedia
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={loadPreview}
        className="btn-ghost mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
      >
        <RefreshCw size={12} /> Segarkan pratinjau
      </button>

      {/* Meta + downloads */}
      <div className="mt-5 grid grid-cols-1 gap-5 border-t border-border pt-5 sm:grid-cols-2">
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
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => download("png-front")}
              disabled={downloading !== null}
              className="flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold text-txt-secondary hover:bg-surface-secondary disabled:opacity-50"
            >
              {downloading === "png-front" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              PNG Depan
            </button>
            <button
              onClick={() => download("png-back")}
              disabled={downloading !== null}
              className="flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold text-txt-secondary hover:bg-surface-secondary disabled:opacity-50"
            >
              {downloading === "png-back" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              PNG Belakang
            </button>
          </div>
          <button
            onClick={() => download("pdf")}
            disabled={downloading !== null}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {downloading === "pdf" ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            Unduh PDF {isLanyard ? "Lanyard" : "KTA"} (Depan &amp; Belakang)
          </button>
          {status !== "ACTIVE" && (
            <p className="text-[11px] text-txt-muted">
              Kartu yang diunduh menampilkan status saat ini. Status <strong>Aktif</strong> muncul setelah diterbitkan admin.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
