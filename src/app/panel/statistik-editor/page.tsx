"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  BarChart3,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
} from "lucide-react";

import { EDITOR_ROLES } from "@/lib/roles";

interface ReviewedArticle {
  id: string;
  title: string;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function StatistikEditorPage() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = session?.user?.role || "";
  const userId = session?.user?.id || "";

  const [articles, setArticles] = useState<ReviewedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect non-editors
  if (
    sessionStatus !== "loading" &&
    session &&
    !EDITOR_ROLES.includes(userRole)
  ) {
    redirect("/panel/dashboard");
  }

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);

      // Admins see all reviewed articles; editors see only their own
      const url =
        userRole === "SUPER_ADMIN"
          ? `/api/articles?limit=500&status=ALL`
          : `/api/articles?limit=500&status=ALL&reviewedBy=${userId}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Gagal memuat data");
      const json = await res.json();
      const allArticles: ReviewedArticle[] = json.data?.articles || [];

      // Filter only articles that have been reviewed (have reviewedAt)
      const reviewed = allArticles.filter((a) => a.reviewedAt);
      setArticles(reviewed);
    } catch {
      setError("Gagal memuat statistik. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [userId, userRole]);

  useEffect(() => {
    if (userId) fetchData();
  }, [userId, fetchData]);

  // Computed stats
  const totalReview = articles.length;
  const approved = articles.filter(
    (a) => a.status === "APPROVED" || a.status === "PUBLISHED"
  ).length;
  const rejected = articles.filter((a) => a.status === "REJECTED").length;

  // Average reviews per day
  let avgPerDay = 0;
  if (articles.length > 0) {
    const dates = articles
      .filter((a) => a.reviewedAt)
      .map((a) => new Date(a.reviewedAt!).toDateString());
    const uniqueDays = new Set(dates).size;
    avgPerDay = uniqueDays > 0 ? Math.round((totalReview / uniqueDays) * 10) / 10 : 0;
  }

  const approvalRate =
    totalReview > 0 ? Math.round((approved / totalReview) * 100) : 0;
  const rejectionRate =
    totalReview > 0 ? Math.round((rejected / totalReview) * 100) : 0;

  // Recent 10 reviews
  const recentReviews = [...articles]
    .sort(
      (a, b) =>
        new Date(b.reviewedAt || 0).getTime() -
        new Date(a.reviewedAt || 0).getTime()
    )
    .slice(0, 10);

  if (
    sessionStatus === "loading" ||
    (session && !EDITOR_ROLES.includes(userRole))
  ) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 size={24} className="text-primary" />
            <h1 className="text-lg sm:text-2xl font-bold text-txt-primary">
              Statistik Editor
            </h1>
          </div>
          <p className="mt-1 text-sm text-txt-secondary">
            Ringkasan performa review Anda
          </p>
        </div>
        <div className="animate-pulse">
          <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-[12px] border border-border bg-surface p-4 shadow-card"
              >
                <div className="h-8 w-8 rounded-[12px] bg-surface-tertiary" />
                <div className="mt-2 h-7 w-16 rounded bg-surface-tertiary" />
                <div className="mt-1 h-3 w-20 rounded bg-surface-secondary" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 size={24} className="text-primary" />
          <h1 className="text-lg sm:text-2xl font-bold text-txt-primary">
            Statistik Editor
          </h1>
        </div>
        <p className="mt-1 text-sm text-txt-secondary">
          Ringkasan performa review Anda
        </p>
      </div>

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

      {/* Stats Cards */}
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
            {/* Approval rate */}
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
            {/* Rejection rate */}
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
      <div className="overflow-hidden rounded-[12px] border border-border bg-surface shadow-card">
        <div className="border-b border-border bg-surface-secondary px-5 py-4">
          <h2 className="font-semibold text-txt-primary">
            Review Terbaru
          </h2>
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
                        {article.reviewNote || "\u2014"}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-txt-secondary">
                      {article.reviewedAt
                        ? formatDate(article.reviewedAt)
                        : "\u2014"}
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
    </div>
  );
}
