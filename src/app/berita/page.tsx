export const revalidate = 60; // ISR: revalidate article list every 60 seconds

import Link from "next/link";
import { Metadata } from "next";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import ArticleCard from "@/components/artikel/ArticleCard";
import { prisma } from "@/lib/prisma";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";

const PER_PAGE = 12;

interface PageProps {
  searchParams: Promise<{
    page?: string;
    sort?: string;
    category?: string;
    q?: string;
  }>;
}

// Pagination canonical: page 1 → "/berita", page N>1 → "/berita?page=N".
// Filter params (sort/category/q) tidak masuk canonical karena variants ini
// dianggap soft-duplicate dari halaman base — kita biarkan Google pilih
// canonical sendiri via signal lain (internal links).
export async function generateMetadata({
  searchParams: searchParamsPromise,
}: PageProps): Promise<Metadata> {
  const searchParams = await searchParamsPromise;
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const canonical = page > 1 ? `/berita?page=${page}` : "/berita";
  const titleSuffix = page > 1 ? ` — Halaman ${page}` : "";

  return {
    title: `Semua Berita${titleSuffix}`,
    description:
      "Daftar berita terbaru dari Kartawarta — bisnis, ekonomi, pemerintahan, hukum, olahraga, hiburan, teknologi, dan peristiwa lokal di Bandung, Jawa Barat & Indonesia.",
    openGraph: {
      title: `Semua Berita${titleSuffix} | Kartawarta`,
      description:
        "Daftar berita terbaru dari Kartawarta — bisnis, ekonomi, pemerintahan, hukum, olahraga, hiburan, teknologi, dan peristiwa lokal di Bandung, Jawa Barat & Indonesia.",
      type: "website",
      locale: "id_ID",
      siteName: "Kartawarta",
      images: [{ url: "/kartawarta-icon.png", width: 512, height: 512, alt: "Kartawarta" }],
    },
    alternates: { canonical },
  };
}

export default async function BeritaPage({ searchParams: searchParamsPromise }: PageProps) {
  const searchParams = await searchParamsPromise;
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const sort = searchParams.sort || "latest";
  const categorySlug = searchParams.category || "all";
  const searchQuery = searchParams.q || "";

  // Fetch categories for filter dropdown
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
  });

  // Build where clause
  const where: Record<string, unknown> = {
    status: "PUBLISHED" as const,
  };

  if (categorySlug !== "all") {
    const cat = categories.find((c) => c.slug === categorySlug);
    if (cat) {
      where.categoryId = cat.id;
    }
  }

  if (searchQuery.length >= 2) {
    where.OR = [
      { title: { contains: searchQuery, mode: "insensitive" } },
      { excerpt: { contains: searchQuery, mode: "insensitive" } },
    ];
  }

  // Determine order
  const orderBy =
    sort === "popular"
      ? { viewCount: "desc" as const }
      : { publishedAt: "desc" as const };

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where: where as never,
      include: { author: true, category: true },
      orderBy,
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.article.count({ where: where as never }),
  ]);

  const totalPages = Math.ceil(total / PER_PAGE);

  // Build URL helper
  function buildUrl(params: Record<string, string | number>) {
    const base: Record<string, string> = {
      page: String(params.page ?? page),
      sort: String(params.sort ?? sort),
      category: String(params.category ?? categorySlug),
    };
    if (searchQuery) base.q = searchQuery;
    if (params.q !== undefined) base.q = String(params.q);
    const qs = new URLSearchParams(base).toString();
    return `/berita?${qs}`;
  }

  // Page numbers to show
  const pageNumbers: number[] = [];
  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, page + 2);
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  const ld = breadcrumbJsonLd([
    { name: "Beranda", url: "/" },
    { name: "Semua Berita", url: "/berita" },
  ]);

  return (
    <div className="bg-surface min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
      <div className="container-main py-6 sm:py-8 lg:py-10 2xl:py-14">
        {/* Header */}
        <div className="mb-6">
          <h1 className="flex items-center gap-3 font-serif text-headline-sm font-bold text-txt-primary sm:text-headline-md lg:text-headline-lg">
            <span className="block h-7 w-[3px] rounded-full bg-secondary" />
            Semua Berita
          </h1>
          <p className="mt-2 text-sm text-txt-secondary">
            {total.toLocaleString("id-ID")} artikel ditemukan
          </p>
        </div>

        {/* Filters bar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border bg-surface-secondary p-4">
          {/* Search */}
          <form method="GET" action="/berita" className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
            <input
              type="text"
              name="q"
              defaultValue={searchQuery}
              placeholder="Cari berita..."
              className="input w-full py-2.5 pl-10 pr-4 text-sm"
            />
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="category" value={categorySlug} />
          </form>

          <div className="flex flex-wrap items-center gap-3">
            {/* Sort */}
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-txt-muted" />
              <div className="flex rounded-full border border-border overflow-hidden">
                <Link
                  href={buildUrl({ sort: "latest", page: 1 })}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    sort === "latest"
                      ? "bg-primary text-white"
                      : "bg-surface text-txt-secondary hover:bg-surface-tertiary"
                  }`}
                >
                  Terbaru
                </Link>
                <Link
                  href={buildUrl({ sort: "popular", page: 1 })}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    sort === "popular"
                      ? "bg-primary text-white"
                      : "bg-surface text-txt-secondary hover:bg-surface-tertiary"
                  }`}
                >
                  Terpopuler
                </Link>
              </div>
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Link
                href={buildUrl({ category: "all", page: 1 })}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  categorySlug === "all"
                    ? "bg-primary text-white"
                    : "bg-surface text-txt-secondary hover:bg-surface-tertiary border border-border"
                }`}
              >
                Semua
              </Link>
              {categories.slice(0, 5).map((cat) => (
                <Link
                  key={cat.slug}
                  href={buildUrl({ category: cat.slug, page: 1 })}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    categorySlug === cat.slug
                      ? "bg-primary text-white"
                      : "bg-surface text-txt-secondary hover:bg-surface-tertiary border border-border"
                  }`}
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Article grid */}
        {articles.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.slug} {...article} variant="standard" />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <Search size={48} className="mx-auto text-border" />
            <p className="mt-4 text-txt-secondary">Tidak ada berita ditemukan</p>
            <p className="text-sm text-txt-muted">Coba ubah filter atau kata kunci pencarian</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            {/* Prev */}
            {page > 1 ? (
              <Link
                href={buildUrl({ page: page - 1 })}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-txt-primary transition-all hover:border-primary hover:text-primary"
              >
                <ChevronLeft size={16} />
                <span className="hidden sm:inline">Sebelumnya</span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-txt-muted opacity-50">
                <ChevronLeft size={16} />
                <span className="hidden sm:inline">Sebelumnya</span>
              </span>
            )}

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {startPage > 1 && (
                <>
                  <Link
                    href={buildUrl({ page: 1 })}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium text-txt-secondary hover:bg-surface-secondary transition-colors"
                  >
                    1
                  </Link>
                  {startPage > 2 && (
                    <span className="px-1 text-txt-muted">...</span>
                  )}
                </>
              )}
              {pageNumbers.map((p) => (
                <Link
                  key={p}
                  href={buildUrl({ page: p })}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    p === page
                      ? "bg-primary text-white"
                      : "text-txt-secondary hover:bg-surface-secondary"
                  }`}
                >
                  {p}
                </Link>
              ))}
              {endPage < totalPages && (
                <>
                  {endPage < totalPages - 1 && (
                    <span className="px-1 text-txt-muted">...</span>
                  )}
                  <Link
                    href={buildUrl({ page: totalPages })}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium text-txt-secondary hover:bg-surface-secondary transition-colors"
                  >
                    {totalPages}
                  </Link>
                </>
              )}
            </div>

            {/* Next */}
            {page < totalPages ? (
              <Link
                href={buildUrl({ page: page + 1 })}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-txt-primary transition-all hover:border-primary hover:text-primary"
              >
                <span className="hidden sm:inline">Selanjutnya</span>
                <ChevronRight size={16} />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-txt-muted opacity-50">
                <span className="hidden sm:inline">Selanjutnya</span>
                <ChevronRight size={16} />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
