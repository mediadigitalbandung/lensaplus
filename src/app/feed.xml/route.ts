import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const escapeXml = (str: string) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const safeCdata = (str: string) => str.replace(/\]\]>/g, "]]]]><![CDATA[>");

function inferImageMimeType(url: string): string {
  const clean = url.split(/[?#]/)[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export async function GET() {
  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com";

  let articles: Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    content: string;
    featuredImage: string | null;
    publishedAt: Date | null;
    author: { name: string };
    category: { name: string };
  }> = [];
  let dbFailed = false;

  try {
    articles = await prisma.article.findMany({
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
  } catch (err) {
    dbFailed = true;
    console.warn("[feed.xml] DB query failed:", err);
  }

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
      const contentEncoded = a.content || a.excerpt || "";
      const rawImg = a.featuredImage?.trim();
      const imageAbs =
        rawImg && !/^data:/i.test(rawImg)
          ? rawImg.startsWith("http")
            ? rawImg
            : `${siteUrl}${rawImg.startsWith("/") ? "" : "/"}${rawImg}`
          : null;
      const enclosure = imageAbs
        ? `\n      <enclosure url="${escapeXml(imageAbs)}" length="0" type="${inferImageMimeType(imageAbs)}" />`
        : "";
      return `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${escapeXml(link)}</link>
      <description><![CDATA[${safeCdata(description)}]]></description>
      <content:encoded><![CDATA[${safeCdata(contentEncoded)}]]></content:encoded>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="false">${escapeXml(a.id)}</guid>
      <category>${escapeXml(a.category.name)}</category>
      <author>noreply@lensaplus.com (${escapeXml(a.author.name)})</author>${enclosure}
    </item>`;
    })
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Lensaplus</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>Portal berita digital nasional Indonesia — bisnis, ekonomi, pemerintahan, hukum, olahraga, hiburan, teknologi, dan peristiwa Nusantara.</description>
    <language>id-ID</language>
    <copyright>Copyright ${new Date().getFullYear()} Lensaplus</copyright>
    <pubDate>${lastBuildDate}</pubDate>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <generator>Lensaplus CMS (Next.js)</generator>
    <atom:link href="${escapeXml(siteUrl)}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": dbFailed ? "no-store" : "public, max-age=300, s-maxage=300",
    },
  });
}
