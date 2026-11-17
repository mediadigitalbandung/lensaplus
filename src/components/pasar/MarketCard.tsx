import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

export interface MarketCardProps {
  label: string;
  sublabel?: string;
  primary: string;   // formatted primary value (e.g. "Rp 16.234")
  secondary?: string; // formatted secondary value (e.g. "$94,234")
  change: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
}

function DirectionIcon({ dir, size = 16 }: { dir: "up" | "down" | "flat"; size?: number }) {
  if (dir === "up") return <ArrowUpRight size={size} strokeWidth={2.5} />;
  if (dir === "down") return <ArrowDownRight size={size} strokeWidth={2.5} />;
  return <Minus size={size} strokeWidth={2.5} />;
}

const colors = {
  up: {
    card: "bg-white border-border",
    accent: "bg-emerald-500",
    text: "text-emerald-700",
  },
  down: {
    card: "bg-white border-border",
    accent: "bg-red-500",
    text: "text-red-700",
  },
  flat: {
    card: "bg-white border-border",
    accent: "bg-stone-300",
    text: "text-on-surface-variant",
  },
} as const;

export default function MarketCard({
  label,
  sublabel,
  primary,
  secondary,
  change,
  changePercent,
  direction,
}: MarketCardProps) {
  const c = colors[direction];
  const sign = changePercent >= 0 ? "+" : "";

  return (
    <div
      className={`relative overflow-hidden rounded-sm border shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all ${c.card}`}
    >
      {/* Top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${c.accent}`} />

      <div className="px-4 py-4 mt-0.5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <span className="block text-label-md font-bold text-on-surface leading-tight">{label}</span>
            {sublabel && (
              <span className="block text-[10px] text-on-surface-variant mt-0.5 leading-tight">{sublabel}</span>
            )}
          </div>
          <span className={`shrink-0 ${c.text}`}>
            <DirectionIcon dir={direction} size={15} />
          </span>
        </div>

        {/* Primary value */}
        <div className="text-title-lg font-mono font-bold text-on-surface leading-none tracking-tight">
          {primary}
        </div>

        {/* Secondary value (e.g. USD price alongside IDR) */}
        {secondary && (
          <div className="text-label-sm font-mono text-on-surface-variant mt-0.5">{secondary}</div>
        )}

        {/* Change row — plain colored text, no highlight background */}
        <div className="mt-2.5 flex items-center gap-2">
          <span className={`text-label-sm font-mono font-semibold ${c.text}`}>
            {sign}{changePercent.toFixed(2)}%
          </span>
          {change !== 0 && (
            <span className={`text-[11px] font-mono ${c.text}`}>
              ({change > 0 ? "+" : ""}{change >= 1000 || change <= -1000
                ? Math.round(change).toLocaleString("id-ID")
                : change.toFixed(2)})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
