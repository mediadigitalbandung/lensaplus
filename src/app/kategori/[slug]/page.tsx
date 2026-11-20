export const revalidate = 60; // ISR: revalidate category page every 60 seconds

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import ArticleCard from "@/components/artikel/ArticleCard";
import PaginatedArticles from "@/components/artikel/PaginatedArticles";
import SearchableArticleList from "@/components/artikel/SearchableArticleList";
import Sidebar from "@/components/layout/Sidebar";
import HeadlineSlider from "@/components/slider/HeadlineSlider";
import SubHeadlineSlider from "@/components/slider/SubHeadlineSlider";
import PollingCarousel from "@/components/slider/PollingCarousel";
import VideoStory from "@/components/slider/VideoStory";
import BannerAd, { SidebarAd } from "@/components/ads/BannerAd";
import { getPublishedReels } from "@/lib/video-story";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getCached } from "@/lib/cache";
import {
  HOME_TRENDING_ARTICLE_SELECT,
  HOME_TRENDING_CACHE_KEY,
  PUBLIC_ARTICLE_CARD_SELECT,
  serializePublicArticleCards,
} from "@/lib/public-article-select";
import { safeJsonLdStringify } from "@/lib/seo/json-ld";

async function getCategory(slug: string) {
  return prisma.category.findUnique({ where: { slug } });
}

export async function generateMetadata({ params: paramsPromise }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await paramsPromise;
  const category = await getCategory(params.slug);
  if (!category) return { title: "Kategori Tidak Ditemukan" };

  const title = `${category.name} - Berita Terkini`;
  const description = `Kumpulan berita ${category.name.toLowerCase()} terbaru dari Lensaplus — media berita digital nasional Indonesia. Menyajikan liputan terpercaya dan terverifikasi Dewan Pers.`;

  // AdSense thin-content: an empty category page (no published articles) has
  // no value — noindex it. Non-empty categories stay indexable.
  const publishedCount = await prisma.article.count({
    where: { status: "PUBLISHED", categoryId: category.id },
  });
  const indexable = publishedCount > 0;

  return {
    title,
    description,
    robots: indexable
      ? undefined
      : { index: false, follow: true, googleBot: { index: false } },
    openGraph: {
      title: `${title} | Lensaplus`,
      description,
      type: "website",
      locale: "id_ID",
      siteName: "Lensaplus",
      images: [{ url: "/lensaplus-icon.png", width: 512, height: 512, alt: "Lensaplus" }],
    },
    alternates: {
      canonical: `/kategori/${params.slug}`,
    },
  };
}

export default async function CategoryPage({ params: paramsPromise }: { params: Promise<{ slug: string }> }) {
  const params = await paramsPromise;
  const category = await getCategory(params.slug);
  if (!category) notFound();

  // Real Instagram Reels (rendered in the CMS) for the Video Story strip.
  const reels = await getPublishedReels(20);

  const [articles, trendingArticles] = await Promise.all([
    prisma.article.findMany({
      where: { status: "PUBLISHED", categoryId: category.id },
      select: PUBLIC_ARTICLE_CARD_SELECT,
      orderBy: { publishedAt: "desc" },
      take: 20,
    }),
    getCached(HOME_TRENDING_CACHE_KEY, 60_000, async () => {
      const past24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      let trending = await prisma.article.findMany({
        where: {
          status: "PUBLISHED",
          publishedAt: { gte: past24Hours },
        },
        select: HOME_TRENDING_ARTICLE_SELECT,
        orderBy: { viewCount: "desc" },
        take: 10,
      });

      if (trending.length < 6) {
        const past7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        trending = await prisma.article.findMany({
          where: {
            status: "PUBLISHED",
            publishedAt: { gte: past7Days },
          },
          select: HOME_TRENDING_ARTICLE_SELECT,
          orderBy: { viewCount: "desc" },
          take: 10,
        });
      }

      if (trending.length < 6) {
        trending = await prisma.article.findMany({
          where: { status: "PUBLISHED" },
          select: HOME_TRENDING_ARTICLE_SELECT,
          orderBy: { viewCount: "desc" },
          take: 10,
        });
      }

      return trending;
    }),
  ]);

  const sidebarTrending = trendingArticles.map((a) => ({
    title: a.title,
    slug: a.slug,
    category: a.category.name,
    publishedAt: a.publishedAt
      ? new Date(a.publishedAt).toISOString()
      : "",
    viewCount: a.viewCount,
    featuredImage: a.featuredImage,
  }));

  const serializedArticles = serializePublicArticleCards(articles);
  const gridOffset = serializedArticles.length >= 7 ? 11 : serializedArticles.length >= 3 ? 5 : 0;
  const remainingGridArticles = serializedArticles.slice(gridOffset);
  const paginatedArticles =
    remainingGridArticles.length > 0 ? remainingGridArticles : serializedArticles;

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com";
  // CollectionPage + ItemList so crawlers see what's in this category, plus a
  // sibling BreadcrumbList script for rich-result eligibility.
  const categoryJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.name} — Lensaplus`,
    description: category.description || `Berita ${category.name} terbaru dari Lensaplus.`,
    url: `${siteUrl}/kategori/${category.slug}`,
    isPartOf: { "@type": "WebSite", name: "Lensaplus", url: siteUrl },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: articles.length,
      itemListElement: articles.map((a: { slug: string; title: string }, i: number) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${siteUrl}/berita/${a.slug}`,
        name: a.title,
      })),
    },
  };
  const categoryBreadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Beranda", item: siteUrl },
      { "@type": "ListItem", position: 2, name: category.name, item: `${siteUrl}/kategori/${category.slug}` },
    ],
  };

  return (
    <div className="bg-surface min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(categoryJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(categoryBreadcrumbJsonLd) }} />
      <div className="container-main py-6 sm:py-8 lg:py-10 2xl:py-14">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-txt-muted">
          <Link href="/" className="hover:text-primary">Beranda</Link>
          <ChevronRight size={14} />
          <span className="font-medium text-txt-primary">{category.name}</span>
        </nav>

        <div className="mb-6">
          <h1 className="flex items-center gap-3 font-serif text-headline-sm font-bold text-txt-primary sm:text-headline-md lg:text-headline-lg">
            <span className="block h-7 w-[3px] rounded-full bg-secondary" />
            {category.name}
          </h1>
          <p className="mt-1 text-sm text-txt-muted">
            Kumpulan berita {category.name.toLowerCase()} terbaru dan terpercaya
          </p>
        </div>

        {/* Banner Ad — Leaderboard */}
        <div className="mb-6">
          <BannerAd slot="HEADER" />
        </div>

        {/* Headline slider */}
        {serializedArticles.length >= 3 && (
          <div className="mb-6">
            <HeadlineSlider items={serializedArticles.slice(0, 5)} />
          </div>
        )}

        {/* Sub-headline slider — crossfade like headline */}
        {serializedArticles.length >= 7 && (
          <div className="mb-6">
            <SubHeadlineSlider items={serializedArticles.slice(5, 11)} />
          </div>
        )}

        {/* Polling — live interactive carousel */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <h2 className="border-l-[3px] border-primary pl-3 text-lg font-bold text-txt-primary">
              Polling {category.name}
            </h2>
          </div>
          <PollingCarousel categorySlug={params.slug} />
        </div>

        {/* Banner Ad — below polling */}
        <div className="mb-6">
          <BannerAd slot="BETWEEN_SECTIONS" />
        </div>

        {/* Video Story — real Instagram Reels made in the CMS */}
        {reels.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="border-l-[3px] border-primary pl-3 text-lg font-bold text-txt-primary flex items-center">
                Video Story
              </h2>
              <Link href="/video" className="text-sm font-medium text-primary hover:underline">
                Lihat Semua &rarr;
              </Link>
            </div>
            <VideoStory items={reels} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {/* Section header */}
            <div className="mb-5">
              <h2 className="border-l-[3px] border-primary pl-3 text-lg font-bold text-txt-primary">
                Berita Terkini {category.name}
              </h2>
            </div>
            {/* Articles grid — paginated, 6 per page */}
            {paginatedArticles.length > 0 ? (
              <PaginatedArticles articles={paginatedArticles} perPage={6} />
            ) : (
              <div className="rounded-lg border-2 border-dashed border-border py-16 text-center">
                <p className="text-txt-muted">Belum ada artikel di kategori ini.</p>
              </div>
            )}
          </div>

          <div className="lg:col-span-1 flex flex-col">
            <Sidebar trending={sidebarTrending} />
            <div className="mt-5">
              <SidebarAd />
            </div>
          </div>
        </div>

        {/* Banner Ad — Bottom full width */}
        <div className="mt-8">
          <BannerAd slot="IN_ARTICLE" />
        </div>

        {/* Semua Berita — searchable list view */}
        <section className="mt-8">
          <div className="mb-5">
            <h2 className="border-l-[3px] border-primary pl-3 text-lg font-bold text-txt-primary">
              Semua Berita {category.name}
            </h2>
          </div>
          <SearchableArticleList
            articles={serializedArticles}
            categoryName={category.name.toLowerCase()}
          />
        </section>

        {/* Banner Ad — paling bawah */}
        <div className="mt-8">
          <BannerAd slot="FOOTER" />
        </div>
      </div>
    </div>
  );
}
