/**
 * Shared types for the news-source scraper pipeline.
 */

export interface ListingItem {
  /** Absolute URL of the article detail page. */
  url: string;
  /** Best-guess title from the listing card. May be replaced after fetching detail. */
  title: string;
  /** Optional thumbnail URL (absolute). */
  thumbnail?: string;
  /** Optional snippet shown on listing card. */
  snippet?: string;
  /** Optional published date if exposed on listing. */
  publishedAt?: Date;
}

export interface ScrapedArticle {
  /** Canonical URL of the article on the upstream site. */
  url: string;
  /** Cleaned-up title. */
  title: string;
  /** Cleaned plain-text byline / author if detectable. */
  author?: string;
  /** Plain-text excerpt — short. */
  excerpt: string;
  /** Sanitised HTML body, paragraph-structured. */
  contentHtml: string;
  /** Total word count of the body. */
  wordCount: number;
  /** Detected published date (best effort). */
  publishedAt?: Date;
  /** Hero / lead image URL on the upstream site (absolute), if any. */
  heroImageUrl?: string;
  /** Detected language code, e.g. "id", "en". Heuristic. */
  lang?: string;
}

export interface ScraperOptions {
  /** Override the default user agent. */
  userAgent?: string;
  /** Override fetch timeout in ms (default 15s). */
  timeoutMs?: number;
  /** Manual CSS selector for article cards on a listing. */
  articleSelector?: string;
  /** Manual selector for title within a card. */
  titleSelector?: string;
  /** Manual selector for the article body inside a detail page. */
  contentSelector?: string;
  /** Manual selector for the hero image. */
  imageSelector?: string;
  /**
   * Render JavaScript via headless Chromium. Required for SPA sites whose
   * article cards are injected client-side. ~5–15× slower than the
   * static fetcher.
   */
  useHeadless?: boolean;
  /** Selector to wait for after page load when in headless mode. */
  waitForSelector?: string | null;
}
