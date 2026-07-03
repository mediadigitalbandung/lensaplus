import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://kartawarta.com";

  // Known AI-training / scraper crawlers we opt OUT of entirely. These are
  // SEPARATE from search-engine indexing: Googlebot, Bingbot, and social
  // link-preview fetchers (facebookexternalhit, Twitterbot, WhatsApp) are NOT
  // listed, so Search + Google News + share previews are unaffected.
  // Note: robots.txt is advisory — well-behaved bots obey it; the honeypot
  // (/api/trap) + rate limiting + Cloudflare handle the ones that don't.
  const aiScrapers = [
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    "CCBot",
    "ClaudeBot",
    "anthropic-ai",
    "Claude-Web",
    "Google-Extended", // Google's AI-training crawler — NOT Googlebot/Search.
    "Bytespider",
    "Amazonbot",
    "PerplexityBot",
    "Omgilibot",
    "Omgili",
    "Diffbot",
    "ImagesiftBot",
    "cohere-ai",
    "YouBot",
    "Meta-ExternalAgent",
    "FacebookBot", // Meta AI crawler — NOT facebookexternalhit (share previews).
    "Applebot-Extended",
    "DataForSeoBot",
    "magpie-crawler",
  ];

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
      // Block AI scrapers from the ENTIRE site.
      { userAgent: aiScrapers, disallow: ["/"] },
    ],
    sitemap: [
      `${siteUrl}/sitemap.xml`,
      `${siteUrl}/sitemap-news.xml`,
      `${siteUrl}/sitemap-glossary.xml`,
      // sitemap-sorotan.xml intentionally removed — Sorotan pages are
      // noindexed (AI re-framings), so we no longer advertise them to Google.
      `${siteUrl}/sitemap-lokasi.xml`,
    ],
  };
}
