"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Smooth count-up animation untuk angka di stat card.
 * - Parse string ke number (strip non-digit kecuali . dan ,)
 * - Animate dari 0 → target dalam `duration` ms
 * - Kalau value bukan number (mis. "6.0M", "75%"), tampilkan as-is tanpa animation
 * - Respects prefers-reduced-motion (langsung skip ke final value)
 */
export default function CountUp({
  value,
  duration = 700,
  className,
}: {
  value: string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Reduced motion → skip animation
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }

    // Parse target — only animate kalau pure number (atau number dengan koma/titik separator)
    const cleaned = value.replace(/[.,]/g, "");
    const target = parseFloat(cleaned);
    if (!Number.isFinite(target) || cleaned !== Math.floor(target).toString()) {
      // Non-pure-number (e.g. "6.0M", "75%") → tampil langsung
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      // easeOutQuint untuk feel premium (cepat di awal, melambat di akhir)
      const eased = 1 - Math.pow(1 - progress, 5);
      const current = Math.floor(target * eased);
      setDisplay(current.toLocaleString("id-ID"));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(value);
      }
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <span className={className}>{display}</span>;
}
