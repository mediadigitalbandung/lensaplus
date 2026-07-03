/**
 * Sitemap for /sorotan pages — INTENTIONALLY EMPTY.
 *
 * Sorotan entries are AI re-framings of existing articles ("scaled content")
 * and are now noindexed for AdSense compliance. This route stays a valid,
 * empty urlset (HTTP 200, not 404) so any previously-submitted reference
 * resolves cleanly and Search Console drops the URLs it once listed.
 */

export const dynamic = "force-dynamic";
export const revalidate = 600;

export async function GET() {
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
