export const revalidate = 60; // ISR: revalidate tag page every 60 seconds

import Link from "next/link";
import { Metadata } from "next";
import { ChevronLeft, ChevronRight, Hash } from "lucide-react";
import ArticleCard from "@/components/artikel/ArticleCard";
import BannerAd from "@/components/ads/BannerAd";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

const PER_PAGE = 12;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

// High-priority tag overrides — hand-tuned meta for hub pages we want to push.
// Keeps generic fallback for all other tags.
const TAG_META_OVERRIDES: Record<string, { title: string; description: string }> = {
  "bank-bjb": {
    title: "Bank BJB — Liputan Lengkap RUPST, Direksi & Kinerja",
    description:
      "Liputan terverifikasi Lensaplus tentang Bank BJB: RUPST 2025, jajaran direksi & komisaris, dividen, kinerja keuangan, dan kerja sama strategis Bank Pembangunan Daerah Jawa Barat dan Banten.",
  },
};

export async function generateMetadata({ params: paramsPromise, searchParams: searchParamsPromise }: PageProps): Promise<Metadata> {
  const params = await paramsPromise;
  const searchParams = await searchParamsPromise;
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const tag = await prisma.tag.findUnique({ where: { slug: params.slug } });
  if (!tag) return { title: "Tag Tidak Ditemukan" };
  const override = TAG_META_OVERRIDES[params.slug];
  const articleCount = await prisma.article.count({
    where: { status: "PUBLISHED", tags: { some: { slug: params.slug } } },
  });
  const baseTitle = override?.title || `Berita ${tag.name} Terbaru`;
  const title = page > 1 ? `${baseTitle} — Halaman ${page}` : baseTitle;
  const description =
    override?.description ||
    `${articleCount} artikel terbaru tentang ${tag.name} dari Lensaplus — liputan, analisis, dan perkembangan terkini.`;
  // AdSense thin-content: index a tag hub ONLY when it is substantial
  // (>= MIN_INDEXABLE_TAG_ARTICLES on page 1). Sparse/empty tags and every
  // paginated view (page > 1) are noindexed but still crawlable (follow) so
  // article links keep flowing. Hand-tuned override hubs stay indexable.
  const MIN_INDEXABLE_TAG_ARTICLES = 5;
  const indexable = !!override || (page === 1 && articleCount >= MIN_INDEXABLE_TAG_ARTICLES);
  // Paginated views collapse onto the base tag canonical (no per-page canonical)
  // since they are no longer independently indexed.
  const canonical = `/tag/${params.slug}`;
  return {
    title,
    description,
    robots: indexable
      ? undefined
      : { index: false, follow: true, googleBot: { index: false } },
    openGraph: { title: `${title} — Lensaplus`, description, type: "website" },
    alternates: { canonical },
  };
}

export default async function TagPage({ params: paramsPromise, searchParams: searchParamsPromise }: PageProps) {
  const params = await paramsPromise;
  const searchParams = await searchParamsPromise;
  const tag = await prisma.tag.findUnique({
    where: { slug: params.slug },
  });

  if (!tag) notFound();

  const page = Math.max(1, parseInt(searchParams.page || "1"));

  const where = {
    status: "PUBLISHED" as const,
    tags: { some: { slug: params.slug } },
  };

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      include: { author: true, category: true },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.article.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PER_PAGE);

  // Page numbers
  const pageNumbers: number[] = [];
  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, page + 2);
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com";
  // CollectionPage with an ItemList of articles so crawlers can see what's in
  // the collection. BreadcrumbList is emitted as a SIBLING <script>, not
  // nested — Google only reads top-level BreadcrumbList for rich results.
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Berita ${tag.name} — Lensaplus`,
    url: `${siteUrl}/tag/${tag.slug}`,
    isPartOf: { "@type": "WebSite", name: "Lensaplus", url: siteUrl },
    description: `${total.toLocaleString("id-ID")} artikel Lensaplus dengan tag ${tag.name}.`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: articles.length,
      itemListElement: articles.map((a, i) => ({
        "@type": "ListItem",
        position: (page - 1) * PER_PAGE + i + 1,
        url: `${siteUrl}/berita/${a.slug}`,
        name: a.title,
      })),
    },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Beranda", item: siteUrl },
      { "@type": "ListItem", position: 2, name: tag.name, item: `${siteUrl}/tag/${tag.slug}` },
    ],
  };

  return (
    <div className="bg-surface min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <div className="container-main py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-txt-secondary">
          <Link href="/" className="transition-colors hover:text-primary">Beranda</Link>
          <span>&gt;</span>
          <span className="text-txt-muted">Tag</span>
          <span>&gt;</span>
          <span className="text-txt-primary font-medium">#{tag.name}</span>
        </nav>

        {/* Header */}
        <div className="mb-6">
          <h1 className="flex items-center gap-3 text-xl font-bold text-txt-primary sm:text-2xl lg:text-3xl">
            <Hash size={24} className="text-primary" />
            Tag: #{tag.name}
          </h1>
          <p className="mt-2 text-sm text-txt-secondary">
            {total.toLocaleString("id-ID")} artikel dengan tag ini
          </p>
        </div>

        {/* Ad slot above articles — suppressed on empty tag pages (no ads on
            content-less pages, per AdSense policy) */}
        {articles.length > 0 && <BannerAd size="slim" />}

        {/* Article grid */}
        {articles.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.slug} {...article} variant="standard" />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <Hash size={48} className="mx-auto text-border" />
            <p className="mt-4 text-txt-secondary">Belum ada berita dengan tag ini</p>
            <Link href="/" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
              Kembali ke Beranda
            </Link>
          </div>
        )}

        {/* Ad slot below articles — suppressed on empty tag pages */}
        {articles.length > 0 && <BannerAd size="slim" />}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            {page > 1 ? (
              <Link
                href={`/tag/${params.slug}?page=${page - 1}`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-txt-primary transition-all hover:border-primary hover:text-primary"
              >
                <ChevronLeft size={16} />
                <span className="hidden sm:inline">Sebelumnya</span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-txt-muted opacity-50">
                <ChevronLeft size={16} />
                <span className="hidden sm:inline">Sebelumnya</span>
              </span>
            )}

            <div className="flex items-center gap-1">
              {startPage > 1 && (
                <>
                  <Link
                    href={`/tag/${params.slug}?page=1`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium text-txt-secondary hover:bg-surface-secondary transition-colors"
                  >
                    1
                  </Link>
                  {startPage > 2 && <span className="px-1 text-txt-muted">...</span>}
                </>
              )}
              {pageNumbers.map((p) => (
                <Link
                  key={p}
                  href={`/tag/${params.slug}?page=${p}`}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    p === page
                      ? "bg-primary text-white"
                      : "text-txt-secondary hover:bg-surface-secondary"
                  }`}
                >
                  {p}
                </Link>
              ))}
              {endPage < totalPages && (
                <>
                  {endPage < totalPages - 1 && <span className="px-1 text-txt-muted">...</span>}
                  <Link
                    href={`/tag/${params.slug}?page=${totalPages}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium text-txt-secondary hover:bg-surface-secondary transition-colors"
                  >
                    {totalPages}
                  </Link>
                </>
              )}
            </div>

            {page < totalPages ? (
              <Link
                href={`/tag/${params.slug}?page=${page + 1}`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-txt-primary transition-all hover:border-primary hover:text-primary"
              >
                <span className="hidden sm:inline">Selanjutnya</span>
                <ChevronRight size={16} />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-txt-muted opacity-50">
                <span className="hidden sm:inline">Selanjutnya</span>
                <ChevronRight size={16} />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
