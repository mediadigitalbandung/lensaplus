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
    include: { author: true, category: true },
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
      const contentEncoded = a.excerpt || "";
      return `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${link}</link>
      <description><![CDATA[${description}]]></description>
      <content:encoded><![CDATA[${contentEncoded}]]></content:encoded>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="false">${a.id}</guid>
      <category>${escapeXml(a.category.name)}</category>
      <author>noreply@kartawarta.com (${escapeXml(a.author.name)})</author>
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
