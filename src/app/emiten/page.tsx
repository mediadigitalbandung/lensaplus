import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
type CompanySector =
  | "KEUANGAN" | "ENERGI" | "KONSUMER" | "PROPERTI" | "TELEKOMUNIKASI"
  | "INFRASTRUKTUR" | "PERTAMBANGAN" | "PERTANIAN_PERKEBUNAN" | "TRANSPORTASI"
  | "TEKNOLOGI" | "KESEHATAN_FARMASI" | "MANUFAKTUR" | "PARIWISATA" | "OTHER";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Direktori Emiten Indonesia | Lensaplus",
  description:
    "Profil lengkap perusahaan publik Indonesia: sektor, market cap, CEO, dan berita terkait.",
};

const SECTOR_LABELS: Record<CompanySector, string> = {
  KEUANGAN: "Keuangan",
  ENERGI: "Energi",
  KONSUMER: "Konsumer",
  PROPERTI: "Properti",
  TELEKOMUNIKASI: "Telekomunikasi",
  INFRASTRUKTUR: "Infrastruktur",
  PERTAMBANGAN: "Pertambangan",
  PERTANIAN_PERKEBUNAN: "Pertanian & Perkebunan",
  TRANSPORTASI: "Transportasi",
  TEKNOLOGI: "Teknologi",
  KESEHATAN_FARMASI: "Kesehatan & Farmasi",
  MANUFAKTUR: "Manufaktur",
  PARIWISATA: "Pariwisata",
  OTHER: "Lainnya",
};

function formatMarketCap(cap: bigint | null): string {
  if (!cap) return "—";
  const num = Number(cap);
  if (num >= 1e12) return `Rp ${(num / 1e12).toFixed(2)} T`;
  if (num >= 1e9) return `Rp ${(num / 1e9).toFixed(1)} M`;
  return `Rp ${num.toLocaleString("id-ID")}`;
}

interface SearchParams {
  sector?: string;
  search?: string;
  page?: string;
}

interface CompanyRow {
  ticker: string;
  name: string;
  shortName: string | null;
  sector: CompanySector;
  marketCap: bigint | null;
  logoUrl: string | null;
  hq: string | null;
}

export default async function EmitenPage({ searchParams: searchParamsPromise }: {
  searchParams: Promise<SearchParams>;
}) {
  const searchParams = await searchParamsPromise;
  const sp = await searchParams;
  const sectorFilter = sp.sector as CompanySector | undefined;
  const searchQuery = sp.search ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const limit = 24;

  const where = {
    isActive: true,
    ...(sectorFilter ? { sector: sectorFilter } : {}),
    ...(searchQuery
      ? {
          OR: [
            { ticker: { contains: searchQuery, mode: "insensitive" as const } },
            { name: { contains: searchQuery, mode: "insensitive" as const } },
            { shortName: { contains: searchQuery, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaAny = prisma as any;
  const [companies, total] = (await Promise.all([
    prismaAny.publicCompany.findMany({
      where,
      orderBy: [{ marketCap: "desc" }, { name: "asc" }],
      take: limit,
      skip: (page - 1) * limit,
      select: {
        ticker: true,
        name: true,
        shortName: true,
        sector: true,
        marketCap: true,
        logoUrl: true,
        hq: true,
      },
    }),
    prismaAny.publicCompany.count({ where }),
  ])) as [CompanyRow[], number];

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const sectors = Object.entries(SECTOR_LABELS) as [CompanySector, string][];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Direktori Emiten Indonesia",
    description: "Profil perusahaan publik yang terdaftar di Bursa Efek Indonesia",
    url: "https://lensaplus.com/emiten",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="container-main py-8 sm:py-12">
        {/* Hero */}
        <div className="mb-8">
          <h1 className="font-serif text-display-sm font-bold text-on-surface">
            Direktori Emiten
          </h1>
          <p className="mt-2 text-body-lg text-txt-muted">
            Profil perusahaan publik Indonesia — sektor, kinerja, dan berita terkait.
          </p>
        </div>

        {/* Search + filter */}
        <form method="GET" className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <input
            type="text"
            name="search"
            defaultValue={searchQuery}
            placeholder="Cari ticker atau nama perusahaan..."
            className="input flex-1 rounded-md border border-border bg-surface px-4 py-2.5 text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {sectorFilter && <input type="hidden" name="sector" value={sectorFilter} />}
          <button
            type="submit"
            className="btn-primary rounded-md px-5 py-2.5 text-label-md"
          >
            Cari
          </button>
        </form>

        {/* Sector pills */}
        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            href="/emiten"
            className={`rounded-full px-4 py-1.5 text-label-sm font-medium transition-colors ${
              !sectorFilter
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-txt-secondary hover:bg-primary-light hover:text-primary"
            }`}
          >
            Semua
          </Link>
          {sectors.map(([key, label]) => (
            <Link
              key={key}
              href={`/emiten?sector=${key}`}
              className={`rounded-full px-4 py-1.5 text-label-sm font-medium transition-colors ${
                sectorFilter === key
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-txt-secondary hover:bg-primary-light hover:text-primary"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Grid */}
        {companies.length === 0 ? (
          <div className="py-20 text-center text-txt-muted">
            <p className="text-body-lg">Tidak ada emiten ditemukan.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {companies.map((c) => (
                <Link
                  key={c.ticker}
                  href={`/emiten/${c.ticker.toLowerCase()}`}
                  className="card group flex flex-col gap-3 p-4 hover:shadow-card-hover"
                >
                  {/* Logo or ticker initial */}
                  <div className="flex items-center gap-3">
                    {c.logoUrl ? (
                      <Image
                        src={c.logoUrl}
                        alt={c.ticker}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-md object-contain"
                      />
                    ) : (
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary-light text-label-md font-bold text-primary">
                        {c.ticker.slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-mono text-label-md font-bold text-primary">
                        {c.ticker}
                      </p>
                      <span className="badge badge-green text-[10px]">
                        {SECTOR_LABELS[c.sector]}
                      </span>
                    </div>
                  </div>

                  <p className="line-clamp-2 text-body-sm font-medium text-on-surface group-hover:text-primary">
                    {c.shortName ?? c.name}
                  </p>

                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-label-sm text-txt-muted">Market Cap</span>
                    <span className="text-label-sm font-semibold text-on-surface">
                      {formatMarketCap(c.marketCap)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                {page > 1 && (
                  <Link
                    href={`/emiten?page=${page - 1}${sectorFilter ? `&sector=${sectorFilter}` : ""}${searchQuery ? `&search=${searchQuery}` : ""}`}
                    className="btn-outline-green rounded-md px-4 py-2 text-label-sm"
                  >
                    Sebelumnya
                  </Link>
                )}
                <span className="text-body-sm text-txt-muted">
                  {page} / {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={`/emiten?page=${page + 1}${sectorFilter ? `&sector=${sectorFilter}` : ""}${searchQuery ? `&search=${searchQuery}` : ""}`}
                    className="btn-outline-green rounded-md px-4 py-2 text-label-sm"
                  >
                    Berikutnya
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
