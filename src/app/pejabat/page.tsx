import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { safeJsonLdStringify } from "@/lib/seo/json-ld";
import { parsePositiveInt } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { OfficialLevel, OfficialStatus } from "@prisma/client";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Direktori Pejabat Publik — Bandung & Jawa Barat | Lensaplus",
  description:
    "Direktori pejabat publik daerah Bandung dan Jawa Barat: Walikota, Bupati, anggota DPRD, Kapolda, Kajati, Gubernur, dan pejabat lainnya. Profil, jabatan, dan berita terkait.",
  alternates: { canonical: "/pejabat" },
  openGraph: {
    title: "Direktori Pejabat Publik Bandung & Jabar | Lensaplus",
    description:
      "Profil pejabat publik daerah Bandung dan Jawa Barat beserta berita terkait.",
  },
};

const LEVEL_LABELS: Record<OfficialLevel, string> = {
  NASIONAL: "Nasional",
  PROVINSI: "Provinsi",
  KOTA_KABUPATEN: "Kota/Kabupaten",
  KECAMATAN: "Kecamatan",
  YUDIKATIF: "Yudikatif",
  LEMBAGA: "Lembaga",
  OTHER: "Lainnya",
};

const STATUS_LABELS: Record<OfficialStatus, string> = {
  AKTIF: "Aktif",
  PURNA: "Purna",
  CUTI: "Cuti",
  NONAKTIF: "Nonaktif",
};

const STATUS_TEXT_COLORS: Record<OfficialStatus, string> = {
  AKTIF: "text-primary font-semibold",
  PURNA: "text-txt-muted font-medium",
  CUTI: "text-amber-700 font-semibold",
  NONAKTIF: "text-red-700 font-semibold",
};

const ALL_LEVELS: OfficialLevel[] = [
  "NASIONAL",
  "PROVINSI",
  "KOTA_KABUPATEN",
  "KECAMATAN",
  "YUDIKATIF",
  "LEMBAGA",
  "OTHER",
];

const LIMIT = 24;

interface PageProps {
  searchParams: Promise<{
    level?: string;
    search?: string;
    region?: string;
    page?: string;
  }>;
}

export default async function PejabatPage({ searchParams: searchParamsPromise }: PageProps) {
  const searchParams = await searchParamsPromise;
  const sp = await searchParams;
  const levelParam = ALL_LEVELS.includes(sp.level as OfficialLevel)
    ? (sp.level as OfficialLevel)
    : undefined;
  const searchParam = sp.search?.trim() || undefined;
  const regionParam = sp.region?.trim() || undefined;
  const page = parsePositiveInt(sp.page, 1);

  const where = {
    isPublished: true,
    ...(levelParam ? { level: levelParam } : {}),
    ...(regionParam
      ? { region: { contains: regionParam, mode: "insensitive" as const } }
      : {}),
    ...(searchParam
      ? {
          OR: [
            { name: { contains: searchParam, mode: "insensitive" as const } },
            { position: { contains: searchParam, mode: "insensitive" as const } },
            { institution: { contains: searchParam, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [officials, total] = await Promise.all([
    prisma.publicOfficial.findMany({
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        position: true,
        institution: true,
        level: true,
        region: true,
        status: true,
        party: true,
        photoUrl: true,
      },
      orderBy: [{ level: "asc" }, { name: "asc" }],
      take: LIMIT,
      skip: (page - 1) * LIMIT,
    }),
    prisma.publicOfficial.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Direktori Pejabat Publik Bandung & Jawa Barat",
    description:
      "Direktori pejabat publik daerah Bandung dan Jawa Barat: profil, jabatan, dan berita terkait.",
    url: "https://lensaplus.com/pejabat",
    publisher: {
      "@type": "Organization",
      name: "Lensaplus",
      url: "https://lensaplus.com",
    },
  };

  function buildHref(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged = {
      level: levelParam,
      search: searchParam,
      region: regionParam,
      page: String(page),
      ...overrides,
    };
    if (merged.level) p.set("level", merged.level);
    if (merged.search) p.set("search", merged.search);
    if (merged.region) p.set("region", merged.region);
    if (merged.page && merged.page !== "1") p.set("page", merged.page);
    const qs = p.toString();
    return `/pejabat${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />

      <div className="container-main py-8 sm:py-12">
        {/* Page header */}
        <div className="mb-8 border-l-4 border-primary pl-3">
          <h1 className="font-serif text-headline-md text-txt-primary mb-1">
            Pejabat Publik
          </h1>
          <p className="text-body-md text-txt-secondary max-w-2xl">
            Direktori pejabat publik daerah Bandung dan Jawa Barat — Walikota,
            Bupati, anggota DPRD, Kapolda, Kajati, Gubernur, dan pejabat
            lainnya.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-3">
          {/* Search */}
          <form action="/pejabat" method="get" className="flex gap-2">
            {levelParam && (
              <input type="hidden" name="level" value={levelParam} />
            )}
            {regionParam && (
              <input type="hidden" name="region" value={regionParam} />
            )}
            <input
              type="text"
              name="search"
              defaultValue={searchParam}
              placeholder="Cari nama, jabatan, atau institusi..."
              className="input flex-1 py-2 text-sm"
            />
            <button
              type="submit"
              className="btn-primary rounded-md px-4 py-2 text-sm font-semibold"
            >
              Cari
            </button>
            {(searchParam || levelParam || regionParam) && (
              <a
                href="/pejabat"
                className="btn-ghost rounded-md px-3 py-2 text-sm"
              >
                Reset
              </a>
            )}
          </form>

          {/* Level filter tabs */}
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildHref({ level: undefined, page: "1" })}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                !levelParam
                  ? "border-primary text-primary font-bold bg-surface"
                  : "border-border bg-surface text-txt-secondary hover:border-primary/40 hover:text-primary"
              }`}
            >
              Semua
            </Link>
            {ALL_LEVELS.map((l) => (
              <Link
                key={l}
                href={buildHref({ level: l, page: "1" })}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  levelParam === l
                    ? "border-primary text-primary font-bold bg-surface"
                    : "border-border bg-surface text-txt-secondary hover:border-primary/40 hover:text-primary"
                }`}
              >
                {LEVEL_LABELS[l]}
              </Link>
            ))}
          </div>
        </div>

        {/* Results count */}
        <p className="mb-4 text-sm text-txt-muted">
          {total === 0
            ? "Tidak ada pejabat ditemukan."
            : `Menampilkan ${(page - 1) * LIMIT + 1}–${Math.min(page * LIMIT, total)} dari ${total} pejabat`}
        </p>

        {/* Grid */}
        {officials.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface py-20 text-center">
            <p className="text-sm text-txt-secondary">
              Belum ada pejabat yang sesuai.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {officials.map((official) => (
              <Link
                key={official.id}
                href={`/pejabat/${official.slug}`}
                className="card group flex flex-col rounded-lg border border-border bg-surface p-4 transition-all hover:shadow-card-hover hover:-translate-y-0.5"
              >
                {/* Photo or initials */}
                <div className="mx-auto mb-3 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-container-low">
                  {official.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={official.photoUrl}
                      alt={official.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-primary">
                      {official.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Name */}
                <h2 className="text-center text-sm font-semibold text-txt-primary group-hover:text-primary line-clamp-2 transition-colors">
                  {official.name}
                </h2>

                {/* Position */}
                <p className="mt-1 text-center text-xs text-txt-secondary line-clamp-2">
                  {official.position}
                </p>

                {/* Institution */}
                <p className="mt-0.5 text-center text-xs text-txt-muted line-clamp-1">
                  {official.institution}
                </p>

                {/* Level & status metadata */}
                <div className="mt-3 flex flex-wrap justify-center items-center gap-x-2 gap-y-0.5 text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-primary">
                    {LEVEL_LABELS[official.level]}
                  </span>
                  <span className="text-border">·</span>
                  <span className={STATUS_TEXT_COLORS[official.status]}>
                    {STATUS_LABELS[official.status]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between text-sm text-txt-secondary">
            <span>
              Halaman {page} dari {totalPages}
            </span>
            <div className="flex gap-1">
              {page > 1 && (
                <Link
                  href={buildHref({ page: String(page - 1) })}
                  className="btn-ghost flex items-center gap-1 rounded-md px-3 py-2"
                >
                  <ChevronLeft size={16} /> Sebelumnya
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildHref({ page: String(page + 1) })}
                  className="btn-ghost flex items-center gap-1 rounded-md px-3 py-2"
                >
                  Berikutnya <ChevronRight size={16} />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
