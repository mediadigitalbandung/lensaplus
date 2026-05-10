"use client";

import Link from "next/link";
import { useState } from "react";
import { APBD_DATA, type APBDItem } from "@/data/apbd-data";

// Static data page — no DB. Client component for expand/collapse interaction.
// Metadata exported from a sibling layout if needed; using static title tag here.

function formatAmount(t: number): string {
  return `Rp ${t.toFixed(2)} T`;
}

function pct(amount: number, total: number): string {
  return ((amount / total) * 100).toFixed(1);
}

function RegionSection({ data }: { data: (typeof APBD_DATA)[0] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <section className="mb-14" aria-labelledby={`heading-${data.region.replace(/\s+/g, "-")}`}>
      {/* Region header */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id={`heading-${data.region.replace(/\s+/g, "-")}`}
            className="font-serif text-headline-md font-bold text-on-surface"
          >
            {data.region}
          </h2>
          <p className="mt-1 text-label-sm text-txt-muted">APBD {data.year} — Sumber: {data.source}</p>
        </div>
        <div className="flex-shrink-0 rounded-md bg-primary-light px-5 py-2.5">
          <span className="text-label-sm text-txt-muted">Total APBD</span>
          <p className="font-serif text-title-lg font-bold text-primary">
            {formatAmount(data.totalAmount)}
          </p>
        </div>
      </div>

      {/* Horizontal stacked bar */}
      <div className="mb-5 overflow-hidden rounded-md" aria-label="Stacked bar chart APBD">
        <div className="flex h-10 w-full">
          {data.items.map((item) => {
            const w = pct(item.amount, data.totalAmount);
            return (
              <div
                key={item.sector}
                className="h-full cursor-pointer transition-opacity hover:opacity-80"
                style={{ width: `${w}%`, backgroundColor: item.color }}
                title={`${item.sector}: ${formatAmount(item.amount)} (${w}%)`}
                onClick={() =>
                  setExpanded((prev) => (prev === item.sector ? null : item.sector))
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    setExpanded((prev) => (prev === item.sector ? null : item.sector));
                }}
                aria-label={`${item.sector}: ${w}% dari total APBD`}
              />
            );
          })}
        </div>
      </div>

      {/* Legend + detail rows */}
      <div className="space-y-2">
        {data.items.map((item) => {
          const w = pct(item.amount, data.totalAmount);
          const isOpen = expanded === item.sector;
          return (
            <div key={item.sector} className="card overflow-hidden">
              <button
                className="flex w-full items-center gap-4 px-4 py-3 text-left"
                onClick={() => setExpanded((prev) => (prev === item.sector ? null : item.sector))}
                aria-expanded={isOpen}
              >
                {/* Color dot */}
                <span
                  className="h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
                {/* Bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-body-sm font-medium text-on-surface truncate">
                      {item.sector}
                    </span>
                    <span className="flex-shrink-0 text-label-sm font-semibold text-on-surface">
                      {formatAmount(item.amount)}{" "}
                      <span className="font-normal text-txt-muted">({w}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${w}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
                {/* Chevron */}
                {item.description && (
                  <svg
                    className={`h-4 w-4 flex-shrink-0 text-txt-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>

              {isOpen && item.description && (
                <div className="border-t border-border bg-surface-secondary px-4 py-3">
                  <p className="text-body-sm text-txt-secondary">{item.description}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ComparisonSection() {
  const [kota, kab] = APBD_DATA;

  // Build merged sector list for comparison
  const kotaMap = new Map<string, APBDItem>(kota.items.map((i) => [i.sector, i]));
  const kabMap = new Map<string, APBDItem>(kab.items.map((i) => [i.sector, i]));
  const allSectors = Array.from(new Set([...kotaMap.keys(), ...kabMap.keys()]));

  return (
    <section className="mb-14" aria-labelledby="comparison-heading">
      <h2 id="comparison-heading" className="font-serif text-headline-md font-bold text-on-surface mb-6">
        Perbandingan Kota vs Kabupaten Bandung
      </h2>
      <div className="card overflow-hidden">
        <div className="grid grid-cols-3 border-b border-border bg-surface-container px-4 py-2.5">
          <span className="text-label-sm font-semibold text-txt-muted">Sektor</span>
          <span className="text-right text-label-sm font-semibold text-txt-muted">Kota Bandung</span>
          <span className="text-right text-label-sm font-semibold text-txt-muted">Kab Bandung</span>
        </div>

        {allSectors.map((sector) => {
          const ki = kotaMap.get(sector);
          const kbi = kabMap.get(sector);
          const color = ki?.color ?? kbi?.color ?? "#6b7280";
          return (
            <div key={sector} className="grid grid-cols-3 items-center gap-2 border-b border-border px-4 py-3 last:border-b-0">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span className="text-body-sm text-on-surface truncate">{sector}</span>
              </div>
              <div className="text-right">
                {ki ? (
                  <>
                    <span className="text-body-sm font-medium text-on-surface">
                      {formatAmount(ki.amount)}
                    </span>
                    <span className="ml-1 text-label-sm text-txt-muted">
                      ({pct(ki.amount, kota.totalAmount)}%)
                    </span>
                  </>
                ) : (
                  <span className="text-label-sm text-txt-muted">—</span>
                )}
              </div>
              <div className="text-right">
                {kbi ? (
                  <>
                    <span className="text-body-sm font-medium text-on-surface">
                      {formatAmount(kbi.amount)}
                    </span>
                    <span className="ml-1 text-label-sm text-txt-muted">
                      ({pct(kbi.amount, kab.totalAmount)}%)
                    </span>
                  </>
                ) : (
                  <span className="text-label-sm text-txt-muted">—</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Totals row */}
        <div className="grid grid-cols-3 gap-2 bg-surface-container px-4 py-3">
          <span className="text-label-sm font-bold text-on-surface">Total APBD</span>
          <span className="text-right text-label-sm font-bold text-primary">
            {formatAmount(kota.totalAmount)}
          </span>
          <span className="text-right text-label-sm font-bold text-primary">
            {formatAmount(kab.totalAmount)}
          </span>
        </div>
      </div>
    </section>
  );
}

export default function AnggaranPage() {
  return (
    <div className="container-main py-8 sm:py-12">
      {/* Hero */}
      <div className="mb-10 border-b border-border pb-8">
        <span className="badge badge-green mb-3 inline-block">Data Journalism</span>
        <h1 className="font-serif text-display-sm font-bold text-on-surface">
          Anggaran APBD Bandung
        </h1>
        <p className="mt-3 max-w-2xl text-body-lg text-txt-muted">
          Visualisasi anggaran APBD Kota Bandung dan Kabupaten Bandung tahun 2026 — alokasi per
          sektor, perbandingan, dan breakdown belanja daerah.
        </p>
      </div>

      {/* Per-region sections */}
      {APBD_DATA.map((d) => (
        <RegionSection key={d.region} data={d} />
      ))}

      {/* Comparison */}
      <ComparisonSection />

      {/* Attribution + link */}
      <div className="flex flex-col items-start gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-label-sm text-txt-muted">
          Data bersumber dari <strong>Perda APBD 2026</strong>, DPRD Kota Bandung, dan DPRD
          Kabupaten Bandung. Angka merupakan estimasi editorial berdasarkan dokumen publik.
        </p>
        <Link
          href="/kategori/pemerintahan"
          className="btn-primary flex-shrink-0 rounded-md px-5 py-2.5 text-label-md"
        >
          Berita Pemerintahan →
        </Link>
      </div>
    </div>
  );
}
