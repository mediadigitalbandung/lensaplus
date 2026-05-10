import { successResponse, errorResponse } from "@/lib/api-utils";

export const revalidate = 60; // ISR: revalidate every 60 seconds

const TROY_OZ_TO_GRAM = 31.1034768;

// Yahoo Finance symbols we need for the full market page
const QUOTE_SYMBOLS = [
  "^JKSE",       // IHSG
  "USDIDR=X",    // USD/IDR
  "EURIDR=X",    // EUR/IDR
  "SGDIDR=X",    // SGD/IDR
  "JPYIDR=X",    // JPY/IDR
  "CNYIDR=X",    // CNY/IDR
  "GC=F",        // Gold (USD/oz)
  "CL=F",        // Brent crude (USD/barrel)
  "BTC-USD",     // Bitcoin
  "ETH-USD",     // Ethereum
];

// Top IDX blue-chips for movers — we fetch live quotes for all, then sort
const IDX_SYMBOLS = [
  "BBCA.JK", "BBRI.JK", "BMRI.JK", "TLKM.JK", "ASII.JK",
  "UNVR.JK", "GOTO.JK", "BREN.JK", "AMMN.JK", "TOWR.JK",
  "ADRO.JK", "PGAS.JK", "ICBP.JK", "INDF.JK", "KLBF.JK",
  "EMTK.JK", "MTEL.JK", "SMGR.JK", "EXCL.JK", "TBIG.JK",
];

interface QuoteResult {
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  symbol?: string;
  shortName?: string;
  displayName?: string;
}

function direction(pct: number): "up" | "down" | "flat" {
  if (pct > 0.005) return "up";
  if (pct < -0.005) return "down";
  return "flat";
}

/**
 * Fetch dari Yahoo Finance. Return empty map saat gagal (Yahoo gradually
 * restrict v7 endpoint, kadang 401/429 untuk public access). UI graceful
 * degrade — show "data unavailable" hint, page tetap render struktur.
 */
async function fetchQuotes(symbols: string[]): Promise<Record<string, QuoteResult>> {
  try {
    const joined = symbols.join(",");
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${joined}&fields=regularMarketPrice,regularMarketPreviousClose,regularMarketChange,regularMarketChangePercent,shortName,displayName`;

    const res = await fetch(url, {
      headers: {
        // Browser-like UA tends to bypass Yahoo's bot guard better than Mozilla compat string.
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "application/json,text/plain,*/*",
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
        "Referer": "https://finance.yahoo.com/",
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      console.warn(`[market] Yahoo Finance returned ${res.status}, falling back to empty data`);
      return {};
    }

    const json = await res.json();
    const results: QuoteResult[] = json?.quoteResponse?.result ?? [];

    const map: Record<string, QuoteResult> = {};
    for (const r of results) {
      if (r.symbol) map[r.symbol] = r;
    }
    return map;
  } catch (e) {
    console.warn(`[market] Yahoo fetch error:`, (e as Error).message);
    return {};
  }
}

export async function GET() {
  try {
    // Fetch macro + forex + commodity + crypto in one call
    const [macroMap, idxMap] = await Promise.all([
      fetchQuotes(QUOTE_SYMBOLS),
      fetchQuotes(IDX_SYMBOLS),
    ]);

    // USD/IDR rate for conversions
    const usdIdr = macroMap["USDIDR=X"]?.regularMarketPrice ?? 0;

    // ─── IHSG ───────────────────────────────────────────────────────
    const ihsgQ = macroMap["^JKSE"];
    const ihsg = ihsgQ
      ? {
          price: ihsgQ.regularMarketPrice ?? 0,
          prevClose: ihsgQ.regularMarketPreviousClose ?? 0,
          change: Math.round((ihsgQ.regularMarketChange ?? 0) * 100) / 100,
          changePercent: Math.round((ihsgQ.regularMarketChangePercent ?? 0) * 100) / 100,
          direction: direction(ihsgQ.regularMarketChangePercent ?? 0),
        }
      : null;

    // ─── FOREX ──────────────────────────────────────────────────────
    const forexPairs: { symbol: string; label: string; base: string }[] = [
      { symbol: "USDIDR=X", label: "USD/IDR", base: "USD" },
      { symbol: "EURIDR=X", label: "EUR/IDR", base: "EUR" },
      { symbol: "SGDIDR=X", label: "SGD/IDR", base: "SGD" },
      { symbol: "JPYIDR=X", label: "JPY/IDR", base: "JPY" },
      { symbol: "CNYIDR=X", label: "CNY/IDR", base: "CNY" },
    ];

    const forex = forexPairs.map((p) => {
      const q = macroMap[p.symbol];
      if (!q) return null;
      const pct = q.regularMarketChangePercent ?? 0;
      return {
        label: p.label,
        base: p.base,
        price: Math.round((q.regularMarketPrice ?? 0) * 100) / 100,
        prevClose: Math.round((q.regularMarketPreviousClose ?? 0) * 100) / 100,
        change: Math.round((q.regularMarketChange ?? 0) * 100) / 100,
        changePercent: Math.round(pct * 100) / 100,
        direction: direction(pct),
        currency: "IDR",
      };
    }).filter(Boolean);

    // ─── COMMODITY ──────────────────────────────────────────────────
    const goldQ = macroMap["GC=F"];
    const oilQ = macroMap["CL=F"];

    // Gold: Yahoo gives USD/troy-oz → convert to IDR/gram
    const goldUsdOz = goldQ?.regularMarketPrice ?? 0;
    const goldPrevUsdOz = goldQ?.regularMarketPreviousClose ?? 0;
    const goldIdrGram = usdIdr > 0 ? (goldUsdOz * usdIdr) / TROY_OZ_TO_GRAM : 0;
    const goldPrevIdrGram = usdIdr > 0 ? (goldPrevUsdOz * usdIdr) / TROY_OZ_TO_GRAM : 0;
    const goldChange = goldIdrGram - goldPrevIdrGram;
    const goldPct = goldPrevIdrGram > 0 ? (goldChange / goldPrevIdrGram) * 100 : 0;

    // Oil: USD/barrel — keep raw USD price, also show IDR
    const oilUsd = oilQ?.regularMarketPrice ?? 0;
    const oilPct = oilQ?.regularMarketChangePercent ?? 0;

    const commodity = {
      gold: {
        label: "Emas",
        usdPerOz: Math.round(goldUsdOz * 100) / 100,
        idrPerGram: Math.round(goldIdrGram),
        prevIdrPerGram: Math.round(goldPrevIdrGram),
        change: Math.round(goldChange),
        changePercent: Math.round(goldPct * 100) / 100,
        direction: direction(goldPct),
      },
      oil: {
        label: "Minyak Brent",
        usdPerBarrel: Math.round(oilUsd * 100) / 100,
        change: Math.round((oilQ?.regularMarketChange ?? 0) * 100) / 100,
        changePercent: Math.round(oilPct * 100) / 100,
        direction: direction(oilPct),
      },
    };

    // ─── CRYPTO ─────────────────────────────────────────────────────
    const btcQ = macroMap["BTC-USD"];
    const ethQ = macroMap["ETH-USD"];

    const crypto = [
      {
        symbol: "BTC",
        label: "Bitcoin",
        priceUsd: Math.round((btcQ?.regularMarketPrice ?? 0) * 100) / 100,
        priceIdr: usdIdr > 0 ? Math.round((btcQ?.regularMarketPrice ?? 0) * usdIdr) : 0,
        change: Math.round((btcQ?.regularMarketChange ?? 0) * 100) / 100,
        changePercent: Math.round((btcQ?.regularMarketChangePercent ?? 0) * 100) / 100,
        direction: direction(btcQ?.regularMarketChangePercent ?? 0),
      },
      {
        symbol: "ETH",
        label: "Ethereum",
        priceUsd: Math.round((ethQ?.regularMarketPrice ?? 0) * 100) / 100,
        priceIdr: usdIdr > 0 ? Math.round((ethQ?.regularMarketPrice ?? 0) * usdIdr) : 0,
        change: Math.round((ethQ?.regularMarketChange ?? 0) * 100) / 100,
        changePercent: Math.round((ethQ?.regularMarketChangePercent ?? 0) * 100) / 100,
        direction: direction(ethQ?.regularMarketChangePercent ?? 0),
      },
    ];

    // ─── IDX TOP MOVERS ─────────────────────────────────────────────
    const idxQuotes = IDX_SYMBOLS.map((sym) => {
      const q = idxMap[sym];
      if (!q) return null;
      const pct = q.regularMarketChangePercent ?? 0;
      return {
        symbol: sym.replace(".JK", ""),
        name: q.displayName ?? q.shortName ?? sym.replace(".JK", ""),
        price: q.regularMarketPrice ?? 0,
        change: Math.round((q.regularMarketChange ?? 0) * 100) / 100,
        changePercent: Math.round(pct * 100) / 100,
        direction: direction(pct),
      };
    }).filter(Boolean) as {
      symbol: string; name: string; price: number;
      change: number; changePercent: number; direction: "up" | "down" | "flat";
    }[];

    const sorted = [...idxQuotes].sort((a, b) => b.changePercent - a.changePercent);
    const gainers = sorted.filter((s) => s.changePercent > 0).slice(0, 5);
    const losers = [...sorted].reverse().filter((s) => s.changePercent < 0).slice(0, 5);

    // Detect kalau semua data zero (Yahoo gagal total) — set placeholder flag
    // supaya UI bisa show "data tidak tersedia" hint instead of misleading zero.
    const dataAvailable = (ihsg?.value ?? 0) > 0 || (usdIdr ?? 0) > 0;

    return successResponse({
      ihsg,
      forex,
      commodity,
      crypto,
      movers: { gainers, losers },
      usdIdrRate: usdIdr,
      updatedAt: new Date().toISOString(),
      source: dataAvailable ? "Yahoo Finance (delayed ~15 min)" : "Data sumber sementara tidak tersedia — coba lagi nanti",
      dataAvailable,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
