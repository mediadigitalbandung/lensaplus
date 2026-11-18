"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Layers, AlertCircle, Loader2 } from "lucide-react";
import type { Role } from "@prisma/client";
import { canManageTiktok } from "@/lib/tiktok/specs";

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
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const userRole = session?.user?.role as Role | undefined;
  const isAuthorized = Boolean(userRole && canManageTiktok(userRole));

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (sessionStatus !== "loading" && !isAuthorized) {
      router.replace("/panel/dashboard");
    }
  }, [sessionStatus, isAuthorized, router]);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tiktok/templates");
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || `Gagal memuat template (HTTP ${res.status})`);
      }
      setTemplates(json.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat template");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === "authenticated" && isAuthorized) {
      fetchTemplates();
    }
  }, [sessionStatus, isAuthorized, fetchTemplates]);

  if (sessionStatus === "loading" || !isAuthorized) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

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
        <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">
          Template TikTok
        </h1>
        <p className="text-sm text-txt-secondary">
          Template Hyperframes yang akan dipakai saat render otomatis aktif.
        </p>
      </div>

      <div className="mb-5 flex items-start gap-3 rounded-lg border border-yellow-400 border-l-4 border-l-yellow-500 bg-surface p-4">
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

      {error && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-red-300 border-l-4 border-l-red-600 bg-surface p-4 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={fetchTemplates} className="btn-ghost text-xs font-semibold text-primary">
            Coba Lagi
          </button>
        </div>
      )}

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
