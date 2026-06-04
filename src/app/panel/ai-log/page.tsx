"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Sparkles, Cpu, Hash, Users, ChevronLeft, ChevronRight, Loader2, CheckCircle, Tag } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface AILog {
  id: string;
  userId: string;
  userName: string;
  feature: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  articleTitle: string | null;
  createdAt: string;
}

interface UserStat {
  userId: string;
  name: string;
  tokens: number;
  requests: number;
}

interface Stats {
  totalTokens: number;
  totalRequests: number;
  byUser: UserStat[];
  byFeature: { feature: string; tokens: number; requests: number }[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface BulkResult {
  processed: number;
  totalTagsAdded: number;
  totalArticles: number;
  articlesSkipped: number;
  results: { title: string; tags: string[] }[];
}

const FEATURE_LABELS: Record<string, string> = {
  tags: "Generate Tag",
  summary: "Ringkasan",
  seo_title: "SEO Title",
  meta_description: "Meta Description",
};

export default function AIPage() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = session?.user?.role || "";
  const { success, error: showError } = useToast();

  const [activeTab, setActiveTab] = useState<"generate" | "log">("generate");

  // Log state
  const [logs, setLogs] = useState<AILog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filterUser, setFilterUser] = useState("");
  const [logLoading, setLogLoading] = useState(true);

  // Bulk tags state
  const [generating, setGenerating] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);

  if (
    sessionStatus !== "loading" &&
    session &&
    userRole !== "SUPER_ADMIN"
  ) {
    redirect("/panel/dashboard");
  }

  const fetchLogs = useCallback(
    async (page: number) => {
      setLogLoading(true);
      try {
        const params = new URLSearchParams({ page: page.toString(), limit: "20" });
        if (filterUser) params.set("userId", filterUser);
        const res = await fetch(`/api/ai/usage?${params}`);
        if (res.ok) {
          const json = await res.json();
          setLogs(json.data.logs);
          setPagination(json.data.pagination);
          setStats(json.data.stats);
        }
      } catch { /* ignore */ } finally {
        setLogLoading(false);
      }
    },
    [filterUser]
  );

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  async function handleBulkGenerate() {
    setGenerating(true);
    setBulkResult(null);
    try {
      const res = await fetch("/api/ai/bulk-tags", { method: "POST" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Gagal generate tags");
      }
      const json = await res.json();
      setBulkResult(json.data);
      success(`Berhasil generate tags untuk ${json.data.processed} artikel`);
      // Refresh logs after generate
      fetchLogs(1);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal generate tags");
    } finally {
      setGenerating(false);
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const formatNumber = (n: number) => n.toLocaleString("id-ID");

  if (sessionStatus === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-3xl font-bold text-txt-primary flex items-center gap-2">
          <Sparkles size={24} className="text-primary" />
          AI Tools
        </h1>
        <p className="text-base text-txt-secondary mt-1">Generate tag SEO otomatis dan monitor penggunaan AI</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        <button
          onClick={() => setActiveTab("generate")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "generate"
              ? "border-primary text-primary"
              : "border-transparent text-txt-secondary hover:text-txt-primary"
          }`}
        >
          <span className="flex items-center gap-2">
            <Tag size={16} />
            Generate Tags
          </span>
        </button>
        <button
          onClick={() => setActiveTab("log")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "log"
              ? "border-primary text-primary"
              : "border-transparent text-txt-secondary hover:text-txt-primary"
          }`}
        >
          <span className="flex items-center gap-2">
            <Cpu size={16} />
            Log Penggunaan
          </span>
        </button>
      </div>

      {/* ══════ TAB: GENERATE TAGS ══════ */}
      {activeTab === "generate" && (
        <>
          <div className="rounded-xl border border-border bg-surface shadow-card p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-light shrink-0">
                <Sparkles size={24} className="text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-txt-primary">Bulk Generate Tags</h3>
                <p className="text-sm text-txt-secondary mt-1 mb-4">
                  AI akan menganalisis setiap artikel yang memiliki kurang dari 5 tag,
                  lalu generate 8-10 tag SEO-friendly secara otomatis. Tag baru akan langsung
                  membuat halaman /tag/[slug] yang terindex Google.
                </p>
                <button
                  onClick={handleBulkGenerate}
                  disabled={generating}
                  className="btn-primary flex items-center gap-2"
                >
                  {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  {generating ? "Sedang memproses..." : "Generate Tags Sekarang"}
                </button>
              </div>
            </div>
          </div>

          {bulkResult && (
            <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
              <div className="border-b border-border px-5 py-3.5">
                <h3 className="flex items-center gap-2 text-sm font-bold text-txt-primary">
                  <CheckCircle size={16} className="text-primary" />
                  Hasil Generate
                </h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="rounded-lg bg-surface-secondary p-3 text-center">
                    <p className="text-2xl font-extrabold text-txt-primary">{bulkResult.processed}</p>
                    <p className="text-xs text-txt-muted">Artikel Diproses</p>
                  </div>
                  <div className="rounded-lg bg-surface-secondary p-3 text-center">
                    <p className="text-2xl font-extrabold text-primary">{bulkResult.totalTagsAdded}</p>
                    <p className="text-xs text-txt-muted">Tags Ditambahkan</p>
                  </div>
                  <div className="rounded-lg bg-surface-secondary p-3 text-center">
                    <p className="text-2xl font-extrabold text-txt-primary">{bulkResult.totalArticles}</p>
                    <p className="text-xs text-txt-muted">Total Artikel</p>
                  </div>
                  <div className="rounded-lg bg-surface-secondary p-3 text-center">
                    <p className="text-2xl font-extrabold text-txt-muted">{bulkResult.articlesSkipped}</p>
                    <p className="text-xs text-txt-muted">Sudah Cukup</p>
                  </div>
                </div>
                {bulkResult.results?.length > 0 && (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    <p className="text-sm font-semibold text-txt-secondary">Detail per Artikel:</p>
                    {bulkResult.results.map((r, i) => (
                      <div key={i} className="rounded-lg border border-border p-3">
                        <p className="text-sm font-semibold text-txt-primary mb-2">{r.title}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {r.tags.map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary">
                              <Tag size={10} />
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════ TAB: LOG PENGGUNAAN ══════ */}
      {activeTab === "log" && (
        <>
          {/* Stats Cards */}
          {stats && (
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light">
                    <Cpu size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-txt-muted">Total Token</p>
                    <p className="text-xl font-bold text-txt-primary">{formatNumber(stats.totalTokens)}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-50">
                    <Hash size={20} className="text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-xs text-txt-muted">Total Request</p>
                    <p className="text-xl font-bold text-txt-primary">{formatNumber(stats.totalRequests)}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                    <Users size={20} className="text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-txt-muted">Pengguna Aktif</p>
                    <p className="text-xl font-bold text-txt-primary">{stats.byUser.length}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Per User */}
          {stats && stats.byUser.length > 0 && (
            <div className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-card">
              <h2 className="mb-3 text-sm font-semibold text-txt-primary">Penggunaan Per Pengguna</h2>
              <div className="space-y-2">
                {stats.byUser.map((u) => (
                  <div key={u.userId} className="flex items-center justify-between rounded-lg bg-surface-secondary px-4 py-2.5">
                    <button
                      onClick={() => setFilterUser(filterUser === u.userId ? "" : u.userId)}
                      className={`text-sm font-medium transition-colors ${filterUser === u.userId ? "text-primary" : "text-txt-primary hover:text-primary"}`}
                    >
                      {u.name}
                    </button>
                    <div className="flex items-center gap-4 text-xs text-txt-muted">
                      <span>{formatNumber(u.requests)} req</span>
                      <span>{formatNumber(u.tokens)} token</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filterUser && (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm text-txt-secondary">Filter: {stats?.byUser.find((u) => u.userId === filterUser)?.name}</span>
              <button onClick={() => setFilterUser("")} className="text-xs text-primary hover:underline">Hapus filter</button>
            </div>
          )}

          {/* Log Table */}
          {logLoading ? (
            <div className="flex min-h-[20vh] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface shadow-card overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-border bg-surface-secondary">
                    <th className="px-3 sm:px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Waktu</th>
                    <th className="px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Pengguna</th>
                    <th className="px-3 sm:px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Fitur</th>
                    <th className="px-3 sm:px-5 py-3.5 text-right text-sm font-medium text-txt-secondary">Token</th>
                    <th className="px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Artikel</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-base text-txt-muted">Belum ada data penggunaan AI</td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="border-b border-border last:border-0 hover:bg-surface-secondary/50 transition-colors">
                        <td className="px-3 sm:px-5 py-4 text-xs sm:text-sm text-txt-secondary whitespace-nowrap">{formatDate(log.createdAt)}</td>
                        <td className="px-5 py-4 text-sm text-txt-primary">{log.userName}</td>
                        <td className="px-3 sm:px-5 py-4">
                          <span className="inline-block rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary">
                            {FEATURE_LABELS[log.feature] || log.feature}
                          </span>
                        </td>
                        <td className="px-3 sm:px-5 py-4 text-right text-sm font-medium text-txt-primary">{formatNumber(log.totalTokens)}</td>
                        <td className="px-5 py-4 text-sm text-txt-secondary max-w-[200px] truncate">{log.articleTitle || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-txt-muted">
                Halaman {pagination.page} dari {pagination.totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => fetchLogs(pagination.page - 1)} disabled={pagination.page <= 1} className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-40">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => fetchLogs(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-40">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
