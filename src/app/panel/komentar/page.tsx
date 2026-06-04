"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageCircle,
  CheckCircle,
  XCircle,
  Trash2,
  Clock,
  Filter,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

interface Comment {
  id: string;
  content: string;
  authorName: string;
  authorEmail: string;
  isApproved: boolean;
  articleId: string;
  parentId: string | null;
  createdAt: string;
  article?: {
    title: string;
    slug: string;
  };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[12px] border border-border bg-surface p-5 shadow-card"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="h-5 w-16 rounded-full bg-surface-tertiary" />
            <div className="h-4 w-20 rounded bg-surface-tertiary" />
          </div>
          <div className="h-5 w-2/3 rounded bg-surface-tertiary" />
          <div className="mt-2 h-4 w-full rounded bg-surface-secondary" />
        </div>
      ))}
    </div>
  );
}

const ITEMS_PER_PAGE = 20;

export default function KomentarPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("pending");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const { success, error: showError } = useToast();
  const { confirm } = useConfirm();

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filterParam = filter === "all" ? "" : `&filter=${filter}`;
      const res = await fetch(
        `/api/comments?page=${page}&limit=${ITEMS_PER_PAGE}${filterParam}`
      );
      if (!res.ok) throw new Error("Gagal memuat komentar");

      const json = await res.json();
      const data = json.data;

      setComments(data.comments || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
      setPendingCount(data.pendingCount || 0);
      setApprovedCount(data.approvedCount || 0);
    } catch {
      setError("Gagal memuat daftar komentar. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [filter]);

  async function handleApprove(id: string) {
    try {
      setUpdating(id);
      const res = await fetch(`/api/comments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved: true }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Gagal menyetujui komentar");
      }
      success("Komentar disetujui");
      fetchComments();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menyetujui komentar");
    } finally {
      setUpdating(null);
    }
  }

  async function handleReject(id: string) {
    try {
      setUpdating(id);
      const res = await fetch(`/api/comments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved: false }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Gagal menolak komentar");
      }
      success("Komentar ditolak");
      fetchComments();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menolak komentar");
    } finally {
      setUpdating(null);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({ message: "Hapus komentar ini secara permanen?", variant: "danger", title: "Konfirmasi" });
    if (!ok) return;
    try {
      setUpdating(id);
      const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Gagal menghapus komentar");
      }
      success("Komentar dihapus");
      fetchComments();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menghapus komentar");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-3xl font-bold text-txt-primary flex items-center gap-2">
          <MessageCircle size={24} />
          Komentar
        </h1>
        <p className="text-base text-txt-secondary">
          {loading
            ? "Memuat..."
            : `${pendingCount} komentar menunggu moderasi`}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 p-4 text-center text-base text-red-700">
          <p>{error}</p>
          <button
            onClick={fetchComments}
            className="mt-2 rounded-[12px] bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
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
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-[12px] border border-border bg-surface p-4 shadow-card">
              <div className="flex items-center gap-2 text-sm text-txt-secondary">
                <MessageCircle size={16} /> Total
              </div>
              <p className="mt-1 text-lg sm:text-2xl font-bold text-txt-primary">
                {pendingCount + approvedCount}
              </p>
            </div>
            <div className="rounded-[12px] border border-border bg-surface p-4 shadow-card">
              <div className="flex items-center gap-2 text-sm text-yellow-600">
                <Clock size={16} /> Menunggu
              </div>
              <p className="mt-1 text-lg sm:text-2xl font-bold text-txt-primary">
                {pendingCount}
              </p>
            </div>
            <div className="rounded-[12px] border border-border bg-surface p-4 shadow-card">
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle size={16} /> Disetujui
              </div>
              <p className="mt-1 text-lg sm:text-2xl font-bold text-txt-primary">
                {approvedCount}
              </p>
            </div>
          </div>

          {/* Filter */}
          <div className="mb-4 flex items-center gap-2">
            <Filter size={16} className="text-txt-muted" />
            {(
              [
                { key: "pending", label: "Menunggu" },
                { key: "approved", label: "Disetujui" },
                { key: "all", label: "Semua" },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  filter === f.key
                    ? "bg-primary text-white"
                    : "bg-surface-tertiary text-txt-secondary hover:bg-border"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Comments list */}
          <div className="space-y-3">
            {comments.length === 0 ? (
              <div className="rounded-[12px] border border-border bg-surface p-8 text-center text-base text-txt-secondary shadow-card">
                Tidak ada komentar
                {filter === "pending"
                  ? " yang menunggu moderasi"
                  : filter === "approved"
                    ? " yang disetujui"
                    : ""}
                .
              </div>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-[12px] border border-border bg-surface p-5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Status + meta */}
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`badge text-sm ${
                            comment.isApproved
                              ? "bg-primary-light text-primary"
                              : "bg-yellow-50 text-yellow-600"
                          }`}
                        >
                          {comment.isApproved ? (
                            <>
                              <CheckCircle size={10} className="mr-1" />
                              Disetujui
                            </>
                          ) : (
                            <>
                              <Clock size={10} className="mr-1" />
                              Menunggu
                            </>
                          )}
                        </span>
                        <span className="text-sm text-txt-muted">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>

                      {/* Article title */}
                      {comment.article && (
                        <p className="mb-1 text-sm text-txt-muted">
                          Pada:{" "}
                          <a
                            href={`/berita/${comment.article.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {comment.article.title}
                          </a>
                        </p>
                      )}

                      {/* Author info */}
                      <p className="text-sm font-semibold text-txt-primary">
                        {comment.authorName}
                        <span className="ml-2 text-sm font-normal text-txt-muted">
                          ({comment.authorEmail})
                        </span>
                      </p>

                      {/* Comment content */}
                      <p className="mt-1 text-sm text-txt-secondary leading-relaxed">
                        {comment.content}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-shrink-0 gap-1.5">
                      {!comment.isApproved && (
                        <button
                          onClick={() => handleApprove(comment.id)}
                          disabled={updating === comment.id}
                          className="rounded-lg bg-primary-light p-2 text-primary hover:bg-primary/20 disabled:opacity-50"
                          title="Setujui"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      {comment.isApproved && (
                        <button
                          onClick={() => handleReject(comment.id)}
                          disabled={updating === comment.id}
                          className="rounded-lg bg-yellow-50 p-2 text-yellow-600 hover:bg-yellow-100 disabled:opacity-50"
                          title="Batalkan persetujuan"
                        >
                          <XCircle size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(comment.id)}
                        disabled={updating === comment.id}
                        className="rounded-lg bg-red-50 p-2 text-red-500 hover:bg-red-100 disabled:opacity-50"
                        title="Hapus"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
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
