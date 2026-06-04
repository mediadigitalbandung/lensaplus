"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Sparkles, RefreshCw, BookOpen } from "lucide-react";
import { getReadHistory, topCategories } from "@/lib/personalization/tracker";

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImage: string | null;
  publishedAt: string;
  category: { name: string; slug: string };
}

export default function UntukAndaClient() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasHistory, setHasHistory] = useState(false);
  const [topCats, setTopCats] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const history = getReadHistory();
      setHasHistory(history.length > 0);
      const cats = topCategories(history, 5);
      setTopCats(cats);
      const excludeSlugs = history.slice(0, 30).map((e) => e.s);

      const res = await fetch("/api/personalization/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorySlugs: cats, excludeSlugs, limit: 18 }),
      });
      const json = await res.json();
      if (json.success) setArticles(json.data.articles || []);
    } catch {
      // silently fail — reader still sees empty state with CTA
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="container-main py-8 sm:py-12">
      <header className="mb-8 sm:mb-12">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-secondary text-white">
            <Sparkles size={20} strokeWidth={2.5} />
          </div>
          <h1 className="font-serif text-headline-md sm:text-display-sm font-bold text-on-surface">
            Untuk Anda
          </h1>
        </div>
        <p className="text-body-md sm:text-body-lg text-on-surface-variant max-w-2xl">
          {hasHistory ? (
            <>
              Rekomendasi berdasarkan kategori yang Anda paling sering baca:{" "}
              <span className="font-semibold text-primary">
                {topCats.slice(0, 3).join(", ")}
              </span>
              .
            </>
          ) : (
            <>
              Rekomendasi awal — terbaru. Mulai baca beberapa artikel agar feed
              makin personal.
            </>
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <button
            onClick={load}
            disabled={loading}
            className="btn-ghost flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />{" "}
            Refresh
          </button>
          <span className="text-xs text-txt-muted">
            Privacy-respecting &middot; Cookie 30 hari &middot; Tanpa login
          </span>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="card animate-pulse h-72 bg-surface-tertiary rounded-lg"
            />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-secondary p-8 text-center">
          <BookOpen size={48} className="mx-auto mb-4 text-txt-muted" />
          <p className="text-body-md text-txt-muted">
            Belum ada rekomendasi. Mulai baca artikel untuk personalisasi.
          </p>
          <Link
            href="/berita"
            className="mt-4 inline-block text-primary hover:underline font-semibold"
          >
            Lihat berita terbaru &rarr;
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {articles.map((a) => (
            <Link key={a.id} href={`/berita/${a.slug}`} className="card group">
              {a.featuredImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.featuredImage}
                  alt={a.title}
                  className="h-40 w-full object-cover rounded-t-lg"
                  loading="lazy"
                />
              )}
              <div className="p-4 sm:p-5">
                <p className="text-[10px] uppercase tracking-wider text-primary font-bold mb-2">
                  {a.category.name}
                </p>
                <h3 className="font-serif text-base sm:text-lg font-bold text-on-surface line-clamp-3 group-hover:text-primary transition-colors">
                  {a.title}
                </h3>
                {a.excerpt && (
                  <p className="mt-2 text-xs sm:text-sm text-on-surface-variant line-clamp-2">
                    {a.excerpt}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
