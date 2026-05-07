/**
 * Google News sitemap — articles published in the last 48 hours.
 *
 * Spec: https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
 */

import { prisma } from "@/lib/prisma";

// Google News sitemap MUST reflect the last 48-hour publishing window in
// near-real-time (window slides every minute). Keep `force-dynamic` so each
// request runs the query; CDN caching is governed by the response
// Cache-Control header (public, max-age=300, s-maxage=300) below.
// Note: Next.js ignores `revalidate` when `dynamic = "force-dynamic"`, so
// declaring both was redundant — removed to avoid cosmetic conflict.
export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const since = new Date(Date.now() - TWO_DAYS_MS);

  const articles = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { gte: since },
    },
    select: {
      slug: true,
      title: true,
      publishedAt: true,
      tags: { select: { name: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: 1000,
  });

  const urls = articles
    .filter((a) => a.publishedAt)
    .map((a) => {
      const loc = `${SITE_URL}/berita/${a.slug}`;
      const keywords = a.tags.map((t) => t.name).join(", ");
      return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <news:news>
      <news:publication>
        <news:name>Kartawarta</news:name>
        <news:language>id</news:language>
      </news:publication>
      <news:publication_date>${a.publishedAt!.toISOString()}</news:publication_date>
      <news:title>${escapeXml(a.title)}</news:title>${keywords ? `
      <news:keywords>${escapeXml(keywords)}</news:keywords>` : ""}
    </news:news>
  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
