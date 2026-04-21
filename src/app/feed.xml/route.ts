import { prisma } from "@/lib/prisma";

export async function GET() {
  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://kartawarta.com";

  const articles = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    include: { author: true, category: true },
    orderBy: { publishedAt: "desc" },
    take: 20,
  });

  const escapeXml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const items = articles
    .map(
      (a) => `    <item>
      <title><![CDATA[${a.title}]]></title>
      <link>${siteUrl}/berita/${escapeXml(a.slug)}</link>
      <description><![CDATA[${a.excerpt || ""}]]></description>
      <pubDate>${a.publishedAt?.toUTCString() || ""}</pubDate>
      <guid isPermaLink="true">${siteUrl}/berita/${escapeXml(a.slug)}</guid>
      <category>${escapeXml(a.category.name)}</category>
      <author>${escapeXml(a.author.name)}</author>
    </item>`
    )
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Kartawarta</title>
    <link>${siteUrl}</link>
    <description>Portal berita hukum terpercaya di Bandung</description>
    <language>id</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
