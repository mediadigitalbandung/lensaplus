"use client";

/**
 * EditorTab — merged "Statistik Editor" view, rendered as a sub-tab inside
 * /panel/statistik (replaces the standalone /panel/statistik-editor page).
 *
 * Two sections:
 *  1. Review performance (the reviewer's own approve/reject breakdown).
 *  2. "Sorotan SEO per Penulis" — every writer's Sorotan grouped per author,
 *     so editor-tier users can monitor the team's SEO highlight output.
 *
 * Audience: editor-tier only (SUPER_ADMIN | CHIEF_EDITOR | EDITOR). The parent
 * page gates the tab; this component assumes an editor-tier session.
 */

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Sparkles,
  ChevronDown,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface ReviewedArticle {
  id: string;
  title: string;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
}

interface SorotanItem {
  slug: string;
  title: string;
  angle: string;
  indexStatus: string;
  articleSlug: string;
  createdAt: string;
}

interface AuthorGroup {
  authorId: string;
  authorName: string;
  total: number;
  indexed: number;
  submitted: number;
  pending: number;
  failed: number;
  items: SorotanItem[];
}

const ANGLE_LABELS: Record<string, string> = {
  KRONOLOGI: "Kronologi",
  ANALISIS: "Analisis",
  DAMPAK: "Dampak",
  LATAR_BELAKANG: "Latar Belakang",
  PROFIL: "Profil",
  REAKSI: "Reaksi",
  HUKUM: "Hukum",
  EKONOMI: "Ekonomi",
  PROYEKSI: "Proyeksi",
  FAQ: "FAQ",
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  indexed: { label: "Terindeks", cls: "bg-primary-light text-primary" },
  submitted: { label: "Diajukan", cls: "bg-blue-50 text-blue-600" },
  pending: { label: "Menunggu", cls: "bg-surface-tertiary text-txt-secondary" },
  failed: { label: "Gagal", cls: "bg-red-50 text-red-600" },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function EditorTab() {
  const { data: session } = useSession();
  const userRole = session?.user?.role || "";
  const userId = session?.user?.id || "";

  const [articles, setArticles] = useState<ReviewedArticle[]>([]);
  const [authors, setAuthors] = useState<AuthorGroup[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [sampled, setSampled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);

      // Admins see all reviewed articles; editors see only their own reviews.
      const reviewUrl =
        userRole === "SUPER_ADMIN"
          ? `/api/articles?limit=500&status=ALL`
          : `/api/articles?limit=500&status=ALL&reviewedBy=${userId}`;

      const [reviewRes, sorotanRes] = await Promise.all([
        fetch(reviewUrl),
        fetch(`/api/seo/sorotan-by-author`),
      ]);

      if (!reviewRes.ok) throw new Error("Gagal memuat data review");
      const reviewJson = await reviewRes.json();
      const allArticles: ReviewedArticle[] = reviewJson.data?.articles || [];
      setArticles(allArticles.filter((a) => a.reviewedAt));

      if (sorotanRes.ok) {
        const sorotanJson = await sorotanRes.json();
        setAuthors(sorotanJson.data?.authors || []);
        setGrandTotal(sorotanJson.data?.grandTotal || 0);
        setSampled(Boolean(sorotanJson.data?.sampled));
      }
    } catch {
      setError("Gagal memuat statistik. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [userId, userRole]);

  useEffect(() => {
    if (userId) fetchData();
  }, [userId, fetchData]);

  // ── Review stats ──
  const totalReview = articles.length;
  const approved = articles.filter(
    (a) => a.status === "APPROVED" || a.status === "PUBLISHED"
  ).length;
  const rejected = articles.filter((a) => a.status === "REJECTED").length;

  let avgPerDay = 0;
  if (articles.length > 0) {
    const dates = articles
      .filter((a) => a.reviewedAt)
      .map((a) => new Date(a.reviewedAt!).toDateString());
    const uniqueDays = new Set(dates).size;
    avgPerDay =
      uniqueDays > 0 ? Math.round((totalReview / uniqueDays) * 10) / 10 : 0;
  }

  const approvalRate =
    totalReview > 0 ? Math.round((approved / totalReview) * 100) : 0;
  const rejectionRate =
    totalReview > 0 ? Math.round((rejected / totalReview) * 100) : 0;

  const recentReviews = [...articles]
    .sort(
      (a, b) =>
        new Date(b.reviewedAt || 0).getTime() -
        new Date(a.reviewedAt || 0).getTime()
    )
    .slice(0, 10);

  const totalSorotan = grandTotal || authors.reduce((sum, a) => sum + a.total, 0);

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
          <p>{error}</p>
          <button
            onClick={fetchData}
            className="mt-2 rounded-[12px] bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Review performance */}
      <h2 className="mb-3 text-base font-semibold text-txt-primary">
        Performa Review {userRole === "SUPER_ADMIN" ? "(Semua)" : "(Anda)"}
      </h2>
      <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <div className="rounded-[12px] border border-border bg-surface p-4 shadow-card">
          <div className="inline-flex rounded-[12px] bg-blue-50 p-2 text-blue-500">
            <Clock size={18} />
          </div>
          <p className="mt-2 text-xl sm:text-3xl font-extrabold text-txt-primary">
            {totalReview}
          </p>
          <p className="text-xs text-txt-secondary">Total Review</p>
        </div>
        <div className="rounded-[12px] border border-border bg-surface p-4 shadow-card">
          <div className="inline-flex rounded-[12px] bg-primary-light p-2 text-primary">
            <CheckCircle size={18} />
          </div>
          <p className="mt-2 text-xl sm:text-3xl font-extrabold text-primary">
            {approved}
          </p>
          <p className="text-xs text-txt-secondary">Disetujui</p>
        </div>
        <div className="rounded-[12px] border border-border bg-surface p-4 shadow-card">
          <div className="inline-flex rounded-[12px] bg-red-50 p-2 text-red-500">
            <XCircle size={18} />
          </div>
          <p className="mt-2 text-xl sm:text-3xl font-extrabold text-red-500">
            {rejected}
          </p>
          <p className="text-xs text-txt-secondary">Ditolak</p>
        </div>
        <div className="rounded-[12px] border border-border bg-surface p-4 shadow-card">
          <div className="inline-flex rounded-[12px] bg-purple-50 p-2 text-purple-500">
            <TrendingUp size={18} />
          </div>
          <p className="mt-2 text-xl sm:text-3xl font-extrabold text-txt-primary">
            {avgPerDay}
          </p>
          <p className="text-xs text-txt-secondary">Rata-rata Review/Hari</p>
        </div>
      </div>

      {/* Review Breakdown */}
      <div className="mb-6 rounded-[12px] border border-border bg-surface p-5 shadow-card">
        <h2 className="mb-4 text-lg font-semibold text-txt-primary">
          Review Breakdown
        </h2>
        {totalReview === 0 ? (
          <p className="text-sm text-txt-muted">Belum ada data review.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-txt-primary">
                  Disetujui
                </span>
                <span className="text-sm font-semibold text-primary">
                  {approvalRate}%
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-surface-tertiary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${approvalRate}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-txt-primary">
                  Ditolak
                </span>
                <span className="text-sm font-semibold text-red-500">
                  {rejectionRate}%
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-surface-tertiary">
                <div
                  className="h-full rounded-full bg-red-500 transition-all duration-500"
                  style={{ width: `${rejectionRate}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Reviews Table */}
      <div className="mb-8 overflow-hidden rounded-[12px] border border-border bg-surface shadow-card">
        <div className="border-b border-border bg-surface-secondary px-5 py-4">
          <h2 className="font-semibold text-txt-primary">Review Terbaru</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-border bg-surface-secondary">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                  Judul
                </th>
                <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                  Status
                </th>
                <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                  Catatan
                </th>
                <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                  Tanggal Review
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentReviews.map((article) => {
                const isApproved =
                  article.status === "APPROVED" ||
                  article.status === "PUBLISHED";
                const isRejected = article.status === "REJECTED";
                return (
                  <tr key={article.id} className="hover:bg-surface-secondary">
                    <td className="max-w-[250px] px-5 py-3">
                      <p className="truncate font-medium text-txt-primary">
                        {article.title}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          isApproved
                            ? "bg-primary-light text-primary"
                            : isRejected
                              ? "bg-red-50 text-red-600"
                              : "bg-surface-tertiary text-txt-secondary"
                        }`}
                      >
                        {isApproved ? (
                          <CheckCircle size={12} />
                        ) : isRejected ? (
                          <XCircle size={12} />
                        ) : null}
                        {isApproved
                          ? "Disetujui"
                          : isRejected
                            ? "Ditolak"
                            : article.status}
                      </span>
                    </td>
                    <td className="max-w-[200px] px-5 py-3">
                      <p className="truncate text-xs text-txt-secondary">
                        {article.reviewNote || "—"}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-txt-secondary">
                      {article.reviewedAt
                        ? formatDate(article.reviewedAt)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {recentReviews.length === 0 && (
          <div className="py-12 text-center text-txt-secondary">
            Belum ada artikel yang di-review.
          </div>
        )}
      </div>

      {/* Sorotan SEO per Penulis */}
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={20} className="text-primary" />
        <h2 className="text-base font-semibold text-txt-primary">
          Sorotan SEO per Penulis
        </h2>
        <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary">
          {totalSorotan} total
        </span>
      </div>
      <p className="mb-4 text-sm text-txt-secondary">
        Pantauan output Sorotan SEO seluruh penulis, dikelompokkan per penulis.
        {sampled && (
          <span className="text-txt-muted">
            {" "}
            Rincian per penulis adalah sampel terbaru; total seluruhnya{" "}
            {totalSorotan.toLocaleString("id-ID")} Sorotan.
          </span>
        )}
      </p>

      {authors.length === 0 ? (
        <div className="rounded-[12px] border border-border bg-surface py-12 text-center text-txt-secondary shadow-card">
          Belum ada Sorotan yang dibuat.
        </div>
      ) : (
        <div className="space-y-3">
          {authors.map((author) => {
            const isOpen = expanded === author.authorId;
            return (
              <div
                key={author.authorId}
                className="overflow-hidden rounded-[12px] border border-border bg-surface shadow-card"
              >
                <button
                  onClick={() =>
                    setExpanded(isOpen ? null : author.authorId)
                  }
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-surface-secondary"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-txt-primary">
                      {author.authorName}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-txt-secondary">
                      <span>{author.total} sorotan</span>
                      <span className="text-primary">
                        {author.indexed} terindeks
                      </span>
                      {author.submitted > 0 && (
                        <span className="text-blue-600">
                          {author.submitted} diajukan
                        </span>
                      )}
                      {author.pending > 0 && (
                        <span>{author.pending} menunggu</span>
                      )}
                      {author.failed > 0 && (
                        <span className="text-red-600">
                          {author.failed} gagal
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-txt-muted transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="divide-y divide-border border-t border-border">
                    {author.items.map((item) => {
                      const meta =
                        STATUS_META[item.indexStatus] || STATUS_META.pending;
                      return (
                        <div
                          key={item.slug}
                          className="flex items-start justify-between gap-3 px-5 py-3"
                        >
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-medium text-txt-primary">
                              {item.title}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                              <span className="rounded bg-surface-tertiary px-1.5 py-0.5 text-txt-secondary">
                                {ANGLE_LABELS[item.angle] || item.angle}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 font-medium ${meta.cls}`}
                              >
                                {meta.label}
                              </span>
                              <span className="text-txt-muted">
                                {formatDate(item.createdAt)}
                              </span>
                            </div>
                          </div>
                          {item.articleSlug && (
                            <Link
                              href={`/sorotan/${item.slug}`}
                              target="_blank"
                              className="shrink-0 rounded p-1.5 text-txt-muted hover:bg-surface-secondary hover:text-primary"
                              title="Lihat sorotan"
                            >
                              <ExternalLink size={15} />
                            </Link>
                          )}
                        </div>
                      );
                    })}
                    {author.total > author.items.length && (
                      <p className="px-5 py-2 text-xs text-txt-muted">
                        Menampilkan {author.items.length} dari {author.total}{" "}
                        sorotan terbaru.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
