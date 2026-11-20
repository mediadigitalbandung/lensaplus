/**
 * GET /sitemap.xml
 *
 * Main sitemap — replaces the MetadataRoute sitemap.ts with an explicit
 * route handler so we can set deterministic Cache-Control headers for
 * Cloudflare (s-maxage=600 stale-while-revalidate=86400).
 *
 * Covers: static pages, categories, articles (latest 1000), tags,
 * authors, and topic cluster pages.
 *
 * Next.js revalidates the RSC data every 600 s (10 min) matching
 * the s-maxage so Cloudflare and Next ISR stay in sync.
 */

import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function url(
  loc: string,
  lastmod?: Date | string,
  changefreq?: string,
  priority?: number,
): string {
  const lm = lastmod
    ? typeof lastmod === "string"
      ? lastmod
      : lastmod.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  return [
    "  <url>",
    `    <loc>${escapeXml(loc)}</loc>`,
    `    <lastmod>${lm}</lastmod>`,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : "",
    priority !== undefined ? `    <priority>${priority.toFixed(1)}</priority>` : "",
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function GET() {
  const now = new Date();

  // Static pages
  const staticUrls = [
    url(SITE_URL, now, "hourly", 1.0),
    url(`${SITE_URL}/berita`, now, "hourly", 0.9),
    url(`${SITE_URL}/tentang`, now, "monthly", 0.3),
    url(`${SITE_URL}/redaksi`, now, "monthly", 0.3),
    url(`${SITE_URL}/kontak`, now, "monthly", 0.3),
    url(`${SITE_URL}/unduh`, now, "monthly", 0.6),
    url(`${SITE_URL}/newsletter`, now, "monthly", 0.5),
    url(`${SITE_URL}/privasi`, now, "yearly", 0.2),
    url(`${SITE_URL}/syarat-ketentuan`, now, "yearly", 0.2),
    url(`${SITE_URL}/kode-etik`, now, "yearly", 0.2),
    url(`${SITE_URL}/pedoman-media`, now, "yearly", 0.2),
  ];

  let categoryUrls: string[] = [];
  let articleUrls: string[] = [];
  let tagUrls: string[] = [];
  let authorUrls: string[] = [];
  let topicUrls: string[] = [];
  let dbFailed = false;

  try {
    const [categories, articles, tags, authors] = await Promise.all([
      prisma.category.findMany({
        where: { articles: { some: { status: "PUBLISHED" } } },
        select: { slug: true },
      }),
      prisma.article.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
        orderBy: { publishedAt: "desc" },
        take: 1000,
      }),
      prisma.tag.findMany({
        where: { articles: { some: { status: "PUBLISHED" } } },
        select: { slug: true },
      }),
      prisma.user.findMany({
        where: { isActive: true, articles: { some: { status: "PUBLISHED" } } },
        select: { name: true },
      }),
    ]);

    categoryUrls = categories.map((c) =>
      url(`${SITE_URL}/kategori/${c.slug}`, now, "hourly", 0.8),
    );
    articleUrls = articles.map((a) =>
      url(`${SITE_URL}/berita/${a.slug}`, a.updatedAt, "weekly", 0.6),
    );
    tagUrls = tags.map((t) =>
      url(`${SITE_URL}/tag/${t.slug}`, now, "daily", 0.5),
    );
    const authorSlugs = Array.from(
      new Set(authors.map((u) => slugify(u.name)).filter(Boolean)),
    );
    authorUrls = authorSlugs.map((slug) =>
      url(`${SITE_URL}/penulis/${slug}`, now, "weekly", 0.4),
    );

    try {
      const topics = await prisma.topic.findMany({
        where: { isPublished: true },
        select: { slug: true, updatedAt: true },
      });
      topicUrls = topics.map((t) =>
        url(`${SITE_URL}/topik/${t.slug}`, t.updatedAt, "weekly", 0.7),
      );
    } catch {
      // Topic query unavailable — skip gracefully
    }
  } catch (err) {
    dbFailed = true;
    console.warn("[sitemap.xml] DB query failed, returning static fallback:", err);
  }

  const allUrls = [
    ...staticUrls,
    ...categoryUrls,
    ...articleUrls,
    ...tagUrls,
    ...authorUrls,
    ...topicUrls,
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...allUrls,
    "</urlset>",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Don't edge-cache fallback output when DB was unavailable.
      "Cache-Control": dbFailed
        ? "no-store"
        : "public, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
