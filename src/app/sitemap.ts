import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "hourly", priority: 1.0 },
    { url: `${siteUrl}/berita`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/tentang`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/redaksi`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/kontak`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/privasi`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/syarat-ketentuan`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/kode-etik`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/pedoman-media`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    // /bookmark is a client-only page that reads localStorage — no indexable
    // content, removed to stop wasting crawl budget.
  ];

  // Category pages
  const categories = await prisma.category.findMany({ select: { slug: true } });
  const categoryPages: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${siteUrl}/kategori/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "hourly" as const,
    priority: 0.8,
  }));

  // Published articles (latest 1000)
  const articles = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, updatedAt: true },
    orderBy: { publishedAt: "desc" },
    take: 1000,
  });
  const articlePages: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${siteUrl}/berita/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // Tag pages
  const tags = await prisma.tag.findMany({ select: { slug: true } });
  const tagPages: MetadataRoute.Sitemap = tags.map((t) => ({
    url: `${siteUrl}/tag/${t.slug}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.5,
  }));

  // Author pages (use slugified name to match actual route)
  const authors = await prisma.user.findMany({
    where: { isActive: true },
    select: { name: true },
  });
  const authorPages: MetadataRoute.Sitemap = authors.map((u) => ({
    url: `${siteUrl}/penulis/${slugify(u.name)}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.4,
  }));

  return [...staticPages, ...categoryPages, ...articlePages, ...tagPages, ...authorPages];
}
