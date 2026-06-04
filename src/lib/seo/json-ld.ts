/**
 * JSON-LD structured data builders.
 *
 * All functions are pure and return a plain object ready to `JSON.stringify`
 * into a `<script type="application/ld+json">` tag.
 *
 * Schema refs:
 *  - NewsArticle     https://schema.org/NewsArticle
 *  - Article         https://schema.org/Article
 *  - BreadcrumbList  https://schema.org/BreadcrumbList
 *  - FAQPage         https://schema.org/FAQPage
 *  - HowTo           https://schema.org/HowTo
 *  - QAPage          https://schema.org/QAPage
 *  - NewsMediaOrganization https://schema.org/NewsMediaOrganization
 *  - WebSite         https://schema.org/WebSite
 */

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";
const SITE_NAME = "Kartawarta";
const LOGO_URL = `${SITE_URL}/kartawarta-icon.png`;

// Sister media properties under the same publisher. Listed in `sameAs` of
// the NewsMediaOrganization so Google understands these belong to the same
// brand entity (knowledge-graph signal, not a backlink).
const SISTER_BRANDS: string[] = [
  "https://jurnalishukumbandung.com",
];

// Publisher identity/contact for Organization structured data.
// City/region/country/email are already public on the site, so they're inlined.
// Sensitive specifics (legal entity, street, postal code, phone, founding year)
// come from env and render ONLY when the operator sets them — never fabricated.
const PUBLISHER_EMAIL = "redaksi@kartawarta.com";
const PUBLISHER_PHONE = process.env.NEXT_PUBLIC_PUBLISHER_PHONE || "";
const PUBLISHER_STREET = process.env.NEXT_PUBLIC_PUBLISHER_STREET || "";
const PUBLISHER_POSTAL = process.env.NEXT_PUBLIC_PUBLISHER_POSTAL || "";
const PUBLISHER_FOUNDING = process.env.NEXT_PUBLIC_PUBLISHER_FOUNDING || ""; // e.g. "2024"
const PUBLISHER_LEGAL_NAME = process.env.NEXT_PUBLIC_PUBLISHER_LEGAL_NAME || ""; // e.g. "PT Media Digital Bandung"

function publisherAddress(): Record<string, unknown> {
  return {
    "@type": "PostalAddress",
    ...(PUBLISHER_STREET && { streetAddress: PUBLISHER_STREET }),
    addressLocality: "Bandung",
    addressRegion: "Jawa Barat",
    ...(PUBLISHER_POSTAL && { postalCode: PUBLISHER_POSTAL }),
    addressCountry: "ID",
  };
}

function publisherContactPoint(): Record<string, unknown> {
  return {
    "@type": "ContactPoint",
    contactType: "editorial",
    email: PUBLISHER_EMAIL,
    ...(PUBLISHER_PHONE && { telephone: PUBLISHER_PHONE }),
    areaServed: "ID",
    availableLanguage: ["id"],
  };
}

// NewsMediaOrganization policy links — Google News / Publisher Center trust
// signals that map our existing transparency pages to schema.org policy
// properties. All point to real, live routes; no operator input required.
// Docs: https://developers.google.com/search/docs/appearance/structured-data/article#news
function publisherPolicies(): Record<string, string> {
  return {
    ethicsPolicy: `${SITE_URL}/kode-etik`,
    publishingPrinciples: `${SITE_URL}/pedoman-media`,
    verificationFactCheckingPolicy: `${SITE_URL}/pedoman-media`,
    actionableFeedbackPolicy: `${SITE_URL}/kontak`,
    masthead: `${SITE_URL}/redaksi`,
  };
}

export interface JsonLdAuthor {
  name: string;
  slug?: string;
  url?: string;
}

export interface JsonLdCategory {
  name: string;
  slug: string;
}

export interface JsonLdArticleInput {
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string;
  featuredImage?: string | null;
  /**
   * Guaranteed fallback image (e.g. the dynamic /api/og?slug=... 1200x630 card)
   * used when `featuredImage` is absent so the Article JSON-LD always carries
   * at least one image — a Google rich-result / Top Stories requirement.
   */
  ogImageUrl?: string | null;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  author: JsonLdAuthor;
  category: JsonLdCategory;
  tags?: { name: string }[];
  wordCount?: number;
}

// Google ignores/truncates headlines over 110 characters in structured data.
function clampHeadline(title: string): string {
  const t = title.trim();
  return t.length <= 110 ? t : `${t.slice(0, 107).trimEnd()}…`;
}

function iso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function absoluteUrl(pathOrUrl: string | null | undefined): string | undefined {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function countWords(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const clean = text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return undefined;
  return clean.split(" ").filter(Boolean).length;
}

function authorUrl(author: JsonLdAuthor): string {
  if (author.url) return absoluteUrl(author.url) || `${SITE_URL}`;
  if (author.slug) return `${SITE_URL}/penulis/${author.slug}`;
  return SITE_URL;
}

/**
 * Base publisher block used across Article / NewsArticle.
 */
function publisherBlock() {
  return {
    "@type": "NewsMediaOrganization",
    name: SITE_NAME,
    ...(PUBLISHER_LEGAL_NAME && { legalName: PUBLISHER_LEGAL_NAME }),
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: LOGO_URL,
      width: 512,
      height: 512,
    },
    email: PUBLISHER_EMAIL,
    address: publisherAddress(),
    contactPoint: publisherContactPoint(),
    ...publisherPolicies(),
    ...(PUBLISHER_FOUNDING && { foundingDate: PUBLISHER_FOUNDING }),
    sameAs: publisherSameAs(),
  };
}

/**
 * Shared Article / NewsArticle body.
 */
function articleBody(
  article: JsonLdArticleInput,
  mainPath: string,
): Record<string, unknown> {
  const mainEntityUrl = `${SITE_URL}${mainPath}`;
  const wordCount = article.wordCount ?? countWords(article.content);

  // Always emit at least one ImageObject: real featured image if present,
  // else the guaranteed 1200x630 OG card. Never an empty array.
  const featured = absoluteUrl(article.featuredImage);
  const ogFallback = absoluteUrl(article.ogImageUrl);
  const images: object[] = featured
    ? [{ "@type": "ImageObject", url: featured }]
    : ogFallback
      ? [{ "@type": "ImageObject", url: ogFallback, width: 1200, height: 630 }]
      : [];

  return {
    headline: clampHeadline(article.title),
    ...(article.excerpt ? { description: article.excerpt } : {}),
    ...(images.length > 0 && { image: images }),
    datePublished: iso(article.publishedAt),
    dateModified: iso(article.updatedAt) ?? iso(article.publishedAt),
    author: {
      "@type": "Person",
      name: article.author.name,
      url: authorUrl(article.author),
    },
    publisher: publisherBlock(),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": mainEntityUrl,
    },
    articleSection: article.category.name,
    isAccessibleForFree: true,
    ...(wordCount !== undefined && { wordCount }),
    ...(article.tags && article.tags.length > 0 && {
      keywords: article.tags.map((t) => t.name).join(", "),
    }),
    inLanguage: "id-ID",
  };
}

/**
 * NewsArticle — use for journalistic content at `/berita/[slug]`.
 */
export function newsArticleJsonLd(article: JsonLdArticleInput): object {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    ...articleBody(article, `/berita/${article.slug}`),
  };
}

/**
 * Article — use for general editorial content (e.g. Sorotan pages).
 * Optional `pathOverride` lets the caller point mainEntityOfPage at a different
 * URL (e.g. `/sorotan/slug`).
 */
export function articleJsonLd(
  article: JsonLdArticleInput,
  pathOverride?: string,
): object {
  const path = pathOverride ?? `/berita/${article.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    ...articleBody(article, path),
  };
}

/**
 * BreadcrumbList — `items` is ordered from root to leaf.
 * `url` can be absolute or a site-relative path (e.g. "/kategori/hukum").
 */
export function breadcrumbJsonLd(
  items: { name: string; url?: string }[],
): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      ...(item.url && { item: absoluteUrl(item.url) }),
    })),
  };
}

/**
 * FAQPage — consumes the FAQ array that may be stored as JSON in
 * `Article.faqData`.
 */
export function faqJsonLd(
  items: { question: string; answer: string }[],
): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

/**
 * HowTo — for step-by-step / tutorial articles.
 */
export function howToJsonLd(
  name: string,
  steps: { name: string; text: string; url?: string }[],
  options?: { description?: string; totalTimeIso?: string },
): object {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    ...(options?.description && { description: options.description }),
    ...(options?.totalTimeIso && { totalTime: options.totalTimeIso }),
    step: steps.map((step, idx) => ({
      "@type": "HowToStep",
      position: idx + 1,
      name: step.name,
      text: step.text,
      ...(step.url && { url: absoluteUrl(step.url) }),
    })),
  };
}

/**
 * QAPage — single question with multiple answers.
 */
export function qaJsonLd(
  question: string,
  answers: { text: string; author: string; upvotes?: number; url?: string }[],
): object {
  if (answers.length === 0) {
    return {
      "@context": "https://schema.org",
      "@type": "QAPage",
      mainEntity: {
        "@type": "Question",
        name: question,
      },
    };
  }

  const [accepted, ...suggested] = answers;

  return {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: question,
      answerCount: answers.length,
      acceptedAnswer: {
        "@type": "Answer",
        text: accepted.text,
        upvoteCount: accepted.upvotes ?? 0,
        author: { "@type": "Person", name: accepted.author },
        ...(accepted.url && { url: absoluteUrl(accepted.url) }),
      },
      ...(suggested.length > 0 && {
        suggestedAnswer: suggested.map((a) => ({
          "@type": "Answer",
          text: a.text,
          upvoteCount: a.upvotes ?? 0,
          author: { "@type": "Person", name: a.author },
          ...(a.url && { url: absoluteUrl(a.url) }),
        })),
      }),
    },
  };
}

/**
 * Read social profile URLs for the publisher's `sameAs` block.
 *
 * Source priority (highest first):
 *   1. Env var `KARTAWARTA_SOCIAL_URLS` — comma-separated URLs
 *   2. Individual env vars: `KARTAWARTA_TWITTER_URL`, `_FACEBOOK_URL`,
 *      `_INSTAGRAM_URL`, `_LINKEDIN_URL`, `_YOUTUBE_URL`, `_TIKTOK_URL`
 *
 * Returns [] if nothing configured. Knowledge Graph still works without
 * sameAs but won't surface social profile cards in SERP.
 */
function publisherSameAs(): string[] {
  const social = (() => {
    const bulk = process.env.KARTAWARTA_SOCIAL_URLS;
    if (bulk && bulk.trim()) {
      return bulk
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^https?:\/\//i.test(s));
    }
    return [
      process.env.KARTAWARTA_TWITTER_URL,
      process.env.KARTAWARTA_FACEBOOK_URL,
      process.env.KARTAWARTA_INSTAGRAM_URL,
      process.env.KARTAWARTA_LINKEDIN_URL,
      process.env.KARTAWARTA_YOUTUBE_URL,
      process.env.KARTAWARTA_TIKTOK_URL,
    ].filter((s): s is string => !!s && /^https?:\/\//i.test(s));
  })();
  // De-dupe in case a sister URL happens to also be in the social list.
  return Array.from(new Set([...social, ...SISTER_BRANDS]));
}

/**
 * NewsMediaOrganization — global publisher block.
 */
export function organizationJsonLd(): object {
  return {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name: SITE_NAME,
    ...(PUBLISHER_LEGAL_NAME && { legalName: PUBLISHER_LEGAL_NAME }),
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: LOGO_URL,
      width: 512,
      height: 512,
    },
    email: PUBLISHER_EMAIL,
    address: publisherAddress(),
    contactPoint: publisherContactPoint(),
    ...publisherPolicies(),
    ...(PUBLISHER_FOUNDING && { foundingDate: PUBLISHER_FOUNDING }),
    sameAs: publisherSameAs(),
  };
}

/**
 * WebSite — includes SearchAction for sitelinks searchbox.
 *
 * urlTemplate must match a real route that accepts the query string.
 * `/search?q=...` is wired up in src/app/search/page.tsx and is the only
 * route that surfaces matching articles for arbitrary terms.
 */
export function websiteJsonLd(): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}
