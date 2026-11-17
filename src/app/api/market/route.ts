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

// Spark responses don't carry display names, so map the tickers to the
// Indonesian company names we used to get from the v7 quote endpoint.
const IDX_NAMES: Record<string, string> = {
  BBCA: "Bank Central Asia",
  BBRI: "Bank Rakyat Indonesia",
  BMRI: "Bank Mandiri",
  TLKM: "Telkom Indonesia",
  ASII: "Astra International",
  UNVR: "Unilever Indonesia",
  GOTO: "GoTo Gojek Tokopedia",
  BREN: "Barito Renewables",
  AMMN: "Amman Mineral Internasional",
  TOWR: "Sarana Menara Nusantara",
  ADRO: "Adaro Energy",
  PGAS: "Perusahaan Gas Negara",
  ICBP: "Indofood CBP Sukses Makmur",
  INDF: "Indofood Sukses Makmur",
  KLBF: "Kalbe Farma",
  EMTK: "Elang Mahkota Teknologi",
  MTEL: "Dayamitra Telekomunikasi",
  SMGR: "Semen Indonesia",
  EXCL: "XL Axiata",
  TBIG: "Tower Bersama",
};

interface QuoteResult {
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  symbol?: string;
}

function direction(pct: number): "up" | "down" | "flat" {
  if (pct > 0.005) return "up";
  if (pct < -0.005) return "down";
  return "flat";
}

/**
 * Fetch quotes via the Yahoo Finance v8 `/spark` endpoint.
 *
 * The legacy v7 `/quote` endpoint now answers 401 for public (cookie-less)
 * access from most IPs, so we switched to `/spark`, which still works.
 * Caveats handled here:
 *  - `/spark` caps each request at 20 symbols → batch the list.
 *  - `/spark` returns `close[]` + `chartPreviousClose` (no
 *    regularMarketChange/Percent) → derive change/percent ourselves.
 *
 * Returns an empty map when a request fails; the UI degrades gracefully.
 */
async function fetchQuotes(symbols: string[]): Promise<Record<string, QuoteResult>> {
  const out: Record<string, QuoteResult> = {};
  try {
    // Batch to stay under the 20-symbol per-request cap.
    const batches: string[][] = [];
    for (let i = 0; i < symbols.length; i += 20) {
      batches.push(symbols.slice(i, i + 20));
    }

    const responses = await Promise.all(
      batches.map(async (batch) => {
        const url = `https://query2.finance.yahoo.com/v8/finance/spark?symbols=${batch.join(",")}&range=1d&interval=1d`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Lensaplus/1.0)",
            "Accept": "application/json,text/plain,*/*",
          },
          next: { revalidate: 60 },
        });
        if (!res.ok) throw new Error(`Yahoo returned ${res.status}`);
        return res.json();
      })
    );

    for (const data of responses) {
      for (const sym of symbols) {
        const q = data?.[sym];
        if (!q || !Array.isArray(q.close)) continue;

        const closes = q.close.filter((v: unknown) => typeof v === "number" && Number.isFinite(v));
        if (closes.length === 0) continue;

        const price = closes[closes.length - 1];
        const prevClose = q.chartPreviousClose ?? q.previousClose ?? price;
        const change = price - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

        out[sym] = { symbol: sym, price, prevClose, change, changePercent };
      }
    }
  } catch (e) {
    console.warn(`[market] Yahoo fetch error:`, (e as Error).message);
  }
  return out;
}

export async function GET() {
  try {
    // Fetch macro + forex + commodity + crypto in one call
    const [macroMap, idxMap] = await Promise.all([
      fetchQuotes(QUOTE_SYMBOLS),
      fetchQuotes(IDX_SYMBOLS),
    ]);

    // USD/IDR rate for conversions
    const usdIdr = macroMap["USDIDR=X"]?.price ?? 0;

    // ─── IHSG ───────────────────────────────────────────────────────
    const ihsgQ = macroMap["^JKSE"];
    const ihsg = ihsgQ
      ? {
          price: ihsgQ.price,
          prevClose: ihsgQ.prevClose,
          change: Math.round(ihsgQ.change * 100) / 100,
          changePercent: Math.round(ihsgQ.changePercent * 100) / 100,
          direction: direction(ihsgQ.changePercent),
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
      return {
        label: p.label,
        base: p.base,
        price: Math.round(q.price * 100) / 100,
        prevClose: Math.round(q.prevClose * 100) / 100,
        change: Math.round(q.change * 100) / 100,
        changePercent: Math.round(q.changePercent * 100) / 100,
        direction: direction(q.changePercent),
        currency: "IDR",
      };
    }).filter(Boolean);

    // ─── COMMODITY ──────────────────────────────────────────────────
    const goldQ = macroMap["GC=F"];
    const oilQ = macroMap["CL=F"];

    // Gold: Yahoo gives USD/troy-oz → convert to IDR/gram
    const goldUsdOz = goldQ?.price ?? 0;
    const goldPrevUsdOz = goldQ?.prevClose ?? 0;
    const goldIdrGram = usdIdr > 0 ? (goldUsdOz * usdIdr) / TROY_OZ_TO_GRAM : 0;
    const goldPrevIdrGram = usdIdr > 0 ? (goldPrevUsdOz * usdIdr) / TROY_OZ_TO_GRAM : 0;
    const goldChange = goldIdrGram - goldPrevIdrGram;
    const goldPct = goldPrevIdrGram > 0 ? (goldChange / goldPrevIdrGram) * 100 : 0;

    // Oil: USD/barrel — keep raw USD price, also show IDR
    const oilUsd = oilQ?.price ?? 0;
    const oilPct = oilQ?.changePercent ?? 0;

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
        change: Math.round((oilQ?.change ?? 0) * 100) / 100,
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
        priceUsd: Math.round((btcQ?.price ?? 0) * 100) / 100,
        priceIdr: usdIdr > 0 ? Math.round((btcQ?.price ?? 0) * usdIdr) : 0,
        change: Math.round((btcQ?.change ?? 0) * 100) / 100,
        changePercent: Math.round((btcQ?.changePercent ?? 0) * 100) / 100,
        direction: direction(btcQ?.changePercent ?? 0),
      },
      {
        symbol: "ETH",
        label: "Ethereum",
        priceUsd: Math.round((ethQ?.price ?? 0) * 100) / 100,
        priceIdr: usdIdr > 0 ? Math.round((ethQ?.price ?? 0) * usdIdr) : 0,
        change: Math.round((ethQ?.change ?? 0) * 100) / 100,
        changePercent: Math.round((ethQ?.changePercent ?? 0) * 100) / 100,
        direction: direction(ethQ?.changePercent ?? 0),
      },
    ];

    // ─── IDX TOP MOVERS ─────────────────────────────────────────────
    const idxQuotes = IDX_SYMBOLS.map((sym) => {
      const q = idxMap[sym];
      if (!q) return null;
      const ticker = sym.replace(".JK", "");
      return {
        symbol: ticker,
        name: IDX_NAMES[ticker] ?? ticker,
        price: q.price,
        change: Math.round(q.change * 100) / 100,
        changePercent: Math.round(q.changePercent * 100) / 100,
        direction: direction(q.changePercent),
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
    const dataAvailable = (ihsg?.price ?? 0) > 0 || (usdIdr ?? 0) > 0;

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
