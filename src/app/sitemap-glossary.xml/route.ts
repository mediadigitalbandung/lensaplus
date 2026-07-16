/**
 * Sitemap for /glossary terms — separate from main sitemap.xml
 * for cleaner indexing analytics in Search Console.
 */

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 600; // 10 min

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com";

function esc(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const items = await prisma.glossary.findMany({
    where: { isPublished: true },
    select: { slug: true, updatedAt: true },
    orderBy: { istilah: "asc" },
  });

  const urls: string[] = [
    `<url><loc>${SITE_URL}/glossary</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
  ];

  for (const item of items) {
    urls.push(
      `<url>` +
        `<loc>${esc(`${SITE_URL}/glossary/${item.slug}`)}</loc>` +
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
