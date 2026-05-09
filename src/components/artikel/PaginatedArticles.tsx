"use client";

import { useState } from "react";
import ArticleCard from "./ArticleCard";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  verificationLabel?: string;
}

interface PaginatedArticlesProps {
  articles: Article[];
  perPage?: number;
}

export default function PaginatedArticles({ articles, perPage = 6 }: PaginatedArticlesProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(articles.length / perPage);
  const current = articles.slice(page * perPage, (page + 1) * perPage);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        {current.map((article) => (
          <ArticleCard key={article.slug} {...article} />
        ))}
      </div>

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
    </div>
  );
}
