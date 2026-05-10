import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export interface MoverItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
}

interface MoversListProps {
  gainers: MoverItem[];
  losers: MoverItem[];
}

function MoverRow({ item, type }: { item: MoverItem; type: "gainer" | "loser" }) {
  const isUp = type === "gainer";
  return (
    <li className="flex items-center justify-between py-2.5 border-b border-border last:border-0 gap-3">
      <div className="min-w-0 flex-1">
        <span className="block text-label-md font-bold text-on-surface">{item.symbol}</span>
        <span className="block text-[10px] text-on-surface-variant truncate">{item.name}</span>
      </div>
      <div className="text-right shrink-0">
        <div className="text-label-md font-mono font-semibold text-on-surface">
          {item.price.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
        </div>
        <div className={`flex items-center justify-end gap-0.5 text-label-sm font-mono font-bold ${isUp ? "text-emerald-600" : "text-red-600"}`}>
          {isUp ? <ArrowUpRight size={12} strokeWidth={2.5} /> : <ArrowDownRight size={12} strokeWidth={2.5} />}
          {item.changePercent >= 0 ? "+" : ""}{item.changePercent.toFixed(2)}%
        </div>
      </div>
    </li>
  );
}

export default function MoversList({ gainers, losers }: MoversListProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
      {/* Gainers */}
      <section aria-labelledby="movers-gainers-heading">
        <div className="card px-4 py-4">
          <h3
            id="movers-gainers-heading"
            className="flex items-center gap-2 text-label-md font-bold uppercase tracking-wider text-emerald-700 mb-1"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            Top Gainers
          </h3>
          <ul>
            {gainers.length > 0
              ? gainers.map((item) => (
                  <MoverRow key={item.symbol} item={item} type="gainer" />
                ))
              : (
                <li className="py-6 text-center text-body-sm text-on-surface-variant">
                  Data tidak tersedia
                </li>
              )}
          </ul>
        </div>
      </section>

      {/* Losers */}
      <section aria-labelledby="movers-losers-heading">
        <div className="card px-4 py-4">
          <h3
            id="movers-losers-heading"
            className="flex items-center gap-2 text-label-md font-bold uppercase tracking-wider text-red-700 mb-1"
          >
            <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
            Top Losers
          </h3>
          <ul>
            {losers.length > 0
              ? losers.map((item) => (
                  <MoverRow key={item.symbol} item={item} type="loser" />
                ))
              : (
                <li className="py-6 text-center text-body-sm text-on-surface-variant">
                  Data tidak tersedia
                </li>
              )}
          </ul>
        </div>
      </section>
    </div>
  );
}
