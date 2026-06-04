"use client";

/**
 * Panel Live Blog — listing + create/delete
 * Auth: SUPER_ADMIN | CHIEF_EDITOR | EDITOR
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Radio,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  ExternalLink,
  Filter,
  Edit,
  Settings,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type LiveBlogStatus = "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";

interface LiveBlog {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  status: LiveBlogStatus;
  scheduledAt: string;
  isPublished: boolean;
  viewCount: number;
  createdAt: string;
  author: { name: string };
  _count: { entries: number };
}

const STATUS_LABELS: Record<LiveBlogStatus, string> = {
  SCHEDULED: "Terjadwal",
  LIVE: "Sedang Live",
  ENDED: "Selesai",
  CANCELLED: "Dibatalkan",
};

const STATUS_COLORS: Record<LiveBlogStatus, string> = {
  SCHEDULED: "bg-blue-50 text-blue-600",
  LIVE: "bg-red-50 text-red-600 font-bold animate-pulse",
  ENDED: "bg-primary-light text-primary",
  CANCELLED: "bg-surface-container-low text-txt-muted",
};

const WRITE_ROLES = [
  "SUPER_ADMIN",
  "CHIEF_EDITOR",
  "EDITOR",
];

const DELETE_ROLES = ["SUPER_ADMIN", "CHIEF_EDITOR"];

function formatDateTime(s: string) {
  return new Date(s).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LiveBlogsPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role || "";
  const canWrite = WRITE_ROLES.includes(userRole);
  const canDelete = DELETE_ROLES.includes(userRole);
  const { success: showSuccess, error: showError } = useToast();
  const { confirm } = useConfirm();

  const [liveBlogs, setLiveBlogs] = useState<LiveBlog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<LiveBlogStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLiveBlogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      const res = await fetch(`/api/panel/live-blogs?${params}`);
      if (res.ok) {
        const json = await res.json();
        setLiveBlogs(json.data?.liveBlogs || []);
        setTotalPages(json.data?.totalPages || 1);
      }
    } catch {
      showError("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, showError]);

  useEffect(() => {
    fetchLiveBlogs();
  }, [fetchLiveBlogs]);

  const handleDelete = async (blog: LiveBlog) => {
    const ok = await confirm({
      title: "Hapus Live Blog",
      message: `Hapus "${blog.title}"? Semua entry akan ikut terhapus.`,
      confirmText: "Hapus",
      variant: "danger",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/panel/live-blogs/${blog.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        showError(json.error || "Gagal menghapus");
        return;
      }
      showSuccess("Live blog berhasil dihapus");
      fetchLiveBlogs();
    } catch {
      showError("Terjadi kesalahan");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Radio size={22} className="text-secondary" />
          <h1 className="text-xl font-bold text-on-surface">Live Blog</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLiveBlogs}
            className="btn-ghost flex items-center gap-1.5 text-sm"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
          {canWrite && (
            <Link
              href="/panel/live-blogs/baru"
              className="btn-primary flex items-center gap-1.5 text-sm"
            >
              <Plus size={16} />
              Buat Live Blog
            </Link>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-txt-muted" />
        {(["ALL", "LIVE", "SCHEDULED", "ENDED", "CANCELLED"] as const).map(
          (s) => (
            <button
              key={s}
              onClick={() => { setFilterStatus(s); setPage(1); }}
              className={`rounded-full px-3 py-1 text-label-sm transition-colors ${
                filterStatus === s
                  ? "bg-primary text-white"
                  : "bg-surface-container-low text-txt-secondary hover:bg-surface-container"
              }`}
            >
              {s === "ALL" ? "Semua" : STATUS_LABELS[s]}
            </button>
          )
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      ) : liveBlogs.length === 0 ? (
        <div className="py-16 text-center text-txt-muted">
          <Radio size={36} className="mx-auto mb-3 opacity-20" />
          <p>Belum ada live blog.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-container-low text-txt-muted">
              <tr>
                <th className="px-4 py-3 text-left">Judul</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Jadwal</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Update</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Views</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface-container-lowest">
              {liveBlogs.map((blog) => (
                <tr key={blog.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-on-surface line-clamp-1 max-w-xs">
                      {blog.title}
                    </div>
                    {blog.category && (
                      <div className="text-xs text-txt-muted mt-0.5">
                        {blog.category}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs ${STATUS_COLORS[blog.status]}`}
                    >
                      {STATUS_LABELS[blog.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-txt-secondary text-xs whitespace-nowrap">
                    {formatDateTime(blog.scheduledAt)}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-txt-muted text-xs">
                    {blog._count.entries}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-txt-muted text-xs">
                    {blog.viewCount.toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/live/${blog.slug}`}
                        target="_blank"
                        className="rounded p-1.5 text-txt-muted hover:text-primary hover:bg-surface-container-low transition-colors"
                        title="Lihat publik"
                      >
                        <ExternalLink size={15} />
                      </Link>
                      {canWrite && (
                        <Link
                          href={`/panel/live-blogs/${blog.id}`}
                          className="rounded p-1.5 text-txt-muted hover:text-primary hover:bg-surface-container-low transition-colors"
                          title="Edit"
                        >
                          <Edit size={15} />
                        </Link>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(blog)}
                          className="rounded p-1.5 text-txt-muted hover:text-secondary hover:bg-secondary-light transition-colors"
                          title="Hapus"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="btn-ghost text-sm disabled:opacity-40"
          >
            Sebelumnya
          </button>
          <span className="text-sm text-txt-muted">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="btn-ghost text-sm disabled:opacity-40"
          >
            Berikutnya
          </button>
        </div>
      )}
    </div>
  );
}
