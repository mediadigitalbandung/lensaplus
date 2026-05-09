"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search as SearchIcon, SlidersHorizontal, Clock, Calendar, TrendingUp, ChevronLeft, ChevronRight, X, History } from "lucide-react";
import ArticleCard from "@/components/artikel/ArticleCard";

interface SearchResult {
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImage: string | null;
  category: { name: string; slug: string };
  author: { name: string };
  publishedAt: string;
  readTime: number | null;
  viewCount: number;
  verificationLabel: string;
}

interface SuggestItem {
  title: string;
  slug: string;
}

type SortBy = "terbaru" | "terlama" | "terpopuler";
type TimeRange = "semua" | "minggu" | "bulan" | "tahun";

const HISTORY_KEY = "search_history_kartawarta";
const MAX_HISTORY = 5;

function getSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addSearchHistory(q: string) {
  if (typeof window === "undefined" || !q.trim()) return;
  try {
    let history = getSearchHistory();
    history = history.filter((h) => h.toLowerCase() !== q.toLowerCase());
    history.unshift(q.trim());
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // localStorage not available
  }
}

function clearSearchHistory() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // localStorage not available
  }
}

function highlightText(text: string, keyword: string): React.ReactNode {
  if (!keyword || keyword.length < 2) return text;
  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-primary-light text-primary font-semibold rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("terbaru");
  const [timeRange, setTimeRange] = useState<TimeRange>("semua");
  const [page, setPage] = useState(0);
  const perPage = 9;

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<SuggestItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [inputFocused, setInputFocused] = useState(false);
  const suggestRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load search history on mount
  useEffect(() => {
    setSearchHistory(getSearchHistory());
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced autocomplete fetch
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (json.success) {
        setSuggestions(json.data || []);
      }
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length >= 2) {
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(value);
        setShowSuggestions(true);
      }, 300);
    } else {
      setSuggestions([]);
      // Show history when input is empty and focused
      if (value.length === 0 && inputFocused) {
        setShowSuggestions(true);
      }
    }
  };

  const fetchResults = async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setTotal(0);
      setSearched(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=100`);
      const json = await res.json();
      if (json.success) {
        setResults(json.data.articles || []);
        setTotal(json.data.pagination?.total || json.data.articles?.length || 0);
      } else {
        setResults([]);
        setTotal(0);
      }
    } catch {
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setSearched(true);
      setPage(0);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      fetchResults(initialQuery);
    }
  }, [initialQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      addSearchHistory(query.trim());
      setSearchHistory(getSearchHistory());
    }
    setShowSuggestions(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
    fetchResults(query);
  };

  const handleSuggestionClick = (slug: string, title: string) => {
    addSearchHistory(title);
    setSearchHistory(getSearchHistory());
    setShowSuggestions(false);
    router.push(`/berita/${slug}`);
  };

  const handleHistoryClick = (q: string) => {
    setQuery(q);
    setShowSuggestions(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
    fetchResults(q);
  };

  const handleClearHistory = () => {
    clearSearchHistory();
    setSearchHistory([]);
  };

  // Filter & sort results
  const filtered = useMemo(() => {
    let data = [...results];

    // Time range filter
    if (timeRange !== "semua") {
      const now = new Date();
      let cutoff: Date;
      if (timeRange === "minggu") cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else if (timeRange === "bulan") cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      else cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      data = data.filter((a) => new Date(a.publishedAt) >= cutoff);
    }

    // Sort
    if (sortBy === "terpopuler") data.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    else if (sortBy === "terlama") data.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
    else data.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    return data;
  }, [results, sortBy, timeRange]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice(page * perPage, (page + 1) * perPage);

  const sortOptions: { value: SortBy; label: string; icon: typeof Clock }[] = [
    { value: "terbaru", label: "Terbaru", icon: Clock },
    { value: "terlama", label: "Terlama", icon: Calendar },
    { value: "terpopuler", label: "Terpopuler", icon: TrendingUp },
  ];

  const timeOptions: { value: TimeRange; label: string }[] = [
    { value: "semua", label: "Semua Waktu" },
    { value: "minggu", label: "1 Minggu" },
    { value: "bulan", label: "1 Bulan" },
    { value: "tahun", label: "1 Tahun" },
  ];

  // Whether to show the dropdown
  const shouldShowDropdown = showSuggestions && inputFocused && (
    (query.length >= 2 && suggestions.length > 0) ||
    (query.length === 0 && searchHistory.length > 0)
  );

  return (
    <>
      {/* Search input with autocomplete */}
      <div className="relative mt-4" ref={suggestRef}>
        <form onSubmit={handleSearch}>
          <div className="relative">
            <SearchIcon
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-txt-muted"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => {
                setInputFocused(true);
                if (query.length === 0 && searchHistory.length > 0) {
                  setShowSuggestions(true);
                } else if (query.length >= 2) {
                  setShowSuggestions(true);
                }
              }}
              onBlur={() => {
                // Delay to allow clicks on suggestions
                setTimeout(() => setInputFocused(false), 200);
              }}
              placeholder="Cari berita..."
              className="input w-full py-3 pl-12 pr-4 text-lg"
              autoFocus
            />
          </div>
        </form>

        {/* Autocomplete dropdown */}
        {shouldShowDropdown && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-[12px] border border-border bg-surface shadow-lg">
            {/* Search suggestions */}
            {query.length >= 2 && suggestions.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold text-txt-muted uppercase tracking-wider">
                  Saran Pencarian
                </div>
                {suggestions.map((item) => (
                  <button
                    key={item.slug}
                    onClick={() => handleSuggestionClick(item.slug, item.title)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-secondary transition-colors"
                  >
                    <SearchIcon size={14} className="text-txt-muted flex-shrink-0" />
                    <span className="text-sm text-txt-primary truncate">
                      {highlightText(item.title, query)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Search history */}
            {query.length === 0 && searchHistory.length > 0 && (
              <div>
                <div className="px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-txt-muted uppercase tracking-wider">
                    Riwayat Pencarian
                  </span>
                  <button
                    onClick={handleClearHistory}
                    className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                  >
                    Hapus Semua
                  </button>
                </div>
                {searchHistory.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => handleHistoryClick(h)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-secondary transition-colors"
                  >
                    <History size={14} className="text-txt-muted flex-shrink-0" />
                    <span className="text-sm text-txt-primary truncate">{h}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters — only show after search */}
      {searched && results.length > 0 && (
        <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Sort by */}
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal size={14} className="text-txt-muted shrink-0" />
            <span className="text-xs text-txt-muted shrink-0">Urutan:</span>
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setSortBy(opt.value); setPage(0); }}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  sortBy === opt.value
                    ? "bg-primary text-white"
                    : "bg-surface-secondary text-txt-secondary hover:bg-surface-tertiary"
                }`}
              >
                <opt.icon size={12} />
                {opt.label}
              </button>
            ))}
          </div>

          {/* Time range */}
          <div className="flex flex-wrap items-center gap-2">
            <Calendar size={14} className="text-txt-muted shrink-0" />
            <span className="text-xs text-txt-muted shrink-0">Periode:</span>
            {timeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setTimeRange(opt.value); setPage(0); }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  timeRange === opt.value
                    ? "bg-primary text-white"
                    : "bg-surface-secondary text-txt-secondary hover:bg-surface-tertiary"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Results count */}
      {!loading && searched && query && (
        <p className="mt-4 text-sm text-txt-muted">
          {filtered.length} hasil ditemukan untuk &quot;{query}&quot;
          {timeRange !== "semua" && ` (${timeOptions.find(t => t.value === timeRange)?.label})`}
        </p>
      )}

      {/* Results grid — with keyword highlighting in titles */}
      {!loading && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
          {paginated.map((article) => (
            <article key={article.slug} className="group">
              <Link href={`/berita/${article.slug}`} className="block">
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-sm">
                  {article.featuredImage ? (
                    <Image
                      src={article.featuredImage}
                      alt={article.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="h-full w-full bg-surface-secondary" />
                  )}
                </div>
              </Link>
              <div className="mt-2">
                <Link
                  href={`/kategori/${article.category.slug}`}
                  className="text-xs font-bold uppercase tracking-wide text-primary"
                >
                  {article.category.name}
                </Link>
                <Link href={`/berita/${article.slug}`}>
                  <h3 className="mt-1 line-clamp-2 text-base font-bold leading-snug text-txt-primary hover:underline">
                    {searched && query ? highlightText(article.title, query) : article.title}
                  </h3>
                </Link>
                <p className="mt-2 text-xs text-txt-muted">
                  {new Date(article.publishedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  <span className="mx-1">&middot;</span>
                  {article.author.name}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
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

      {/* Empty state */}
      {!loading && filtered.length === 0 && searched && query && (
        <div className="py-16 text-center">
          <SearchIcon size={48} className="mx-auto text-border" />
          <p className="mt-4 text-txt-secondary">
            Tidak ada hasil untuk &quot;{query}&quot;
          </p>
          <p className="text-sm text-txt-muted">
            Coba kata kunci lain, ubah filter, atau periksa ejaan
          </p>
        </div>
      )}
    </>
  );
}

export default function SearchPage() {
  return (
    <div className="bg-surface min-h-screen">
      <div className="container-main py-6 sm:py-8 lg:py-10 2xl:py-14">
        <h1 className="flex items-center gap-3 font-serif text-headline-sm font-bold text-txt-primary sm:text-headline-md lg:text-headline-lg">
          <span className="block h-7 w-[3px] rounded-full bg-primary" />
          Pencarian
        </h1>
        <Suspense
          fallback={
            <div className="mt-8 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          }
        >
          <SearchContent />
        </Suspense>
      </div>
    </div>
  );
}
