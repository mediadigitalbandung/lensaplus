"use client";

/**
 * Statistik → AI tab (SUPER_ADMIN only). Token + cost (Rupiah) analytics over
 * AIUsageLog: totals, per-article average/min/max, and breakdowns by provider /
 * model. Perplexity research/draft calls are tracked here (logged with model +
 * computed USD cost; converted to IDR via the `usd_idr_rate` setting).
 */

import { useState, useEffect, useCallback } from "react";
import { Loader2, Coins, Hash, FileText, Bot, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell,
} from "recharts";

interface Breakdown { key: string; tokens: number; costUsd: number; costIdr: number; requests: number }
interface ArticleRow { title: string; calls: number; tokens: number; costUsd: number; costIdr: number; providers: string[] }
interface AiStats {
  usdIdrRate: number;
  totals: { totalRequests: number; totalTokens: number; totalCostUsd: number; totalCostIdr: number };
  perArticle: { count: number; avgTokens: number; minTokens: number; maxTokens: number; avgCostIdr: number; minCostIdr: number; maxCostIdr: number };
  byProvider: Breakdown[];
  byModel: Breakdown[];
  byFeature: Breakdown[];
  topArticles: ArticleRow[];
}

const idrFmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("id-ID");
const rp = (n: number) => idrFmt.format(n || 0);
const num = (n: number) => numFmt.format(n || 0);

const BAR_COLORS = ["#002045", "#b7102a", "#1a7f37", "#9a6700", "#3730a3"];

type Scope = "all" | "perplexity" | "anthropic" | "deepseek";

export default function AiUsageTab() {
  const [scope, setScope] = useState<Scope>("perplexity");
  const [stats, setStats] = useState<AiStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = scope === "all" ? "" : `?provider=${scope}`;
      const res = await fetch(`/api/ai/stats${qs}`);
      if (res.ok) setStats((await res.json()).data);
      else setStats(null);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const SCOPES: { key: Scope; label: string }[] = [
    { key: "perplexity", label: "Perplexity" },
    { key: "all", label: "Semua" },
    { key: "anthropic", label: "Claude" },
    { key: "deepseek", label: "DeepSeek" },
  ];

  return (
    <div className="space-y-5">
      {/* Scope toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border bg-surface-secondary p-1">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              onClick={() => setScope(s.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                scope === s.key ? "bg-primary text-on-primary shadow-sm" : "text-txt-secondary hover:text-txt-primary"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {stats && (
          <span className="text-xs text-txt-muted">
            Kurs: 1 USD = {rp(stats.usdIdrRate)} <span className="text-txt-muted/70">(atur di Pengaturan → <code>usd_idr_rate</code>)</span>
          </span>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 size={24} className="mx-auto animate-spin text-primary" /></div>
      ) : !stats || stats.totals.totalRequests === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-txt-secondary">
          Belum ada data penggunaan AI untuk cakupan ini.
          <p className="mt-1 text-xs text-txt-muted">
            Token Perplexity mulai tercatat sejak fitur ini aktif — buat artikel dengan &quot;Riset &amp; Tulis&quot; untuk mengisinya.
          </p>
        </div>
      ) : (
        <>
          {/* Headline cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card icon={<Hash size={16} />} label="Total Token" value={num(stats.totals.totalTokens)} />
            <Card icon={<Coins size={16} />} label="Total Biaya" value={rp(stats.totals.totalCostIdr)} accent />
            <Card icon={<TrendingUp size={16} />} label="Total Request" value={num(stats.totals.totalRequests)} />
            <Card icon={<FileText size={16} />} label="Artikel Terlacak" value={num(stats.perArticle.count)} />
          </div>

          {/* Per-article analysis */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
            <div className="mb-3 flex items-center gap-2">
              <Bot size={18} className="text-primary" />
              <h4 className="text-sm font-bold text-txt-primary">Analisis per Artikel</h4>
              <span className="text-xs text-txt-muted">(total semua panggilan AI per judul artikel)</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MinAvgMax title="Token per artikel" min={num(stats.perArticle.minTokens)} avg={num(stats.perArticle.avgTokens)} max={num(stats.perArticle.maxTokens)} />
              <MinAvgMax title="Biaya per artikel" min={rp(stats.perArticle.minCostIdr)} avg={rp(stats.perArticle.avgCostIdr)} max={rp(stats.perArticle.maxCostIdr)} accent />
            </div>
          </div>

          {/* Cost by model chart */}
          {stats.byModel.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <h4 className="mb-4 text-sm font-bold text-txt-primary">Biaya per Model (Rp)</h4>
              <ResponsiveContainer width="100%" height={Math.max(160, stats.byModel.length * 46)}>
                <BarChart data={stats.byModel.map((m) => ({ name: m.key, idr: m.costIdr }))} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" tickFormatter={(v) => num(v as number)} fontSize={11} />
                  <YAxis type="category" dataKey="name" width={140} fontSize={11} />
                  <Tooltip formatter={(v) => rp(v as number)} />
                  <Bar dataKey="idr" radius={[0, 4, 4, 0]}>
                    {stats.byModel.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top articles by cost */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
            <h4 className="mb-3 text-sm font-bold text-txt-primary">Artikel Termahal (Top 25)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-txt-muted">
                    <th className="py-2 pr-3 font-semibold">Artikel / Topik</th>
                    <th className="py-2 px-3 text-right font-semibold">Panggilan</th>
                    <th className="py-2 px-3 text-right font-semibold">Token</th>
                    <th className="py-2 pl-3 text-right font-semibold">Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topArticles.map((a, i) => (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3 max-w-[360px] truncate text-txt-primary" title={a.title}>{a.title}</td>
                      <td className="py-2 px-3 text-right text-txt-secondary">{num(a.calls)}</td>
                      <td className="py-2 px-3 text-right text-txt-secondary">{num(a.tokens)}</td>
                      <td className="py-2 pl-3 text-right font-semibold text-txt-primary">{rp(a.costIdr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-txt-muted">
            Estimasi biaya dihitung dari tarif token resmi (Perplexity Sonar, Claude, DeepSeek) per panggilan + biaya
            per-request pencarian Perplexity, lalu dikonversi ke Rupiah. Total USD: ${stats.totals.totalCostUsd.toFixed(4)}.
          </p>
        </>
      )}
    </div>
  );
}

function Card({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 shadow-card ${accent ? "border-primary/30 bg-primary/5" : "border-border bg-surface"}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-txt-muted">
        {icon} {label}
      </div>
      <p className={`mt-1.5 text-xl font-bold ${accent ? "text-primary" : "text-txt-primary"}`}>{value}</p>
    </div>
  );
}

function MinAvgMax({ title, min, avg, max, accent }: { title: string; min: string; avg: string; max: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-3">
      <p className="mb-2 text-xs font-semibold text-txt-secondary">{title}</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><p className="text-[11px] uppercase text-txt-muted">Min</p><p className="text-sm font-semibold text-txt-primary">{min}</p></div>
        <div><p className="text-[11px] uppercase text-txt-muted">Rata-rata</p><p className={`text-sm font-bold ${accent ? "text-primary" : "text-txt-primary"}`}>{avg}</p></div>
        <div><p className="text-[11px] uppercase text-txt-muted">Maks</p><p className="text-sm font-semibold text-txt-primary">{max}</p></div>
      </div>
    </div>
  );
}
