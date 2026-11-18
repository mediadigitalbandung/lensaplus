"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Filter,
  Search,
  Eye,
} from "lucide-react";

import { EDITOR_ROLES } from "@/lib/roles";

interface ReviewedArticle {
  id: string;
  title: string;
  slug: string;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  author?: { id: string; name: string };
  category?: { id: string; name: string; slug: string };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function RiwayatReviewPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const userRole = session?.user?.role || "";
  const userId = session?.user?.id || "";
  const authorized = EDITOR_ROLES.includes(userRole);

  const [articles, setArticles] = useState<ReviewedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (sessionStatus !== "loading" && session && !authorized) {
      router.replace("/panel/dashboard");
    }
  }, [sessionStatus, session, authorized, router]);

  const fetchReviews = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/articles?page=${page}&limit=20&status=ALL&reviewedBy=${userId}`);
      if (!res.ok) throw new Error("Gagal memuat data");
      const json = await res.json();
      setArticles(json.data?.articles || []);
      setTotalPages(json.data?.pagination?.totalPages || 1);
    } catch {
      setError("Gagal memuat riwayat review.");
    } finally {
      setLoading(false);
    }
  }, [userId, page]);

  useEffect(() => {
    if (sessionStatus !== "loading" && authorized && userId) {
      fetchReviews();
    }
  }, [sessionStatus, authorized, userId, fetchReviews]);

  const filtered = articles.filter((a) => {
    const matchStatus =
      filterStatus === "ALL" ||
      (filterStatus === "APPROVED" && (a.status === "APPROVED" || a.status === "PUBLISHED")) ||
      (filterStatus === "REJECTED" && a.status === "REJECTED");
    const matchSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  if (sessionStatus === "loading" || (session && !authorized)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg sm:text-2xl font-bold text-txt-primary">Riwayat Review</h1>
        <p className="text-sm text-txt-secondary mt-1">
          Artikel yang telah Anda review
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input
            type="text"
            placeholder="Cari judul artikel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-full pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-txt-muted" />
          {[
            { value: "ALL", label: "Semua" },
            { value: "APPROVED", label: "Disetujui" },
            { value: "REJECTED", label: "Ditolak" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filterStatus === opt.value
                  ? "bg-primary text-white"
                  : "bg-surface-tertiary text-txt-secondary hover:bg-border"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
          <p>{error}</p>
          <button
            onClick={fetchReviews}
            className="mt-2 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          <div className="border-b border-border bg-surface-secondary px-5 py-3">
            <div className="h-4 w-full rounded-lg bg-surface-tertiary" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border px-5 py-3">
              <div className="h-4 w-1/3 rounded-lg bg-surface-tertiary" />
              <div className="h-4 w-1/6 rounded-lg bg-surface-tertiary" />
              <div className="h-4 w-16 rounded-full bg-surface-tertiary" />
              <div className="h-4 w-1/4 rounded-lg bg-surface-tertiary" />
              <div className="h-4 w-20 rounded-lg bg-surface-tertiary" />
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-border bg-surface-secondary">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">Judul Artikel</th>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">Penulis</th>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">Status Akhir</th>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">Catatan Review</th>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">Tanggal Review</th>
                  <th className="px-5 py-3 text-right font-medium text-txt-secondary">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((article) => {
                  const isApproved = article.status === "APPROVED" || article.status === "PUBLISHED";
                  const isRejected = article.status === "REJECTED";
                  return (
                    <tr key={article.id} className="hover:bg-surface-secondary">
                      <td className="max-w-[250px] px-5 py-3">
                        <p className="truncate font-medium text-txt-primary">{article.title}</p>
                      </td>
                      <td className="px-5 py-3 text-txt-secondary">
                        {article.author?.name || "\u2014"}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`text-xs font-semibold ${
                            isApproved
                              ? "text-primary"
                              : isRejected
                                ? "text-red-700"
                                : "text-txt-secondary"
                          }`}
                        >
                          {isApproved ? "Disetujui" : isRejected ? "Ditolak" : article.status}
                        </span>
                      </td>
                      <td className="max-w-[200px] px-5 py-3">
                        <p className="truncate text-txt-secondary text-xs">
                          {article.reviewNote || "\u2014"}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-txt-secondary">
                        {article.reviewedAt ? formatDate(article.reviewedAt) : "\u2014"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/berita/${article.slug}`}
                          className="btn-ghost inline-flex items-center gap-1 rounded-lg p-1 text-xs"
                          title="Lihat"
                        >
                          <Eye size={16} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="py-12 text-center text-txt-secondary">
              {articles.length === 0
                ? "Belum ada artikel yang Anda review."
                : "Tidak ada artikel ditemukan dengan filter ini."}
            </div>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-txt-secondary">Halaman {page} dari {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-secondary px-4 py-2 text-sm disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn-secondary px-4 py-2 text-sm disabled:opacity-40"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
