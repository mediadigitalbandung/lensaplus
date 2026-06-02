/**
 * Legacy duplicate of the Google News sitemap. The canonical news sitemap is
 * /sitemap-news.xml (the one referenced in robots.txt). This route used to emit
 * a second, slightly divergent news sitemap (it included image-less articles),
 * which risked Google ingesting two URL sets for the same content.
 *
 * Kept as a permanent 301 redirect so any externally cached/submitted link
 * (e.g. previously added in Search Console) lands on the canonical sitemap
 * instead of a 404.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";
  return Response.redirect(`${siteUrl}/sitemap-news.xml`, 301);
}
