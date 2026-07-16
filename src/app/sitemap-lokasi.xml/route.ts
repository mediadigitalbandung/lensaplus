/**
 * Sitemap for /lokasi pengadilan directory.
 * Static — pulls from src/data/court-locations.ts.
 */

import { courtLocations } from "@/data/court-locations";

export const dynamic = "force-static";
export const revalidate = 86400; // 1 day

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
  const urls: string[] = [
    `<url><loc>${SITE_URL}/lokasi</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>`,
  ];

  for (const loc of courtLocations) {
    urls.push(
      `<url>` +
        `<loc>${esc(`${SITE_URL}/lokasi/${loc.slug}`)}</loc>` +
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
      "Cache-Control": "s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
