"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Layers, AlertCircle } from "lucide-react";

interface Template {
  id: string;
  key: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  aspectRatio: string;
  minSlots: number;
  maxSlots: number;
  acceptedKinds: string;
}

export default function TiktokTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tiktok/templates")
      .then((r) => r.json())
      .then((j) => setTemplates(j.data || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Link
        href="/panel/tiktok"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-txt-secondary hover:text-primary"
      >
        <ArrowLeft size={14} />
        Kembali
      </Link>

      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl sm:text-3xl font-bold text-txt-primary">
          <Layers size={24} className="text-primary" />
          Template TikTok
        </h1>
        <p className="text-sm text-txt-secondary">
          Template Hyperframes yang akan dipakai saat render otomatis aktif.
        </p>
      </div>

      <div className="mb-5 flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-yellow-700" />
        <div className="text-sm text-yellow-800">
          <p className="font-semibold">Template hanya aktif di Fase 2</p>
          <p className="mt-0.5 text-yellow-700">
            Daftar di sini disinkron dengan file HTML Hyperframes di server. Template baru harus
            ditambahkan oleh SUPER_ADMIN melalui POST /api/tiktok/templates dengan path file HTML
            yang valid. Lihat <Link href="/panel/dokumentasi" className="underline">dokumentasi</Link>{" "}
            untuk panduan format template.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-surface p-10 text-center text-sm text-txt-secondary">
          Memuat...
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-txt-secondary">
          Belum ada template terdaftar.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="overflow-hidden rounded-lg border border-border bg-surface shadow-card"
            >
              {t.thumbnailUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={t.thumbnailUrl} alt={t.name} className="aspect-[9/16] w-full object-cover" />
              ) : (
                <div className="flex aspect-[9/16] items-center justify-center bg-surface-secondary">
                  <Layers size={32} className="text-border" />
                </div>
              )}
              <div className="p-3">
                <p className="text-sm font-bold text-txt-primary">{t.name}</p>
                <p className="mt-0.5 text-[11px] text-txt-muted">
                  {t.minSlots}-{t.maxSlots} slot · {t.aspectRatio} · {t.acceptedKinds}
                </p>
                {t.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-txt-secondary">{t.description}</p>
                )}
                <p className="mt-2 font-mono text-[10px] text-primary">{t.key}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
