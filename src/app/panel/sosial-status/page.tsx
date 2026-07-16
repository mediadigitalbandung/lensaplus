"use client";

/**
 * Sosial Status — read-only social-media monitor for ALL roles.
 *
 * View-only: shows the status of automated social posts and lets staff SHARE
 * already-published ones. No publish / edit / takedown actions live here — the
 * full control panel (/panel/social) stays SUPER_ADMIN-only. The API
 * (/api/social/status) scopes data per role: creators (journalist/contributor)
 * only see posts from their OWN articles (data privacy); editors+ may monitor
 * every account's posts and filter by author. Read-only for everyone.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Instagram,
  Facebook,
  Twitter,
  AtSign,
  Share2,
  Link2,
  Send,
  MessageCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ImageOff,
  Film,
  Layers,
  User,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { EDITOR_ROLES } from "@/lib/roles";

interface PostCategory {
  id: string;
  name: string;
  slug: string;
}
interface PostArticle {
  id: string;
  title: string;
  slug: string;
  category: PostCategory | null;
  author: { id: string; name: string } | null;
}
interface SocialStatusPost {
  id: string;
  platform: "INSTAGRAM" | "FACEBOOK" | "TWITTER" | "THREADS";
  status: "DRAFT" | "PENDING" | "PROCESSING" | "PUBLISHED" | "REJECTED" | "DELETED";
  mediaKind: "IMAGE" | "STORY" | "REELS";
  imageUrl: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  caption: string | null;
  externalId: string | null;
  publishedAt: string | null;
  createdAt: string;
  errorMessage: string | null;
  article: PostArticle | null;
}
interface Category {
  id: string;
  name: string;
}
interface StaffUser {
  id: string;
  name: string;
}

const PLATFORMS = [
  { value: "INSTAGRAM", label: "Instagram", icon: Instagram, color: "text-pink-600", bg: "bg-pink-50" },
  { value: "FACEBOOK", label: "Facebook", icon: Facebook, color: "text-blue-600", bg: "bg-blue-50" },
  { value: "THREADS", label: "Threads", icon: AtSign, color: "text-zinc-800", bg: "bg-zinc-100" },
  { value: "TWITTER", label: "X / Twitter", icon: Twitter, color: "text-sky-600", bg: "bg-sky-50" },
] as const;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draf", cls: "bg-zinc-100 text-zinc-600" },
  PENDING: { label: "Menunggu", cls: "bg-amber-50 text-amber-700" },
  PROCESSING: { label: "Diproses", cls: "bg-blue-50 text-blue-700" },
  PUBLISHED: { label: "Terbit", cls: "bg-green-50 text-green-700" },
  REJECTED: { label: "Ditolak", cls: "bg-red-50 text-red-700" },
  DELETED: { label: "Dihapus", cls: "bg-zinc-100 text-zinc-500" },
};

const STATUS_OPTIONS = ["DRAFT", "PENDING", "PROCESSING", "PUBLISHED", "REJECTED", "DELETED"];

function platformMeta(p: string) {
  return PLATFORMS.find((x) => x.value === p) ?? PLATFORMS[0];
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SosialStatusPage() {
  const { success: showSuccess } = useToast();
  const { data: session } = useSession();
  // Editors+ may monitor every account's posts; creators only see their own.
  const isEditor = EDITOR_ROLES.includes(session?.user?.role || "");

  const [posts, setPosts] = useState<SocialStatusPost[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [authors, setAuthors] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterPlatform, setFilterPlatform] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterAuthor, setFilterAuthor] = useState("ALL");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 12;

  const [shareOpenId, setShareOpenId] = useState<string | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);

  // Load category list once for the filter dropdown.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/categories");
        if (res.ok) {
          const json = await res.json();
          setCategories((json.data || []).map((c: Category) => ({ id: c.id, name: c.name })));
        }
      } catch {
        /* non-critical */
      }
    })();
  }, []);

  // Editors get an author filter — load the staff list. (/api/users returns a
  // role-dependent shape: array for editors, { users } for super admin.)
  useEffect(() => {
    if (!isEditor) return;
    (async () => {
      try {
        const res = await fetch("/api/users?limit=100");
        if (res.ok) {
          const json = await res.json();
          const list: StaffUser[] = Array.isArray(json.data?.users)
            ? json.data.users
            : Array.isArray(json.data)
              ? json.data
              : [];
          setAuthors(list.map((u) => ({ id: u.id, name: u.name })));
        }
      } catch {
        /* non-critical */
      }
    })();
  }, [isEditor]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPlatform !== "ALL") params.set("platform", filterPlatform);
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      if (filterCategory !== "ALL") params.set("categoryId", filterCategory);
      if (isEditor && filterAuthor !== "ALL") params.set("authorId", filterAuthor);
      params.set("page", String(page));
      params.set("limit", String(LIMIT));
      const res = await fetch(`/api/social/status?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setPosts(json.data?.posts || []);
        setTotalPages(json.data?.pagination?.totalPages || 1);
        setTotal(json.data?.pagination?.total || 0);
      } else {
        setPosts([]);
      }
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [filterPlatform, filterStatus, filterCategory, filterAuthor, isEditor, page]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [filterPlatform, filterStatus, filterCategory, filterAuthor]);

  // Close the share menu on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpenId(null);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrlOf = (p: SocialStatusPost) =>
    p.article ? `${origin}/berita/${p.article.slug}` : origin;

  async function copyLink(p: SocialStatusPost) {
    try {
      await navigator.clipboard.writeText(shareUrlOf(p));
      showSuccess("Tautan disalin");
    } catch {
      /* ignore */
    }
    setShareOpenId(null);
  }

  async function nativeShare(p: SocialStatusPost) {
    const url = shareUrlOf(p);
    const title = p.article?.title || "Lensaplus";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: title, url });
      } catch {
        /* user cancelled */
      }
    } else {
      copyLink(p);
    }
    setShareOpenId(null);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">Status Sosial Media</h1>
        <p className="text-base text-txt-secondary">
          Pantau status postingan sosial media otomatis dan bagikan yang sudah terbit. Tampilan ini
          hanya untuk melihat &amp; membagikan — tanpa edit, publikasi, atau takedown.
        </p>
      </div>

      {/* Platform tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {[{ value: "ALL", label: "Semua", icon: Share2 }, ...PLATFORMS].map((tab) => {
          const TIcon = tab.icon;
          const active = filterPlatform === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setFilterPlatform(tab.value)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-txt-secondary hover:text-txt-primary"
              )}
            >
              <TIcon size={15} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Secondary filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input h-10 w-auto"
          aria-label="Filter status"
        >
          <option value="ALL">Semua Status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="input h-10 w-auto"
          aria-label="Filter kategori"
        >
          <option value="ALL">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {isEditor && (
          <select
            value={filterAuthor}
            onChange={(e) => setFilterAuthor(e.target.value)}
            className="input h-10 w-auto"
            aria-label="Filter penulis"
          >
            <option value="ALL">Semua Penulis</option>
            {authors.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}
        <span className="ml-auto text-sm text-txt-muted">{total} postingan</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface py-16 text-center">
          <Share2 className="mx-auto mb-3 h-10 w-10 text-border" />
          <p className="text-txt-secondary">Belum ada postingan sosial media untuk filter ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => {
            const pm = platformMeta(p.platform);
            const PIcon = pm.icon;
            const st = STATUS_META[p.status] || { label: p.status, cls: "bg-zinc-100 text-zinc-600" };
            const thumb = p.thumbnailUrl || p.imageUrl;
            const canShare = p.status === "PUBLISHED" && !!p.article;
            return (
              <div
                key={p.id}
                className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-card"
              >
                {/* Thumbnail */}
                <div className="relative aspect-[4/3] bg-surface-secondary">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt={p.article?.title || "Post"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-border">
                      <ImageOff size={32} />
                    </div>
                  )}
                  {/* Platform chip */}
                  <span className={`absolute left-2 top-2 flex items-center gap-1 rounded-full ${pm.bg} px-2 py-1 text-[11px] font-semibold ${pm.color}`}>
                    <PIcon size={13} /> {pm.label}
                  </span>
                  {/* Media kind chip */}
                  {p.mediaKind !== "IMAGE" && (
                    <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
                      {p.mediaKind === "REELS" ? <Film size={12} /> : <Layers size={12} />}
                      {p.mediaKind === "REELS" ? "Reel" : "Story"}
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col p-3.5">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                    {p.article?.category && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        {p.article.category.name}
                      </span>
                    )}
                  </div>

                  <p className="line-clamp-2 text-sm font-semibold text-txt-primary">
                    {p.article?.title || "(artikel dihapus)"}
                  </p>
                  {isEditor && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-txt-muted">
                      <User size={11} /> {p.article?.author?.name || "—"}
                    </p>
                  )}
                  {p.caption && (
                    <p className="mt-1 line-clamp-2 text-xs text-txt-secondary">{p.caption}</p>
                  )}
                  {p.status === "REJECTED" && p.errorMessage && (
                    <p className="mt-1 line-clamp-2 text-xs text-red-600">{p.errorMessage}</p>
                  )}

                  <p className="mt-2 text-[11px] text-txt-muted">
                    {p.publishedAt ? `Terbit ${formatDate(p.publishedAt)}` : `Dibuat ${formatDate(p.createdAt)}`}
                  </p>

                  {/* Actions — read-only: view article + share */}
                  <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                    {p.article && (
                      <a
                        href={`${origin}/berita/${p.article.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-txt-secondary hover:bg-surface-secondary hover:text-txt-primary"
                      >
                        <ExternalLink size={14} /> Lihat artikel
                      </a>
                    )}
                    <div className="relative ml-auto" ref={shareOpenId === p.id ? shareRef : undefined}>
                      <button
                        type="button"
                        disabled={!canShare}
                        onClick={() => setShareOpenId(shareOpenId === p.id ? null : p.id)}
                        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
                        title={canShare ? "Bagikan" : "Hanya postingan terbit yang bisa dibagikan"}
                      >
                        <Share2 size={14} /> Bagikan
                      </button>
                      {shareOpenId === p.id && canShare && (
                        <div className="absolute bottom-full right-0 z-20 mb-2 w-44 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                          <button onClick={() => nativeShare(p)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-secondary">
                            <Share2 size={14} className="text-txt-secondary" /> Bagikan…
                          </button>
                          <button onClick={() => copyLink(p)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-secondary">
                            <Link2 size={14} className="text-txt-secondary" /> Salin tautan
                          </button>
                          <a href={`https://wa.me/?text=${encodeURIComponent(`${p.article?.title || ""} ${shareUrlOf(p)}`)}`} target="_blank" rel="noopener noreferrer" onClick={() => setShareOpenId(null)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-secondary">
                            <MessageCircle size={14} className="text-green-600" /> WhatsApp
                          </a>
                          <a href={`https://t.me/share/url?url=${encodeURIComponent(shareUrlOf(p))}&text=${encodeURIComponent(p.article?.title || "")}`} target="_blank" rel="noopener noreferrer" onClick={() => setShareOpenId(null)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-secondary">
                            <Send size={14} className="text-sky-500" /> Telegram
                          </a>
                          <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrlOf(p))}&text=${encodeURIComponent(p.article?.title || "")}`} target="_blank" rel="noopener noreferrer" onClick={() => setShareOpenId(null)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-secondary">
                            <Twitter size={14} className="text-sky-600" /> X / Twitter
                          </a>
                          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrlOf(p))}`} target="_blank" rel="noopener noreferrer" onClick={() => setShareOpenId(null)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-secondary">
                            <Facebook size={14} className="text-blue-600" /> Facebook
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-txt-secondary hover:bg-surface-secondary disabled:opacity-40"
          >
            <ChevronLeft size={16} /> Sebelumnya
          </button>
          <span className="text-sm text-txt-secondary">
            Halaman {page} dari {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-txt-secondary hover:bg-surface-secondary disabled:opacity-40"
          >
            Berikutnya <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
