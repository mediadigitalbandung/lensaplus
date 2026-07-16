import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
type CompanySector =
  | "KEUANGAN" | "ENERGI" | "KONSUMER" | "PROPERTI" | "TELEKOMUNIKASI"
  | "INFRASTRUKTUR" | "PERTAMBANGAN" | "PERTANIAN_PERKEBUNAN" | "TRANSPORTASI"
  | "TEKNOLOGI" | "KESEHATAN_FARMASI" | "MANUFAKTUR" | "PARIWISATA" | "OTHER";

export const revalidate = 600;

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

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaAny = prisma as any;

interface CompanyDetail {
  id: string; ticker: string; name: string; shortName: string | null;
  sector: CompanySector; description: string | null; founded: number | null;
  ipoDate: Date | null; marketCap: bigint | null; website: string | null;
  logoUrl: string | null; ceo: string | null; hq: string | null;
  employees: number | null; isActive: boolean; viewCount: number;
  createdAt: Date; updatedAt: Date;
}

export async function generateMetadata({
  params: paramsPromise,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const params = await paramsPromise;
  const ticker = params.ticker.toUpperCase();
  const company = (await prismaAny.publicCompany.findUnique({
    where: { ticker },
    select: { name: true, sector: true, description: true },
  })) as Pick<CompanyDetail, "name" | "sector" | "description"> | null;
  if (!company) return { title: "Emiten tidak ditemukan | Lensaplus" };
  return {
    title: `${ticker} — ${company.name} | Lensaplus`,
    description: company.description?.slice(0, 160) ?? `Profil ${ticker} (${SECTOR_LABELS[company.sector]}) di Lensaplus.`,
  };
}

export default async function EmitenDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const params = await paramsPromise;
  const ticker = params.ticker.toUpperCase();

  const company = (await prismaAny.publicCompany.findUnique({ where: { ticker } })) as CompanyDetail | null;
  if (!company || !company.isActive) notFound();

  // Increment view count (fire-and-forget)
  prismaAny.publicCompany
    .update({ where: { ticker }, data: { viewCount: { increment: 1 } } })
    .catch(() => null);

  // Related articles: search by ticker in title or content (case-insensitive, limit 5)
  const relatedArticles = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { title: { contains: ticker, mode: "insensitive" } },
        { content: { contains: ticker, mode: "insensitive" } },
      ],
    },
    orderBy: { publishedAt: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      slug: true,
      publishedAt: true,
      featuredImage: true,
    },
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: company.name,
        alternateName: company.shortName ?? undefined,
        url: company.website ?? undefined,
        logo: company.logoUrl ?? undefined,
        foundingDate: company.founded?.toString(),
        numberOfEmployees: company.employees ?? undefined,
        address: company.hq ?? undefined,
      },
      {
        "@type": "Corporation",
        name: company.name,
        tickerSymbol: company.ticker,
        description: company.description ?? undefined,
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
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-label-sm text-txt-muted" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-primary">Beranda</Link>
          <span>/</span>
          <Link href="/emiten" className="hover:text-primary">Emiten</Link>
          <span>/</span>
          <span className="text-on-surface">{ticker}</span>
        </nav>

        {/* Hero */}
        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start">
          {company.logoUrl ? (
            <Image
              src={company.logoUrl}
              alt={company.name}
              width={80}
              height={80}
              className="h-20 w-20 rounded-lg object-contain border border-border bg-white p-2"
            />
          ) : (
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-primary-light text-headline-sm font-bold text-primary">
              {ticker.slice(0, 2)}
            </div>
          )}

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-headline-lg font-bold text-on-surface">
                {company.name}
              </h1>
              <span className="font-mono text-label-lg font-bold text-primary bg-primary-light px-3 py-1 rounded-md">
                {company.ticker}
              </span>
            </div>
            {company.shortName && (
              <p className="mt-1 text-body-md text-txt-muted">{company.shortName}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="badge badge-green">{SECTOR_LABELS[company.sector]}</span>
              {company.marketCap && (
                <span className="badge bg-surface-container text-txt-secondary">
                  Market Cap: {formatMarketCap(company.marketCap)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main: description + info */}
          <div className="lg:col-span-2 space-y-8">
            {company.description && (
              <section>
                <h2 className="mb-3 font-serif text-title-lg font-semibold text-on-surface">
                  Tentang Perusahaan
                </h2>
                <p className="text-body-md leading-relaxed text-txt-secondary">
                  {company.description}
                </p>
              </section>
            )}

            {/* Related Articles */}
            {relatedArticles.length > 0 && (
              <section>
                <h2 className="mb-4 font-serif text-title-lg font-semibold text-on-surface">
                  Berita Terkait {ticker}
                </h2>
                <div className="space-y-3">
                  {relatedArticles.map((a) => (
                    <Link
                      key={a.id}
                      href={`/artikel/${a.slug}`}
                      className="flex gap-4 rounded-md p-3 hover:bg-surface-container transition-colors"
                    >
                      {a.featuredImage && (
                        <Image
                          src={a.featuredImage}
                          alt={a.title}
                          width={80}
                          height={56}
                          className="h-14 w-20 flex-shrink-0 rounded-sm object-cover"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-body-sm font-medium text-on-surface hover:text-primary">
                          {a.title}
                        </p>
                        {a.publishedAt && (
                          <time
                            dateTime={a.publishedAt.toISOString()}
                            className="mt-1 block text-label-sm text-txt-muted"
                          >
                            {formatDate(a.publishedAt)}
                          </time>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar: company info */}
          <aside className="space-y-6">
            <div className="card p-5 space-y-4">
              <h3 className="font-sans text-label-lg font-semibold uppercase tracking-wider text-txt-muted">
                Info Perusahaan
              </h3>

              {[
                { label: "CEO / Direktur", value: company.ceo },
                { label: "Kantor Pusat", value: company.hq },
                {
                  label: "Karyawan",
                  value: company.employees?.toLocaleString("id-ID") ?? null,
                },
                { label: "Berdiri", value: company.founded?.toString() ?? null },
                { label: "IPO", value: formatDate(company.ipoDate) },
              ].map(
                ({ label, value }) =>
                  value && (
                    <div key={label} className="flex flex-col gap-0.5">
                      <span className="text-label-sm text-txt-muted">{label}</span>
                      <span className="text-body-sm text-on-surface">{value}</span>
                    </div>
                  )
              )}

              {company.website && (
                <div>
                  <span className="text-label-sm text-txt-muted">Website</span>
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block truncate text-body-sm text-primary hover:underline"
                  >
                    {company.website.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
            </div>

            <Link
              href="/emiten"
              className="btn-outline-green block w-full rounded-md py-2.5 text-center text-label-md"
            >
              Lihat Semua Emiten
            </Link>
          </aside>
        </div>
      </div>
    </>
  );
}
