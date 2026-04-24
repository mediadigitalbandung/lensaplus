"use client";

/**
 * Sorotan Panel — EDITOR+
 * Manage Sorotan SEO pages generated per article (3 angles: KRONOLOGI, ANALISIS, DAMPAK)
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Lightbulb,
  Sparkles,
  RefreshCw,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Zap,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { EDITOR_ROLES } from "@/lib/roles";

interface Article {
  id: string;
  title: string;
  slug: string;
  status: string;
  publishedAt: string | null;
  _sorotanCount?: number;
}

interface SorotanStatus {
  total: number;
  counts: {
    pending: number;
    submitted: number;
    indexed: number;
    failed: number;
    unknown: number;
  };
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SorotanPage() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = session?.user?.role || "";
  const { success: showSuccess, error: showError } = useToast();

  const [articles, setArticles] = useState<Article[]>([]);
  const [sorotanStatus, setSorotanStatus] = useState<SorotanStatus | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [singleProcessing, setSingleProcessing] = useState<string | null>(null);

  if (
    sessionStatus !== "loading" &&
    session &&
    !EDITOR_ROLES.includes(userRole)
  ) {
    redirect("/panel/dashboard");
  }

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [artRes, statusRes] = await Promise.all([
        fetch("/api/articles?status=PUBLISHED&limit=100&sort=oldest"),
        fetch("/api/seo/sorotan-status"),
      ]);

      if (artRes.ok) {
        const json = await artRes.json();
        setArticles(json.data?.articles || []);
      }
      if (statusRes.ok) {
        const json = await statusRes.json();
        setSorotanStatus(json.data);
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleBatchGenerate() {
    try {
      setBatchGenerating(true);
      const res = await fetch("/api/seo/generate-sorotan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 5 }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal");
      showSuccess(
        `Diproses ${json.data?.targets ?? 0} artikel — ${json.data?.totalCreated ?? 0} sorotan dibuat, ${json.data?.totalErrors ?? 0} error.`,
      );
      fetchData();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal batch generate");
    } finally {
      setBatchGenerating(false);
    }
  }

  async function handleSingle(articleId: string) {
    try {
      setSingleProcessing(articleId);
      const res = await fetch("/api/seo/generate-sorotan-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal");
      showSuccess(
        `${json.data?.created ?? 0} angle dibuat, ${json.data?.skipped ?? 0} di-skip, ${(json.data?.errors || []).length} error.`,
      );
      fetchData();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal generate");
    } finally {
      setSingleProcessing(null);
    }
  }

  if (sessionStatus === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Lightbulb size={24} className="text-primary" />
            <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">
              Sorotan
            </h1>
          </div>
          <p className="mt-1 text-sm text-txt-secondary">
            Halaman SEO tambahan — 3 sudut pandang per artikel (Kronologi /
            Analisis / Dampak).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="btn-ghost flex items-center gap-2 px-3 py-2.5 text-sm"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={handleBatchGenerate}
            disabled={batchGenerating}
            className="btn-primary flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {batchGenerating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Zap size={14} />
            )}
            Generate Batch (5)
          </button>
        </div>
      </div>

      {/* Status cards */}
      {sorotanStatus && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
            <p className="text-xs text-txt-secondary">Total Sorotan</p>
            <p className="mt-1 text-2xl font-extrabold text-txt-primary">
              {sorotanStatus.total}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
            <div className="flex items-center gap-1.5 text-xs text-txt-secondary">
              <Clock size={12} className="text-yellow-500" /> Pending
            </div>
            <p className="mt-1 text-2xl font-extrabold text-yellow-600">
              {sorotanStatus.counts.pending}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
            <div className="flex items-center gap-1.5 text-xs text-txt-secondary">
              <AlertCircle size={12} className="text-blue-500" /> Submitted
            </div>
            <p className="mt-1 text-2xl font-extrabold text-blue-600">
              {sorotanStatus.counts.submitted}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
            <div className="flex items-center gap-1.5 text-xs text-txt-secondary">
              <CheckCircle size={12} className="text-primary" /> Indexed
            </div>
            <p className="mt-1 text-2xl font-extrabold text-primary">
              {sorotanStatus.counts.indexed}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
            <div className="flex items-center gap-1.5 text-xs text-txt-secondary">
              <XCircle size={12} className="text-red-500" /> Failed
            </div>
            <p className="mt-1 text-2xl font-extrabold text-red-600">
              {sorotanStatus.counts.failed}
            </p>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <Sparkles size={16} className="mt-0.5 text-blue-600 shrink-0" />
          <p className="text-xs text-blue-700">
            Sorotan dibuat otomatis via AI (3 angle: KRONOLOGI, ANALISIS,
            DAMPAK). Setiap artikel idealnya punya 3 sorotan. Artikel dengan
            sorotan 0–2 bisa di-generate ulang.
          </p>
        </div>
      </div>

      {/* Article list */}
      <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="border-b border-border bg-surface-secondary px-5 py-4">
          <h2 className="text-base font-bold text-txt-primary">
            Artikel Dipublikasi
          </h2>
        </div>
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 size={24} className="mx-auto animate-spin text-primary" />
          </div>
        ) : articles.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-txt-secondary">
              Belum ada artikel dipublikasi.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-secondary">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                    Artikel
                  </th>
                  <th className="hidden sm:table-cell px-5 py-3 text-left font-medium text-txt-secondary">
                    Dipublikasi
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-txt-secondary">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {articles.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-secondary/50">
                    <td className="max-w-[360px] px-5 py-3">
                      <p className="truncate font-medium text-txt-primary">
                        {a.title}
                      </p>
                      <p className="text-[11px] text-txt-muted truncate">
                        /{a.slug}
                      </p>
                    </td>
                    <td className="hidden sm:table-cell px-5 py-3 text-xs text-txt-secondary">
                      {formatDate(a.publishedAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleSingle(a.id)}
                        disabled={singleProcessing === a.id}
                        className="btn-secondary inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                      >
                        {singleProcessing === a.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Sparkles size={12} />
                        )}
                        Generate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
