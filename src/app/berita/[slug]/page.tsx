export const revalidate = 60;

import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";
import {
  Flag,
  CheckCircle,
} from "lucide-react";
import CopyProtection from "@/components/artikel/CopyProtection";
import ReadingProgress from "@/components/artikel/ReadingProgress";
import PrintButton from "@/components/artikel/PrintButton";
import ShareBar from "@/components/artikel/ShareBar";
import { FeaturedImage } from "@/components/artikel/FeaturedImage";
import { ArticleImageFallback } from "@/components/artikel/ArticleImageFallback";
import Sidebar from "@/components/layout/Sidebar";
import ArticleCard from "@/components/artikel/ArticleCard";
import BannerAd, { SidebarAd } from "@/components/ads/BannerAd";
import CommentSection from "@/components/artikel/CommentSection";
import BookmarkButton from "@/components/artikel/BookmarkButton";
import ReactionBar from "@/components/artikel/ReactionBar";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
// Note: DOMPurify removed — content sanitized at input via API validation
import { slugify } from "@/lib/utils";
import { faqJsonLd, newsArticleJsonLd } from "@/lib/seo/json-ld";

async function getArticle(slug: string) {
  const article = await prisma.article.findUnique({
    where: { slug },
    include: { author: true, category: true, sources: true, tags: true },
  });
  return article;
}

export async function generateMetadata({ params: paramsPromise }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await paramsPromise;
  const article = await getArticle(params.slug);
  if (!article) return { title: "Artikel Tidak Ditemukan" };

  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.excerpt || "";
  const ogImageUrl = `/api/og?slug=${encodeURIComponent(params.slug)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      authors: [article.author.name],
      section: article.category.name,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: article.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: `/berita/${params.slug}`,
    },
  };
}

// Pagination threshold tuned so typical 400–700-word articles render as a
// single page (so all the Baca Juga injections appear together, not split
// across two clicks). Only genuinely long-form (>900 words) gets paginated.
const WORDS_PER_PAGE = 800;
const TOLERANCE = 100;
const AD_INSERT_WORDS = 100; // inject ad after ~100 words
const AD_MIN_REMAINING = 80; // don't inject if less than 80 words remain
const AD_PLACEHOLDER = '<!--AD_SLOT-->';

function countWords(html: string): number {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
}

function injectInlineAds(html: string): string {
  if (!html) return html;

  const totalWords = countWords(html);
  if (totalWords < AD_INSERT_WORDS + AD_MIN_REMAINING) return html;

  const blocks = html.split(/(<br\s*\/?>(?:<br\s*\/?>)*|<\/p>\s*<p[^>]*>|<\/h[2-6]>\s*<h[2-6][^>]*>)/gi);
  let result = "";
  let wordCount = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const blockWords = countWords(block);

    result += block;
    wordCount += blockWords;

    if (wordCount >= AD_INSERT_WORDS) {
      // Check remaining words after this point
      const remaining = blocks.slice(i + 1).join("");
      const remainingWords = countWords(remaining);

      if (remainingWords >= AD_MIN_REMAINING) {
        result += AD_PLACEHOLDER;
        wordCount = 0;
      }
    }
  }

  return result;
}

// ── Inline "Baca Juga" block ───────────────────────────────────────────────
// One single block in the middle of the article body (around the 1/3 mark)
// that lists up to BACA_JUGA_LIST_MAX related articles vertically. Lands on
// a paragraph boundary so we never break a sentence.
const BACA_JUGA_TARGET_OFFSET_RATIO = 1 / 3; // place after ~1/3 of total words
const BACA_JUGA_MIN_OFFSET_WORDS = 100;
const BACA_JUGA_MIN_REMAINING = 80;
const BACA_JUGA_LIST_MAX = 5;

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function injectBacaJuga(
  html: string,
  related: { slug: string; title: string }[],
): string {
  if (!html || related.length === 0) return html;
  const totalWords = countWords(html);
  if (totalWords < BACA_JUGA_MIN_OFFSET_WORDS + BACA_JUGA_MIN_REMAINING) return html;

  const items = related.slice(0, BACA_JUGA_LIST_MAX);
  const targetOffset = Math.max(
    BACA_JUGA_MIN_OFFSET_WORDS,
    Math.floor(totalWords * BACA_JUGA_TARGET_OFFSET_RATIO),
  );

  // Split on paragraph boundaries; inject ONCE at the first boundary past
  // targetOffset that still leaves enough body afterwards.
  const blocks = html.split(/(<\/p>\s*<p[^>]*>)/gi);
  let result = "";
  let cumulativeWords = 0;
  let injected = false;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    result += block;
    cumulativeWords += countWords(block);

    const isCapturedBoundary = i % 2 === 1; // captured groups land at odd indices
    if (
      !injected &&
      isCapturedBoundary &&
      cumulativeWords >= targetOffset
    ) {
      const remaining = blocks.slice(i + 1).join("");
      if (countWords(remaining) >= BACA_JUGA_MIN_REMAINING) {
        const list = items
          .map(
            (p) =>
              `<li><a href="/berita/${escapeAttr(p.slug)}">${escapeAttr(p.title)}</a></li>`,
          )
          .join("");
        result +=
          `<aside class="baca-juga-list" data-baca-juga-list>` +
          `<span class="baca-juga-list-label">Baca Juga</span>` +
          `<ul>${list}</ul>` +
          `</aside>`;
        injected = true;
      }
    }
  }

  return result;
}

function splitContentIntoPages(html: string): string[] {
  if (!html) return [html];

  const textOnly = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const totalWords = textOnly.split(" ").filter(Boolean).length;

  if (totalWords <= WORDS_PER_PAGE + TOLERANCE) return [html];

  const blocks = html.split(/(<br\s*\/?>(?:<br\s*\/?>)*|<\/p>\s*<p[^>]*>|<\/h[2-6]>\s*<h[2-6][^>]*>)/gi);

  const pages: string[] = [];
  let currentPage = "";
  let currentWordCount = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const blockText = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const blockWords = blockText.split(" ").filter(Boolean).length;

    currentPage += block;
    currentWordCount += blockWords;

    if (currentWordCount >= WORDS_PER_PAGE && i < blocks.length - 1) {
      const remaining = blocks.slice(i + 1).join("");
      const remainingText = remaining.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const remainingWords = remainingText.split(" ").filter(Boolean).length;

      if (remainingWords > TOLERANCE) {
        pages.push(currentPage.trim());
        currentPage = "";
        currentWordCount = 0;
      }
    }
  }

  if (currentPage.trim()) {
    pages.push(currentPage.trim());
  }

  return pages.length > 0 ? pages : [html];
}

export default async function ArticlePage({ params: paramsPromise, searchParams: searchParamsPromise }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const params = await paramsPromise;
  const searchParams = await searchParamsPromise;
  const article = await getArticle(params.slug);
  if (!article) notFound();

  // Non-published articles are private — only visible to author/editors/admins
  const isPublished = article.status === "PUBLISHED";

  if (!isPublished) {
    // Check if current user has access
    const { getServerSession } = await import("next-auth");
    const { authOptions } = await import("@/lib/auth");
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role || "";
    const isAuthor = session?.user?.id === article.authorId;
    const hasAccess = isAuthor || ["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"].includes(userRole);

    if (!hasAccess) {
      notFound();
    }
  }

  // Increment view count only for published articles. Fire-and-forget — never
  // block SSR rendering on a counter write. Errors are swallowed because the
  // counter is non-critical (used for trending/Top, not for paywall, audit,
  // or revenue). Awaiting this would add ~30–60 ms to TTFB per article hit
  // and propagate Prisma transient errors to the reader as a 500.
  if (isPublished) {
    prisma.article
      .update({
        where: { slug: params.slug },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {
        /* non-critical: swallow transient DB error so the page still renders */
      });
  }

  // Status label mapping for non-published preview
  const statusLabels: Record<string, { label: string; color: string }> = {
    DRAFT: { label: "Draf", color: "bg-gray-500" },
    IN_REVIEW: { label: "Sedang Direview", color: "bg-yellow-500" },
    APPROVED: { label: "Disetujui — Menunggu Publikasi", color: "bg-blue-500" },
    REJECTED: { label: "Ditolak", color: "bg-red-500" },
    ARCHIVED: { label: "Diarsipkan", color: "bg-gray-600" },
  };

  // Resolve editor/reviewer name
  let editorName: string | null = null;
  if (article.reviewedBy) {
    const reviewer = await prisma.user.findUnique({
      where: { id: article.reviewedBy },
      select: { name: true },
    });
    editorName = reviewer?.name || null;
  }

  // Fetch related articles (same category, exclude current). 10 total:
  //   - first up-to-4 used as inline "Baca Juga" suggestions in the body
  //     (actual count depends on article length: ~1 per 200 words, hard max 4)
  //   - first 6 displayed in the "Baca Lainnya" grid at the bottom
  // Inline picks overlap with the grid on purpose — readers who skim past
  // the inline link still see them in the bottom grid.
  const relatedArticles = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      categoryId: article.categoryId,
      id: { not: article.id },
    },
    include: { author: true, category: true },
    orderBy: { publishedAt: "desc" },
    take: 10,
  });
  const inlineBacaJuga = relatedArticles.slice(0, 4).map((r) => ({
    slug: r.slug,
    title: r.title,
  }));
  const bacaLainnyaGrid = relatedArticles.slice(0, 6);

  // Sorotan cross-links: 3 analytical angles per article. Surfacing them on
  // the source article funnels internal authority + lengthens session.
  const articleSorotan = await prisma.sorotan.findMany({
    where: { articleId: article.id },
    orderBy: { angle: "asc" },
    select: { slug: true, title: true, angle: true },
  });

  // Fetch trending for sidebar
  const trendingArticles = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    include: { category: true },
    orderBy: { viewCount: "desc" },
    take: 5,
  });

  const sidebarTrending = trendingArticles.map((a) => ({
    title: a.title,
    slug: a.slug,
    category: a.category.name,
    publishedAt: a.publishedAt
      ? new Date(a.publishedAt).toLocaleDateString("id-ID")
      : "",
    viewCount: a.viewCount,
  }));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";
  const articleUrl = `${appUrl}/berita/${params.slug}`;

  // Avoid double-rendering when the article body opens with the same image as
  // the featured image at the top — strips the leading <img> or <figure>...img...</figure>
  // from `content` only when its src matches `article.featuredImage` exactly.
  // 16 articles in the wild had this from the auto-article / migration flow.
  const dedupedContent = (() => {
    const featured = article.featuredImage?.trim();
    if (!featured) return article.content;
    const figureRe = /^\s*<figure[^>]*>\s*<img[^>]*\bsrc=["']([^"']+)["'][^>]*>[\s\S]*?<\/figure>\s*/i;
    const imgRe = /^\s*<img[^>]*\bsrc=["']([^"']+)["'][^>]*\/?>\s*(?:<\/img>)?\s*/i;
    const figMatch = article.content.match(figureRe);
    if (figMatch && figMatch[1] === featured) return article.content.slice(figMatch[0].length);
    const imgMatch = article.content.match(imgRe);
    if (imgMatch && imgMatch[1] === featured) return article.content.slice(imgMatch[0].length);
    return article.content;
  })();

  // Inject inline "Baca Juga" suggestions BEFORE pagination so the threshold
  // is checked against the full article length, not the per-page slice.
  // Pagination then naturally splits the article around the injected asides.
  const contentWithBacaJuga = injectBacaJuga(dedupedContent, inlineBacaJuga);
  const contentPages = splitContentIntoPages(contentWithBacaJuga);
  const totalPages = contentPages.length;
  const currentPage = Math.min(Math.max(1, parseInt(searchParams.page || "1") || 1), totalPages);
  // Inject ads per page (after pagination) so every page gets an ad in the middle
  const sanitizedContent = injectInlineAds(contentPages[currentPage - 1] || contentWithBacaJuga);

  // Use shared NewsArticle builder so publisher renders as NewsMediaOrganization
  // (Google News eligibility) and stays in sync with homepage organization JSON-LD.
  const jsonLd = newsArticleJsonLd({
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    content: article.content,
    featuredImage: article.featuredImage,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    author: { name: article.author.name, slug: slugify(article.author.name) },
    category: { name: article.category.name, slug: article.category.slug },
    tags: article.tags.map((t: { name: string }) => ({ name: t.name })),
    wordCount: countWords(article.content),
  });

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Beranda", item: appUrl },
      { "@type": "ListItem", position: 2, name: article.category.name, item: `${appUrl}/kategori/${article.category.slug}` },
      { "@type": "ListItem", position: 3, name: article.title },
    ],
  };

  // Parse FAQ data (JSON) if present. Accept either an array of {question, answer}
  // or an object { items: [...] }. Silently drop malformed payloads.
  let faqLd: object | null = null;
  if (article.faqData && article.faqData.trim().length > 0) {
    try {
      const parsed = JSON.parse(article.faqData) as unknown;
      const items = Array.isArray(parsed)
        ? parsed
        : (parsed as { items?: unknown[] } | null)?.items;
      if (Array.isArray(items) && items.length > 0) {
        const valid = items.filter(
          (it): it is { question: string; answer: string } =>
            typeof it === "object" &&
            it !== null &&
            typeof (it as { question?: unknown }).question === "string" &&
            typeof (it as { answer?: unknown }).answer === "string",
        );
        if (valid.length > 0) {
          faqLd = faqJsonLd(valid);
        }
      }
    } catch {
      // malformed faqData — ignore
    }
  }

  const structuredData = faqLd
    ? [jsonLd, breadcrumbLd, faqLd]
    : [jsonLd, breadcrumbLd];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <ReadingProgress />
      <CopyProtection
        authorName={article.author.name}
        articleUrl={articleUrl}
        articleTitle={article.title}
        categoryName={article.category.name}
        publishedAt={article.publishedAt ? new Date(article.publishedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : ""}
      />

      <div className="bg-surface min-h-screen overflow-x-hidden">
        {/* Status banner for non-published articles */}
        {!isPublished && statusLabels[article.status] && (
          <div className={`${statusLabels[article.status].color} text-white`}>
            <div className="container-main flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-2 w-2 rounded-full bg-white animate-pulse shrink-0" />
                <span className="text-xs sm:text-sm font-bold uppercase tracking-wider truncate">Preview — {statusLabels[article.status].label}</span>
              </div>
              <span className="hidden sm:inline text-xs text-white/70 shrink-0">Halaman ini hanya dapat dilihat oleh pihak terkait</span>
            </div>
          </div>
        )}

        {/* Ad — Top leaderboard (only on published) */}
        {isPublished && <BannerAd size="slim" className="bg-surface-secondary" />}

        <div className="container-main py-6 sm:py-8 lg:py-10 2xl:py-14 overflow-hidden">
          {/* Breadcrumb */}
          <nav className="mb-6 flex items-center gap-2 text-sm text-txt-secondary" aria-label="Breadcrumb">
            <Link href="/" className="transition-colors hover:text-primary">Beranda</Link>
            <span>&gt;</span>
            <Link href={`/kategori/${article.category.slug}`} className="transition-colors hover:text-primary">
              {article.category.name}
            </Link>
            <span>&gt;</span>
            <span className="truncate max-w-[120px] sm:max-w-[200px] lg:max-w-[400px] text-txt-muted">{article.title}</span>
          </nav>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
            {/* Article */}
            <article className="lg:col-span-2">
              {/* Print-only header */}
              <div className="print-header hidden">
                <Image src="/kartawarta-icon.png" alt="Kartawarta" width={40} height={40} />
                <div>
                  <div className="print-title">Kartawarta</div>
                  <div className="print-subtitle">Media Berita Digital Bandung — kartawarta.com</div>
                </div>
              </div>

              {/* Category badge & verification */}
              <div className="mb-4 flex items-center gap-3">
                <Link
                  href={`/kategori/${article.category.slug}`}
                  className="text-xs font-bold uppercase tracking-wide text-primary hover:underline"
                >
                  {article.category.name}
                </Link>
                {article.verificationLabel === "VERIFIED" && (
                  <span className="flex items-center gap-1 text-xs font-medium text-primary">
                    <CheckCircle size={12} /> Terverifikasi
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="font-serif text-headline-sm font-extrabold leading-tight text-txt-primary tracking-tight sm:text-headline-md lg:text-display-sm">
                {article.title}
              </h1>

              {/* Excerpt */}
              {article.excerpt && (
                <p className="mt-3 text-lg text-txt-secondary">
                  {article.excerpt}
                </p>
              )}

              {/* Meta bar */}
              <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-txt-muted">
                <span>Penulis: <span className="text-txt-primary font-medium">{article.author.name}</span></span>
                {editorName && (
                  <>
                    <span className="text-txt-muted/50">&middot;</span>
                    <span>Editor: <span className="text-txt-primary font-medium">{editorName}</span></span>
                  </>
                )}
                <span className="text-txt-muted/50">&middot;</span>
                <span>
                  {article.publishedAt
                    ? new Date(article.publishedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
                    : "-"}
                </span>
                <span className="text-txt-muted/50">&middot;</span>
                <span>{article.readTime ?? 0} menit baca</span>
              </div>

              {/* Divider */}
              <div className="mt-6 h-px bg-border" />

              {/* Ad — below meta */}
              <div className="mt-6">
                <BannerAd slot="HEADER" noWrapper />
              </div>

              {/* Featured Image */}
              {article.featuredImage && (
                <FeaturedImage src={article.featuredImage} alt={article.title} priority />
              )}

              {/* Article content with inline ads */}
              <ArticleImageFallback />
              <div className="mt-8 max-w-full overflow-hidden">
                {sanitizedContent.includes(AD_PLACEHOLDER) ? (
                  sanitizedContent.split(AD_PLACEHOLDER).map((chunk, i, arr) => (
                    <div key={i}>
                      <div
                        className="article-content text-base sm:text-[17px] leading-[1.8] break-words text-justify"
                        dangerouslySetInnerHTML={{ __html: chunk }}
                      />
                      {i < arr.length - 1 && (
                        <div className="my-6 overflow-hidden">
                          <BannerAd slot="IN_ARTICLE" noWrapper />
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div
                    className="article-content text-base sm:text-[17px] leading-[1.8] break-words text-justify"
                    dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                  />
                )}
              </div>

              {/* Page navigation */}
              {totalPages > 1 && (
                <div className="mt-8 flex flex-col gap-3 rounded-sm border border-border bg-surface-secondary p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs sm:text-sm text-txt-secondary">
                    Halaman <span className="font-bold text-txt-primary">{currentPage}</span> dari <span className="font-bold text-txt-primary">{totalPages}</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    {currentPage > 1 && (
                      <Link
                        href={`/berita/${params.slug}?page=${currentPage - 1}`}
                        className="btn-secondary px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm"
                      >
                        ← <span className="hidden sm:inline">Sebelumnya</span>
                      </Link>
                    )}
                    {Array.from({ length: totalPages }, (_, i) => (
                      <Link
                        key={i + 1}
                        href={`/berita/${params.slug}${i === 0 ? "" : `?page=${i + 1}`}`}
                        className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-xs sm:text-sm font-semibold transition-colors ${
                          currentPage === i + 1
                            ? "bg-primary text-white"
                            : "hover:bg-surface-tertiary text-txt-secondary"
                        }`}
                      >
                        {i + 1}
                      </Link>
                    ))}
                    {currentPage < totalPages && (
                      <Link
                        href={`/berita/${params.slug}?page=${currentPage + 1}`}
                        className="btn-primary px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm"
                      >
                        <span className="hidden sm:inline">Selanjutnya</span> →
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Ad — after content */}
              <div className="mt-8">
                <BannerAd slot="IN_ARTICLE" noWrapper />
              </div>

              {/* Share bar + bookmark */}
              <div className="mt-8">
                <ShareBar articleUrl={articleUrl} articleTitle={article.title} slug={params.slug} />
                <div className="mt-3 flex items-center justify-end gap-2">
                  <PrintButton />
                  <BookmarkButton slug={params.slug} />
                </div>
              </div>

              {/* Reactions — engagement emoji bar */}
              {isPublished && <ReactionBar articleId={article.id} />}

              {/* Sources */}
              {article.sources.length > 0 && (
                <div className="mt-8 rounded-sm border border-border bg-surface p-6 shadow-card">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-txt-primary">
                    Sumber &amp; Narasumber
                  </h3>
                  <ul className="space-y-2">
                    {article.sources.map((source, i) => (
                      <li key={i} className="text-sm text-txt-secondary">
                        <strong className="text-txt-primary">{source.name}</strong>
                        {source.title && ` -- ${source.title}`}
                        {source.institution && `, ${source.institution}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tags */}
              <div className="mt-8 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-txt-secondary">Tags</span>
                {article.tags.map((tag) => (
                  <Link
                    key={tag.slug}
                    href={`/tag/${tag.slug}`}
                    className="text-xs font-medium text-primary border border-border rounded px-2 py-1 hover:bg-surface-secondary transition-colors"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>

              {/* Ad — after tags */}
              <div className="mt-6">
                <BannerAd slot="BETWEEN_SECTIONS" />
              </div>

              {/* Report button */}
              <div className="mt-8 border-t border-border pt-5">
                <Link href="/kontak?subject=Laporkan Berita" className="btn-ghost text-xs text-txt-secondary hover:text-red-600" aria-label="Laporkan berita ini">
                  <Flag size={13} aria-hidden="true" />
                  Laporkan Berita Ini
                </Link>
              </div>

              {/* Author box */}
              <div id="author" className="mt-8 rounded-sm border border-border bg-surface p-6 shadow-card">
                <div className="flex gap-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
                    {article.author.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-txt-primary">{article.author.name}</h3>
                    <p className="text-sm text-primary font-medium">Jurnalis</p>
                    <p className="mt-2 text-sm leading-relaxed text-txt-secondary">
                      {article.author.bio}
                    </p>
                    <Link
                      href={`/penulis/${slugify(article.author.name)}`}
                      className="mt-3 inline-block text-sm font-medium text-primary transition-colors hover:text-primary-dark"
                    >
                      Lihat semua artikel &rarr;
                    </Link>
                  </div>
                </div>
              </div>

              {/* Ad — before related */}
              <div className="mt-8">
                <BannerAd slot="FOOTER" noWrapper />
              </div>

              {/* Sorotan — analytical angles for this article */}
              {articleSorotan.length > 0 && (
                <section className="mt-10 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/60 via-surface to-surface p-5 sm:p-6">
                  <div className="mb-4 flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="m9 11-6 6v3h9l3-3" /><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-txt-primary tracking-tight">Sorotan</h2>
                      <p className="text-xs text-txt-muted">Tiga sudut pandang dari peristiwa ini</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {articleSorotan.map((s) => {
                      const angleLabel: Record<string, string> = {
                        KRONOLOGI: "Kronologi",
                        ANALISIS: "Analisis",
                        DAMPAK: "Dampak",
                      };
                      return (
                        <Link
                          key={s.slug}
                          href={`/sorotan/${s.slug}`}
                          className="group block rounded-xl border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-card"
                        >
                          <span className="inline-block rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                            {angleLabel[s.angle] || s.angle}
                          </span>
                          <p className="mt-2 text-sm font-semibold text-txt-primary line-clamp-3 group-hover:text-amber-700 transition-colors">
                            {s.title}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Baca Lainnya — bottom grid */}
              {bacaLainnyaGrid.length > 0 && (
                <section className="mt-10">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="border-l-[3px] border-primary pl-3 text-lg font-bold text-txt-primary">
                      Baca Lainnya
                    </h2>
                    <Link
                      href={`/kategori/${article.category.slug}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Lihat Semua &rarr;
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
                    {bacaLainnyaGrid.map((related) => (
                      <ArticleCard
                        key={related.slug}
                        {...related}
                        variant="standard"
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Comments — only on published articles */}
              {isPublished && <CommentSection articleId={article.id} />}

              {/* Print-only footer */}
              <div className="print-footer hidden">
                &copy; {new Date().getFullYear()} Kartawarta — kartawarta.com
                <br />Artikel ini dicetak pada {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                <br />Sumber: {articleUrl}
              </div>
            </article>

            {/* Sidebar */}
            <div className="hidden lg:block lg:col-span-1">
              <Sidebar trending={sidebarTrending} />
              <div className="mt-5">
                <SidebarAd />
              </div>
            </div>
          </div>
        </div>

        {/* Ad — Bottom full width */}
        <div className="py-8">
          <BannerAd size="leaderboard" className="bg-surface-secondary" />
        </div>
      </div>
    </>
  );
}
