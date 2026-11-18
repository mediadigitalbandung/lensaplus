const TROY_OZ_TO_GRAM = 31.1034768;

const QUOTE_SYMBOLS = [
  "^JKSE",
  "USDIDR=X",
  "EURIDR=X",
  "SGDIDR=X",
  "JPYIDR=X",
  "CNYIDR=X",
  "GC=F",
  "CL=F",
  "BTC-USD",
  "ETH-USD",
];

const IDX_SYMBOLS = [
  "BBCA.JK", "BBRI.JK", "BMRI.JK", "TLKM.JK", "ASII.JK",
  "UNVR.JK", "GOTO.JK", "BREN.JK", "AMMN.JK", "TOWR.JK",
  "ADRO.JK", "PGAS.JK", "ICBP.JK", "INDF.JK", "KLBF.JK",
  "EMTK.JK", "MTEL.JK", "SMGR.JK", "EXCL.JK", "TBIG.JK",
];

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

export interface IhsgData {
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
}

export interface ForexItem {
  label: string;
  base: string;
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
  currency: string;
}

export interface GoldData {
  label: string;
  usdPerOz: number;
  idrPerGram: number;
  prevIdrPerGram: number;
  change: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
}

export interface OilData {
  label: string;
  usdPerBarrel: number;
  change: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
}

export interface CryptoItem {
  symbol: string;
  label: string;
  priceUsd: number;
  priceIdr: number;
  change: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
}

export interface MarketMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
}

export interface MarketData {
  ihsg: IhsgData | null;
  forex: ForexItem[];
  commodity: { gold: GoldData; oil: OilData };
  crypto: CryptoItem[];
  movers: { gainers: MarketMover[]; losers: MarketMover[] };
  usdIdrRate: number;
  updatedAt: string;
  source: string;
}

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

async function fetchQuotes(symbols: string[]): Promise<Record<string, QuoteResult>> {
  const out: Record<string, QuoteResult> = {};
  try {
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
            Accept: "application/json,text/plain,*/*",
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
    console.warn("[pasar] Yahoo fetch error:", (e as Error).message);
  }
  return out;
}

export async function getMarketData(): Promise<MarketData | null> {
  try {
    const [macroMap, idxMap] = await Promise.all([
      fetchQuotes(QUOTE_SYMBOLS),
      fetchQuotes(IDX_SYMBOLS),
    ]);

    const usdIdr = macroMap["USDIDR=X"]?.price ?? 0;

    const ihsgQ = macroMap["^JKSE"];
    const ihsg: IhsgData | null = ihsgQ
      ? {
          price: ihsgQ.price,
          prevClose: ihsgQ.prevClose,
          change: Math.round(ihsgQ.change * 100) / 100,
          changePercent: Math.round(ihsgQ.changePercent * 100) / 100,
          direction: direction(ihsgQ.changePercent),
        }
      : null;

    const dataAvailable = (ihsg?.price ?? 0) > 0 || usdIdr > 0;
    if (!dataAvailable) return null;

    const forexPairs = [
      { symbol: "USDIDR=X", label: "USD/IDR", base: "USD" },
      { symbol: "EURIDR=X", label: "EUR/IDR", base: "EUR" },
      { symbol: "SGDIDR=X", label: "SGD/IDR", base: "SGD" },
      { symbol: "JPYIDR=X", label: "JPY/IDR", base: "JPY" },
      { symbol: "CNYIDR=X", label: "CNY/IDR", base: "CNY" },
    ];

    const forex = forexPairs
      .map((p): ForexItem | null => {
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
      })
      .filter((x): x is ForexItem => x !== null);

    const goldQ = macroMap["GC=F"];
    const oilQ = macroMap["CL=F"];

    const goldUsdOz = goldQ?.price ?? 0;
    const goldPrevUsdOz = goldQ?.prevClose ?? 0;
    const goldIdrGram = usdIdr > 0 ? (goldUsdOz * usdIdr) / TROY_OZ_TO_GRAM : 0;
    const goldPrevIdrGram = usdIdr > 0 ? (goldPrevUsdOz * usdIdr) / TROY_OZ_TO_GRAM : 0;
    const goldChange = goldIdrGram - goldPrevIdrGram;
    const goldPct = goldPrevIdrGram > 0 ? (goldChange / goldPrevIdrGram) * 100 : 0;

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

    const btcQ = macroMap["BTC-USD"];
    const ethQ = macroMap["ETH-USD"];

    const crypto: CryptoItem[] = [
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

    const idxQuotes = IDX_SYMBOLS.map((sym): MarketMover | null => {
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
    }).filter((x): x is MarketMover => x !== null);

    const sorted = [...idxQuotes].sort((a, b) => b.changePercent - a.changePercent);
    const gainers = sorted.filter((s) => s.changePercent > 0).slice(0, 5);
    const losers = [...sorted].reverse().filter((s) => s.changePercent < 0).slice(0, 5);

    return {
      ihsg,
      forex,
      commodity,
      crypto,
      movers: { gainers, losers },
      usdIdrRate: usdIdr,
      updatedAt: new Date().toISOString(),
      source: "Yahoo Finance (delayed ~15 min)",
    };
  } catch {
    return null;
  }
}
