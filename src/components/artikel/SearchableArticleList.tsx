"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, SlidersHorizontal, Clock, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import ClientDate from "@/components/ClientDate";

interface Article {
  title: string;
  slug: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  category: { name: string; slug: string };
  author: { name: string };
  publishedAt: Date | string | null;
  readTime?: number | null;
  viewCount?: number;
}

interface SearchableArticleListProps {
  articles: Article[];
  categoryName: string;
}

type SortBy = "terbaru" | "terlama" | "terpopuler";

export default function SearchableArticleList({ articles, categoryName }: SearchableArticleListProps) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("terbaru");
  const [page, setPage] = useState(0);
  const perPage = 10;

  const filtered = useMemo(() => {
    let result = articles;

    // Search filter
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.excerpt?.toLowerCase().includes(q) ||
          a.author.name.toLowerCase().includes(q)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === "terpopuler") return (b.viewCount || 0) - (a.viewCount || 0);
      if (sortBy === "terlama") return new Date(a.publishedAt || 0).getTime() - new Date(b.publishedAt || 0).getTime();
      return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
    });

    setPage(0);
    return result;
  }, [articles, query, sortBy]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice(page * perPage, (page + 1) * perPage);

  return (
    <div>
      {/* Search + Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Cari berita ${categoryName}...`}
            className="input pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-txt-muted shrink-0" />
          {(["terbaru", "terlama", "terpopuler"] as SortBy[]).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                sortBy === s
                  ? "bg-primary text-white"
                  : "bg-surface-secondary text-txt-secondary hover:bg-surface-tertiary"
              }`}
            >
              {s === "terbaru" ? "Terbaru" : s === "terlama" ? "Terlama" : "Terpopuler"}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-txt-muted mb-4">
        {filtered.length} berita ditemukan
        {query && ` untuk "${query}"`}
      </p>

      {/* Article list — 1 article per row */}
      <div className="space-y-0 divide-y divide-border">
        {paginated.map((article) => (
          <article key={article.slug} className="group flex gap-4 py-4 first:pt-0">
            {/* Thumbnail */}
            {article.featuredImage && (
              <Link href={`/berita/${article.slug}`} className="shrink-0">
                <div className="relative h-[80px] w-[120px] sm:h-[90px] sm:w-[140px] overflow-hidden rounded-lg">
                  <Image
                    src={article.featuredImage}
                    alt={article.title}
                    fill
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                </div>
              </Link>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
              <Link href={`/berita/${article.slug}`}>
                <h3 className="text-sm sm:text-base font-bold text-txt-primary leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                  {article.title}
                </h3>
              </Link>
              {article.excerpt && (
                <p className="mt-1 text-xs text-txt-secondary line-clamp-1 hidden sm:block">
                  {article.excerpt}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-txt-muted">
                <span className="text-primary font-semibold">{article.category.name}</span>
                <span className="h-2.5 w-px bg-border" />
                <span>{article.author.name}</span>
                <span className="h-2.5 w-px bg-border" />
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  <ClientDate date={article.publishedAt} format="long" />
                </span>
                {article.viewCount !== undefined && article.viewCount > 0 && (
                  <>
                    <span className="h-2.5 w-px bg-border" />
                    <span className="flex items-center gap-1">
                      <Eye size={10} />
                      {article.viewCount.toLocaleString("id-ID")}
                    </span>
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-txt-primary transition-all hover:border-primary hover:text-primary disabled:opacity-30 disabled:hover:border-border disabled:hover:text-txt-primary"
          >
            <ChevronLeft size={16} />
            Sebelumnya
          </button>
          <span className="text-sm text-txt-muted">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-txt-primary transition-all hover:border-primary hover:text-primary disabled:opacity-30 disabled:hover:border-border disabled:hover:text-txt-primary"
          >
            Selanjutnya
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-txt-muted">Tidak ada berita yang cocok dengan pencarian Anda.</p>
        </div>
      )}
    </div>
  );
}
