"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Trash2, ArrowLeft } from "lucide-react";

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
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function readBookmarks(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem("bookmarks") || "[]");
    return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export default function BookmarkPage() {
  const [articles, setArticles] = useState<BookmarkedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  useEffect(() => {
    const stored = readBookmarks();
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
    try {
      localStorage.setItem("bookmarks", JSON.stringify(updated));
    } catch {
      /* storage quota / disabled */
    }
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
          <h1 className="border-l-4 border-primary pl-3 font-serif text-headline-sm font-extrabold text-txt-primary sm:text-headline-md lg:text-headline-lg">
            Bookmark Saya
          </h1>
          <p className="mt-1 text-sm text-txt-secondary">
            Artikel yang Anda simpan untuk dibaca nanti
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse flex sm:block gap-3 rounded-lg border border-border bg-surface-secondary p-3 sm:p-4"
              >
                <div className="w-28 h-20 sm:w-full sm:h-auto sm:aspect-[16/9] shrink-0 rounded-lg bg-surface-tertiary" />
                <div className="flex-1 min-w-0 sm:mt-3 space-y-2">
                  <div className="h-4 sm:h-5 w-3/4 rounded-lg bg-surface-tertiary" />
                  <div className="h-3 sm:h-4 w-full rounded-lg bg-surface-tertiary/70" />
                </div>
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface-secondary p-12 text-center">
            <p className="text-lg font-semibold text-txt-primary">
              Belum ada bookmark
            </p>
            <p className="mt-1 text-sm text-txt-secondary">
              {bookmarks.length > 0
                ? "Artikel yang pernah Anda simpan sudah tidak tersedia."
                : "Simpan artikel favorit dengan menekan ikon bookmark pada halaman berita."}
            </p>
            <Link
              href="/"
              className="btn-primary mt-4 inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold"
            >
              Jelajahi Berita
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <div
                key={article.slug}
                className="group relative flex flex-row sm:flex-col rounded-xl border border-border bg-surface overflow-hidden shadow-card transition-all hover:shadow-lg"
              >
                {/* Featured image */}
                {article.featuredImage ? (
                  <Link href={`/berita/${article.slug}`} className="w-28 sm:w-full shrink-0">
                    <div className="relative h-full min-h-[92px] sm:h-auto sm:aspect-[16/9] overflow-hidden">
                      <Image
                        src={article.featuredImage}
                        alt={article.title}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                  </Link>
                ) : (
                  <Link href={`/berita/${article.slug}`} className="w-28 sm:w-full shrink-0">
                    <div className="flex h-full min-h-[92px] sm:h-auto sm:aspect-[16/9] items-center justify-center bg-surface-secondary">
                      <span className="font-serif text-[10px] sm:text-sm font-bold uppercase tracking-widest text-txt-muted/40">Lensaplus</span>
                    </div>
                  </Link>
                )}

                <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col justify-between">
                  <div>
                    {/* Category */}
                    {article.category && (
                      <Link
                        href={`/kategori/${article.category.slug}`}
                        className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-primary hover:underline"
                      >
                        {article.category.name}
                      </Link>
                    )}

                    {/* Title */}
                    <Link href={`/berita/${article.slug}`}>
                      <h2 className="mt-0.5 sm:mt-1 font-serif text-sm sm:text-base font-bold leading-snug text-txt-primary line-clamp-2 hover:text-primary transition-colors">
                        {article.title}
                      </h2>
                    </Link>

                    {/* Excerpt */}
                    {article.excerpt && (
                      <p className="mt-1 hidden sm:line-clamp-2 text-xs text-txt-secondary">
                        {article.excerpt}
                      </p>
                    )}
                  </div>

                  {/* Meta + remove */}
                  <div className="mt-2 sm:mt-3 flex items-center justify-between gap-2">
                    <div className="text-[10px] sm:text-xs text-txt-muted truncate">
                      {article.author?.name}
                      {article.publishedAt && (
                        <span className="ml-1.5 sm:ml-2">
                          {formatDate(article.publishedAt)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeBookmark(article.slug)}
                      className="shrink-0 rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Hapus bookmark"
                      aria-label={`Hapus bookmark ${article.title}`}
                    >
                      <Trash2 size={15} aria-hidden="true" />
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
