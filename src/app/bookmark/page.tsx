"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bookmark, Trash2, ArrowLeft } from "lucide-react";

interface BookmarkedArticle {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  publishedAt?: string | null;
  author?: { name: string };
  category?: { name: string; slug: string };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function BookmarkPage() {
  const [articles, setArticles] = useState<BookmarkedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("bookmarks") || "[]");
    setBookmarks(stored);

    if (stored.length === 0) {
      setLoading(false);
      return;
    }

    fetch("/api/articles/by-slugs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugs: stored }),
    })
      .then((res) => res.json())
      .then((json) => {
        setArticles(json.data || []);
      })
      .catch(() => {
        // silent fail
      })
      .finally(() => setLoading(false));
  }, []);

  function removeBookmark(slug: string) {
    const updated = bookmarks.filter((s) => s !== slug);
    setBookmarks(updated);
    localStorage.setItem("bookmarks", JSON.stringify(updated));
    setArticles((prev) => prev.filter((a) => a.slug !== slug));
  }

  return (
    <div className="bg-surface min-h-screen">
      <div className="container-main py-6 sm:py-8 lg:py-10 2xl:py-14">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-1 text-sm text-txt-secondary hover:text-primary"
          >
            <ArrowLeft size={14} />
            Beranda
          </Link>
          <h1 className="flex items-center gap-3 font-serif text-headline-sm font-extrabold text-txt-primary sm:text-headline-md lg:text-headline-lg">
            <Bookmark size={28} className="text-primary" />
            Bookmark Saya
          </h1>
          <p className="mt-1 text-sm text-txt-secondary">
            Artikel yang Anda simpan untuk dibaca nanti
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg border border-border bg-surface-secondary p-4"
              >
                <div className="aspect-[16/9] rounded-lg bg-surface-tertiary" />
                <div className="mt-3 h-5 w-3/4 rounded-lg bg-surface-tertiary" />
                <div className="mt-2 h-4 w-full rounded-lg bg-surface-secondary" />
              </div>
            ))}
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface-secondary p-12 text-center">
            <Bookmark size={48} className="mx-auto mb-4 text-txt-muted" />
            <p className="text-lg font-semibold text-txt-primary">
              Belum ada bookmark
            </p>
            <p className="mt-1 text-sm text-txt-secondary">
              Simpan artikel favorit dengan menekan ikon bookmark pada halaman
              berita.
            </p>
            <Link
              href="/"
              className="btn-primary mt-4 inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold"
            >
              Jelajahi Berita
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <div
                key={article.slug}
                className="group relative rounded-lg border border-border bg-surface overflow-hidden shadow-card transition-all hover:shadow-lg"
              >
                {/* Featured image */}
                {article.featuredImage ? (
                  <Link href={`/berita/${article.slug}`}>
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <Image
                        src={article.featuredImage}
                        alt={article.title}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                  </Link>
                ) : (
                  <Link href={`/berita/${article.slug}`}>
                    <div className="flex aspect-[16/9] items-center justify-center bg-surface-secondary">
                      <Bookmark size={32} className="text-txt-muted" />
                    </div>
                  </Link>
                )}

                <div className="p-4">
                  {/* Category */}
                  {article.category && (
                    <Link
                      href={`/kategori/${article.category.slug}`}
                      className="text-xs font-bold uppercase tracking-wide text-primary hover:underline"
                    >
                      {article.category.name}
                    </Link>
                  )}

                  {/* Title */}
                  <Link href={`/berita/${article.slug}`}>
                    <h2 className="mt-1 text-base font-bold leading-snug text-txt-primary line-clamp-2 hover:text-primary transition-colors">
                      {article.title}
                    </h2>
                  </Link>

                  {/* Excerpt */}
                  {article.excerpt && (
                    <p className="mt-1 text-xs text-txt-secondary line-clamp-2">
                      {article.excerpt}
                    </p>
                  )}

                  {/* Meta + remove */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-txt-muted">
                      {article.author?.name}
                      {article.publishedAt && (
                        <span className="ml-2">
                          {formatDate(article.publishedAt)}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => removeBookmark(article.slug)}
                      className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Hapus bookmark"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
