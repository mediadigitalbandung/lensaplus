"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, CheckCircle, Clock, Eye, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

interface Report {
  id: string;
  reason: string;
  detail?: string;
  email?: string | null;
  status: string;
  createdAt: string;
  article?: {
    id: string;
    title: string;
    slug: string;
    author?: { name: string };
  };
}

const reasonLabels: Record<string, { label: string; color: string }> = {
  HOAX: { label: "Berita Palsu/Hoax", color: "bg-red-50 text-red-600" },
  MISLEADING: { label: "Menyesatkan", color: "bg-yellow-50 text-yellow-600" },
  INACCURATE: { label: "Tidak Akurat", color: "bg-yellow-50 text-yellow-600" },
  SARA: { label: "SARA", color: "bg-orange-50 text-orange-600" },
  PLAGIARISM: { label: "Plagiarisme", color: "bg-blue-50 text-blue-600" },
  DEFAMATION: { label: "Pencemaran Nama Baik", color: "bg-purple-50 text-purple-600" },
  OTHER: { label: "Lainnya", color: "bg-surface-tertiary text-txt-secondary" },
};

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  PENDING: { label: "Menunggu", icon: Clock, color: "text-yellow-600" },
  REVIEWED: { label: "Ditinjau", icon: Eye, color: "text-primary" },
  RESOLVED: { label: "Selesai", icon: CheckCircle, color: "text-primary" },
  DISMISSED: { label: "Ditolak", icon: XCircle, color: "text-txt-muted" },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4 shadow-card">
            <div className="h-4 w-24 rounded-lg bg-surface-tertiary" />
            <div className="mt-2 h-7 w-8 rounded-lg bg-surface-tertiary" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-5 w-16 rounded-full bg-surface-tertiary" />
              <div className="h-4 w-20 rounded-lg bg-surface-tertiary" />
              <div className="h-3 w-24 rounded-lg bg-surface-secondary" />
            </div>
            <div className="h-5 w-2/3 rounded-lg bg-surface-tertiary" />
            <div className="mt-2 h-4 w-full rounded-lg bg-surface-secondary" />
          </div>
        ))}
      </div>
    </div>
  );
}

const ITEMS_PER_PAGE = 20;

export default function LaporanPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pendingCount, setPendingCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const { success, error: showError } = useToast();
  const { confirm } = useConfirm();

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/reports?page=${page}&limit=${ITEMS_PER_PAGE}`);
      if (!res.ok) {
        throw new Error("Gagal memuat laporan");
      }

      const json = await res.json();
      const data = json.data;

      setReports(data.reports || []);
      setTotalPages(data.totalPages || 1);
      setPendingCount(data.pendingCount || 0);
    } catch {
      setError("Gagal memuat daftar laporan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  // Fetch status counts separately (all reports, no pagination) for stats display
  const fetchStatusCounts = useCallback(async () => {
    try {
      const counts: Record<string, number> = {};
      for (const status of ["PENDING", "REVIEWED", "RESOLVED", "DISMISSED"]) {
        const res = await fetch(`/api/reports?page=1&limit=1&status=${status}`);
        if (res.ok) {
          const json = await res.json();
          counts[status] = json.data?.total || 0;
        }
      }
      setStatusCounts(counts);
    } catch {
      // Non-critical, stats will just show 0
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    fetchStatusCounts();
  }, [fetchStatusCounts]);

  async function handleUpdateStatus(id: string, newStatus: string) {
    const statusLabel = statusConfig[newStatus]?.label || newStatus;
    const ok = await confirm({ message: `Apakah Anda yakin ingin mengubah status laporan menjadi "${statusLabel}"?`, variant: "warning", title: "Konfirmasi" });
    if (!ok) {
      return;
    }

    try {
      setUpdating(id);
      const res = await fetch(`/api/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Gagal mengubah status laporan");
      }

      success(`Status laporan berhasil diubah menjadi: ${statusConfig[newStatus]?.label || newStatus}`);
      fetchReports();
      fetchStatusCounts();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal mengubah status laporan.");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">
          Laporan Berita
        </h1>
        <p className="text-base text-txt-secondary">
          {loading ? "Memuat..." : `${pendingCount} laporan menunggu ditinjau`}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-center text-base text-red-700">
          <p>{error}</p>
          <button
            onClick={fetchReports}
            className="mt-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            aria-label="Coba muat ulang daftar laporan"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {Object.entries(statusConfig).map(([key, config]) => {
              const Icon = config.icon;
              const count = statusCounts[key] ?? reports.filter((r) => r.status === key).length;
              return (
                <div key={key} className="rounded-lg border border-border bg-surface p-4 shadow-card">
                  <div className={`flex items-center gap-2 text-sm ${config.color}`}>
                    <Icon size={16} /> {config.label}
                  </div>
                  <p className="mt-1 text-lg sm:text-2xl font-bold text-txt-primary">{count}</p>
                </div>
              );
            })}
          </div>

          {/* Reports list */}
          <div className="space-y-3">
            {reports.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface p-4 sm:p-8 text-center text-txt-secondary shadow-card">
                Belum ada laporan.
              </div>
            ) : (
              reports.map((report) => {
                const reason = reasonLabels[report.reason] || { label: report.reason, color: "bg-surface-tertiary text-txt-secondary" };
                const status = statusConfig[report.status] || statusConfig.PENDING;
                const StatusIcon = status.icon;
                return (
                  <div
                    key={report.id}
                    className="rounded-lg border border-border bg-surface p-5 shadow-card"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <span className={`badge ${reason.color}`}>
                            <AlertTriangle size={10} className="mr-1" />
                            {reason.label}
                          </span>
                          <span className={`flex items-center gap-1 text-sm ${status.color}`}>
                            <StatusIcon size={12} />
                            {status.label}
                          </span>
                          <span className="text-sm text-txt-muted">{formatDate(report.createdAt)}</span>
                        </div>
                        <h3 className="font-medium text-txt-primary">
                          {report.article?.title || "Artikel tidak ditemukan"}
                        </h3>
                        <p className="mt-1 text-sm text-txt-secondary">
                          {report.detail || "Tidak ada detail."}
                        </p>
                        {report.email && (
                          <p className="mt-1 text-sm text-txt-muted">
                            Pelapor: {report.email}
                          </p>
                        )}
                      </div>
                      {report.status === "PENDING" && (
                        <div className="ml-4 flex gap-2">
                          <button
                            onClick={() => handleUpdateStatus(report.id, "REVIEWED")}
                            disabled={updating === report.id}
                            className="rounded-lg bg-primary-light px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                            aria-label="Tinjau laporan"
                          >
                            {updating === report.id ? "..." : "Tinjau"}
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(report.id, "DISMISSED")}
                            disabled={updating === report.id}
                            className="rounded-lg bg-surface-tertiary px-4 py-2 text-sm font-medium text-txt-secondary hover:bg-border disabled:opacity-50"
                            aria-label="Tolak laporan"
                          >
                            {updating === report.id ? "..." : "Tolak"}
                          </button>
                        </div>
                      )}
                      {report.status === "REVIEWED" && (
                        <div className="ml-4 flex gap-2">
                          <button
                            onClick={() => handleUpdateStatus(report.id, "RESOLVED")}
                            disabled={updating === report.id}
                            className="rounded-lg bg-primary-light px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                            aria-label="Tandai laporan selesai"
                          >
                            {updating === report.id ? "..." : "Tandai Selesai"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
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
