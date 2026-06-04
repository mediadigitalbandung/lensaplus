"use client";

/**
 * Statistik → AI / Token (SUPER_ADMIN only).
 *
 * Concept: tokens from different providers are NOT comparable (1 Perplexity
 * token ≠ 1 Claude token in price or meaning), so we never sum them into one
 * headline number. The combinable metric across providers is COST in Rupiah
 * (money is normalized) — and per-article totals (the related calls that
 * produce one article). The "Ringkasan" view separates token volume per
 * platform; each platform sub-view drills into one provider where a single
 * token total IS meaningful.
 */

import { useState, useEffect, useCallback } from "react";
import { Loader2, Coins, Hash, FileText, Bot, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell,
} from "recharts";

interface Breakdown { key: string; tokens: number; costIdr: number; requests: number }
interface ArticleRow { title: string; calls: number; tokens: number; costIdr: number; providers: string[] }
interface DailyPoint { date: string; costIdr: number; tokens: number; requests: number }
interface AiStats {
  usdIdrRate: number;
  usdIdrManual: boolean;
  totals: { totalRequests: number; totalTokens: number; totalCostUsd: number; totalCostIdr: number };
  perArticle: { count: number; avgTokens: number; minTokens: number; maxTokens: number; avgCostIdr: number; minCostIdr: number; maxCostIdr: number };
  byProvider: Breakdown[];
  byModel: Breakdown[];
  byFeature: Breakdown[];
  topArticles: ArticleRow[];
  dailyCost: DailyPoint[];
}

const MONTHS_ID = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const fmtDayShort = (d: string) => { const [, m, day] = d.split("-"); return `${+day}/${+m}`; };
const fmtDayFull = (d: string) => { const [y, m, day] = d.split("-"); return `${+day} ${MONTHS_ID[+m]} ${y}`; };

const idrFmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("id-ID");
const rp = (n: number) => idrFmt.format(n || 0);
const num = (n: number) => numFmt.format(n || 0);

const BAR_COLORS = ["#002045", "#b7102a", "#1a7f37", "#9a6700", "#3730a3"];

// Friendly platform names. "unknown" = rows logged before provider was recorded.
const PROVIDER_LABEL: Record<string, string> = {
  perplexity: "Perplexity",
  anthropic: "Claude (Anthropic)",
  deepseek: "DeepSeek",
  unknown: "Legacy (sebelum pelacakan)",
};
const providerLabel = (k: string) => PROVIDER_LABEL[k] || k;

type Scope = "all" | "perplexity" | "anthropic" | "deepseek";

export default function AiUsageTab() {
  const [scope, setScope] = useState<Scope>("all");
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

  const isAll = scope === "all";
  const SCOPES: { key: Scope; label: string }[] = [
    { key: "all", label: "Ringkasan" },
    { key: "perplexity", label: "Perplexity" },
    { key: "anthropic", label: "Claude" },
    { key: "deepseek", label: "DeepSeek" },
  ];

  return (
    <div className="space-y-5">
      {/* Scope toggle + live rate */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-lg border border-border bg-surface-secondary p-1">
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
          <span className="text-right text-xs text-txt-muted">
            Kurs USD→IDR: <strong className="text-txt-secondary">{rp(stats.usdIdrRate)}</strong>{" "}
            {stats.usdIdrManual ? "(manual)" : "(realtime · auto)"}
            <br />
            <span className="text-txt-muted/80">Biaya tiap pemakaian dikunci pada kurs saat itu — total historis tak berubah.</span>
          </span>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 size={24} className="mx-auto animate-spin text-primary" /></div>
      ) : !stats || stats.totals.totalRequests === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-txt-secondary">
          Belum ada data penggunaan AI untuk cakupan ini.
          <p className="mt-1 text-xs text-txt-muted">
            Biaya per panggilan mulai tercatat sejak fitur ini aktif — buat artikel dengan &quot;Riset &amp; Tulis&quot; untuk mengisinya.
          </p>
        </div>
      ) : (
        <>
          {/* Headline — money + volume (combinable). Token total only shown per single platform. */}
          <div className={`grid grid-cols-2 gap-3 ${isAll ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
            {!isAll && <Card icon={<Hash size={16} />} label="Total Token" value={num(stats.totals.totalTokens)} />}
            <Card icon={<Coins size={16} />} label="Total Biaya" value={rp(stats.totals.totalCostIdr)} accent />
            <Card icon={<TrendingUp size={16} />} label="Total Request" value={num(stats.totals.totalRequests)} />
            <Card icon={<FileText size={16} />} label="Artikel Terlacak" value={num(stats.perArticle.count)} />
          </div>

          {/* Daily cost trend */}
          {stats.dailyCost.length > 1 && (
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <h4 className="mb-4 text-sm font-bold text-txt-primary">Tren Biaya Harian (Rp)</h4>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={stats.dailyCost} margin={{ left: 8, right: 16, top: 8 }}>
                  <defs>
                    <linearGradient id="aiCostGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#002045" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#002045" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtDayShort} fontSize={11} minTickGap={24} />
                  <YAxis tickFormatter={(v) => num(v as number)} fontSize={11} width={64} />
                  <Tooltip formatter={(v) => rp(v as number)} labelFormatter={(l) => fmtDayFull(l as string)} />
                  <Area type="monotone" dataKey="costIdr" stroke="#002045" strokeWidth={2} fill="url(#aiCostGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Ringkasan only: per-platform separation (tokens are NOT summed across platforms) */}
          {isAll && stats.byProvider.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <div className="mb-1 flex items-center gap-2">
                <Bot size={18} className="text-primary" />
                <h4 className="text-sm font-bold text-txt-primary">Rincian per Platform</h4>
              </div>
              <p className="mb-4 text-xs text-txt-muted">
                Token tiap platform dipisah (tidak dijumlahkan) karena jenis & harga token berbeda. Biaya (Rp) bisa dibandingkan.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stats.byProvider.map((p) => (
                  <div key={p.key} className="rounded-lg border border-border bg-surface-secondary p-4">
                    <p className="text-sm font-bold text-txt-primary">{providerLabel(p.key)}</p>
                    <div className="mt-2 space-y-1 text-sm">
                      <Row label="Biaya" value={rp(p.costIdr)} strong />
                      <Row label="Token" value={num(p.tokens)} />
                      <Row label="Request" value={num(p.requests)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-article analysis */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
            <div className="mb-3 flex items-center gap-2">
              <FileText size={18} className="text-primary" />
              <h4 className="text-sm font-bold text-txt-primary">Analisis per Artikel</h4>
              <span className="text-xs text-txt-muted">(gabungan semua panggilan AI per judul)</span>
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
            Biaya dihitung dari tarif token resmi per platform (Perplexity Sonar, Claude, DeepSeek) + biaya per-request
            pencarian Perplexity, dikonversi ke Rupiah pada kurs saat pemakaian. Total USD: ${stats.totals.totalCostUsd.toFixed(4)}.
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

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-txt-muted">{label}</span>
      <span className={strong ? "font-bold text-primary" : "font-medium text-txt-primary"}>{value}</span>
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
