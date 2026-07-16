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
  const isUp = s.direction === "up";
  const isDown = s.direction === "down";

  return (
    <div className={`shrink-0 flex items-center gap-2 rounded-full px-3.5 py-1 sm:py-1.5 border shadow-sm transition-all hover:-translate-y-0.5 cursor-default text-[11px] sm:text-body-sm font-bold select-none ${
      isUp
        ? "bg-emerald-50/80 border-emerald-100 text-emerald-800"
        : isDown
        ? "bg-rose-50/80 border-rose-100 text-rose-800"
        : "bg-stone-50/80 border-stone-150 text-stone-800"
    }`}>
      {/* Symbol */}
      <span className="font-bold tracking-tight text-stone-900">{s.symbol}</span>
      
      {/* Price */}
      <span className="font-mono text-stone-700">{fmtPrice(s.price, s.symbol)}</span>

      {/* Change percentage */}
      <div className={`flex items-center gap-0.5 font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
        isUp ? "bg-emerald-500/10 text-emerald-700" : isDown ? "bg-rose-500/10 text-rose-700" : "bg-stone-500/10 text-stone-600"
      }`}>
        {isUp ? <ArrowUpRight size={10} strokeWidth={3} /> : isDown ? <ArrowDownRight size={10} strokeWidth={3} /> : <Minus size={10} strokeWidth={3} />}
        <span>{s.changePercent >= 0 ? "+" : ""}{s.changePercent.toFixed(2)}%</span>
      </div>
    </div>
  );
}

/* ── Stock Carousel — CSS animation + touch pause ── */
function StockCarousel({ stocks, lastUpdate }: { stocks: StockItem[]; lastUpdate: string }) {
  const [paused, setPaused] = useState(false);

  // Empty-state skeleton:
  if (stocks.length === 0) {
    return (
      <div className="bg-stone-50/50 border-b border-stone-200/40 py-2.5 overflow-hidden flex items-center gap-4">
        <div className="pl-4 sm:pl-6 flex items-center gap-2 shrink-0 border-r border-stone-200/80 pr-4">
          <span className="relative flex h-2 w-2">
            <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-stone-300"></span>
          </span>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400">Pasar Live</span>
        </div>
        <div className="relative flex-1 overflow-hidden">
          <div className="flex gap-2.5 pl-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 rounded-full min-w-[130px] h-[28px] sm:h-[32px] bg-stone-200/60 animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const duration = stocks.length * 10; // ~10s per card

  return (
    <div
      className="bg-stone-50/50 border-b border-stone-200/40 py-2.5 overflow-hidden flex items-center gap-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {/* Live Badge Left */}
      <div className="pl-4 sm:pl-6 flex items-center gap-2 shrink-0 border-r border-stone-200/80 pr-4 z-10">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-stone-500">Pasar Live</span>
      </div>

      {/* Scrolling Marquee */}
      <div className="relative flex-1 overflow-hidden">
        <div
          className="flex gap-2.5 w-max"
          style={{
            animation: `stockScroll ${duration}s linear infinite`,
            animationPlayState: paused ? "paused" : "running",
          }}
        >
          {/* Set 1 */}
          <div className="flex gap-2.5">
            {stocks.map((s) => <StockCard key={`a-${s.symbol}`} s={s} />)}
          </div>
          {/* Set 2 (duplicate for seamless loop) */}
          <div className="flex gap-2.5">
            {stocks.map((s) => <StockCard key={`b-${s.symbol}`} s={s} />)}
          </div>
        </div>
      </div>

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
  const trendDuration = Math.max(trendingItems.length * 10, 60);

  return (
    <>
      {/* ═══ TRENDING INDONESIA ═══ */}
      <div className="bg-primary border-b border-primary-dark/35 overflow-hidden">
        <div className="flex items-center py-2 sm:py-2.5 relative">
          <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 z-10 bg-primary shadow-[6px_0_10px_-2px_rgba(0,0,0,0.15)]">
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
                      className="mx-2.5 sm:mx-5 inline-flex items-center gap-1.5 sm:gap-2 text-body-sm sm:text-body-md font-semibold text-white/90 hover:text-white whitespace-nowrap transition-colors">
                      {item.hot && (
                        <span className="inline-flex items-center rounded-sm bg-secondary px-1 sm:px-1.5 py-0.5 text-[9px] font-bold text-white tracking-wider">HOT</span>
                      )}
                      {item.category && (
                        <span className="text-[10px] sm:text-label-sm font-bold text-purple-300 uppercase tracking-wider">{item.category}</span>
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
                      className="mx-2.5 sm:mx-5 inline-flex items-center gap-1.5 sm:gap-2 text-body-sm sm:text-body-md font-semibold text-white/90 hover:text-white whitespace-nowrap transition-colors">
                      {item.hot && (
                        <span className="inline-flex items-center rounded-sm bg-secondary px-1 sm:px-1.5 py-0.5 text-[9px] font-bold text-white tracking-wider">HOT</span>
                      )}
                      {item.category && (
                        <span className="text-[10px] sm:text-label-sm font-bold text-purple-300 uppercase tracking-wider">{item.category}</span>
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
