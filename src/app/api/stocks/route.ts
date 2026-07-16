import { successResponse, errorResponse } from "@/lib/api-utils";

export const revalidate = 15; // ISR: revalidate every 15 seconds

const SYMBOLS: { id: string; label: string; unit: string }[] = [
  { id: "^JKSE", label: "IHSG", unit: "poin indeks" },
  { id: "BBCA.JK", label: "BBCA", unit: "per saham" },
  { id: "BBRI.JK", label: "BBRI", unit: "per saham" },
  { id: "BMRI.JK", label: "BMRI", unit: "per saham" },
  { id: "TLKM.JK", label: "TLKM", unit: "per saham" },
  { id: "ASII.JK", label: "ASII", unit: "per saham" },
  { id: "UNVR.JK", label: "UNVR", unit: "per saham" },
  { id: "GOTO.JK", label: "GOTO", unit: "per saham" },
  { id: "USDIDR=X", label: "USD/IDR", unit: "per 1 USD" },
  { id: "GC=F", label: "EMAS", unit: "per gram" },
  { id: "CL=F", label: "MINYAK", unit: "per barel" },
  { id: "BTC-USD", label: "BTC", unit: "per 1 BTC" },
];

// 1 troy ounce = 31.1034768 gram — Yahoo's GC=F is USD/oz; we want IDR/gram
const TROY_OUNCE_TO_GRAM = 31.1034768;

export async function GET() {
  try {
    const ids = SYMBOLS.map((s) => s.id).join(",");
    const res = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/spark?symbols=${ids}&range=1d&interval=1d`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Lensaplus/1.0)" },
        next: { revalidate: 15 },
      }
    );

    if (!res.ok) throw new Error(`Yahoo returned ${res.status}`);

    const data = await res.json();

    // Resolve USD→IDR rate first so we can convert USD-denominated commodities
    // (gold, oil, BTC) into Rupiah for the local audience.
    const usdIdrQuote = data["USDIDR=X"];
    let usdIdrRate = 0;
    if (usdIdrQuote) {
      const validUsdClose = Array.isArray(usdIdrQuote.close)
        ? usdIdrQuote.close.filter((v: any) => v !== null && v !== undefined)
        : [];
      const closeRate = validUsdClose.length > 0 ? validUsdClose[validUsdClose.length - 1] : 0;
      const prevRate = usdIdrQuote.chartPreviousClose || usdIdrQuote.previousClose || closeRate;
      usdIdrRate = closeRate > 0 ? closeRate : prevRate || 16000;
    }
    const USD_QUOTED = new Set(["EMAS", "MINYAK", "BTC"]);

    const stocks = SYMBOLS.map((s) => {
      const q = data[s.id];
      if (!q) return null;

      const validCloseArray = Array.isArray(q.close)
        ? q.close.filter((v: any) => v !== null && v !== undefined)
        : [];

      let close = validCloseArray.length > 0 ? validCloseArray[validCloseArray.length - 1] : 0;
      let prev = q.chartPreviousClose || q.previousClose || close;

      if (close === 0 && prev > 0) {
        close = prev;
      }

      // Convert USD-quoted commodities to IDR (price + prevClose).
      // Change/percent are derived from the converted values so the deltas
      // shown to the user are also in Rupiah.
      if (USD_QUOTED.has(s.label) && usdIdrRate > 0) {
        close = close * usdIdrRate;
        prev = prev * usdIdrRate;
      }

      // Yahoo quotes gold in USD per troy ounce; Indonesian audience expects
      // per gram. Divide after the IDR conversion so we end up at IDR/gram.
      if (s.label === "EMAS") {
        close = close / TROY_OUNCE_TO_GRAM;
        prev = prev / TROY_OUNCE_TO_GRAM;
      }

      const change = close - prev;
      const pct = prev > 0 ? (change / prev) * 100 : 0;
      return {
        symbol: s.label,
        unit: s.unit,
        price: close,
        prevClose: prev,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(pct * 100) / 100,
        direction: change > 0.001 ? "up" : change < -0.001 ? "down" : "flat",
        currency: "IDR",
      };
    }).filter(Boolean);

    return successResponse({ stocks, updatedAt: new Date().toISOString(), usdIdrRate });
  } catch (e) {
    return errorResponse(e);
  }
}
