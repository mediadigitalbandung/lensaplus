export const revalidate = 600;

import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import ArticleCard from "@/components/artikel/ArticleCard";
import { courtLocations, getCourtLocationBySlug } from "@/data/court-locations";
import { prisma } from "@/lib/prisma";
import {
  PUBLIC_ARTICLE_CARD_SELECT,
  type PublicArticleCardRecord,
} from "@/lib/public-article-select";
import { breadcrumbJsonLd, safeJsonLdStringify } from "@/lib/seo/json-ld";
import { safeHref } from "@/components/common/safeHref";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return courtLocations.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params: paramsPromise }: PageProps): Promise<Metadata> {
  const params = await paramsPromise;
  const court = getCourtLocationBySlug(params.slug);
  if (!court) return { title: "Lokasi Tidak Ditemukan" };
  const ogImage = `/api/og?title=${encodeURIComponent(court.name)}&type=lokasi`;
  return {
    title: court.name,
    description: court.description,
    openGraph: {
      title: `${court.name} - Lensaplus`,
      description: court.description,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: court.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${court.name} - Lensaplus`,
      description: court.description,
      images: [ogImage],
    },
    alternates: { canonical: `/lokasi/${court.slug}` },
  };
}

const TYPE_LABEL: Record<string, string> = {
  PN: "Pengadilan Negeri",
  PA: "Pengadilan Agama",
  PT: "Pengadilan Tinggi",
  PTUN: "Pengadilan Tata Usaha Negara",
  PTA: "Pengadilan Tinggi Agama",
  TIPIKOR: "Pengadilan Tipikor",
  MIL: "Pengadilan Militer",
  MA: "Mahkamah Agung",
};

export default async function LokasiDetailPage({ params: paramsPromise }: PageProps) {
  const params = await paramsPromise;
  const court = getCourtLocationBySlug(params.slug);
  if (!court) notFound();

  // Related articles whose title or content includes the court name
  let relatedArticles: PublicArticleCardRecord[] = [];
  try {
    relatedArticles = await prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          { title: { contains: court.shortName, mode: "insensitive" } },
          { title: { contains: court.name, mode: "insensitive" } },
          { content: { contains: court.shortName, mode: "insensitive" } },
        ],
      },
      select: PUBLIC_ARTICLE_CARD_SELECT,
      orderBy: { publishedAt: "desc" },
      take: 6,
    });
  } catch {
    relatedArticles = [];
  }

  const safeWebsiteUrl = safeHref(court.website);
  const safeMapsUrl = safeHref(court.mapsUrl);
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "GovernmentOffice",
    name: court.name,
    description: court.description,
    url: `${siteUrl}/lokasi/${court.slug}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: court.address,
      addressLocality: court.city,
      addressCountry: "ID",
    },
    telephone: court.phone,
    ...(court.email && { email: court.email }),
    ...(safeWebsiteUrl && { sameAs: [safeWebsiteUrl] }),
    openingHours: court.hours,
  };

  const breadcrumb = breadcrumbJsonLd([
    { name: "Beranda", url: "/" },
    { name: "Lokasi", url: "/lokasi" },
    { name: court.shortName, url: `/lokasi/${court.slug}` },
  ]);

  return (
    <div className="bg-surface min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify([jsonLd, breadcrumb]) }}
      />
      <div className="container-main py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-txt-muted">
          <Link href="/" className="hover:text-primary">Beranda</Link>
          <ChevronRight size={14} />
          <Link href="/lokasi" className="hover:text-primary">Lokasi</Link>
          <ChevronRight size={14} />
          <span className="font-medium text-txt-primary truncate">{court.shortName}</span>
        </nav>

        {/* Hero */}
        <header className="mb-8 rounded-lg border border-border bg-surface-container-lowest p-6 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                {TYPE_LABEL[court.type] ?? court.type}
              </span>
              <h1 className="mt-2 font-serif text-2xl font-bold leading-tight text-on-surface sm:text-3xl">
                {court.name}
              </h1>
              <p className="mt-3 max-w-2xl text-base text-on-surface-variant">
                {court.description}
              </p>
              <p className="mt-4 text-sm text-on-surface-variant">
                <span className="font-semibold text-on-surface">Alamat:</span> {court.address}
              </p>
            </div>
            {safeMapsUrl && (
              <a
                href={safeMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
              >
                <ExternalLink size={14} aria-hidden="true" />
                Buka di Google Maps
              </a>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            {/* Related articles */}
            <section>
              <h2 className="mb-4 border-l-[3px] border-primary pl-3 text-lg font-bold text-on-surface">
                Berita Terkait
              </h2>
              {relatedArticles.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:gap-6">
                  {relatedArticles.map((a) => (
                    <ArticleCard
                      key={a.slug}
                      title={a.title}
                      slug={a.slug}
                      excerpt={a.excerpt}
                      featuredImage={a.featuredImage}
                      category={a.category}
                      author={a.author}
                      publishedAt={a.publishedAt}
                      viewCount={a.viewCount}
                      variant="standard"
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border bg-surface-container-low p-6 text-sm text-on-surface-variant">
                  Belum ada berita terkait yang ditandai untuk pengadilan ini.
                </p>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-1 space-y-6">
            <div className="rounded-lg border border-border bg-surface-container-lowest p-5 shadow-card">
              <h3 className="mb-4 border-l-[3px] border-primary pl-3 text-sm font-bold uppercase tracking-wider text-on-surface">
                Kontak &amp; Operasional
              </h3>
              <ul className="space-y-3 text-sm text-on-surface-variant">
                <li>
                  <span className="font-semibold text-on-surface">Telepon:</span>{" "}
                  <span>{court.phone}</span>
                </li>
                {court.email && (
                  <li>
                    <span className="font-semibold text-on-surface">Email:</span>{" "}
                    <a href={`mailto:${court.email}`} className="hover:text-primary">
                      {court.email}
                    </a>
                  </li>
                )}
                {safeWebsiteUrl && (
                  <li>
                    <span className="font-semibold text-on-surface">Situs Web:</span>{" "}
                    <a
                      href={safeWebsiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all hover:text-primary"
                    >
                      {safeWebsiteUrl.replace(/^https?:\/\//, "")}
                    </a>
                  </li>
                )}
                <li>
                  <span className="font-semibold text-on-surface">Jam Layanan:</span>{" "}
                  <span>{court.hours}</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-surface-container-lowest p-5 shadow-card">
              <h3 className="mb-3 border-l-[3px] border-primary pl-3 text-sm font-bold uppercase tracking-wider text-on-surface">
                Wilayah Hukum
              </h3>
              <p className="text-sm text-on-surface-variant">{court.jurisdiction}</p>
            </div>

            <div className="rounded-lg border border-border bg-surface-container-lowest p-5 shadow-card">
              <h3 className="mb-3 border-l-[3px] border-primary pl-3 text-sm font-bold uppercase tracking-wider text-on-surface">
                Pengadilan Lain
              </h3>
              <ul className="space-y-2 text-sm">
                {courtLocations
                  .filter((c) => c.slug !== court.slug)
                  .slice(0, 6)
                  .map((c) => (
                    <li key={c.slug}>
                      <Link
                        href={`/lokasi/${c.slug}`}
                        className="text-on-surface hover:text-primary transition-colors"
                      >
                        {c.shortName}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
