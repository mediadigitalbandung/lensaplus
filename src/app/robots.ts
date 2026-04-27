import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://kartawarta.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
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
