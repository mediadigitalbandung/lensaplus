import { Metadata } from "next";

/**
 * Internal search results page is intentionally noindexed.
 *
 * Why: search-results pages are "thin content" by Google's standard
 * (varies per query, often duplicates of category/tag pages, no unique
 * editorial value). Indexing them wastes crawl budget and risks doorway-
 * page penalties when the query echoes content the page doesn't really
 * cover. Google explicitly recommends noindex for site-search results:
 * https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links#noindex
 *
 * White-hat alternatives for long-tail capture: substantive landing
 * pages (kategori/, topik/, sorotan/), structured data, content
 * expansion in real articles. NOT dynamic title/H1 from query string.
 */
export const metadata: Metadata = {
  title: "Cari Artikel | Kartawarta",
  description: "Cari berita hukum, putusan, dan analisis di Kartawarta.",
  robots: {
    index: false,
    follow: true,
    nocache: true,
    googleBot: {
      index: false,
      follow: true,
      noimageindex: true,
    },
  },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
