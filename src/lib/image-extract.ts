/**
 * Extract the first <img src="..."> URL from an HTML string.
 * Returns null if no image found, or the source is empty / a data: URI
 * (data URIs are unsuitable for OG tags, news sitemap, social cards).
 */
export function extractFirstImageUrl(html: string | null | undefined): string | null {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!match) return null;
  const url = match[1].trim();
  if (!url || url.startsWith("data:")) return null;
  return url;
}
