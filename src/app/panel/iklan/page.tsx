"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { canManageAds } from "@/lib/auth";
import { Role } from "@prisma/client";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import Link from "next/link";
import {
  Plus,
  Eye,
  MousePointer,
  BarChart3,
  Edit,
  Trash2,
  Power,
  Calendar,
} from "lucide-react";

interface Ad {
  id: string;
  name: string;
  type: string;
  slot: string;
  imageUrl?: string | null;
  htmlCode?: string | null;
  targetUrl?: string | null;
  isActive: boolean;
  startDate: string;
  endDate: string;
  impressions: number;
  clicks: number;
  priority: number;
}

const slotLabels: Record<string, string> = {
  HEADER: "Header Banner",
  SIDEBAR: "Sidebar",
  IN_ARTICLE: "Dalam Artikel",
  FOOTER: "Footer",
  BETWEEN_SECTIONS: "Antar Seksi",
  POPUP: "Pop-up",
  FLOATING_BOTTOM: "Floating Bottom",
};

const typeLabels: Record<string, string> = {
  IMAGE: "Gambar",
  GIF: "GIF Animasi",
  HTML: "Kode HTML",
};

// Display order for the slot-availability grid (matches the public rate card).
const SLOT_ORDER = [
  "HEADER",
  "BETWEEN_SECTIONS",
  "SIDEBAR",
  "IN_ARTICLE",
  "FLOATING_BOTTOM",
  "FOOTER",
  "POPUP",
];

type ServeStatus = "Tayang" | "Terjadwal" | "Berakhir" | "Nonaktif";

// Effective serving status from the isActive flag AND the date window — an ad
// can be isActive=true yet not actually serving (scheduled in the future or
// past its endDate). Sales needs the real state, not just the toggle.
function servingStatus(ad: Ad, now: number): ServeStatus {
  if (!ad.isActive) return "Nonaktif";
  const start = new Date(ad.startDate).getTime();
  const end = new Date(ad.endDate).getTime();
  if (now < start) return "Terjadwal";
  if (now > end) return "Berakhir";
  return "Tayang";
}

const STATUS_STYLE: Record<ServeStatus, string> = {
  Tayang: "bg-primary-light text-primary",
  Terjadwal: "bg-amber-50 text-amber-700",
  Berakhir: "bg-surface-tertiary text-txt-muted",
  Nonaktif: "bg-red-50 text-red-600",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4 shadow-card">
            <div className="h-4 w-24 rounded-lg bg-surface-tertiary" />
            <div className="mt-2 h-7 w-16 rounded-lg bg-surface-tertiary" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        <div className="border-b border-border bg-surface-secondary px-5 py-3"><div className="h-4 w-full rounded-lg bg-surface-tertiary" /></div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-5 py-3">
            <div className="h-4 w-1/4 rounded-lg bg-surface-tertiary" />
            <div className="h-4 w-20 rounded-lg bg-surface-tertiary" />
            <div className="h-4 w-32 rounded-lg bg-surface-tertiary" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function IklanPage() {
  const { data: session, status } = useSession();
  const { success, error: showError } = useToast();
  const { confirm } = useConfirm();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const fetchAds = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/ads?all=true");
      if (!res.ok) throw new Error("Gagal memuat iklan");
      const json = await res.json();
      setAds(json.data || []);
    } catch {
      setError("Gagal memuat daftar iklan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  async function handleDelete(id: string) {
    const ok = await confirm({ message: "Apakah Anda yakin ingin menghapus iklan ini?", variant: "danger", title: "Konfirmasi" });
    if (!ok) return;
    try {
      setDeleting(id);
      const res = await fetch(`/api/ads/${id}`, { method: "DELETE" });
      if (!res.ok) { const json = await res.json(); throw new Error(json.error || "Gagal menghapus iklan"); }
      success("Iklan berhasil dihapus"); fetchAds();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menghapus iklan.");
    } finally {
      setDeleting(null);
    }
  }

  // Role guard — must be after all hooks to satisfy rules-of-hooks
  if (status === "loading") return <LoadingSkeleton />;
  if (!session || !canManageAds(session.user.role as Role)) {
    redirect("/panel/dashboard");
  }

  const totalPages = Math.ceil(ads.length / ITEMS_PER_PAGE);
  const paginatedAds = ads.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const totalImpressions = ads.reduce((sum, ad) => sum + ad.impressions, 0);
  const totalClicks = ads.reduce((sum, ad) => sum + ad.clicks, 0);
  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";

  // How many ads are actually SERVING right now in each slot — so a salesperson
  // can tell at a glance which positions are free to sell.
  const now = Date.now();
  const servingBySlot: Record<string, number> = {};
  for (const ad of ads) {
    if (servingStatus(ad, now) === "Tayang") {
      servingBySlot[ad.slot] = (servingBySlot[ad.slot] || 0) + 1;
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">Kelola Iklan</h1>
          <p className="text-base text-txt-secondary">Atur banner iklan di berbagai posisi</p>
        </div>
        <Link href="/panel/iklan/baru" className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-semibold">
          <Plus size={16} /> Tambah Iklan
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-center text-base text-red-700">
          <p>{error}</p>
          <button onClick={fetchAds} className="mt-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Coba Lagi</button>
        </div>
      )}

      {loading ? <LoadingSkeleton /> : (
        <>
          {/* Slot availability — which positions are free to sell right now */}
          <div className="mb-6">
            <h2 className="mb-2 text-sm font-semibold text-txt-secondary">Ketersediaan Slot</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
              {SLOT_ORDER.map((slot) => {
                const count = servingBySlot[slot] || 0;
                const free = count === 0;
                return (
                  <Link
                    key={slot}
                    href={`/panel/iklan/baru?slot=${slot}`}
                    className="rounded-lg border border-border bg-surface p-3 shadow-card transition-colors hover:border-primary/40"
                    title={free ? "Slot kosong — klik untuk isi" : `${count} iklan tayang`}
                  >
                    <p className="truncate text-xs font-medium text-txt-primary">{slotLabels[slot] || slot}</p>
                    <span
                      className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        free ? "bg-green-50 text-green-700" : "bg-primary-light text-primary"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${free ? "bg-green-500" : "bg-primary"}`} />
                      {free ? "Kosong" : `${count} tayang`}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
              <div className="flex items-center gap-2 text-sm text-txt-secondary"><Eye size={16} className="text-blue-500" /> Total Tayangan</div>
              <p className="mt-1 text-lg sm:text-2xl font-bold text-txt-primary">{totalImpressions.toLocaleString("id-ID")}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
              <div className="flex items-center gap-2 text-sm text-txt-secondary"><MousePointer size={16} className="text-primary" /> Total Klik</div>
              <p className="mt-1 text-lg sm:text-2xl font-bold text-txt-primary">{totalClicks.toLocaleString("id-ID")}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
              <div className="flex items-center gap-2 text-sm text-txt-secondary"><BarChart3 size={16} className="text-purple-500" /> Rata-rata CTR</div>
              <p className="mt-1 text-lg sm:text-2xl font-bold text-txt-primary">{avgCtr}%</p>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-border bg-surface-secondary">
                  <tr>
                    <th className="px-3 sm:px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Nama Iklan</th>
                    <th className="px-3 sm:px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Posisi</th>
                    <th className="px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Periode</th>
                    <th className="px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Tayangan</th>
                    <th className="px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Klik</th>
                    <th className="px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">CTR</th>
                    <th className="px-3 sm:px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Status</th>
                    <th className="px-3 sm:px-5 py-3.5 text-right text-sm font-medium text-txt-secondary">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedAds.map((ad) => {
                    const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) + "%" : "0.00%";
                    const serve = servingStatus(ad, now);
                    return (
                      <tr key={ad.id} className="hover:bg-surface-secondary">
                        <td className="px-3 sm:px-5 py-4">
                          <p className="font-medium text-txt-primary text-sm">{ad.name}</p>
                          <p className="text-xs text-txt-muted">{typeLabels[ad.type] || ad.type}</p>
                        </td>
                        <td className="px-3 sm:px-5 py-4">
                          <span className="rounded-lg bg-surface-tertiary px-3 py-0.5 text-sm font-medium text-txt-secondary">{slotLabels[ad.slot] || ad.slot}</span>
                        </td>
                        <td className="px-5 py-4 text-txt-secondary">
                          <div className="flex items-center gap-1 text-sm"><Calendar size={12} /> {formatDate(ad.startDate)} — {formatDate(ad.endDate)}</div>
                        </td>
                        <td className="px-5 py-4 text-sm text-txt-secondary">{ad.impressions.toLocaleString("id-ID")}</td>
                        <td className="px-5 py-4 text-sm text-txt-secondary">{ad.clicks.toLocaleString("id-ID")}</td>
                        <td className="px-5 py-4 text-sm font-bold text-txt-primary">{ctr}</td>
                        <td className="px-3 sm:px-5 py-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-sm font-medium ${STATUS_STYLE[serve]}`}>
                            <Power size={10} /> {serve}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/panel/iklan/${ad.id}/edit`} className="btn-ghost rounded-lg p-2" title="Edit"><Edit size={16} /></Link>
                            <button onClick={() => handleDelete(ad.id)} disabled={deleting === ad.id} className="btn-ghost rounded-lg p-2 hover:text-red-500 disabled:opacity-50" title="Hapus"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {paginatedAds.length === 0 && <div className="py-12 text-center text-base text-txt-secondary">Belum ada iklan.</div>}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-base text-txt-secondary">Halaman {page} dari {totalPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary px-5 py-2.5 text-base disabled:opacity-40">Sebelumnya</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary px-5 py-2.5 text-base disabled:opacity-40">Selanjutnya</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
