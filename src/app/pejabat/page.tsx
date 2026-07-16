import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Users, ChevronLeft, ChevronRight } from "lucide-react";
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

const LEVEL_COLORS: Record<OfficialLevel, string> = {
  NASIONAL: "bg-blue-100 text-blue-800",
  PROVINSI: "bg-violet-100 text-violet-800",
  KOTA_KABUPATEN: "bg-primary-light text-primary",
  KECAMATAN: "bg-teal-100 text-teal-800",
  YUDIKATIF: "bg-red-100 text-red-800",
  LEMBAGA: "bg-amber-100 text-amber-800",
  OTHER: "bg-surface-tertiary text-txt-secondary",
};

const STATUS_LABELS: Record<OfficialStatus, string> = {
  AKTIF: "Aktif",
  PURNA: "Purna",
  CUTI: "Cuti",
  NONAKTIF: "Nonaktif",
};

const STATUS_COLORS: Record<OfficialStatus, string> = {
  AKTIF: "bg-primary-light text-primary border border-primary/20",
  PURNA: "bg-surface-secondary text-txt-muted border border-border",
  CUTI: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  NONAKTIF: "bg-red-50 text-red-700 border border-red-200",
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
  const page = Math.max(1, parseInt(sp.page || "1", 10));

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="container-main py-8 sm:py-12">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Users size={28} className="text-primary shrink-0" />
            <h1 className="font-serif text-headline-md text-txt-primary">
              Pejabat Publik
            </h1>
          </div>
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

          {/* Level filter pills */}
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildHref({ level: undefined, page: "1" })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                !levelParam
                  ? "bg-primary text-white"
                  : "bg-surface-tertiary text-txt-secondary hover:bg-border"
              }`}
            >
              Semua
            </Link>
            {ALL_LEVELS.map((l) => (
              <Link
                key={l}
                href={buildHref({ level: l, page: "1" })}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  levelParam === l
                    ? "bg-primary text-white"
                    : "bg-surface-tertiary text-txt-secondary hover:bg-border"
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
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface py-20 text-center">
            <Users size={40} className="mx-auto text-border mb-3" />
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
                <div className="mx-auto mb-3 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-light">
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

                {/* Badges */}
                <div className="mt-3 flex flex-wrap justify-center gap-1">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${LEVEL_COLORS[official.level]}`}
                  >
                    {LEVEL_LABELS[official.level]}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[official.status]}`}
                  >
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
