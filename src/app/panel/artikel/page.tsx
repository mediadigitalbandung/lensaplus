"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  FileText,
  XCircle,
  UserCheck,
  Download,
  Archive,
} from "lucide-react";
import { exportToCsv } from "@/lib/csv-utils";

interface Article {
  id: string;
  title: string;
  slug: string;
  status: string;
  viewCount: number;
  verificationLabel: string;
  createdAt: string;
  publishedAt: string | null;
  reviewedBy?: string | null;
  reviewerName?: string | null;
  author?: { id: string; name: string; avatar?: string };
  category?: { id: string; name: string; slug: string };
}

import { CREATOR_ROLES, EDITOR_ROLES } from "@/lib/roles";

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  PUBLISHED: { label: "Dipublikasi", icon: CheckCircle, color: "bg-primary-light text-primary" },
  IN_REVIEW: { label: "Menunggu Review", icon: Clock, color: "bg-yellow-50 text-yellow-600" },
  DRAFT: { label: "Draf", icon: FileText, color: "bg-surface-tertiary text-txt-secondary" },
  APPROVED: { label: "Disetujui", icon: CheckCircle, color: "bg-blue-50 text-blue-600" },
  REJECTED: { label: "Ditolak", icon: XCircle, color: "bg-red-50 text-red-600" },
  ARCHIVED: { label: "Diarsipkan", icon: FileText, color: "bg-surface-tertiary text-txt-muted" },
};

// Progress steps for the timeline indicator
const progressSteps = ["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED"];
const stepLabels: Record<string, string> = {
  DRAFT: "Draf",
  IN_REVIEW: "Review",
  APPROVED: "Disetujui",
  PUBLISHED: "Publikasi",
};

function StatusTimeline({ status }: { status: string }) {
  const isRejected = status === "REJECTED";
  const isArchived = status === "ARCHIVED";
  const currentIndex = progressSteps.indexOf(status);

  return (
    <div className="flex items-center gap-0.5">
      {progressSteps.map((step, i) => {
        const isCompleted = !isRejected && !isArchived && currentIndex >= i;
        return (
          <div key={step} className="flex items-center">
            <div
              className={`flex items-center justify-center rounded-full text-xs font-bold transition-colors ${
                isRejected
                  ? "h-4 w-4 border border-red-500/40 bg-red-500/10 text-red-400"
                  : isCompleted
                    ? "h-4 w-4 bg-primary text-white"
                    : "h-4 w-4 border border-border bg-surface-tertiary text-txt-muted"
              }`}
              title={stepLabels[step]}
            >
              {isCompleted ? "\u2713" : i + 1}
            </div>
            {i < progressSteps.length - 1 && (
              <div
                className={`h-[2px] w-3 ${
                  isRejected
                    ? "bg-red-500/20"
                    : !isArchived && currentIndex > i
                      ? "bg-primary"
                      : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
      {isRejected && (
        <span className="ml-1 text-xs font-medium text-red-400">Ditolak</span>
      )}
      {isArchived && (
        <span className="ml-1 text-xs font-medium text-txt-muted">Arsip</span>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-[12px] border border-border bg-surface shadow-card">
      <div className="border-b border-border bg-surface-secondary px-5 py-3">
        <div className="h-4 w-full rounded bg-surface-tertiary" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border px-5 py-3">
          <div className="h-4 w-1/3 rounded bg-surface-tertiary" />
          <div className="h-4 w-1/6 rounded bg-surface-tertiary" />
          <div className="h-4 w-1/6 rounded bg-surface-tertiary" />
          <div className="h-4 w-16 rounded-full bg-surface-tertiary" />
          <div className="h-4 w-10 rounded bg-surface-tertiary" />
          <div className="h-4 w-20 rounded bg-surface-tertiary" />
        </div>
      ))}
    </div>
  );
}

export default function ArtikelPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { success, error: showError } = useToast();
  const { confirm } = useConfirm();
  const userRole = session?.user?.role || "";
  const userId = session?.user?.id || "";
  const isEditor = EDITOR_ROLES.includes(userRole);
  const isCreator = CREATOR_ROLES.includes(userRole);

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  // Editors default to IN_REVIEW, creators default to ALL
  const [filterStatus, setFilterStatus] = useState(isEditor ? "IN_REVIEW" : "ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Update default filter when session loads
  useEffect(() => {
    if (isEditor) {
      setFilterStatus("IN_REVIEW");
    }
  }, [isEditor]);

  const fetchArticles = useCallback(async () => {
    if (!session?.user) return;
    try {
      setLoading(true);
      setError(null);

      // Creators only see their own articles
      let url = `/api/articles?page=${page}&limit=20&status=${filterStatus}`;
      if (isCreator) {
        url += `&authorId=${userId}`;
      }

      const res = await fetch(url);

      if (!res.ok) {
        throw new Error("Gagal memuat artikel");
      }

      const json = await res.json();
      setArticles(json.data?.articles || []);
      setTotalPages(json.data?.pagination?.totalPages || 1);
    } catch (err) {
      setError("Gagal memuat daftar artikel. Silakan coba lagi.");
      console.error("Fetch articles error:", err);
    } finally {
      setLoading(false);
    }
  }, [session?.user, isCreator, userId, page, filterStatus]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  async function handleDelete(id: string, title: string) {
    const ok = await confirm({ message: "Apakah Anda yakin ingin menghapus artikel ini? Tindakan ini tidak dapat dibatalkan.", variant: "danger", title: "Konfirmasi" });
    if (!ok) {
      return;
    }

    try {
      setDeleting(id);
      const res = await fetch(`/api/articles/${id}`, { method: "DELETE" });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Gagal menghapus artikel");
      }

      success("Artikel berhasil dihapus");
      fetchArticles();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menghapus artikel.");
      console.error("Delete article error:", err);
    } finally {
      setDeleting(null);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(filteredIds: string[]) {
    const allSelected = filteredIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIds));
    }
  }

  async function handleBulkDelete() {
    const ok = await confirm({ message: `Apakah Anda yakin ingin menghapus ${selectedIds.size} artikel? Tindakan ini tidak dapat dibatalkan.`, variant: "danger", title: "Konfirmasi" });
    if (!ok) return;
    setBulkProcessing(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await fetch("/api/articles/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Gagal menghapus artikel");
      }
      success(`${ids.length} artikel berhasil dihapus.`);
      setSelectedIds(new Set());
      fetchArticles();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Terjadi kesalahan saat menghapus beberapa artikel.");
    } finally {
      setBulkProcessing(false);
    }
  }

  async function handleBulkArchive() {
    const ok = await confirm({ message: `Arsipkan ${selectedIds.size} artikel yang dipilih?`, variant: "warning", title: "Konfirmasi" });
    if (!ok) return;
    setBulkProcessing(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await fetch("/api/articles/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", ids }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Gagal mengarsipkan artikel");
      }
      success(`${ids.length} artikel berhasil diarsipkan.`);
      setSelectedIds(new Set());
      fetchArticles();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Terjadi kesalahan saat mengarsipkan beberapa artikel.");
    } finally {
      setBulkProcessing(false);
    }
  }

  function handleExportCsv() {
    const headers = ["Judul", "Kategori", "Status", "Penulis", "Views", "Tanggal"];
    const rows = filtered.map((a) => [
      a.title,
      a.category?.name || "",
      statusConfig[a.status]?.label || a.status,
      a.author?.name || "",
      String(a.viewCount),
      formatDate(a.publishedAt || a.createdAt),
    ]);
    exportToCsv("artikel-kartawarta.csv", headers, rows);
  }

  const filtered = articles.filter((a) => {
    return a.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredIds = filtered.map((a) => a.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">Artikel</h1>
          <p className="text-base text-txt-secondary">
            {isCreator ? "Kelola artikel Anda" : "Kelola semua artikel"}
          </p>
        </div>
        <Link
          href="/panel/artikel/baru"
          className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"
        >
          <Plus size={16} />
          Tulis Artikel
        </Link>
      </div>

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full bg-surface-dark px-6 py-3 shadow-lg border border-white/10">
          <span className="text-sm text-white">{selectedIds.size} dipilih</span>
          <button
            onClick={handleBulkArchive}
            disabled={bulkProcessing}
            className="text-sm font-medium text-yellow-400 hover:text-yellow-300 disabled:opacity-50"
            aria-label="Arsipkan artikel terpilih"
          >
            Arsipkan
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkProcessing}
            className="text-sm font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
            aria-label="Hapus artikel terpilih"
          >
            Hapus
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-white/50 hover:text-white"
            aria-label="Batal pilih semua"
          >
            Batal
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-col sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2 w-full sm:max-w-xs">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
            <input
              type="text"
              placeholder="Cari artikel..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="input w-full pl-9 text-base py-2.5"
              aria-label="Cari artikel"
            />
          </div>
          <button
            onClick={handleExportCsv}
            className="btn-secondary flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold whitespace-nowrap"
            title="Export CSV"
            aria-label="Export daftar artikel ke CSV"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-txt-muted shrink-0" />
          {["ALL", "DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "REJECTED"].map((status) => (
            <button
              key={status}
              onClick={() => { setFilterStatus(status); setPage(1); }}
              className={`rounded-full px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                filterStatus === status
                  ? "bg-primary text-white"
                  : "bg-surface-tertiary text-txt-secondary hover:bg-border"
              }`}
            >
              {status === "ALL" ? "Semua" : statusConfig[status]?.label || status}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 p-4 text-center text-base text-red-700">
          <p>{error}</p>
          <button
            onClick={fetchArticles}
            className="mt-2 rounded-[12px] bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            aria-label="Coba muat ulang daftar artikel"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* Table — viewport-constrained so the horizontal scrollbar stays
               within reach instead of getting buried below hundreds of rows.
               max-h fits below the page header + filters + pagination footer. */}
          <div className="rounded-[12px] border border-border bg-surface shadow-card overflow-hidden">
            <div className="overflow-auto max-h-[calc(100vh-260px)]">
              <table className="w-full min-w-[320px] text-sm">
                <thead className="sticky top-0 z-10 border-b border-border bg-surface-secondary shadow-sm">
                  <tr>
                    <th className="w-10 px-3 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={() => toggleSelectAll(filteredIds)}
                        className="h-4 w-4 rounded border-border text-primary accent-goto-green"
                        aria-label="Pilih semua artikel"
                      />
                    </th>
                    <th className="px-3 sm:px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Judul</th>
                    <th className="hidden md:table-cell px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Kategori</th>
                    {isEditor && (
                      <th className="hidden lg:table-cell px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Penulis</th>
                    )}
                    <th className="px-3 sm:px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Status</th>
                    <th className="hidden lg:table-cell px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Progres</th>
                    <th className="hidden xl:table-cell px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Editor</th>
                    <th className="hidden sm:table-cell px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Views</th>
                    <th className="hidden md:table-cell px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Tanggal</th>
                    <th className="px-3 sm:px-5 py-3.5 text-right text-sm font-medium text-txt-secondary">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((article) => {
                    const config = statusConfig[article.status] || statusConfig.DRAFT;
                    const StatusIcon = config.icon;
                    return (
                      <tr key={article.id} className={`hover:bg-surface-secondary ${selectedIds.has(article.id) ? "bg-primary-50" : ""}`}>
                        <td className="w-10 px-3 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(article.id)}
                            onChange={() => toggleSelect(article.id)}
                            className="h-4 w-4 rounded border-border text-primary accent-goto-green"
                            aria-label={`Pilih artikel ${article.title}`}
                          />
                        </td>
                        <td className="max-w-[200px] sm:max-w-[300px] px-3 sm:px-5 py-4">
                          <button
                            type="button"
                            onClick={() => router.push(`/panel/artikel/${article.id}/edit`)}
                            className="truncate block w-full text-left font-medium text-txt-primary text-sm hover:text-primary transition-colors cursor-pointer"
                            title="Buka di editor"
                          >
                            {article.title}
                          </button>
                        </td>
                        <td className="hidden md:table-cell px-5 py-4 text-sm text-txt-secondary">
                          {article.category?.name || "\u2014"}
                        </td>
                        {isEditor && (
                          <td className="hidden lg:table-cell px-5 py-4 text-sm text-txt-secondary">
                            {article.author?.name || "\u2014"}
                          </td>
                        )}
                        <td className="px-3 sm:px-5 py-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-sm font-medium ${config.color}`}>
                            <StatusIcon size={12} />
                            {config.label}
                          </span>
                        </td>
                        <td className="hidden lg:table-cell px-5 py-4">
                          <StatusTimeline status={article.status} />
                        </td>
                        <td className="hidden xl:table-cell px-5 py-4 text-txt-secondary">
                          {article.reviewerName ? (
                            <span className="inline-flex items-center gap-1 text-sm">
                              <UserCheck size={12} className="text-primary" />
                              {article.reviewerName}
                            </span>
                          ) : (
                            "\u2014"
                          )}
                        </td>
                        <td className="hidden sm:table-cell px-5 py-4 text-sm text-txt-secondary">
                          {article.viewCount > 0 ? article.viewCount.toLocaleString("id-ID") : "\u2014"}
                        </td>
                        <td className="hidden md:table-cell px-5 py-4 text-sm text-txt-secondary">
                          {formatDate(article.publishedAt || article.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => router.push(`/berita/${article.slug}`)}
                              className="btn-ghost rounded p-2"
                              title="Lihat"
                              aria-label="Lihat artikel"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => router.push(`/panel/artikel/${article.id}/edit`)}
                              className="btn-ghost rounded p-2"
                              title="Edit"
                              aria-label="Edit artikel"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(article.id, article.title)}
                              disabled={deleting === article.id}
                              className="btn-ghost rounded p-2 hover:text-red-500 disabled:opacity-50"
                              title="Hapus"
                              aria-label="Hapus artikel"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filtered.length === 0 && (
              <div className="py-12 text-center text-base text-txt-secondary">
                Tidak ada artikel ditemukan.
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-base text-txt-secondary">
                Halaman {page} dari {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn-secondary px-5 py-2.5 text-base disabled:opacity-40"
                >
                  Sebelumnya
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="btn-secondary px-5 py-2.5 text-base disabled:opacity-40"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
