"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

/* ── Types ── */
interface TickerItem { title: string; href: string; hot?: boolean; category?: string | null }
interface StockItem {
  symbol: string; price: number; prevClose: number;
  change: number; changePercent: number; direction: "up" | "down" | "flat";
  unit?: string;
}

function fmtPrice(p: number, sym: string): string {
  // BTC: 1 coin in IDR is in the billions → compact "M" (miliar) / "jt" (juta).
  if (sym === "BTC") {
    if (p >= 1_000_000_000) return "Rp " + (p / 1_000_000_000).toFixed(2) + " M";
    if (p >= 1_000_000) return "Rp " + (p / 1_000_000).toFixed(1) + " jt";
    return "Rp " + p.toLocaleString("id-ID", { maximumFractionDigits: 0 });
  }
  // MINYAK: per barrel in IDR ~Rp 1.7 jt → use "jt" suffix when ≥1 jt.
  if (sym === "MINYAK") {
    if (p >= 1_000_000) return "Rp " + (p / 1_000_000).toFixed(2) + " jt";
    return "Rp " + p.toLocaleString("id-ID", { maximumFractionDigits: 0 });
  }
  // EMAS: now per gram (~Rp 2,5 jt) — show full integer Rupiah.
  if (sym === "EMAS") return "Rp " + Math.round(p).toLocaleString("id-ID");
  if (sym === "USD/IDR") return "Rp " + p.toLocaleString("id-ID", { maximumFractionDigits: 0 });
  if (p >= 1000) return p.toLocaleString("id-ID", { maximumFractionDigits: 0 });
  return p.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtChange(c: number, sym: string): string {
  // Big absolute changes (Rp puluhan ribu+ for converted commodities & USD/IDR)
  // → integer with locale separators. Small (saham, %) → 2 decimals.
  const sign = c >= 0 ? "+" : "";
  const isLargeIdr = ["BTC", "EMAS", "MINYAK", "USD/IDR"].includes(sym);
  if (isLargeIdr) {
    if (Math.abs(c) >= 1_000_000) return sign + (c / 1_000_000).toFixed(2) + " jt";
    return sign + Math.round(c).toLocaleString("id-ID");
  }
  return sign + c.toFixed(2);
}

/* ── Hooks ── */
function useStocks() {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [lastUpdate, setLastUpdate] = useState("");

  const fetchStocks = useCallback(async () => {
    try {
      const res = await fetch("/api/stocks", { cache: "no-store" });
      if (!res.ok) throw new Error("err");
      const json = await res.json();
      // /api/stocks returns { success, data: { stocks, updatedAt, usdIdrRate } }.
      // Older shape was { data: [...] } directly, so tolerate both: prefer
      // the nested .stocks, fall back to a bare array if the API ever
      // reverts to the legacy shape.
      const data: StockItem[] = Array.isArray(json.data?.stocks)
        ? json.data.stocks
        : Array.isArray(json.data)
        ? json.data
        : [];
      if (data.length > 0) {
        setStocks(data.map((s: StockItem) => ({
          ...s,
          direction: s.change > 0.001 ? "up" as const : s.change < -0.001 ? "down" as const : "flat" as const,
        })));
        setLastUpdate(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      }
    } catch { /* keep existing */ }
  }, []);

  useEffect(() => { fetchStocks(); const i = setInterval(fetchStocks, 15000); return () => clearInterval(i); }, [fetchStocks]);
  return { stocks, lastUpdate };
}

function useTrending() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const fetchTrending = useCallback(() => {
    fetch("/api/trending").then((r) => r.json()).then((json) => {
      const data = json.data || json || [];
      if (Array.isArray(data) && data.length > 0) {
        setItems(data.map((t: { label?: string; href?: string; hot?: boolean; category?: string }) => ({
          title: t.label || "", href: t.href || "/search", hot: t.hot || false, category: t.category || null,
        })));
      }
    }).catch(() => {});
  }, []);
  useEffect(() => {
    fetchTrending();
    const i = setInterval(fetchTrending, 7200000); // refresh every 2 hours
    return () => clearInterval(i);
  }, [fetchTrending]);
  return items;
}

/* ── Stock Card ── */
function StockCard({ s }: { s: StockItem }) {
  return (
    <div className={`shrink-0 rounded-lg sm:rounded-lg px-3 py-2 sm:px-4 sm:py-3 min-w-[120px] sm:min-w-[170px] border shadow-[0_2px_10px_-4px_rgba(0,0,0,0.08)] hover:shadow-[0_6px_14px_-4px_rgba(0,0,0,0.12)] transition-all hover:-translate-y-0.5 relative overflow-hidden group cursor-default ${
      s.direction === "up" ? "bg-emerald-50/60 border-emerald-100" : s.direction === "down" ? "bg-red-50/60 border-red-100" : "bg-gray-50/60 border-gray-100"
    }`}>
      {/* Decorative top accent line */}
      <div className={`absolute top-0 left-0 w-full h-0.5 sm:h-1 transition-colors ${
        s.direction === "up" ? "bg-emerald-500" : s.direction === "down" ? "bg-red-500" : "bg-gray-300"
      }`} />

      <div className="flex items-start justify-between mb-1.5 sm:mb-2 mt-0.5 gap-1">
        <div className="min-w-0">
          <span className="block text-label-sm sm:text-label-md font-bold text-gray-600 group-hover:text-gray-900 transition-colors leading-tight">{s.symbol}</span>
          {s.unit && (
            <span className="block text-[9px] sm:text-[10px] text-gray-400 leading-tight font-medium mt-0.5 truncate">
              {s.unit}
            </span>
          )}
        </div>
        <div className={`shrink-0 p-0.5 sm:p-1 rounded-md transition-colors ${
          s.direction === "up" ? "bg-emerald-50 text-emerald-600" : s.direction === "down" ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"
        }`}>
          {s.direction === "up" ? <ArrowUpRight size={12} strokeWidth={2.5} className="sm:hidden" /> :
           s.direction === "down" ? <ArrowDownRight size={12} strokeWidth={2.5} className="sm:hidden" /> :
           <Minus size={12} strokeWidth={2.5} className="sm:hidden" />}
          {s.direction === "up" ? <ArrowUpRight size={14} strokeWidth={2.5} className="hidden sm:block" /> :
           s.direction === "down" ? <ArrowDownRight size={14} strokeWidth={2.5} className="hidden sm:block" /> :
           <Minus size={14} strokeWidth={2.5} className="hidden sm:block" />}
        </div>
      </div>

      <div className="text-title-md sm:text-title-lg font-mono font-bold text-gray-900 leading-none tracking-tight">{fmtPrice(s.price, s.symbol)}</div>

      <div className="mt-1.5 sm:mt-2.5 flex items-center gap-1 sm:gap-1.5">
        <span className={`text-[10px] sm:text-label-sm font-mono font-bold ${
          s.direction === "up" ? "text-emerald-600" : s.direction === "down" ? "text-red-600" : "text-gray-500"
        }`}>
          {fmtChange(s.change, s.symbol)}
        </span>
        <span className={`text-[9px] sm:text-[11px] font-mono font-bold px-1 sm:px-1.5 py-0.5 rounded-[4px] ${
          s.direction === "up" ? "bg-emerald-50 text-emerald-600" : s.direction === "down" ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"
        }`}>
          {s.changePercent >= 0 ? "+" : ""}{s.changePercent.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

/* ── Stock Carousel — CSS animation + touch pause ── */
function StockCarousel({ stocks, lastUpdate }: { stocks: StockItem[]; lastUpdate: string }) {
  const [paused, setPaused] = useState(false);

  // Empty-state skeleton: render the Market chrome immediately so SSR + the
  // first paint after hydration still show "Market • Live …" even before
  // the /api/stocks call resolves. Without this, the entire ticker is
  // invisible until the first fetch completes (and stays invisible if the
  // API call fails for any reason).
  if (stocks.length === 0) {
    return (
      <div className="bg-gray-50/30 border-b border-gray-100 overflow-hidden">
        <div className="container-main py-2 sm:py-3 lg:py-4">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-label-sm sm:text-label-md font-bold uppercase tracking-widest text-gray-500">Market</span>
              <span className="hidden sm:inline text-label-sm text-gray-400">Live</span>
            </div>
            <span className="text-[10px] sm:text-label-sm text-gray-400 font-mono">Memuat…</span>
          </div>
        </div>
        <div className="relative">
          <div className="flex gap-2 sm:gap-2.5 pl-5 sm:pl-8 pr-5 sm:pr-8 pb-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 rounded-lg sm:rounded-lg min-w-[120px] sm:min-w-[170px] h-[68px] sm:h-[88px] bg-gray-100/70 animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const duration = stocks.length * 12; // ~12s per card

  return (
    <div
      className="bg-gray-50/30 border-b border-gray-100 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div className="container-main py-2 sm:py-3 lg:py-4">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-label-sm sm:text-label-md font-bold uppercase tracking-widest text-gray-500">Market</span>
            <span className="hidden sm:inline text-label-sm text-gray-400">Live</span>
          </div>
          {lastUpdate && <span className="text-[10px] sm:text-label-sm text-gray-400 font-mono">Update {lastUpdate} WIB</span>}
        </div>
      </div>

      <div className="relative">
        <div
          className="flex gap-2 sm:gap-2.5 w-max"
          style={{
            animation: `stockScroll ${duration}s linear infinite`,
            animationPlayState: paused ? "paused" : "running",
          }}
        >
          {/* Set 1 */}
          <div className="flex gap-2 sm:gap-2.5 pl-5 sm:pl-8">
            {stocks.map((s) => <StockCard key={`a-${s.symbol}`} s={s} />)}
          </div>
          {/* Set 2 (duplicate for seamless loop) */}
          <div className="flex gap-2 sm:gap-2.5">
            {stocks.map((s) => <StockCard key={`b-${s.symbol}`} s={s} />)}
          </div>
        </div>
      </div>

      <div className="h-3" />

      <style jsx>{`
        @keyframes stockScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

/* ── Main Component ── */
export default function NewsTicker() {
  const trendingItems = useTrending();
  const { stocks, lastUpdate } = useStocks();

  // Trending: duplicate for CSS infinite scroll
  const looped = trendingItems.length > 0 ? [...trendingItems, ...trendingItems] : [];
  const trendDuration = Math.max(trendingItems.length * 10, 60); // slow: ~10s per tag

  return (
    <>
      {/* ═══ TRENDING INDONESIA ═══
          Selalu render shell-nya (Trending pill + bar gelap) supaya
          chrome ticker langsung kelihatan di SSR + first paint, walau
          /api/trending belum balas atau kosong. Konten geser baru
          aktif setelah trendingItems terisi. */}
      <div className="bg-primary border-b border-[#001530] overflow-hidden">
        <div className="flex items-center py-2 sm:py-2.5 lg:py-3 relative">
          <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 z-10 bg-primary shadow-[8px_0_12px_-2px_#002045]">
            <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-secondary animate-pulse shrink-0" />
            <span className="text-label-sm sm:text-label-md font-bold tracking-widest text-white uppercase whitespace-nowrap">
              Trending
            </span>
          </div>
          {looped.length === 0 ? (
            <div className="flex-1 overflow-hidden pl-2 pr-3 sm:pr-6">
              <span className="text-body-sm sm:text-body-md font-medium text-white/40 whitespace-nowrap">Memuat trending…</span>
            </div>
          ) : (
            // CSS infinite scroll
            <div className="flex-1 overflow-hidden">
              <div
                className="flex w-max hover:[animation-play-state:paused]"
                style={{ animation: `trendScroll ${trendDuration}s linear infinite` }}
              >
                {/* Set 1 */}
                <div className="flex items-center">
                  {trendingItems.map((item, i) => (
                    <Link key={`a-${i}`} href={item.href}
                      className="mx-2.5 sm:mx-5 inline-flex items-center gap-1.5 sm:gap-2 text-body-sm sm:text-body-md font-medium text-white/80 hover:text-white whitespace-nowrap transition-colors">
                      {item.hot && (
                        <span className="inline-flex items-center rounded-sm bg-secondary px-1 sm:px-1.5 py-0.5 text-[9px] font-bold text-white tracking-wider">HOT</span>
                      )}
                      {item.category && (
                        <span className="text-[10px] sm:text-label-sm font-bold text-blue-200/80 uppercase tracking-wider">{item.category}</span>
                      )}
                      <span className="h-1 w-1 rounded-full bg-white/20 shrink-0" />
                      {item.title}
                    </Link>
                  ))}
                </div>
                {/* Set 2 */}
                <div className="flex items-center">
                  {trendingItems.map((item, i) => (
                    <Link key={`b-${i}`} href={item.href}
                      className="mx-2.5 sm:mx-5 inline-flex items-center gap-1.5 sm:gap-2 text-body-sm sm:text-body-md font-medium text-white/80 hover:text-white whitespace-nowrap transition-colors">
                      {item.hot && (
                        <span className="inline-flex items-center rounded-sm bg-secondary px-1 sm:px-1.5 py-0.5 text-[9px] font-bold text-white tracking-wider">HOT</span>
                      )}
                      {item.category && (
                        <span className="text-[10px] sm:text-label-sm font-bold text-blue-200/80 uppercase tracking-wider">{item.category}</span>
                      )}
                      <span className="h-1 w-1 rounded-full bg-white/20 shrink-0" />
                      {item.title}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <style jsx>{`
          @keyframes trendScroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
      </div>

      {/* ═══ MARKET CAROUSEL ═══ */}
      <StockCarousel stocks={stocks} lastUpdate={lastUpdate} />
    </>
  );
}
