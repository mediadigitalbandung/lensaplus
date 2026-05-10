import type { Metadata } from "next";
import Link from "next/link";
import {
  EKO_BANDUNG_INDICATORS,
  EKO_BANDUNG_SECTORS,
  EKO_BANDUNG_COMPANIES,
} from "@/data/eko-bandung-data";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Dashboard Ekonomi Bandung | Kartawarta",
  description:
    "Indikator ekonomi terkini Kota Bandung: inflasi, PDRB, UMK, pengangguran, dan data perekonomian Jawa Barat dari BPS.",
};

const TREND_ICONS: Record<"up" | "down" | "stable", string> = {
  up: "↑",
  down: "↓",
  stable: "→",
};

const TREND_COLORS: Record<"up" | "down" | "stable", string> = {
  up: "text-emerald-600",
  down: "text-red-500",
  stable: "text-txt-muted",
};

export default function EkonomiBandungPage() {
  const totalContribution = EKO_BANDUNG_SECTORS.reduce(
    (sum, s) => sum + s.contribution,
    0
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Dashboard Ekonomi Bandung",
    description:
      "Indikator ekonomi terkini Kota Bandung dan Jawa Barat dari BPS Jawa Barat.",
    url: "https://kartawarta.com/ekonomi-bandung",
    about: [
      {
        "@type": "Dataset",
        name: "Indikator Ekonomi Bandung 2026",
        creator: { "@type": "Organization", name: "BPS Jawa Barat" },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="container-main py-8 sm:py-12">
        {/* Hero */}
        <div className="mb-10 border-b border-border pb-8">
          <span className="badge badge-green mb-3 inline-block">Data Journalism</span>
          <h1 className="font-serif text-display-sm font-bold text-on-surface">
            Dashboard Ekonomi Bandung
          </h1>
          <p className="mt-3 max-w-2xl text-body-lg text-txt-muted">
            Indikator ekonomi terkini Kota Bandung dan Jawa Barat berdasarkan data resmi BPS,
            Pemerintah Daerah, dan lembaga statistik nasional.
          </p>
        </div>

        {/* Indicators grid */}
        <section className="mb-12" aria-labelledby="indicators-heading">
          <h2
            id="indicators-heading"
            className="section-title mb-6"
          >
            Indikator Utama
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {EKO_BANDUNG_INDICATORS.map((ind) => (
              <div
                key={ind.label}
                className="card flex flex-col gap-2 p-5"
              >
                <span className="text-label-sm text-txt-muted uppercase tracking-wide">
                  {ind.label}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-headline-md font-bold text-on-surface">
                    {ind.value}
                  </span>
                  {ind.unit && (
                    <span className="text-body-sm text-txt-muted">{ind.unit}</span>
                  )}
                </div>

                {ind.trend && ind.change && (
                  <span
                    className={`flex items-center gap-1 text-label-sm font-medium ${TREND_COLORS[ind.trend]}`}
                  >
                    <span aria-hidden="true">{TREND_ICONS[ind.trend]}</span>
                    {ind.change} dari periode sebelumnya
                  </span>
                )}

                <div className="mt-2 border-t border-border pt-2 flex items-center justify-between gap-2">
                  <span className="text-label-sm text-txt-muted">{ind.source}</span>
                  <span className="text-label-sm text-txt-muted">{ind.asOf}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Sector breakdown — CSS bar chart */}
        <section className="mb-12" aria-labelledby="sectors-heading">
          <h2 id="sectors-heading" className="section-title mb-6">
            Sektor Ekonomi Bandung (Kontribusi PDRB)
          </h2>
          <div className="card p-6 space-y-4">
            {EKO_BANDUNG_SECTORS.map((s) => {
              const pct = ((s.contribution / totalContribution) * 100).toFixed(1);
              return (
                <div key={s.name}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-body-sm text-on-surface">{s.name}</span>
                    <span className="text-label-sm font-semibold text-on-surface">
                      {s.contribution}% ({pct}%)
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-surface-container">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: s.color,
                      }}
                      role="progressbar"
                      aria-valuenow={parseFloat(pct)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${s.name}: ${pct}%`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-label-sm text-txt-muted">
            Sumber: BPS Jawa Barat, 2025. Angka merupakan estimasi kontribusi terhadap PDRB Kota Bandung.
          </p>
        </section>

        {/* Notable companies */}
        <section className="mb-12" aria-labelledby="companies-heading">
          <h2 id="companies-heading" className="section-title mb-6">
            Perusahaan Notable Bandung
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EKO_BANDUNG_COMPANIES.map((c) => (
              <div key={c.name} className="card flex items-center gap-4 p-4">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-primary-light text-label-md font-bold text-primary">
                  {c.ticker ?? c.name.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="text-body-sm font-semibold text-on-surface line-clamp-2">
                    {c.name}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    {c.ticker ? (
                      <Link
                        href={`/emiten/${c.ticker.toLowerCase()}`}
                        className="text-label-sm font-mono text-primary hover:underline"
                      >
                        {c.ticker}
                      </Link>
                    ) : (
                      <span className="text-label-sm text-txt-muted">Non-publik</span>
                    )}
                    <span className="text-label-sm text-txt-muted">· {c.sector}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer attribution + link */}
        <div className="flex flex-col items-start gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-label-sm text-txt-muted">
            Data bersumber dari <strong>BPS Jawa Barat</strong>, Pemerintah Kota Bandung, dan
            Pergub Jabar. Diperbarui secara berkala oleh redaksi Kartawarta.
          </p>
          <Link
            href="/kategori/bisnis-ekonomi"
            className="btn-primary flex-shrink-0 rounded-md px-5 py-2.5 text-label-md"
          >
            Berita Bisnis Bandung →
          </Link>
        </div>
      </div>
    </>
  );
}
