export const dynamic = "force-dynamic";

import Link from "next/link";
import { Metadata } from "next";
import { ChevronRight, CalendarDays, Newspaper } from "lucide-react";
import ArticleCard from "@/components/artikel/ArticleCard";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseSlugDate(slug: string): { from: Date; to: Date } | null {
  const m = slug.match(DATE_RE);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (!y || !mo || !d || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const from = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (
    from.getFullYear() !== y ||
    from.getMonth() !== mo - 1 ||
    from.getDate() !== d
  )
    return null;
  const to = new Date(y, mo - 1, d, 23, 59, 59, 999);
  if (from.getTime() > Date.now()) return null;
  return { from, to };
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function generateMetadata({ params: paramsPromise }: PageProps): Promise<Metadata> {
  const params = await paramsPromise;
  const range = parseSlugDate(params.slug);
  if (!range) return { title: "Rangkuman Harian Tidak Ditemukan" };
  const dateStr = fmtDay(range.from);
  return {
    title: `Rangkuman ${dateStr}`,
    description: `Ringkasan berita yang terbit pada ${dateStr} di Kartawarta.`,
    openGraph: {
      title: `Rangkuman ${dateStr} - Kartawarta`,
      description: `Ringkasan berita yang terbit pada ${dateStr}.`,
      type: "website",
    },
    alternates: { canonical: `/rangkuman/harian/${params.slug}` },
  };
}

export default async function RangkumanHarianDetailPage({ params: paramsPromise }: PageProps) {
  const params = await paramsPromise;
  const range = parseSlugDate(params.slug);
  if (!range) notFound();

  const articles = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { gte: range.from, lte: range.to },
    },
    include: { author: true, category: true },
    orderBy: { publishedAt: "desc" },
  });

  if (articles.length === 0) notFound();

  const dateStr = fmtDay(range.from);
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Rangkuman ${dateStr}`,
    description: `Ringkasan berita Kartawarta pada ${dateStr}.`,
    url: `${siteUrl}/rangkuman/harian/${params.slug}`,
    isPartOf: { "@type": "WebSite", name: "Kartawarta", url: siteUrl },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Beranda", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Rangkuman", item: `${siteUrl}/rangkuman` },
        { "@type": "ListItem", position: 3, name: "Harian", item: `${siteUrl}/rangkuman/harian` },
        { "@type": "ListItem", position: 4, name: dateStr },
      ],
    },
    hasPart: articles.map((a) => ({
      "@type": "NewsArticle",
      headline: a.title,
      url: `${siteUrl}/berita/${a.slug}`,
      datePublished: a.publishedAt?.toISOString(),
      author: { "@type": "Person", name: a.author.name },
      articleSection: a.category.name,
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
          <Link href="/rangkuman/harian" className="hover:text-primary">Harian</Link>
          <ChevronRight size={14} />
          <span className="font-medium text-txt-primary">{dateStr}</span>
        </nav>

        <div className="mb-8 max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="block h-7 w-[3px] rounded-full bg-primary" />
            <h1 className="flex items-center gap-2 text-xl font-bold text-txt-primary sm:text-2xl lg:text-3xl">
              <CalendarDays size={22} className="text-primary" />
              Rangkuman {dateStr}
            </h1>
          </div>
          <p className="mt-3 text-sm text-on-surface-variant">
            Berikut ringkasan berita Kartawarta yang terbit pada hari ini. Total{" "}
            <span className="font-semibold text-on-surface">
              {articles.length.toLocaleString("id-ID")} artikel
            </span>
            .
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
            <Newspaper size={12} />
            {articles.length} artikel
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <ArticleCard
              key={a.slug}
              title={a.title}
              slug={a.slug}
              excerpt={a.excerpt}
              featuredImage={a.featuredImage}
              category={a.category}
              author={a.author}
              publishedAt={a.publishedAt}
              variant="standard"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
