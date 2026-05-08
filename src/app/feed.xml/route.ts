import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const escapeXml = (str: string) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export async function GET() {
  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";

  const articles = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      featuredImage: true,
      publishedAt: true,
      author: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: 30,
  });

  const lastBuildDate = (
    articles[0]?.publishedAt
      ? new Date(articles[0].publishedAt)
      : new Date()
  ).toUTCString();

  const items = articles
    .map((a) => {
      const link = `${siteUrl}/berita/${a.slug}`;
      const description = (a.excerpt || "").slice(0, 500);
      const pubDate = a.publishedAt
        ? new Date(a.publishedAt).toUTCString()
        : new Date().toUTCString();
      // <content:encoded> per RSS 2.0 + content module spec carries the full
      // article body so feed readers (Feedly, Inoreader, NewsBlur) can show
      // the article inline. Falling back to excerpt makes the feed feel
      // truncated and pushes readers off-platform — defeats the point of
      // publishing an RSS feed.
      const contentEncoded = a.content || a.excerpt || "";
      // <enclosure> for the cover image gives podcast-style feed clients +
      // some news aggregators a thumbnail to display. featuredImage may be
      // relative — normalize before emitting.
      const imageAbs = a.featuredImage
        ? a.featuredImage.startsWith("http")
          ? a.featuredImage
          : `${siteUrl}${a.featuredImage.startsWith("/") ? "" : "/"}${a.featuredImage}`
        : null;
      const enclosure = imageAbs
        ? `\n      <enclosure url="${escapeXml(imageAbs)}" type="image/jpeg" />`
        : "";
      return `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${link}</link>
      <description><![CDATA[${description}]]></description>
      <content:encoded><![CDATA[${contentEncoded}]]></content:encoded>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="false">${a.id}</guid>
      <category>${escapeXml(a.category.name)}</category>
      <author>noreply@kartawarta.com (${escapeXml(a.author.name)})</author>${enclosure}
    </item>`;
    })
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Kartawarta</title>
    <link>${siteUrl}</link>
    <description>Portal berita hukum digital tepercaya dari Bandung — putusan pengadilan, regulasi, advokasi, dan analisis.</description>
    <language>id-ID</language>
    <copyright>Copyright ${new Date().getFullYear()} Kartawarta</copyright>
    <pubDate>${lastBuildDate}</pubDate>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <generator>Kartawarta CMS (Next.js)</generator>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
