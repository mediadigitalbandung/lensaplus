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
    card: "bg-emerald-50/60 border-emerald-100",
    accent: "bg-emerald-500",
    icon: "bg-emerald-50 text-emerald-600",
    text: "text-emerald-600",
    badge: "bg-emerald-50 text-emerald-600",
  },
  down: {
    card: "bg-red-50/60 border-red-100",
    accent: "bg-red-500",
    icon: "bg-red-50 text-red-600",
    text: "text-red-600",
    badge: "bg-red-50 text-red-600",
  },
  flat: {
    card: "bg-gray-50/60 border-gray-100",
    accent: "bg-gray-300",
    icon: "bg-gray-100 text-gray-500",
    text: "text-gray-500",
    badge: "bg-gray-100 text-gray-500",
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
          <span className={`shrink-0 flex items-center justify-center rounded-md p-1 ${c.icon}`}>
            <DirectionIcon dir={direction} size={14} />
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

        {/* Change row */}
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className={`text-label-sm font-mono font-semibold ${c.text}`}>
            {sign}{changePercent.toFixed(2)}%
          </span>
          {change !== 0 && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${c.badge}`}>
              {change > 0 ? "+" : ""}{change >= 1000 || change <= -1000
                ? Math.round(change).toLocaleString("id-ID")
                : change.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
