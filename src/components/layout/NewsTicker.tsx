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
  if (!Number.isFinite(p)) return "-";
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

/* ── Hooks ── */
function useStocks() {
  const [stocks, setStocks] = useState<StockItem[]>([]);

  const fetchStocks = useCallback(async () => {
    try {
      const res = await fetch("/api/stocks", { cache: "no-store" });
      if (!res.ok) throw new Error("err");
      const json = await res.json();
      // /api/stocks returns { success, data: { stocks, updatedAt, usdIdrRate } }.
      // Older shape was { data: [...] } directly, so tolerate both.
      const data: StockItem[] = Array.isArray(json.data?.stocks)
        ? json.data.stocks
        : Array.isArray(json.data)
        ? json.data
        : [];
      if (data.length > 0) {
        setStocks(
          data
            .filter((s) => s && typeof s.symbol === "string" && Number.isFinite(s.price))
            .map((s: StockItem) => ({
              ...s,
              changePercent: Number.isFinite(s.changePercent) ? s.changePercent : 0,
              direction: s.change > 0.001 ? "up" as const : s.change < -0.001 ? "down" as const : "flat" as const,
            }))
        );
      }
    } catch { /* keep existing */ }
  }, []);

  useEffect(() => { fetchStocks(); const i = setInterval(fetchStocks, 15000); return () => clearInterval(i); }, [fetchStocks]);
  return stocks;
}

function useTrending() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const fetchTrending = useCallback(() => {
    fetch("/api/trending")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json) return;
        const data = json.data || json || [];
        if (Array.isArray(data) && data.length > 0) {
          setItems(
            data
              .filter((t: { label?: string }) => typeof t?.label === "string" && t.label.trim().length > 0)
              .map((t: { label?: string; href?: string; hot?: boolean; category?: string }) => ({
                title: t.label || "",
                href: t.href || "/search",
                hot: Boolean(t.hot),
                category: t.category || null,
              }))
          );
        }
      })
      .catch(() => {});
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
  const pct = Number.isFinite(s.changePercent) ? s.changePercent : 0;

  return (
    <div className="shrink-0 flex items-center gap-2 rounded-md px-3 py-1 sm:py-1.5 border border-stone-200 bg-white transition-colors hover:border-stone-300 cursor-default text-[11px] sm:text-body-sm font-bold select-none">
      {/* Symbol */}
      <span className="font-bold tracking-tight text-stone-900">{s.symbol}</span>

      {/* Price */}
      <span className="font-mono text-stone-700">{fmtPrice(s.price, s.symbol)}</span>

      {/* Change percentage — plain colored text + arrow, no highlight background */}
      <span className={`inline-flex items-center gap-0.5 font-mono text-[10px] ${
        isUp ? "text-emerald-700" : isDown ? "text-rose-700" : "text-stone-600"
      }`}>
        {isUp ? <ArrowUpRight size={10} strokeWidth={2.5} aria-hidden="true" /> : isDown ? <ArrowDownRight size={10} strokeWidth={2.5} aria-hidden="true" /> : <Minus size={10} strokeWidth={2.5} aria-hidden="true" />}
        <span>{pct >= 0 ? "+" : ""}{pct.toFixed(2)}%</span>
      </span>
    </div>
  );
}

/* ── Stock Carousel — CSS animation + touch pause ── */
function StockCarousel({ stocks }: { stocks: StockItem[] }) {
  const [paused, setPaused] = useState(false);

  // Empty-state skeleton:
  if (stocks.length === 0) {
    return (
      <div className="bg-stone-50/50 border-b border-stone-200/40 py-2.5 overflow-hidden flex items-center gap-4">
        <div className="pl-4 sm:pl-6 flex items-center gap-2 shrink-0 border-r border-stone-200/80 pr-4">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-stone-300"></span>
          </span>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-stone-500">Pasar Live</span>
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
          <div className="flex gap-2.5" aria-hidden="true">
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
  const stocks = useStocks();

  // Trending: duplicate for CSS infinite scroll
  const looped = trendingItems.length > 0 ? [...trendingItems, ...trendingItems] : [];
  const trendDuration = Math.max(trendingItems.length * 10, 60);

  return (
    <>
      {/* ═══ TRENDING INDONESIA ═══ */}
      <div className="bg-stone-950 border-b border-stone-800/80 overflow-hidden">
        <div className="flex items-center py-2 sm:py-2.5 relative">
          <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 z-10 bg-stone-950 shadow-[6px_0_10px_-2px_rgba(0,0,0,0.4)]">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse shrink-0" aria-hidden="true" />
            <span className="text-label-sm sm:text-label-md font-bold tracking-widest text-white uppercase whitespace-nowrap">
              Trending
            </span>
          </div>
          {looped.length === 0 ? (
            <div className="flex-1 overflow-hidden pl-2 pr-3 sm:pr-6">
              <span className="text-body-sm sm:text-body-md font-medium text-white/60 whitespace-nowrap">Memuat trending…</span>
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
                        <span className="text-[10px] font-extrabold text-secondary tracking-widest uppercase">HOT</span>
                      )}
                      {item.category && (
                        <span className="text-[10px] sm:text-label-sm font-bold text-purple-300 uppercase tracking-wider">{item.category}</span>
                      )}
                      <span className="h-1 w-1 rounded-full bg-white/20 shrink-0" aria-hidden="true" />
                      {item.title}
                    </Link>
                  ))}
                </div>
                {/* Set 2 */}
                <div className="flex items-center" aria-hidden="true">
                  {trendingItems.map((item, i) => (
                    <Link key={`b-${i}`} href={item.href} tabIndex={-1}
                      className="mx-2.5 sm:mx-5 inline-flex items-center gap-1.5 sm:gap-2 text-body-sm sm:text-body-md font-semibold text-white/90 hover:text-white whitespace-nowrap transition-colors">
                      {item.hot && (
                        <span className="text-[10px] font-extrabold text-secondary tracking-widest uppercase">HOT</span>
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
      <StockCarousel stocks={stocks} />
    </>
  );
}
