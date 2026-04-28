import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const articles = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { gte: twoDaysAgo },
    },
    select: {
      slug: true,
      title: true,
      publishedAt: true,
      category: { select: { name: true } },
      tags: { select: { name: true } },
      featuredImage: true,
    },
    orderBy: { publishedAt: "desc" },
    take: 1000,
  });

  // Resolve <image:loc> to an absolute URL. Google rejects the news
  // sitemap when <image:loc> is path-relative ("/uploads/foo.jpg"),
  // which is what the previous version emitted whenever featuredImage
  // came from our local uploads pipeline.
  const toAbsoluteImageUrl = (raw: string): string => {
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("//")) return `https:${raw}`;
    if (raw.startsWith("/")) return `${siteUrl}${raw}`;
    return `${siteUrl}/${raw}`;
  };

  const items = articles.map((a) => {
    const keywords = a.tags.map((t) => t.name).join(", ");
    const imageTag = a.featuredImage
      ? `<image:image><image:loc>${escXml(toAbsoluteImageUrl(a.featuredImage))}</image:loc><image:title>${escXml(a.title)}</image:title></image:image>`
      : "";
    return `<url>
    <loc>${siteUrl}/berita/${a.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>Kartawarta</news:name>
        <news:language>id</news:language>
      </news:publication>
      <news:publication_date>${a.publishedAt?.toISOString() || ""}</news:publication_date>
      <news:title>${escXml(a.title)}</news:title>${keywords ? `\n      <news:keywords>${escXml(keywords)}</news:keywords>` : ""}
    </news:news>${imageTag}
  </url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  ${items.join("\n  ")}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=600, s-maxage=600" },
  });
}

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
