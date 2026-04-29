import { NextResponse } from "next/server";

export const revalidate = 15; // ISR: revalidate every 15 seconds

const SYMBOLS = [
  { id: "^JKSE", label: "IHSG" },
  { id: "BBCA.JK", label: "BBCA" },
  { id: "BBRI.JK", label: "BBRI" },
  { id: "BMRI.JK", label: "BMRI" },
  { id: "TLKM.JK", label: "TLKM" },
  { id: "ASII.JK", label: "ASII" },
  { id: "UNVR.JK", label: "UNVR" },
  { id: "GOTO.JK", label: "GOTO" },
  { id: "USDIDR=X", label: "USD/IDR" },
  { id: "GC=F", label: "EMAS" },
  { id: "CL=F", label: "MINYAK" },
  { id: "BTC-USD", label: "BTC" },
];

export async function GET() {
  try {
    const ids = SYMBOLS.map((s) => s.id).join(",");
    const res = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/spark?symbols=${ids}&range=1d&interval=1d`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Kartawarta/1.0)" },
        next: { revalidate: 15 },
      }
    );

    if (!res.ok) throw new Error(`Yahoo returned ${res.status}`);

    const data = await res.json();

    // Resolve USD→IDR rate first so we can convert USD-denominated commodities
    // (gold, oil, BTC) into Rupiah for the local audience.
    const usdIdrQuote = data["USDIDR=X"];
    const usdIdrRate =
      (usdIdrQuote?.close?.[usdIdrQuote.close.length - 1] as number | undefined) || 0;
    const USD_QUOTED = new Set(["EMAS", "MINYAK", "BTC"]);

    const stocks = SYMBOLS.map((s) => {
      const q = data[s.id];
      if (!q) return null;
      let close = q.close?.[q.close.length - 1] || 0;
      let prev = q.chartPreviousClose || close;

      // Convert USD-quoted commodities to IDR (price + prevClose).
      // Change/percent are derived from the converted values so the deltas
      // shown to the user are also in Rupiah.
      if (USD_QUOTED.has(s.label) && usdIdrRate > 0) {
        close = close * usdIdrRate;
        prev = prev * usdIdrRate;
      }

      const change = close - prev;
      const pct = prev > 0 ? (change / prev) * 100 : 0;
      return {
        symbol: s.label,
        price: close,
        prevClose: prev,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(pct * 100) / 100,
        direction: change > 0.001 ? "up" : change < -0.001 ? "down" : "flat",
        currency: USD_QUOTED.has(s.label) ? "IDR" : (s.label === "USD/IDR" ? "IDR" : "IDR"),
      };
    }).filter(Boolean);

    return NextResponse.json({ data: stocks, updatedAt: new Date().toISOString(), usdIdrRate });
  } catch (e) {
    return NextResponse.json({ data: [], error: String(e) }, { status: 500 });
  }
}
