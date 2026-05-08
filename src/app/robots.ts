import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://kartawarta.com";

  return {
    rules: [
      {
        userAgent: "*",
        // /api/og is the dynamic OpenGraph image endpoint referenced from
        // article OG tags (src/app/berita/[slug]/page.tsx, lokasi, rangkuman).
        // Twitter/Facebook/WhatsApp scrapers MUST be allowed to fetch it,
        // otherwise share previews render as a blank thumbnail. Allow MUST
        // come before the broader /api/ disallow so Google composes
        // "longest-match wins" correctly.
        allow: ["/", "/api/og"],
        disallow: ["/panel/", "/api/", "/login", "/search"],
      },
    ],
    sitemap: [
      `${siteUrl}/sitemap.xml`,
      `${siteUrl}/sitemap-news.xml`,
      `${siteUrl}/sitemap-glossary.xml`,
      `${siteUrl}/sitemap-sorotan.xml`,
      `${siteUrl}/sitemap-lokasi.xml`,
    ],
  };
}
