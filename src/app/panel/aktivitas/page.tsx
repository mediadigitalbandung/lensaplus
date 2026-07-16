"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ChevronLeft, ChevronRight, Filter, Download } from "lucide-react";
import { exportToCsv } from "@/lib/csv-utils";

/* ── Types ─────────────────────────────────────────────────────────── */

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  detail: string | null;
  createdAt: string;
  // `user` bisa NULL — schema AuditLog.user optional dengan onDelete: SetNull,
  // jadi cron job (CRON_PUBLISH, CRON_SOROTAN, dsb) yang ga jalan atas nama
  // user dapat user=null, plus user yang sudah dihapus juga jadi null.
  // Render WAJIB defensive — sebelum-nya `log.user.name` throw "Cannot read
  // properties of null (reading 'name')" di /panel/aktivitas.
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const actionLabels: Record<string, { label: string; color: string }> = {
  CREATE: { label: "Buat", color: "bg-primary/10 text-primary" },
  UPDATE: { label: "Ubah", color: "bg-blue-50 text-blue-600" },
  DELETE: { label: "Hapus", color: "bg-red-50 text-red-600" },
  LOGIN: { label: "Masuk", color: "bg-surface-tertiary text-txt-secondary" },
  LOGOUT: { label: "Keluar", color: "bg-surface-tertiary text-txt-secondary" },
  PUBLISH: { label: "Terbit", color: "bg-primary/10 text-primary" },
  APPROVE: { label: "Setujui", color: "bg-primary/10 text-primary" },
  REJECT: { label: "Tolak", color: "bg-red-50 text-red-600" },
};

const entityLabels: Record<string, string> = {
  article: "Artikel",
  category: "Kategori",
  tag: "Tag",
  user: "Pengguna",
  ad: "Iklan",
  report: "Laporan",
};

const filterActions = ["", "CREATE", "UPDATE", "DELETE", "LOGIN", "PUBLISH", "APPROVE", "REJECT"];

/* ── Loading skeleton ──────────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      <div className="border-b border-border bg-surface-secondary px-5 py-3">
        <div className="h-4 w-full rounded-lg bg-surface-tertiary" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border px-5 py-3">
          <div className="h-4 w-32 rounded-lg bg-surface-tertiary" />
          <div className="h-4 w-24 rounded-lg bg-surface-tertiary" />
          <div className="h-4 w-16 rounded-lg bg-surface-tertiary" />
          <div className="flex-1">
            <div className="h-4 w-2/3 rounded-lg bg-surface-tertiary" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────────── */

export default function AktivitasPage() {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");

  const [exporting, setExporting] = useState(false);

  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      // Fetch all logs without pagination limit
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (actionFilter) params.set("action", actionFilter);

      // Fetch pages until we have all logs
      const allLogs: AuditLog[] = [];
      let currentPage = 1;
      let totalPages = 1;

      do {
        params.set("page", String(currentPage));
        const res = await fetch(`/api/audit-logs?${params.toString()}`);
        const json = await res.json();
        if (json.success) {
          allLogs.push(...json.data.logs);
          totalPages = json.data.pagination.totalPages;
        } else {
          break;
        }
        currentPage++;
      } while (currentPage <= totalPages);

      const headers = ["Tanggal", "User", "Email", "Aksi", "Entitas", "ID Entitas", "Detail"];
      const rows = allLogs.map((log) => [
        formatDateTime(log.createdAt),
        log.user?.name ?? "Sistem",
        log.user?.email ?? "",
        actionLabels[log.action]?.label || log.action,
        entityLabels[log.entity] || log.entity,
        log.entityId,
        log.detail || "",
      ]);

      exportToCsv("audit-logs-lensaplus.csv", headers, rows);
    } catch {
      console.error("Failed to export CSV");
    } finally {
      setExporting(false);
    }
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (actionFilter) params.set("action", actionFilter);
      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data.logs);
        setPagination(json.data.pagination);
      } else {
        setError(json.error || "Gagal memuat log aktivitas");
      }
    } catch {
      setError("Gagal terhubung ke server");
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    if (isSuperAdmin) fetchLogs();
  }, [fetchLogs, isSuperAdmin]);

  /* ── Guard ── */
  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-txt-secondary">Hanya Super Admin yang dapat mengakses halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">Log Aktivitas</h1>
          <p className="mt-1 text-base text-txt-secondary">
            Riwayat semua aktivitas di panel admin
            {pagination && <span className="ml-1">({pagination.total} total)</span>}
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          disabled={exporting || loading}
          className="btn-secondary flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold whitespace-nowrap disabled:opacity-50"
          title="Export CSV"
          aria-label="Export log aktivitas ke CSV"
        >
          <Download size={14} />
          {exporting ? "Mengexport..." : "Export CSV"}
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter size={16} className="text-txt-secondary" />
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-border bg-surface-secondary px-4 py-2.5 text-base text-txt-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Semua Aksi</option>
          {filterActions.filter(Boolean).map((a) => (
            <option key={a} value={a}>
              {actionLabels[a]?.label || a}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-4 sm:p-8 text-center text-txt-secondary">
          Tidak ada log aktivitas ditemukan.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-secondary text-left">
                  <th className="px-5 py-3.5 text-sm font-medium text-txt-secondary">Waktu</th>
                  <th className="px-5 py-3.5 text-sm font-medium text-txt-secondary">Pengguna</th>
                  <th className="px-5 py-3.5 text-sm font-medium text-txt-secondary">Aksi</th>
                  <th className="px-5 py-3.5 text-sm font-medium text-txt-secondary">Entitas</th>
                  <th className="hidden px-5 py-3.5 text-sm font-medium text-txt-secondary md:table-cell">Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const actionInfo = actionLabels[log.action] || {
                    label: log.action,
                    color: "bg-surface-tertiary text-txt-secondary",
                  };
                  return (
                    <tr key={log.id} className="border-b border-border last:border-0 hover:bg-surface-secondary/50 transition-colors">
                      <td className="px-5 py-4 text-sm text-txt-secondary">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        {log.user ? (
                          <>
                            <div className="text-sm font-medium text-txt-primary">{log.user.name}</div>
                            <div className="text-sm text-txt-secondary">{log.user.email}</div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-medium text-txt-muted italic">Sistem</div>
                            <div className="text-sm text-txt-muted/70">cron / automation</div>
                          </>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-sm font-medium ${actionInfo.color}`}>
                          {actionInfo.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-txt-primary">
                        {entityLabels[log.entity] || log.entity}
                      </td>
                      <td className="hidden max-w-xs truncate px-5 py-4 text-sm text-txt-secondary md:table-cell">
                        {log.detail || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-base text-txt-secondary">
            Halaman {pagination.page} dari {pagination.totalPages}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-lg border border-border px-5 py-2.5 text-base font-medium text-txt-secondary hover:bg-surface-secondary transition-colors disabled:opacity-50"
            >
              <ChevronLeft size={16} />
              Sebelumnya
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="flex items-center gap-1 rounded-lg border border-border px-5 py-2.5 text-base font-medium text-txt-secondary hover:bg-surface-secondary transition-colors disabled:opacity-50"
            >
              Selanjutnya
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
