export const revalidate = 300;

import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ArticleCard from "@/components/artikel/ArticleCard";
import { Layers } from "lucide-react";

// Topic model added via schema migration — cast needed until Prisma client regenerates.
// biome-ignore lint: prisma cast
const db = prisma as any;

const ARTICLES_PER_PAGE = 12;

interface TopicTag {
  id: string;
  name: string;
  slug: string;
}

interface TopicRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  metaTitle: string | null;
  metaDescription: string | null;
  coverImage: string | null;
  isPublished: boolean;
  tags: TopicTag[];
}

async function getTopic(slug: string): Promise<TopicRecord | null> {
  try {
    return await db.topic.findFirst({
      where: { slug, isPublished: true },
      include: {
        tags: { select: { id: true, name: true, slug: true } },
      },
    });
  } catch {
    return null;
  }
}

async function getArticlesForTopic(tagIds: string[], page: number) {
  const skip = (page - 1) * ARTICLES_PER_PAGE;
  const where = {
    status: "PUBLISHED" as const,
    tags: { some: { id: { in: tagIds } } },
  };

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      include: {
        author: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, slug: true } },
        tags: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { publishedAt: "desc" },
      skip,
      take: ARTICLES_PER_PAGE,
    }),
    prisma.article.count({ where }),
  ]);

  return { articles, total, totalPages: Math.ceil(total / ARTICLES_PER_PAGE) };
}

export async function generateMetadata({ params: paramsPromise }: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const params = await paramsPromise;
  const topic = await getTopic(params.slug);

  if (!topic) return {};

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";
  const title = topic.metaTitle || `${topic.name} — Kartawarta`;
  const description = topic.metaDescription || topic.description.slice(0, 160);
  const canonical = `${siteUrl}/topik/${topic.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical,
      ...(topic.coverImage && {
        images: [{ url: topic.coverImage, width: 1200, height: 630, alt: topic.name }],
      }),
    },
    twitter: {
      card: topic.coverImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(topic.coverImage && { images: [topic.coverImage] }),
    },
  };
}

export default async function TopikDetailPage({ params: paramsPromise, searchParams: searchParamsPromise }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await paramsPromise;
  const searchParams = await searchParamsPromise;
  const topic = await getTopic(params.slug);

  // No topic cluster found — fall back to the original kategori redirect.
  if (!topic) {
    permanentRedirect(`/kategori/${params.slug}`);
  }

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const tagIds = topic.tags.map((t: TopicTag) => t.id);
  const { articles, total, totalPages } = await getArticlesForTopic(tagIds, page);

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";
  const canonical = `${siteUrl}/topik/${topic.slug}`;

  const collectionPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": canonical,
    name: topic.name,
    description: topic.description,
    url: canonical,
    ...(topic.coverImage && { image: topic.coverImage }),
    hasPart: articles.slice(0, 10).map((a) => ({
      "@type": "Article",
      name: a.title,
      url: `${siteUrl}/berita/${a.slug}`,
      datePublished: a.publishedAt?.toISOString(),
      author: { "@type": "Person", name: a.author.name },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Beranda", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Topic Cluster", item: `${siteUrl}/topik` },
      { "@type": "ListItem", position: 3, name: topic.name, item: canonical },
    ],
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Artikel tentang ${topic.name}`,
    numberOfItems: total,
    itemListElement: articles.map((a, i) => ({
      "@type": "ListItem",
      position: (page - 1) * ARTICLES_PER_PAGE + i + 1,
      url: `${siteUrl}/berita/${a.slug}`,
      name: a.title,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      <main className="container-main py-10">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1 text-xs text-txt-muted">
          <Link href="/" className="hover:text-primary">Beranda</Link>
          <span>/</span>
          <Link href="/topik" className="hover:text-primary">Topic Cluster</Link>
          <span>/</span>
          <span className="text-txt-secondary">{topic.name}</span>
        </nav>

        {/* Hero */}
        <div className="relative mb-10 overflow-hidden rounded-xl bg-primary">
          {topic.coverImage && (
            <Image
              src={topic.coverImage}
              alt={topic.name}
              fill
              className="object-cover opacity-20"
              priority
              sizes="(max-width: 768px) 100vw, 1200px"
            />
          )}
          <div className="relative z-10 px-8 py-12">
            <div className="mb-3 flex items-center gap-2">
              <Layers size={22} className="text-on-primary/80" />
              <span className="text-sm font-medium uppercase tracking-widest text-on-primary/70">
                Topic Cluster
              </span>
            </div>
            <h1 className="font-serif text-4xl font-bold text-on-primary">
              {topic.name}
            </h1>
            <p className="mt-3 max-w-2xl text-base text-on-primary/80">
              {topic.description}
            </p>
            {topic.tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {topic.tags.map((tag: TopicTag) => (
                  <Link
                    key={tag.id}
                    href={`/tag/${tag.slug}`}
                    className="rounded-full border border-on-primary/30 px-3 py-1 text-xs text-on-primary/90 hover:bg-on-primary/10"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Article count */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-txt-secondary">
            {total > 0 ? (
              <>
                Menampilkan{" "}
                <span className="font-medium text-txt-primary">
                  {(page - 1) * ARTICLES_PER_PAGE + 1}–
                  {Math.min(page * ARTICLES_PER_PAGE, total)}
                </span>{" "}
                dari {total} artikel
              </>
            ) : (
              "Belum ada artikel untuk topik ini."
            )}
          </p>
        </div>

        {/* Article grid */}
        {articles.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                title={article.title}
                slug={article.slug}
                excerpt={article.excerpt}
                featuredImage={article.featuredImage}
                category={article.category}
                author={article.author}
                publishedAt={article.publishedAt}
                readTime={article.readTime}
                viewCount={article.viewCount}
                verificationLabel={article.verificationLabel}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface p-12 text-center">
            <Layers size={40} className="mx-auto mb-3 text-txt-muted" />
            <p className="text-txt-secondary">
              Belum ada artikel yang dipublikasikan untuk topik ini.
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            {page > 1 && (
              <Link
                href={`/topik/${topic.slug}?page=${page - 1}`}
                className="btn-outline-green px-5 py-2 text-sm"
              >
                Sebelumnya
              </Link>
            )}
            <span className="text-sm text-txt-secondary">
              Halaman {page} / {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/topik/${topic.slug}?page=${page + 1}`}
                className="btn-primary px-5 py-2 text-sm"
              >
                Berikutnya
              </Link>
            )}
          </div>
        )}
      </main>
    </>
  );
}
