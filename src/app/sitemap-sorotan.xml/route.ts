/**
 * Sitemap for /sorotan SEO summary pages — 3 angle per article (kronologi/
 * analisis/dampak). Separate sitemap so Search Console can track Sorotan
 * indexing distinctly from main articles.
 */

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 600;

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";

function esc(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const items = await prisma.sorotan.findMany({
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 5000,
  });

  const urls: string[] = [
    `<url><loc>${SITE_URL}/sorotan</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`,
  ];

  for (const item of items) {
    urls.push(
      `<url>` +
        `<loc>${esc(`${SITE_URL}/sorotan/${item.slug}`)}</loc>` +
        `<lastmod>${item.updatedAt.toISOString()}</lastmod>` +
        `<changefreq>monthly</changefreq>` +
        `<priority>0.6</priority>` +
        `</url>`
    );
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.join("\n") +
    `\n</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
