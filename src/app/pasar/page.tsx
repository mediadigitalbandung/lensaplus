import type { Metadata } from "next";
import { ArrowUpRight, ArrowDownRight, Minus, RefreshCw } from "lucide-react";
import MarketGrid from "@/components/pasar/MarketGrid";
import MoversList from "@/components/pasar/MoversList";
import type { MarketCardProps } from "@/components/pasar/MarketCard";
import type { MoverItem } from "@/components/pasar/MoversList";

export const revalidate = 60;

// ─── Metadata ────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Pasar & Bursa — IHSG, Forex, Komoditas, Kripto Terkini | Lensaplus",
  description:
    "Data pasar real-time: IHSG, kurs USD/IDR/EUR/SGD/JPY/CNY, harga emas, minyak, Bitcoin, Ethereum. Update otomatis tiap menit.",
  openGraph: {
    title: "Pasar & Bursa — IHSG, Forex, Komoditas, Kripto | Lensaplus",
    description:
      "Data pasar real-time: IHSG, kurs USD/IDR/EUR/SGD/JPY/CNY, harga emas, minyak, Bitcoin, Ethereum.",
    type: "website",
    url: "https://lensaplus.com/pasar",
    siteName: "Lensaplus",
  },
  alternates: { canonical: "https://lensaplus.com/pasar" },
  robots: { index: true, follow: true },
};

// ─── Types matching /api/market response ────────────────────────────────────

interface IhsgData {
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
}

interface ForexItem {
  label: string;
  base: string;
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
  currency: string;
}

interface GoldData {
  label: string;
  usdPerOz: number;
  idrPerGram: number;
  prevIdrPerGram: number;
  change: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
}

interface OilData {
  label: string;
  usdPerBarrel: number;
  change: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
}

interface CryptoItem {
  symbol: string;
  label: string;
  priceUsd: number;
  priceIdr: number;
  change: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
}

interface MarketData {
  ihsg: IhsgData | null;
  forex: ForexItem[];
  commodity: { gold: GoldData; oil: OilData };
  crypto: CryptoItem[];
  movers: { gainers: MoverItem[]; losers: MoverItem[] };
  usdIdrRate: number;
  updatedAt: string;
  source: string;
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

async function getMarketData(): Promise<MarketData | null> {
  try {
    // Call the route handler logic directly via Yahoo Finance (same origin
    // fetch would require absolute URL in RSC — use internal URL pattern).
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lensaplus.com";
    const res = await fetch(`${baseUrl}/api/market`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtIdr(n: number, opts?: { compact?: boolean }): string {
  if (opts?.compact) {
    if (n >= 1_000_000_000) return "Rp " + (n / 1_000_000_000).toFixed(2) + " M";
    if (n >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(2) + " jt";
  }
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

function fmtUsd(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function DirectionBadge({ dir, pct }: { dir: "up" | "down" | "flat"; pct: number }) {
  const sign = pct >= 0 ? "+" : "";
  if (dir === "up") return (
    <span className="inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-label-md font-mono font-bold bg-emerald-50 text-emerald-700">
      <ArrowUpRight size={14} strokeWidth={2.5} />{sign}{pct.toFixed(2)}%
    </span>
  );
  if (dir === "down") return (
    <span className="inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-label-md font-mono font-bold bg-red-50 text-red-700">
      <ArrowDownRight size={14} strokeWidth={2.5} />{pct.toFixed(2)}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-label-md font-mono font-bold bg-gray-100 text-gray-600">
      <Minus size={14} strokeWidth={2.5} />{sign}{pct.toFixed(2)}%
    </span>
  );
}

// ─── JSON-LD ─────────────────────────────────────────────────────────────────

function JsonLd({ updatedAt }: { updatedAt: string }) {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://lensaplus.com/pasar",
        url: "https://lensaplus.com/pasar",
        name: "Pasar & Bursa — IHSG, Forex, Komoditas, Kripto | Lensaplus",
        description:
          "Data pasar real-time: IHSG, kurs USD/IDR/EUR/SGD/JPY/CNY, harga emas, minyak, Bitcoin, Ethereum.",
        inLanguage: "id",
        publisher: {
          "@type": "Organization",
          name: "Lensaplus",
          url: "https://lensaplus.com",
        },
        dateModified: updatedAt,
      },
      {
        "@type": "Dataset",
        "@id": "https://lensaplus.com/pasar#dataset",
        name: "Data Pasar Keuangan Indonesia",
        description:
          "IHSG, kurs valuta asing, harga emas, minyak, dan kripto. Bersumber dari Yahoo Finance.",
        url: "https://lensaplus.com/pasar",
        creator: { "@type": "Organization", name: "Lensaplus" },
        distribution: [
          {
            "@type": "DataDownload",
            contentUrl: "https://lensaplus.com/api/market",
            encodingFormat: "application/json",
          },
        ],
        temporalCoverage: "2024/..",
        variableMeasured: ["IHSG", "USD/IDR", "EUR/IDR", "Gold", "Brent Crude", "BTC-USD", "ETH-USD"],
        license: "https://creativecommons.org/licenses/by/4.0/",
        dateModified: updatedAt,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PasarPage() {
  const data = await getMarketData();

  // Format update time for display
  const updatedAt = data?.updatedAt ?? new Date().toISOString();
  const updateDisplay = new Date(updatedAt).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // ── Forex cards ──────────────────────────────────────────────────────────
  const forexCards: MarketCardProps[] = (data?.forex ?? []).map((f) => ({
    label: f.label,
    sublabel: `1 ${f.base} dalam IDR`,
    primary: fmtIdr(f.price),
    change: f.change,
    changePercent: f.changePercent,
    direction: f.direction,
  }));

  // ── Commodity cards ──────────────────────────────────────────────────────
  const goldData = data?.commodity.gold;
  const oilData = data?.commodity.oil;

  const commodityCards: MarketCardProps[] = [
    ...(goldData
      ? [
          {
            label: "Emas",
            sublabel: "IDR/gram",
            primary: fmtIdr(goldData.idrPerGram),
            secondary: `${fmtUsd(goldData.usdPerOz)}/oz`,
            change: goldData.change,
            changePercent: goldData.changePercent,
            direction: goldData.direction,
          } satisfies MarketCardProps,
        ]
      : []),
    ...(oilData
      ? [
          {
            label: "Minyak Brent",
            sublabel: "USD/barrel",
            primary: fmtUsd(oilData.usdPerBarrel),
            change: oilData.change,
            changePercent: oilData.changePercent,
            direction: oilData.direction,
          } satisfies MarketCardProps,
        ]
      : []),
  ];

  // ── Crypto cards ─────────────────────────────────────────────────────────
  const cryptoCards: MarketCardProps[] = (data?.crypto ?? []).map((c) => ({
    label: c.label,
    sublabel: `${c.symbol}/USD`,
    primary: fmtUsd(c.priceUsd),
    secondary: c.priceIdr > 0 ? fmtIdr(c.priceIdr, { compact: true }) : undefined,
    change: c.change,
    changePercent: c.changePercent,
    direction: c.direction,
  }));

  // ── IHSG hero values ─────────────────────────────────────────────────────
  const ihsg = data?.ihsg;
  const ihsgPriceStr = ihsg
    ? ihsg.price.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "–";

  return (
    <>
      <JsonLd updatedAt={updatedAt} />

      <main className="container-main py-8 sm:py-10 lg:py-12" id="main-content">
        {/* ── Page header ────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6 sm:mb-8">
          <div>
            <h1 className="headline-lg font-serif font-bold text-on-surface tracking-tight">
              Pasar &amp; Bursa
            </h1>
            <p className="text-body-md text-on-surface-variant mt-1">
              Data pasar keuangan terkini — IHSG, forex, komoditas, dan kripto.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
            <RefreshCw size={12} className="shrink-0" />
            <span>
              {data
                ? <>Update: {updateDisplay} WIB &bull; Delay ~15 mnt</>
                : "Tidak dapat memuat data"}
            </span>
          </div>
        </div>

        {/* ── IHSG Hero card ─────────────────────────────────────────────── */}
        <section aria-labelledby="ihsg-heading" className="mb-8">
          <div
            className={`card px-5 sm:px-8 py-6 sm:py-8 relative overflow-hidden border-l-4 ${
              ihsg?.direction === "up"
                ? "border-l-emerald-500"
                : ihsg?.direction === "down"
                ? "border-l-red-500"
                : "border-l-gray-300"
            }`}
          >
            {/* Background tint */}
            <div
              className={`absolute inset-0 pointer-events-none ${
                ihsg?.direction === "up"
                  ? "bg-emerald-50/30"
                  : ihsg?.direction === "down"
                  ? "bg-red-50/30"
                  : "bg-gray-50/20"
              }`}
            />
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-2 w-2 rounded-full bg-secondary animate-pulse shrink-0" />
                    <h2
                      id="ihsg-heading"
                      className="text-label-md font-bold uppercase tracking-widest text-on-surface-variant"
                    >
                      IHSG
                    </h2>
                    <span className="text-label-sm text-on-surface-variant">
                      — Indeks Harga Saham Gabungan
                    </span>
                  </div>

                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="display-md font-mono font-bold text-on-surface tracking-tight">
                      {ihsgPriceStr}
                    </span>
                    {ihsg && <DirectionBadge dir={ihsg.direction} pct={ihsg.changePercent} />}
                  </div>

                  {ihsg && (
                    <p className="mt-1.5 text-body-sm text-on-surface-variant font-mono">
                      Perubahan:{" "}
                      <span
                        className={
                          ihsg.direction === "up"
                            ? "text-emerald-700"
                            : ihsg.direction === "down"
                            ? "text-red-700"
                            : "text-gray-600"
                        }
                      >
                        {ihsg.change >= 0 ? "+" : ""}
                        {ihsg.change.toFixed(2)}
                      </span>{" "}
                      poin &bull; Prev close:{" "}
                      {ihsg.prevClose.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                </div>

                {/* Mini sparkline placeholder — inline SVG, no external lib */}
                {ihsg && (
                  <div className="hidden sm:block" aria-hidden="true">
                    <SparklineSvg direction={ihsg.direction} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Forex ──────────────────────────────────────────────────────── */}
        {forexCards.length > 0 && (
          <div className="mb-8">
            <MarketGrid
              title="Kurs Valuta Asing"
              items={forexCards}
              cols={forexCards.length >= 5 ? 5 : (forexCards.length as 2 | 3 | 4)}
            />
          </div>
        )}

        {/* ── Top Movers IDX ─────────────────────────────────────────────── */}
        {(data?.movers.gainers.length ?? 0) > 0 || (data?.movers.losers.length ?? 0) > 0 ? (
          <section aria-labelledby="movers-heading" className="mb-8">
            <h2 id="movers-heading" className="section-title mb-4">
              Top Movers IDX
            </h2>
            <MoversList
              gainers={data?.movers.gainers ?? []}
              losers={data?.movers.losers ?? []}
            />
          </section>
        ) : null}

        {/* ── Commodity ──────────────────────────────────────────────────── */}
        {commodityCards.length > 0 && (
          <div className="mb-8">
            <MarketGrid title="Komoditas" items={commodityCards} cols={2} />
          </div>
        )}

        {/* ── Crypto ─────────────────────────────────────────────────────── */}
        {cryptoCards.length > 0 && (
          <div className="mb-8">
            <MarketGrid title="Aset Kripto" items={cryptoCards} cols={2} />
          </div>
        )}

        {/* ── No data fallback ───────────────────────────────────────────── */}
        {!data && (
          <div className="card px-6 py-12 text-center">
            <p className="text-body-lg text-on-surface-variant">
              Data pasar tidak dapat dimuat saat ini. Silakan coba beberapa saat lagi.
            </p>
          </div>
        )}

        {/* ── Footer note ────────────────────────────────────────────────── */}
        <div className="mt-2 pt-4 border-t border-border text-center">
          <p className="text-label-sm text-on-surface-variant">
            Sumber: Yahoo Finance &bull; Data tertunda ~15 menit &bull; Bukan merupakan saran investasi.
          </p>
        </div>
      </main>
    </>
  );
}

// ─── Inline sparkline SVG (decorative, no external lib) ──────────────────────

function SparklineSvg({ direction }: { direction: "up" | "down" | "flat" }) {
  // Simulate a 7-point sparkline shape based on direction for visual cue
  const upPath = "M0,50 L16,42 L32,38 L48,30 L64,22 L80,18 L96,10";
  const downPath = "M0,10 L16,18 L32,22 L48,30 L64,38 L80,42 L96,50";
  const flatPath = "M0,30 L16,28 L32,32 L48,30 L64,29 L80,31 L96,30";

  const pathD = direction === "up" ? upPath : direction === "down" ? downPath : flatPath;
  const stroke =
    direction === "up" ? "#059669" : direction === "down" ? "#dc2626" : "#9ca3af";

  return (
    <svg
      width="96"
      height="60"
      viewBox="0 0 96 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
    >
      <path d={pathD} stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx="96"
        cy={direction === "up" ? "10" : direction === "down" ? "50" : "30"}
        r="3.5"
        fill={stroke}
      />
    </svg>
  );
}
