export const revalidate = 300;

import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";
import { ChevronRight, Newspaper, CalendarDays, Layers } from "lucide-react";
import ArticleCard from "@/components/artikel/ArticleCard";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface ResolvedDigest {
  title: string;
  intro: string;
  range: { from: Date; to: Date } | null;
  category?: { name: string; slug: string };
}

async function resolveDigest(slug: string): Promise<ResolvedDigest | null> {
  const now = new Date();
  if (slug === "pekan-ini") {
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      title: "Rangkuman Pekan Ini",
      intro:
        "Sorotan berita sepekan terakhir — bisnis, ekonomi, pemerintahan, hukum, olahraga, dan peristiwa penting lainnya di Bandung dan nasional.",
      range: { from, to: now },
    };
  }
  if (slug === "bulan-ini") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      title: "Rangkuman Bulan Ini",
      intro:
        "Ringkasan agenda dan peristiwa penting yang terjadi sepanjang bulan berjalan dari berbagai topik.",
      range: { from, to: now },
    };
  }

  // Otherwise treat as category slug
  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) return null;
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    title: `Rangkuman ${category.name}`,
    intro: `Ringkasan berita ${category.name.toLowerCase()} dalam 30 hari terakhir di Kartawarta.`,
    range: { from, to: now },
    category: { name: category.name, slug: category.slug },
  };
}

export async function generateMetadata({ params: paramsPromise }: PageProps): Promise<Metadata> {
  const params = await paramsPromise;
  const digest = await resolveDigest(params.slug);
  if (!digest) return { title: "Rangkuman Tidak Ditemukan" };
  const ogImage = `/api/og?title=${encodeURIComponent(digest.title)}&type=rangkuman`;
  return {
    title: digest.title,
    description: digest.intro,
    openGraph: {
      title: `${digest.title} - Kartawarta`,
      description: digest.intro,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: digest.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${digest.title} - Kartawarta`,
      description: digest.intro,
      images: [ogImage],
    },
    alternates: { canonical: `/rangkuman/${params.slug}` },
  };
}

export default async function RangkumanDetailPage({ params: paramsPromise }: PageProps) {
  const params = await paramsPromise;
  const digest = await resolveDigest(params.slug);
  if (!digest || !digest.range) notFound();

  const where = digest.category
    ? {
        status: "PUBLISHED" as const,
        publishedAt: { gte: digest.range.from, lte: digest.range.to },
        category: { slug: digest.category.slug },
      }
    : {
        status: "PUBLISHED" as const,
        publishedAt: { gte: digest.range.from, lte: digest.range.to },
      };

  const [articles, otherDigests] = await Promise.all([
    prisma.article.findMany({
      where,
      include: { author: true, category: true },
      orderBy: { publishedAt: "desc" },
      take: 30,
    }),
    prisma.category.findMany({
      where: digest.category ? { NOT: { slug: digest.category.slug } } : undefined,
      orderBy: { order: "asc" },
      take: 6,
    }),
  ]);

  const hero = articles[0];
  const rest = articles.slice(1);

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${digest.title} — Kartawarta`,
    description: digest.intro,
    url: `${siteUrl}/rangkuman/${params.slug}`,
    isPartOf: { "@type": "WebSite", name: "Kartawarta", url: siteUrl },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Beranda", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Rangkuman", item: `${siteUrl}/rangkuman` },
        { "@type": "ListItem", position: 3, name: digest.title },
      ],
    },
    hasPart: articles.slice(0, 10).map((a) => ({
      "@type": "NewsArticle",
      headline: a.title,
      url: `${siteUrl}/berita/${a.slug}`,
      datePublished: a.publishedAt?.toISOString(),
    })),
  };

  return (
    <div className="bg-surface min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="container-main py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-txt-muted">
          <Link href="/" className="hover:text-primary">Beranda</Link>
          <ChevronRight size={14} />
          <Link href="/rangkuman" className="hover:text-primary">Rangkuman</Link>
          <ChevronRight size={14} />
          <span className="font-medium text-txt-primary">{digest.title}</span>
        </nav>

        <div className="mb-8 max-w-3xl">
          <div className="flex items-center gap-3">
            <span className="block h-7 w-[3px] rounded-full bg-primary" />
            <h1 className="flex items-center gap-2 text-xl font-bold text-txt-primary sm:text-2xl lg:text-3xl">
              <Newspaper size={22} className="text-primary" />
              {digest.title}
            </h1>
          </div>
          <p className="mt-3 text-base text-on-surface-variant">{digest.intro}</p>
          <p className="mt-2 flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
            <CalendarDays size={12} />
            {digest.range.from.toLocaleDateString("id-ID", { day: "numeric", month: "long" })}
            {" – "}
            {digest.range.to.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
            <span className="mx-1.5 text-on-surface-variant/40">/</span>
            {articles.length} artikel
          </p>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {hero ? (
              <article className="mb-8 group">
                <Link href={`/berita/${hero.slug}`} className="block">
                  <div className="relative aspect-[16/9] overflow-hidden rounded-sm">
                    {hero.featuredImage ? (
                      <Image
                        src={hero.featuredImage}
                        alt={hero.title}
                        fill
                        priority
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="h-full w-full bg-surface-container" />
                    )}
                  </div>
                </Link>
                <div className="mt-4">
                  <Link
                    href={`/kategori/${hero.category.slug}`}
                    className="text-label-md font-bold uppercase tracking-wider text-primary"
                  >
                    {hero.category.name}
                  </Link>
                  <Link href={`/berita/${hero.slug}`}>
                    <h2 className="mt-2 font-serif text-headline-md leading-tight text-on-surface group-hover:text-primary transition-colors">
                      {hero.title}
                    </h2>
                  </Link>
                  {hero.excerpt && (
                    <p className="mt-3 line-clamp-3 text-base text-on-surface-variant">{hero.excerpt}</p>
                  )}
                </div>
              </article>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-border py-16 text-center">
                <Layers size={36} className="mx-auto text-border" />
                <p className="mt-4 text-on-surface-variant">Belum ada artikel pada periode ini.</p>
                <p className="text-sm text-txt-muted">Coba kembali nanti — redaksi rutin menerbitkan berita baru.</p>
              </div>
            )}

            {rest.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:gap-6">
                {rest.map((a) => (
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
            )}
          </div>

          <aside className="lg:col-span-1">
            <div className="rounded-lg border border-border bg-surface-container-low p-5">
              <h3 className="mb-4 border-l-[3px] border-primary pl-3 text-sm font-bold uppercase tracking-wider text-on-surface">
                Rangkuman Lainnya
              </h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href="/rangkuman/pekan-ini" className="text-on-surface hover:text-primary transition-colors">
                    Rangkuman Pekan Ini
                  </Link>
                </li>
                <li>
                  <Link href="/rangkuman/bulan-ini" className="text-on-surface hover:text-primary transition-colors">
                    Rangkuman Bulan Ini
                  </Link>
                </li>
                <li>
                  <Link href="/rangkuman/harian" className="text-on-surface hover:text-primary transition-colors">
                    Arsip Rangkuman Harian
                  </Link>
                </li>
                {otherDigests.slice(0, 4).map((cat) => (
                  <li key={cat.slug}>
                    <Link
                      href={`/rangkuman/${cat.slug}`}
                      className="text-on-surface hover:text-primary transition-colors"
                    >
                      Rangkuman {cat.name}
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
