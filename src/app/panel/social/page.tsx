"use client";

/**
 * Social Media Panel — SUPER_ADMIN only
 * Tabs: Posts | Templates | Settings
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Share2,
  Instagram,
  Facebook,
  Twitter,
  XCircle,
  Loader2,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Eye,
  Send,
  Save,
  Image as ImageIcon,
  ExternalLink,
  Link2,
  Film,
  Play,
  Music,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PLATFORM_DIMENSIONS, type TextLayer } from "@/lib/social/types";

type Platform = "INSTAGRAM" | "FACEBOOK" | "TWITTER" | "THREADS";
type PostStatus = "DRAFT" | "PENDING" | "PROCESSING" | "PUBLISHED" | "REJECTED" | "DELETED";
type MediaKind = "IMAGE" | "STORY" | "REELS";

interface SocialPost {
  id: string;
  articleId: string;
  platform: Platform;
  status: PostStatus;
  mediaKind?: MediaKind;
  externalId: string | null;
  imageUrl: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  caption: string | null;
  publishedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  article?: { id: string; title: string; slug: string };
}

interface SocialTemplate {
  id: string;
  name: string;
  platform: Platform;
  categoryId: string | null;
  backgroundUrl: string;
  textLayers: unknown;
  isActive: boolean;
  updatedAt: string;
  category?: { id: string; name: string; slug: string } | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface SocialSettings {
  global: {
    draftMode: boolean;
    autoPublishIG: boolean;
    autoPublishFB: boolean;
    autoPublishTwitter: boolean;
    autoPublishThreads: boolean;
    autoPublishReels: boolean;
    reelDurationSec?: number;
    reelDefaultBgmUrl?: string | null;
    defaultHashtags: string | null;
    defaultCTA: string | null;
    captionTemplate?: string | null;
  };
  instagram: {
    accessToken: string | null;
    hasAccessToken: boolean;
    igUserId: string | null;
    enabled: boolean;
    captionMaxLen: number;
    hashtagCount: number;
    tokenExpiresAt?: string | null;
  };
  facebook: {
    accessToken: string | null;
    hasAccessToken: boolean;
    pageId: string | null;
    postMode: string;
    enabled: boolean;
    tokenExpiresAt?: string | null;
  };
  threads: {
    accessToken: string | null;
    hasAccessToken: boolean;
    threadsUserId: string | null;
    enabled: boolean;
    tokenExpiresAt?: string | null;
  };
}

const PLATFORM_ICONS: Record<Platform, React.ElementType> = {
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  TWITTER: Twitter,
  THREADS: Share2,
};

const PLATFORM_COLORS: Record<Platform, string> = {
  INSTAGRAM: "text-pink-500 bg-pink-50",
  FACEBOOK: "text-blue-600 bg-blue-50",
  TWITTER: "text-sky-500 bg-sky-50",
  THREADS: "text-emerald-600 bg-emerald-50",
};

const STATUS_COLORS: Record<PostStatus, string> = {
  DRAFT: "bg-surface-tertiary text-txt-secondary",
  PENDING: "bg-yellow-50 text-yellow-600",
  PROCESSING: "bg-blue-50 text-blue-600",
  PUBLISHED: "bg-primary-light text-primary",
  REJECTED: "bg-red-50 text-red-600",
  DELETED: "bg-surface-tertiary text-txt-muted",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// -------------------- Posts Tab --------------------
function PostsTab() {
  const { success: showSuccess, error: showError } = useToast();
  const { confirm } = useConfirm();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<Platform | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<PostStatus | "ALL">("ALL");
  const [testingPublish, setTestingPublish] = useState(false);
  const [testingReel, setTestingReel] = useState(false);
  // Instagram Reel (story-card video) creation
  const [showReelModal, setShowReelModal] = useState(false);
  const [reelArticleId, setReelArticleId] = useState("");
  const [reelBgmUrl, setReelBgmUrl] = useState("");
  const [renderingReel, setRenderingReel] = useState(false);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  async function handleTestPublish(targetPlatform?: "INSTAGRAM" | "FACEBOOK" | "THREADS" | "ALL", isStory?: boolean) {
    let platformLabel = "Semua Platform";
    if (targetPlatform === "INSTAGRAM") {
      platformLabel = isStory ? "Instagram Story" : "Instagram Feed";
    } else if (targetPlatform === "FACEBOOK") {
      platformLabel = isStory ? "Facebook Story" : "Facebook Feed";
    } else if (targetPlatform === "THREADS") {
      platformLabel = "Threads";
    }

    const ok = await confirm({
      title: `Uji Coba Publikasi (${platformLabel})`,
      message: `Apakah Anda yakin ingin memicu uji coba publikasi ke ${platformLabel} menggunakan artikel terbaru yang baru diterbitkan? Ini akan merender gambar kustom dan langsung mempostingnya jika diaktifkan.`,
      variant: "default",
    });
    if (!ok) return;

    try {
      setTestingPublish(true);
      const res = await fetch("/api/social/test-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: targetPlatform, isStory }),
      });
      if (!res.ok) {
        throw new Error(`Server Error (HTTP ${res.status}). Silakan periksa koneksi database Anda.`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Gagal memicu uji coba.");
      }
      
      const results = json.data?.results || [];
      const summary = results
        .map((r: any) => `${r.platform}${r.isStory ? " Story" : " Feed"}${r.note ? ` (${r.note})` : ""}: ${r.status}${r.error ? ` (${r.error})` : ""}`)
        .join("\n");
      
      showSuccess(`Uji coba publikasi ${platformLabel} selesai!\nHasil:\n${summary}`);
      fetchPosts();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal memicu uji coba");
    } finally {
      setTestingPublish(false);
    }
  }

  async function handleRenderReel() {
    try {
      setRenderingReel(true);
      const body: Record<string, unknown> = {};
      if (reelArticleId.trim()) body.articleId = reelArticleId.trim();
      if (reelBgmUrl.trim()) body.bgmUrl = reelBgmUrl.trim();
      const res = await fetch("/api/social/reels/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Server Error (HTTP ${res.status}).`);
      }
      const r = json.data?.result;
      if (r?.status === "REJECTED") {
        throw new Error(r.error || "Render Reel gagal.");
      }
      showSuccess(
        "Reel sedang dirender di latar belakang (±30 detik). Daftar akan diperbarui otomatis saat selesai — tinjau lalu klik Approve untuk publikasi."
      );
      setShowReelModal(false);
      setReelArticleId("");
      setReelBgmUrl("");
      fetchPosts();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal merender Reel");
    } finally {
      setRenderingReel(false);
    }
  }

  async function handleTestReel() {
    const ok = await confirm({
      title: "Uji Coba Reel Instagram",
      message:
        "Render Reel uji coba dari artikel terbaru yang sudah terbit? Sistem akan membuat kutipan AI + video 9:16 (butuh beberapa detik). Jika Draft Mode aktif, hasilnya jadi draft untuk ditinjau; jika tidak, langsung dipublikasikan ke Instagram.",
      variant: "default",
    });
    if (!ok) return;
    try {
      setTestingReel(true);
      const res = await fetch("/api/social/reels/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Server Error (HTTP ${res.status}).`);
      }
      const r = json.data?.result;
      if (r?.status === "REJECTED") {
        throw new Error(r.error || "Render Reel gagal.");
      }
      showSuccess(
        "Uji coba Reel dimulai — sedang dirender di latar belakang (±30 detik). Daftar akan diperbarui otomatis."
      );
      fetchPosts();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal uji coba Reel");
    } finally {
      setTestingReel(false);
    }
  }

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterPlatform !== "ALL") params.set("platform", filterPlatform);
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      params.set("limit", "50");
      const res = await fetch(`/api/social/posts?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setPosts(json.data?.posts || []);
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, [filterPlatform, filterStatus]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // While any post is mid-flight (PROCESSING = Reel rendering, PENDING = being
  // published to the platform in the background), poll so the panel reflects the
  // DRAFT/PUBLISHED/REJECTED transition without a manual refresh.
  const hasProcessing = posts.some((p) => p.status === "PROCESSING" || p.status === "PENDING");
  useEffect(() => {
    if (!hasProcessing) return;
    const t = setInterval(() => {
      fetchPosts();
    }, 5000);
    return () => clearInterval(t);
  }, [hasProcessing, fetchPosts]);

  async function doAction(id: string, action: "approve" | "reject" | "takedown") {
    const post = posts.find(p => p.id === id);
    const isRetry = post?.status === "REJECTED" && action === "approve";

    const labels: Record<string, string> = {
      approve: isRetry ? "mengirim ulang" : "mempublikasi",
      reject: "menghapus",
      takedown: "men-takedown",
    };
    const ok = await confirm({
      title: "Konfirmasi",
      message: `Yakin ingin ${labels[action]} post ini?`,
      variant: action === "takedown" || action === "reject" ? "danger" : "default",
    });
    if (!ok) return;
    try {
      setProcessing(id);
      const res = await fetch(`/api/social/posts/${id}/${action}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal");
      if (json.data?.async) {
        showSuccess(
          "Reel sedang dipublikasikan ke Instagram di latar belakang — status akan diperbarui otomatis (bisa beberapa menit)."
        );
      } else {
        showSuccess(`Berhasil ${labels[action]}.`);
      }
      fetchPosts();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value as Platform | "ALL")}
          className="input text-sm py-2"
        >
          <option value="ALL">Semua Platform</option>
          <option value="INSTAGRAM">Instagram</option>
          <option value="FACEBOOK">Facebook</option>
          <option value="THREADS">Threads</option>
          <option value="TWITTER">Twitter</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as PostStatus | "ALL")}
          className="input text-sm py-2"
        >
          <option value="ALL">Semua Status</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING">Pending</option>
          <option value="PUBLISHED">Published</option>
          <option value="REJECTED">Rejected</option>
          <option value="DELETED">Deleted</option>
        </select>
        <button
          onClick={fetchPosts}
          className="btn-ghost flex items-center gap-1.5 px-3 py-2 text-sm"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
        <button
          onClick={() => {
            setReelArticleId("");
            setReelBgmUrl("");
            setShowReelModal(true);
          }}
          className="btn-primary flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold"
        >
          <Film size={14} />
          Buat Reel
        </button>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <span className="hidden sm:inline text-xs font-semibold text-txt-muted">
            Uji Coba:
          </span>
          <button
            onClick={() => handleTestPublish("INSTAGRAM", false)}
            disabled={testingPublish}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-txt-secondary transition-colors hover:bg-surface-secondary hover:text-txt-primary disabled:opacity-50"
          >
            {testingPublish ? (
              <Loader2 size={12} className="animate-spin text-primary" />
            ) : (
              <Instagram size={12} className="text-pink-500" />
            )}
            IG Feed
          </button>
          <button
            onClick={() => handleTestPublish("INSTAGRAM", true)}
            disabled={testingPublish}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-txt-secondary transition-colors hover:bg-surface-secondary hover:text-txt-primary disabled:opacity-50"
          >
            {testingPublish ? (
              <Loader2 size={12} className="animate-spin text-primary" />
            ) : (
              <Instagram size={12} className="text-pink-500" />
            )}
            IG Story
          </button>
          <button
            onClick={() => handleTestPublish("FACEBOOK", false)}
            disabled={testingPublish}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-txt-secondary transition-colors hover:bg-surface-secondary hover:text-txt-primary disabled:opacity-50"
          >
            {testingPublish ? (
              <Loader2 size={12} className="animate-spin text-primary" />
            ) : (
              <Facebook size={12} className="text-blue-600" />
            )}
            FB Feed
          </button>
          <button
            onClick={() => handleTestPublish("FACEBOOK", true)}
            disabled={testingPublish}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-txt-secondary transition-colors hover:bg-surface-secondary hover:text-txt-primary disabled:opacity-50"
          >
            {testingPublish ? (
              <Loader2 size={12} className="animate-spin text-primary" />
            ) : (
              <Facebook size={12} className="text-blue-600" />
            )}
            FB Story
          </button>
          <button
            onClick={() => handleTestPublish("THREADS", false)}
            disabled={testingPublish}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-txt-secondary transition-colors hover:bg-surface-secondary hover:text-txt-primary disabled:opacity-50"
          >
            {testingPublish ? (
              <Loader2 size={12} className="animate-spin text-primary" />
            ) : (
              <Share2 size={12} className="text-txt-primary" />
            )}
            Threads
          </button>
          <button
            onClick={handleTestReel}
            disabled={testingReel}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-txt-secondary transition-colors hover:bg-surface-secondary hover:text-txt-primary disabled:opacity-50"
            title="Render Reel uji coba dari artikel terbaru"
          >
            {testingReel ? (
              <Loader2 size={12} className="animate-spin text-primary" />
            ) : (
              <Film size={12} className="text-primary" />
            )}
            Reel
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 size={24} className="mx-auto animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-border bg-surface">
          <Share2 size={40} className="mx-auto text-border mb-3" />
          <p className="text-sm text-txt-secondary">Belum ada post.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => {
            const PlatformIcon = PLATFORM_ICONS[p.platform];
            return (
              <div
                key={p.id}
                className="rounded-2xl border border-border bg-surface p-4 shadow-card"
              >
                <div className="flex items-start gap-4">
                  {/* Image / video thumbnail */}
                  <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-surface-secondary relative">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon size={20} className="text-border" />
                      </div>
                    )}
                    {p.videoUrl && (
                      <button
                        type="button"
                        onClick={() => setVideoPreview(p.videoUrl!)}
                        className="absolute inset-0 flex items-center justify-center bg-black/35 transition-colors hover:bg-black/45"
                        title="Putar video Reel"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-primary">
                          <Play size={16} className="ml-0.5" fill="currentColor" />
                        </span>
                      </button>
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${PLATFORM_COLORS[p.platform]}`}
                      >
                        <PlatformIcon size={12} />
                        {p.platform}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status]}`}
                      >
                        {p.status}
                      </span>
                      {p.mediaKind === "REELS" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary">
                          <Film size={12} />
                          Reel
                        </span>
                      )}
                      {p.externalId && (
                        <span className="text-xs text-txt-muted">
                          ID: {p.externalId.slice(0, 12)}...
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-txt-primary mb-1">
                      {p.article?.title || "(artikel dihapus)"}
                    </p>
                    {p.caption && (
                      <p className="text-xs text-txt-secondary line-clamp-2 mb-1">
                        {p.caption}
                      </p>
                    )}
                    {p.errorMessage && (
                      <p className="text-xs text-red-600 font-mono mb-1">
                        Error: {p.errorMessage}
                      </p>
                    )}
                    <p className="text-xs text-txt-muted">
                      {formatDate(p.createdAt)}
                      {p.publishedAt &&
                        ` · Published ${formatDate(p.publishedAt)}`}
                    </p>
                  </div>
                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {p.status === "PROCESSING" && (
                      <span className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-blue-600">
                        <Loader2 size={12} className="animate-spin" />
                        Merender…
                      </span>
                    )}
                    {p.status === "DRAFT" && (
                      <>
                        <button
                          onClick={() => doAction(p.id, "approve")}
                          disabled={processing === p.id}
                          className="btn-primary flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                        >
                          {processing === p.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Send size={12} />
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => doAction(p.id, "reject")}
                          disabled={processing === p.id}
                          className="btn-ghost flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-red-500 disabled:opacity-50"
                        >
                          <XCircle size={12} />
                          Reject
                        </button>
                      </>
                    )}
                    {p.status === "PUBLISHED" && (
                      <button
                        onClick={() => doAction(p.id, "takedown")}
                        disabled={processing === p.id}
                        className="btn-ghost flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-red-500 disabled:opacity-50"
                      >
                        {processing === p.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                        Takedown
                      </button>
                    )}
                    {p.status === "REJECTED" && (
                      <button
                        onClick={() => doAction(p.id, "approve")}
                        disabled={processing === p.id}
                        className="btn-primary flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                      >
                        {processing === p.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        Coba Lagi
                      </button>
                    )}
                    {(p.status === "REJECTED" || p.status === "DELETED") && (
                      <button
                        onClick={() => doAction(p.id, "reject")}
                        disabled={processing === p.id}
                        className="btn-ghost flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-red-500 disabled:opacity-50 hover:bg-red-50"
                      >
                        {processing === p.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                        Hapus Post
                      </button>
                    )}
                    {p.article && (
                      <a
                        href={`/berita/${p.article.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold"
                      >
                        <ExternalLink size={12} />
                        Artikel
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Buat Reel modal */}
      {showReelModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="mb-3 flex items-center gap-2">
              <Film size={20} className="text-primary" />
              <h3 className="text-lg font-bold text-txt-primary">Buat Reel dari Story Card</h3>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-txt-secondary">
              Judul artikel tampil tetap, lalu deskripsi berita (dari AI) muncul
              <strong> kata demi kata</strong> dalam 3 bagian bergantian. Foto &amp; latar
              diam (tanpa zoom); durasi mengikuti kecepatan baca. Hasilnya jadi draft Reel
              untuk Anda tinjau &amp; publikasikan.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-txt-secondary">
                  Article ID{" "}
                  <span className="font-normal text-txt-muted">(kosongkan = artikel terbaru)</span>
                </label>
                <input
                  type="text"
                  className="input w-full py-2 text-sm"
                  placeholder="cljx… (opsional)"
                  value={reelArticleId}
                  onChange={(e) => setReelArticleId(e.target.value)}
                />
                <p className="mt-1 text-[10px] text-txt-muted">
                  Ambil ID dari URL /panel/artikel/[id]/edit. Biarkan kosong untuk memakai
                  artikel terbaru yang sudah terbit.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-txt-secondary">
                    Durasi
                  </label>
                  <div className="input flex items-center py-2 text-sm text-txt-muted">
                    Otomatis · ikut kecepatan baca
                  </div>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-txt-secondary">
                    <Music size={12} /> Musik (opsional)
                  </label>
                  <input
                    type="text"
                    className="input w-full py-2 text-sm"
                    placeholder="/uploads/… URL musik"
                    value={reelBgmUrl}
                    onChange={(e) => setReelBgmUrl(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowReelModal(false)}
                disabled={renderingReel}
                className="btn-ghost rounded-md px-4 py-2 text-sm disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleRenderReel}
                disabled={renderingReel}
                className="btn-primary flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {renderingReel ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />}
                {renderingReel ? "Merender video…" : "Render Reel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video preview modal */}
      {videoPreview && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setVideoPreview(null)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={videoPreview}
              controls
              autoPlay
              className="max-h-[85vh] w-auto rounded-xl shadow-2xl"
              style={{ maxWidth: "min(90vw, 420px)" }}
            />
            <button
              onClick={() => setVideoPreview(null)}
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-txt-primary shadow-lg"
            >
              <XCircle size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------- Templates Tab --------------------
interface TemplateFormData {
  name: string;
  platform: Platform;
  categoryId: string;
  backgroundUrl: string;
  textLayersJson: string;
  isActive: boolean;
}

const EMPTY_TEMPLATE: TemplateFormData = {
  name: "",
  platform: "INSTAGRAM",
  categoryId: "",
  backgroundUrl: "",
  textLayersJson: "",
  isActive: true,
};

const PLATFORM_ASPECT_RATIOS: Record<Platform, { label: string; width: number; height: number }[]> = {
  INSTAGRAM: [
    { label: "Instagram Portrait 4:5 (1080 × 1350)", width: 1080, height: 1350 },
    { label: "Instagram Square 1:1 (1080 × 1080)", width: 1080, height: 1080 },
  ],
  FACEBOOK: [
    { label: "Facebook Link Share 1.91:1 (1200 × 630)", width: 1200, height: 630 },
    { label: "Facebook Portrait 4:5 (1080 × 1350)", width: 1080, height: 1350 },
  ],
  TWITTER: [
    { label: "Twitter/X Feed 16:9 (1200 × 675)", width: 1200, height: 675 },
  ],
  THREADS: [
    { label: "Threads Feed Portrait 4:5 (1080 × 1350)", width: 1080, height: 1350 },
    { label: "Threads Feed Square 1:1 (1080 × 1080)", width: 1080, height: 1080 },
  ],
};

const getPlatformDims = (platform: Platform) => {
  return PLATFORM_DIMENSIONS[platform] || { width: 1080, height: 1350 };
};

const FONT_OPTIONS = [
  { value: "'Newsreader', 'Georgia', serif", label: "Newsreader (Serif)" },
  { value: "Arial, sans-serif", label: "Arial (default)" },
  { value: "'Georgia', serif", label: "Georgia" },
  { value: "system-ui, sans-serif", label: "System Sans" },
];

const WEIGHT_OPTIONS = ["Regular", "Bold", "Medium", "Light"];
const ALIGN_OPTIONS = [
  { value: "left", label: "Kiri" },
  { value: "center", label: "Tengah" },
  { value: "right", label: "Kanan" },
  { value: "justify", label: "Rata Kiri-Kanan (Justify)" },
];

function TemplatesTab() {
  const { success: showSuccess, error: showError } = useToast();
  const { confirm } = useConfirm();
  const [templates, setTemplates] = useState<SocialTemplate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SocialTemplate | null>(null);
  const [form, setForm] = useState<TemplateFormData>(EMPTY_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(1080);
  const [canvasHeight, setCanvasHeight] = useState(1350);
  const dims = { width: canvasWidth, height: canvasHeight };

  // Live visual editor state
  const [layers, setLayers] = useState<TextLayer[]>([]);
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number | null>(null);
  const [draggedLayer, setDraggedLayer] = useState<{
    index: number;
    type: "drag" | "resize";
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.35);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewArticleId, setPreviewArticleId] = useState("");
  const [previewTemplateId, setPreviewTemplateId] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  // Latest article for inline preview
  const [latestArticle, setLatestArticle] = useState<{
    title: string;
    excerpt: string;
    featuredImage: string | null;
    categoryName: string;
    publishedAt: string | null;
  } | null>(null);

  const fetchLatestArticle = useCallback(async () => {
    try {
      const res = await fetch("/api/articles?status=PUBLISHED&limit=1");
      if (res.ok) {
        const json = await res.json();
        const articles = json.data?.articles || [];
        if (articles.length > 0) {
          const a = articles[0];
          setLatestArticle({
            title: a.title || "",
            excerpt: a.excerpt || "",
            featuredImage: a.featuredImage || null,
            categoryName: a.category?.name || "",
            publishedAt: a.publishedAt || null,
          });
        }
      }
    } catch {
      /* silent */
    }
  }, []);

  // Auto-calculate preview scale to fit container
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const availableWidth = entry.contentRect.width - 32; // subtract padding
        const scale = Math.min(1, availableWidth / dims.width);
        setPreviewScale(scale);
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [dims.width, showForm]);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/social/templates");
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.data?.templates || []);
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const json = await res.json();
        const data = json.data;
        if (Array.isArray(data)) {
          setCategories(data);
        } else if (Array.isArray(data?.categories)) {
          setCategories(data.categories);
        }
      }
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchCategories();
    fetchLatestArticle();
  }, [fetchTemplates, fetchCategories, fetchLatestArticle]);

  // Drag and resize handlers
  useEffect(() => {
    if (!draggedLayer) return;

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const platformDims = dims;

      const dx_px = e.clientX - draggedLayer.startX;
      const dy_px = e.clientY - draggedLayer.startY;

      const dx_pct = (dx_px / rect.width) * 100;
      const dy_pct = (dy_px / rect.height) * 100;

      const updatedLayers = [...layers];
      const layer = { ...updatedLayers[draggedLayer.index] };

      if (draggedLayer.type === "drag") {
        const newX_pct = Math.min(100 - draggedLayer.startWidth, Math.max(0, draggedLayer.startLeft + dx_pct));
        const newY_pct = Math.min(100 - draggedLayer.startHeight, Math.max(0, draggedLayer.startTop + dy_pct));
        layer.x = Math.round((newX_pct / 100) * platformDims.width);
        layer.y = Math.round((newY_pct / 100) * platformDims.height);
      } else if (draggedLayer.type === "resize") {
        const newW_pct = Math.min(100 - draggedLayer.startLeft, Math.max(5, draggedLayer.startWidth + dx_pct));
        const newH_pct = Math.min(100 - draggedLayer.startTop, Math.max(5, draggedLayer.startHeight + dy_pct));
        layer.width = Math.round((newW_pct / 100) * platformDims.width);
        layer.height = Math.round((newH_pct / 100) * platformDims.height);
      }

      updatedLayers[draggedLayer.index] = layer;
      setLayers(updatedLayers);
    };

    const handleMouseUp = () => {
      setDraggedLayer(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggedLayer, layers, dims]);

  function handleCanvasMouseDown(e: React.MouseEvent, index: number, type: "drag" | "resize") {
    e.preventDefault();
    e.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const layer = layers[index];
    const platformDims = dims;

    const layerX = (layer.x / platformDims.width) * 100;
    const layerY = (layer.y / platformDims.height) * 100;
    const layerW = (layer.width / platformDims.width) * 100;
    const layerH = (layer.height / platformDims.height) * 100;

    setDraggedLayer({
      index,
      type,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: layerX,
      startTop: layerY,
      startWidth: layerW,
      startHeight: layerH,
    });
    setSelectedLayerIndex(index);
  }

  function openCreate() {
    setEditing(null);
    const defaultLayers = [
      { text: "{{photo}}", x: 0, y: 0, width: 1080, height: 680, fontSize: 0 },
      { text: "{{category}}", x: 60, y: 720, width: 250, height: 60, fontSize: 44, color: "#ffffff", align: "center" as const, weight: "Bold", fontFamily: "'Newsreader', 'Georgia', serif" },
      { text: "{{paraphrased_title}}", x: 60, y: 840, width: 960, height: 200, fontSize: 64, color: "#1f2937", align: "left" as const, weight: "Bold", fontFamily: "'Newsreader', 'Georgia', serif" },
      { text: "{{short_summary}}", x: 60, y: 1060, width: 960, height: 180, fontSize: 40, color: "#4b5563", align: "left" as const, weight: "Regular", fontFamily: "Arial, sans-serif" },
      { text: "{{date}}", x: 800, y: 720, width: 220, height: 50, fontSize: 32, color: "#4b5563", align: "right" as const, weight: "Regular", fontFamily: "Arial, sans-serif" }
    ];
    setLayers(defaultLayers);
    setSelectedLayerIndex(0);
    setCanvasWidth(1080);
    setCanvasHeight(1350);
    setForm({
      ...EMPTY_TEMPLATE,
      textLayersJson: JSON.stringify(defaultLayers, null, 2)
    });
    setShowForm(true);
  }

  function openEdit(t: SocialTemplate) {
    setEditing(t);
    let parsedLayers: TextLayer[] = [];
    try {
      if (Array.isArray(t.textLayers)) {
        parsedLayers = t.textLayers as unknown as TextLayer[];
      } else if (typeof t.textLayers === "string") {
        parsedLayers = JSON.parse(t.textLayers);
      }
    } catch {
      parsedLayers = [];
    }

    // Extract canvas metadata if present
    const metadataLayer = parsedLayers.find((l) => l.text === "{{canvas_metadata}}");
    if (metadataLayer) {
      setCanvasWidth(metadataLayer.x);
      setCanvasHeight(metadataLayer.y);
    } else {
      // Fallback to platform default
      const defaultRatio = PLATFORM_ASPECT_RATIOS[t.platform]?.[0];
      setCanvasWidth(defaultRatio ? defaultRatio.width : 1080);
      setCanvasHeight(defaultRatio ? defaultRatio.height : 1350);
    }

    // Filter out the canvas metadata layer from the layers editor state
    parsedLayers = parsedLayers.filter((l) => l.text !== "{{canvas_metadata}}");

    // Append {{photo}} layer if missing
    if (!parsedLayers.find((l) => l.text === "{{photo}}")) {
      parsedLayers = [
        { text: "{{photo}}", x: 0, y: 0, width: 1080, height: 600, fontSize: 0 },
        ...parsedLayers
      ];
    }

    setLayers(parsedLayers);
    setSelectedLayerIndex(0);

    setForm({
      name: t.name,
      platform: t.platform,
      categoryId: t.categoryId || "",
      backgroundUrl: t.backgroundUrl,
      textLayersJson: JSON.stringify(parsedLayers, null, 2),
      isActive: t.isActive,
    });
    setShowForm(true);
  }

  async function handleBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", `Template Background ${Date.now()}`);
      fd.append("caption", "Social media template overlay cutout frame");
      fd.append("credit", "Jurnalishukum Bandung");

      showSuccess("Mengupload background...");
      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Upload gagal");
      }

      // Exhaustive extraction — the successResponse wrapper nests under json.data
      const uploadedUrl: string =
        json.data?.url ??
        json.data?.media?.url ??
        json.url ??
        (typeof json.data === "string" ? json.data : "");

      if (!uploadedUrl) {
        showError(`Upload OK tapi URL kosong. Keys: ${JSON.stringify(Object.keys(json))} / data keys: ${JSON.stringify(json.data ? Object.keys(json.data) : "null")}`);
        return;
      }

      setForm((prev) => ({ ...prev, backgroundUrl: uploadedUrl }));
      showSuccess(`Background diupload: ${uploadedUrl.substring(uploadedUrl.lastIndexOf("/") + 1)}`);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal upload background");
    }
    // Reset file input so re-uploading the same file triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave() {
    try {
      if (!form.name.trim() || !form.backgroundUrl.trim()) {
        showError("Nama dan Background URL wajib diisi.");
        return;
      }

      setSaving(true);

      const layersToSave = [
        ...layers.filter((l) => l.text !== "{{canvas_metadata}}"),
        { text: "{{canvas_metadata}}", x: canvasWidth, y: canvasHeight, width: 0, height: 0, fontSize: 0 }
      ];

      const body = {
        name: form.name,
        platform: form.platform,
        categoryId: form.categoryId || null,
        backgroundUrl: form.backgroundUrl,
        textLayers: layersToSave,
        isActive: form.isActive,
      };

      const url = editing
        ? `/api/social/templates/${editing.id}`
        : "/api/social/templates";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`Server Error (HTTP ${res.status}). Silakan periksa koneksi database Anda.`);
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menyimpan");
      showSuccess(editing ? "Template diperbarui." : "Template dibuat.");
      setShowForm(false);
      fetchTemplates();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Hapus template",
      message: "Yakin ingin menghapus template ini?",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/social/templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(`Server Error (HTTP ${res.status}). Silakan periksa koneksi database Anda.`);
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menghapus");
      showSuccess("Template dihapus.");
      fetchTemplates();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menghapus");
    }
  }

  async function handlePreview() {
    if (!previewArticleId || !previewTemplateId) {
      showError("Pilih template dan isi Article ID.");
      return;
    }
    try {
      setPreviewLoading(true);
      setPreviewUrl(null);
      const res = await fetch("/api/social/templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: previewTemplateId,
          articleId: previewArticleId,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal preview");
    } finally {
      setPreviewLoading(false);
    }
  }

  function openPreview(template: SocialTemplate) {
    setPreviewTemplateId(template.id);
    setPreviewArticleId("");
    setPreviewUrl(null);
    setPreviewOpen(true);
  }

  function addTextLayer() {
    const newIndex = layers.length;

    const newLayer: TextLayer = {
      text: `Layer #${newIndex}`,
      x: 100,
      y: 500,
      width: 400,
      height: 100,
      fontSize: 40,
      color: "#ffffff",
      align: "left",
      weight: "Regular",
      fontFamily: "Arial, sans-serif",
    };
    setLayers([...layers, newLayer]);
    setSelectedLayerIndex(layers.length);
  }

  function deleteLayer(index: number) {
    if (layers[index].text === "{{photo}}") {
      showError("Area Foto tidak dapat dihapus.");
      return;
    }
    const updated = layers.filter((_, idx) => idx !== index);
    setLayers(updated);
    if (selectedLayerIndex === index) {
      setSelectedLayerIndex(null);
    } else if (selectedLayerIndex !== null && selectedLayerIndex > index) {
      setSelectedLayerIndex(selectedLayerIndex - 1);
    }
  }

  const activeLayer = selectedLayerIndex !== null ? layers[selectedLayerIndex] : null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-txt-secondary">
          {templates.length} template tersedia
        </p>
        <button
          onClick={openCreate}
          className="btn-primary flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold"
        >
          <Plus size={14} />
          Template Baru
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 size={24} className="mx-auto animate-spin text-primary" />
        </div>
      ) : templates.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-border bg-surface">
          <ImageIcon size={40} className="mx-auto text-border mb-3" />
          <p className="text-sm text-txt-secondary">Belum ada template.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => {
            const PIcon = PLATFORM_ICONS[t.platform];
            return (
              <div
                key={t.id}
                className="rounded-2xl border border-border bg-surface overflow-hidden shadow-card"
              >
                <div className="relative w-full h-40 bg-surface-secondary">
                  {t.backgroundUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.backgroundUrl}
                      alt={t.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <span
                    className={`absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${PLATFORM_COLORS[t.platform]}`}
                  >
                    <PIcon size={12} />
                    {t.platform}
                  </span>
                  {!t.isActive && (
                    <span className="absolute top-2 right-2 rounded-full bg-surface/90 px-2 py-0.5 text-xs font-medium text-txt-secondary">
                      Nonaktif
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-bold text-txt-primary truncate">
                    {t.name}
                  </h3>
                  <p className="text-xs text-txt-muted mt-0.5">
                    {t.category?.name || "Semua kategori"}
                  </p>
                  <div className="mt-3 flex items-center gap-1">
                    <button
                      onClick={() => openPreview(t)}
                      className="btn-ghost flex-1 flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs"
                    >
                      <Eye size={12} />
                      Preview
                    </button>
                    <button
                      onClick={() => openEdit(t)}
                      className="btn-ghost flex-1 flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs"
                    >
                      <Edit size={12} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="btn-ghost rounded-md px-2 py-1.5 text-xs text-red-500"
                      title="Hapus"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Premium Visual Template Editor Panel */}
      {showForm && (
        <div className="fixed inset-0 z-[9999] bg-surface-secondary flex flex-col overflow-y-auto text-txt-primary font-sans">
          {/* Top Navbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4 bg-surface/90 backdrop-blur-md sticky top-0 z-50">
            <div className="space-y-0.5">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-txt-primary flex items-center gap-2">
                {editing ? "Edit Template" : "Template Baru"}
              </h2>
              <p className="text-xs text-txt-muted">
                Placeholder: <span className="font-mono text-primary">{"{{paraphrased_title}}"}</span>{" "}
                <span className="font-mono text-primary">{"{{short_summary}}"}</span>{" "}
                <span className="font-mono text-primary">{"{{category}}"}</span>{" "}
                <span className="font-mono text-primary">{"{{date}}"}</span> · AI auto-fill
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              {editing && (
                <button
                  onClick={() => {
                    handleDelete(editing.id);
                  }}
                  className="border border-red-200 hover:bg-red-50 text-red-600 font-semibold text-sm px-4 py-2 rounded-lg transition-all"
                >
                  Hapus
                </button>
              )}
              <button
                onClick={() => setShowForm(false)}
                className="border border-border hover:bg-surface-secondary text-txt-secondary font-semibold text-sm px-4 py-2 rounded-lg transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary-dark text-white font-semibold text-sm px-6 py-2 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-card"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Simpan
              </button>
            </div>
          </div>

          {/* Grid Content */}
          <div className="flex-1 px-6 py-8 max-w-7xl mx-auto w-full">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
              {/* Left Column: Canvas and Layers Editor */}
              <div className="xl:col-span-7 space-y-6">
                {/* Form Settings */}
                <div className="rounded-xl border border-border bg-surface p-5 space-y-4 shadow-card">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
                        Nama Template
                      </label>
                      <input
                        type="text"
                        className="w-full bg-surface-container-highest border border-border text-txt-primary text-sm rounded-lg px-3 py-2.5 outline-none focus:border-primary transition-all font-medium"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="contoh: IG Portrait Berita Terkini"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
                        Platform
                      </label>
                      <select
                        className="w-full bg-surface-container-highest border border-border text-txt-primary text-sm rounded-lg px-3 py-2.5 outline-none focus:border-primary transition-all font-medium"
                        value={form.platform}
                        onChange={(e) => {
                          const p = e.target.value as Platform;
                          setForm({ ...form, platform: p });
                          const defaultRatio = PLATFORM_ASPECT_RATIOS[p]?.[0];
                          if (defaultRatio) {
                            setCanvasWidth(defaultRatio.width);
                            setCanvasHeight(defaultRatio.height);
                          }
                        }}
                      >
                        <option value="INSTAGRAM">Instagram</option>
                        <option value="FACEBOOK">Facebook</option>
                        <option value="TWITTER">Twitter</option>
                        <option value="THREADS">Threads</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
                        Aspek Rasio
                      </label>
                      <select
                        className="w-full bg-surface-container-highest border border-border text-txt-primary text-sm rounded-lg px-3 py-2.5 outline-none focus:border-primary transition-all font-medium"
                        value={`${canvasWidth}x${canvasHeight}`}
                        onChange={(e) => {
                          const [w, h] = e.target.value.split("x").map(Number);
                          setCanvasWidth(w);
                          setCanvasHeight(h);
                        }}
                      >
                        {PLATFORM_ASPECT_RATIOS[form.platform]?.map((ratio) => (
                          <option key={`${ratio.width}x${ratio.height}`} value={`${ratio.width}x${ratio.height}`}>
                            {ratio.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
                        Kategori (opsional)
                      </label>
                      <select
                        className="w-full bg-surface-container-highest border border-border text-txt-primary text-sm rounded-lg px-3 py-2.5 outline-none focus:border-primary transition-all font-medium"
                        value={form.categoryId}
                        onChange={(e) =>
                          setForm({ ...form, categoryId: e.target.value })
                        }
                      >
                        <option value="">Semua kategori</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
                        Background Template (PNG transparan di area foto)
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-surface-secondary hover:bg-surface-container text-txt-primary font-semibold text-xs px-4 py-2.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 border border-border shadow-sm"
                        >
                          <Plus size={12} />
                          Ganti
                        </button>
                        <span className="text-xs text-txt-secondary font-mono truncate max-w-[280px]">
                          {form.backgroundUrl
                            ? form.backgroundUrl.substring(form.backgroundUrl.lastIndexOf("/") + 1)
                            : "Belum ada file dipilih"}
                        </span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png"
                          className="hidden"
                          onChange={handleBgUpload}
                        />
                      </div>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm select-none pt-1">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) =>
                        setForm({ ...form, isActive: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-border bg-surface-secondary accent-primary"
                    />
                    Template Aktif
                  </label>
                </div>

                {/* Drag-and-resize Visual Canvas Box */}
                <div className="rounded-xl border border-border bg-surface p-5 space-y-4 shadow-card">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-txt-primary">
                      Area Foto Artikel (drag untuk pindah, pojok kanan-bawah untuk resize)
                    </h3>
                  </div>

                  <div className="flex justify-center bg-surface-container p-6 rounded-lg border border-border shadow-inner">
                    <div
                      ref={canvasRef}
                      className="relative border border-outline-variant bg-surface-container-high overflow-hidden shadow-card container-type-inline-size select-none"
                      style={{
                        aspectRatio: `${dims.width} / ${dims.height}`,
                        width: "100%",
                        maxWidth: "420px",
                      }}
                    >
                      {/* Background transparent overlay frame */}
                      {form.backgroundUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={form.backgroundUrl}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
                        />
                      )}

                      {/* Render layers */}
                      {layers.map((layer, idx) => {
                        const pctX = (layer.x / dims.width) * 100;
                        const pctY = (layer.y / dims.height) * 100;
                        const pctW = (layer.width / dims.width) * 100;
                        const pctH = (layer.height / dims.height) * 100;
                        const isPhoto = layer.text === "{{photo}}";
                        const isSelected = selectedLayerIndex === idx;

                        return (
                          <div
                            key={idx}
                            className={`absolute select-none ${
                              isPhoto
                                ? isSelected
                                  ? "border-2 border-dashed border-[#002045] bg-[#002045]/25 z-20"
                                  : "border border-dashed border-[#002045]/70 bg-[#002045]/15 z-0"
                                : isSelected
                                  ? "border-2 border-dashed border-[#b7102a] bg-[#b7102a]/20 z-30"
                                  : "border border-dashed border-[#b7102a]/50 bg-[#b7102a]/5 z-20 hover:border-[#b7102a]/80"
                            }`}
                            style={{
                              left: `${pctX}%`,
                              top: `${pctY}%`,
                              width: `${pctW}%`,
                              height: `${pctH}%`,
                              cursor: "move",
                            }}
                            onMouseDown={(e) => handleCanvasMouseDown(e, idx, "drag")}
                          >
                            {/* Inner label / representation */}
                            {isPhoto ? (
                              <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                <span className="bg-primary/90 border border-primary text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                                  AREA FOTO
                                </span>
                              </div>
                            ) : (
                              <div
                                className="absolute inset-0 p-1 pointer-events-none text-txt-primary truncate text-[9px] font-mono leading-none"
                                style={{
                                  fontFamily: layer.fontFamily?.includes("Newsreader") ? "serif" : "sans-serif",
                                  fontWeight: layer.weight === "Bold" ? "bold" : "normal",
                                  textAlign: layer.align || "left",
                                  color: layer.color || "#ffffff",
                                }}
                              >
                                <span className="bg-secondary-light border border-secondary/40 text-secondary px-1 py-0.5 rounded text-[8px] mr-1 font-sans select-none">
                                  {`T${idx}: ${layer.text.replace(/[{}]/g, "")}`}
                                </span>
                              </div>
                            )}

                            {/* Resize handle */}
                            {isSelected && (
                              <div
                                className={`absolute bottom-0 right-0 w-3 h-3 translate-x-1/2 translate-y-1/2 rounded-full shadow-lg border border-white cursor-se-resize z-40 ${
                                  isPhoto ? "bg-[#002045]" : "bg-[#b7102a]"
                                }`}
                                onMouseDown={(e) => handleCanvasMouseDown(e, idx, "resize")}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {activeLayer && (
                    <div className="text-center text-xs font-semibold text-txt-secondary font-mono select-none pt-1">
                      {`Posisi: ${Math.round((activeLayer.x / dims.width) * 100)}%, ${Math.round(
                        (activeLayer.y / dims.height) * 100
                      )}% · Ukuran: ${Math.round((activeLayer.width / dims.width) * 100)}% × ${Math.round(
                        (activeLayer.height / dims.height) * 100
                      )}%`}
                    </div>
                  )}
                </div>

                {/* Layer Cards Form Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between select-none">
                    <h3 className="text-sm font-bold text-txt-primary">
                      Text Layers ({layers.length})
                    </h3>
                    <button
                      type="button"
                      onClick={addTextLayer}
                      className="text-primary hover:text-primary-dark font-bold text-xs flex items-center gap-1 transition-all"
                    >
                      <Plus size={12} />
                      Tambah Teks
                    </button>
                  </div>

                  {layers.map((layer, idx) => {
                    const isPhoto = layer.text === "{{photo}}";
                    const isSelected = selectedLayerIndex === idx;

                    return (
                      <div
                        key={idx}
                        className={`rounded-xl border transition-all ${
                          isSelected
                            ? isPhoto
                              ? "border-primary/40 bg-primary/5"
                              : "border-secondary/40 bg-secondary/5"
                            : "border-border bg-surface hover:border-outline-variant"
                        }`}
                      >
                        {/* Header card click selector */}
                        <div
                          className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none"
                          onClick={() => setSelectedLayerIndex(isSelected ? null : idx)}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${
                                isPhoto ? "bg-[#002045]" : "bg-[#b7102a]"
                              }`}
                            />
                            <span className="text-sm font-bold text-txt-primary">
                              {isPhoto ? "Layer #1 (Area Foto)" : `Layer #${idx} (${layer.text})`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {!isPhoto && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteLayer(idx);
                                }}
                                className="text-red-400 hover:text-red-300 transition-colors p-1"
                                title="Hapus Layer"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                            <span className="text-xs text-txt-muted font-mono">
                              {isSelected ? "Tutup" : "Edit"}
                            </span>
                          </div>
                        </div>

                        {/* Collapsible content editor */}
                        {isSelected && (
                          <div className="px-5 pb-5 pt-1 border-t border-border space-y-4">
                            {!isPhoto && (
                              <div>
                                <label className="block text-[11px] font-semibold text-txt-secondary mb-1">
                                  Teks / Placeholder
                                </label>
                                <textarea
                                  rows={2}
                                  className="w-full bg-surface-container-highest border border-border text-txt-primary text-sm rounded-lg px-3 py-2 outline-none focus:border-primary font-medium font-mono"
                                  value={layer.text}
                                  onChange={(e) => {
                                    const updated = [...layers];
                                    updated[idx].text = e.target.value;
                                    setLayers(updated);
                                  }}
                                  placeholder="Teks atau {{paraphrased_title}}"
                                />
                              </div>
                            )}

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-[11px] font-semibold text-txt-secondary mb-1">
                                  X (%)
                                </label>
                                <input
                                  type="number"
                                  className="w-full bg-surface-container-highest border border-border text-txt-primary text-sm rounded-lg px-2.5 py-1.5 outline-none font-medium font-mono"
                                  value={Math.round((layer.x / dims.width) * 100)}
                                  onChange={(e) => {
                                    const pct = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                    const updated = [...layers];
                                    updated[idx].x = Math.round((pct / 100) * dims.width);
                                    setLayers(updated);
                                  }}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-txt-secondary mb-1">
                                  Y (%)
                                </label>
                                <input
                                  type="number"
                                  className="w-full bg-surface-container-highest border border-border text-txt-primary text-sm rounded-lg px-2.5 py-1.5 outline-none font-medium font-mono"
                                  value={Math.round((layer.y / dims.height) * 100)}
                                  onChange={(e) => {
                                    const pct = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                    const updated = [...layers];
                                    updated[idx].y = Math.round((pct / 100) * dims.height);
                                    setLayers(updated);
                                  }}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-txt-secondary mb-1">
                                  Lebar (%)
                                </label>
                                <input
                                  type="number"
                                  className="w-full bg-surface-container-highest border border-border text-txt-primary text-sm rounded-lg px-2.5 py-1.5 outline-none font-medium font-mono"
                                  value={Math.round((layer.width / dims.width) * 100)}
                                  onChange={(e) => {
                                    const pct = Math.min(100, Math.max(5, parseInt(e.target.value) || 5));
                                    const updated = [...layers];
                                    updated[idx].width = Math.round((pct / 100) * dims.width);
                                    setLayers(updated);
                                  }}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-txt-secondary mb-1">
                                  Tinggi (%)
                                </label>
                                <input
                                  type="number"
                                  className="w-full bg-surface-container-highest border border-border text-txt-primary text-sm rounded-lg px-2.5 py-1.5 outline-none font-medium font-mono"
                                  value={Math.round((layer.height / dims.height) * 100)}
                                  onChange={(e) => {
                                    const pct = Math.min(100, Math.max(5, parseInt(e.target.value) || 5));
                                    const updated = [...layers];
                                    updated[idx].height = Math.round((pct / 100) * dims.height);
                                    setLayers(updated);
                                  }}
                                />
                              </div>
                            </div>

                            {!isPhoto && (
                              <>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-[11px] font-semibold text-txt-secondary mb-1">
                                      Font Family
                                    </label>
                                    <select
                                      className="w-full bg-surface-container-highest border border-border text-txt-primary text-xs rounded-lg px-2.5 py-2 outline-none font-medium focus:border-primary"
                                      value={layer.fontFamily || FONT_OPTIONS[0].value}
                                      onChange={(e) => {
                                        const updated = [...layers];
                                        updated[idx].fontFamily = e.target.value;
                                        setLayers(updated);
                                      }}
                                    >
                                      {FONT_OPTIONS.map((f) => (
                                        <option key={f.value} value={f.value}>
                                          {f.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-semibold text-txt-secondary mb-1">
                                      Font Size (px)
                                    </label>
                                    <input
                                      type="number"
                                      className="w-full bg-surface-container-highest border border-border text-txt-primary text-sm rounded-lg px-2.5 py-1.5 outline-none font-medium font-mono"
                                      value={layer.fontSize}
                                      onChange={(e) => {
                                        const val = Math.max(1, parseInt(e.target.value) || 12);
                                        const updated = [...layers];
                                        updated[idx].fontSize = val;
                                        setLayers(updated);
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-semibold text-txt-secondary mb-1">
                                      Warna (Hex)
                                    </label>
                                    <div className="flex gap-1.5 items-center">
                                      <input
                                        type="color"
                                        className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent p-0"
                                        value={layer.color || "#ffffff"}
                                        onChange={(e) => {
                                          const updated = [...layers];
                                          updated[idx].color = e.target.value;
                                          setLayers(updated);
                                        }}
                                      />
                                      <input
                                        type="text"
                                        className="flex-1 bg-surface-container-highest border border-border text-txt-primary text-sm rounded-lg px-2 py-1.5 outline-none font-medium font-mono"
                                        value={layer.color || "#ffffff"}
                                        onChange={(e) => {
                                          const updated = [...layers];
                                          updated[idx].color = e.target.value;
                                          setLayers(updated);
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  <div>
                                    <label className="block text-[11px] font-semibold text-txt-secondary mb-1">
                                      Alignment
                                    </label>
                                    <select
                                      className="w-full bg-surface-container-highest border border-border text-txt-primary text-xs rounded-lg px-2.5 py-2 outline-none font-medium focus:border-primary"
                                      value={layer.align || "left"}
                                      onChange={(e) => {
                                        const updated = [...layers];
                                        updated[idx].align = e.target.value as "left" | "center" | "right" | "justify";
                                        setLayers(updated);
                                      }}
                                    >
                                      {ALIGN_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>
                                          {o.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-semibold text-txt-secondary mb-1">
                                      Weight
                                    </label>
                                    <select
                                      className="w-full bg-surface-container-highest border border-border text-txt-primary text-xs rounded-lg px-2.5 py-2 outline-none font-medium focus:border-primary"
                                      value={layer.weight || "Regular"}
                                      onChange={(e) => {
                                        const updated = [...layers];
                                        updated[idx].weight = e.target.value;
                                        setLayers(updated);
                                      }}
                                    >
                                      {WEIGHT_OPTIONS.map((w) => (
                                        <option key={w} value={w}>
                                          {w}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-semibold text-txt-secondary mb-1">
                                      Line Height
                                    </label>
                                    <input
                                      type="number"
                                      step="0.1"
                                      className="w-full bg-surface-container-highest border border-border text-txt-primary text-sm rounded-lg px-2.5 py-1.5 outline-none font-medium font-mono"
                                      value={layer.lineHeight || 1.2}
                                      onChange={(e) => {
                                        const val = Math.max(0.5, parseFloat(e.target.value) || 1.2);
                                        const updated = [...layers];
                                        updated[idx].lineHeight = val;
                                        setLayers(updated);
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-semibold text-txt-secondary mb-1">
                                      Max Lines
                                    </label>
                                    <input
                                      type="number"
                                      className="w-full bg-surface-container-highest border border-border text-txt-primary text-sm rounded-lg px-2.5 py-1.5 outline-none font-medium font-mono"
                                      value={layer.maxLines || 3}
                                      onChange={(e) => {
                                        const val = Math.max(1, parseInt(e.target.value) || 3);
                                        const updated = [...layers];
                                        updated[idx].maxLines = val;
                                        setLayers(updated);
                                      }}
                                    />
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: High-Fidelity Responsive Preview Container */}
              <div className="xl:col-span-5 xl:sticky xl:top-[90px] space-y-6">
                <div className="rounded-xl border border-border bg-surface p-5 space-y-4 shadow-card">
                  <div className="flex items-center justify-between select-none">
                    <h3 className="text-sm font-bold text-txt-primary">
                      Preview Template <span className="text-xs text-txt-muted font-normal ml-1">({dims.width}×{dims.height} · {Math.round(previewScale * 100)}%)</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        fetchLatestArticle();
                        showSuccess("Preview di-refresh dengan artikel terbaru");
                      }}
                      className="text-primary hover:text-primary-dark font-bold text-xs flex items-center gap-1 transition-all"
                    >
                      <RefreshCw size={12} className="animate-pulse" />
                      Refresh
                    </button>
                  </div>

                  {/* Pixel-perfect preview — rendered at full resolution, CSS-scaled to fit container */}
                  <div
                    ref={previewContainerRef}
                    className="bg-surface-container p-4 rounded-lg border border-border shadow-inner overflow-hidden"
                  >
                    <div
                      className="mx-auto"
                      style={{
                        width: `${dims.width * previewScale}px`,
                        height: `${dims.height * previewScale}px`,
                      }}
                    >
                      <div
                        className="relative rounded-lg overflow-hidden bg-white text-txt-primary shadow-2xl select-none origin-top-left"
                        style={{
                          width: `${dims.width}px`,
                          height: `${dims.height}px`,
                          transform: `scale(${previewScale})`,
                        }}
                      >
                        {/* 1. Article photo inside its cutout at absolute coordinates */}
                        {(() => {
                          const photoLayer = layers.find((l) => l.text === "{{photo}}");
                          if (!photoLayer) return null;

                          return (
                            <div
                              className="absolute pointer-events-none z-0"
                              style={{
                                left: `${photoLayer.x}px`,
                                top: `${photoLayer.y}px`,
                                width: `${photoLayer.width}px`,
                                height: `${photoLayer.height}px`,
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={latestArticle?.featuredImage || "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=1080"}
                                alt={latestArticle?.title || "Preview"}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          );
                        })()}

                        {/* 2. Transparent background template cutout frame overlaid ON TOP */}
                        {form.backgroundUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={form.backgroundUrl}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
                          />
                        )}

                        {/* 3. Text Layers rendered dynamically — absolute px at full resolution */}
                        {layers
                          .filter((l) => l.text !== "{{photo}}")
                          .map((layer, idx) => {
                            // Dynamic content resolution
                            let resolvedText = layer.text;
                            const previewTitle = latestArticle?.title || "Judul Artikel Terbaru";
                            const previewSummary = latestArticle?.excerpt || "Ringkasan artikel terbaru akan tampil di sini.";
                            const previewCategory = latestArticle?.categoryName || "KATEGORI";
                            const previewDate = latestArticle?.publishedAt
                              ? new Date(latestArticle.publishedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
                              : new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
                            resolvedText = resolvedText
                              .replace(/\{\{category\}\}/g, previewCategory.toUpperCase())
                              .replace(/\{\{paraphrased_title\}\}/g, previewTitle)
                              .replace(/\{\{short_summary\}\}/g, previewSummary)
                              .replace(/\{\{date\}\}/g, previewDate)
                              .replace(/\{\{title\}\}/g, previewTitle)
                              .replace(/\{\{summary\}\}/g, previewSummary);

                            const fontSerif = layer.fontFamily?.includes("Newsreader") || layer.fontFamily?.includes("Georgia");

                            return (
                              <div
                                key={idx}
                                className="absolute pointer-events-none z-20 overflow-hidden text-ellipsis leading-tight flex flex-col justify-start"
                                style={{
                                  left: `${layer.x}px`,
                                  top: `${layer.y}px`,
                                  width: `${layer.width}px`,
                                  height: `${layer.height}px`,
                                  color: layer.color || "#ffffff",
                                  textAlign: layer.align || "left",
                                  fontSize: `${layer.fontSize}px`,
                                  fontFamily: fontSerif ? "'Newsreader', 'Georgia', serif" : "Arial, sans-serif",
                                  fontWeight: layer.weight === "Bold" ? "bold" : "normal",
                                  fontStyle: layer.weight === "Italic" ? "italic" : "normal",
                                  lineHeight: layer.lineHeight || 1.2,
                                }}
                              >
                                {layer.text === "{{category}}" ? (
                                  <span className="text-white font-extrabold rounded inline-block text-center uppercase tracking-wider mx-auto">
                                    {resolvedText}
                                  </span>
                                ) : (
                                  <p className="m-0 select-none line-clamp-3">
                                    {resolvedText}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-txt-muted text-center select-none mt-1">
                    Preview menggunakan artikel terbaru yang dipublish sebagai sample.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-xl font-bold text-txt-primary mb-4">
              Preview Template
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Article ID
                </label>
                <input
                  type="text"
                  className="input w-full py-2 text-sm"
                  placeholder="cljx..."
                  value={previewArticleId}
                  onChange={(e) => setPreviewArticleId(e.target.value)}
                />
                <p className="mt-1 text-[10px] text-txt-muted">
                  Ambil ID dari URL /panel/artikel/[id]/edit
                </p>
              </div>
              <button
                onClick={handlePreview}
                disabled={previewLoading}
                className="btn-primary flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {previewLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Eye size={14} />
                )}
                Render Preview
              </button>
              {previewUrl && (
                <div className="mt-3 rounded-lg overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-auto"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setPreviewOpen(false);
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                }}
                className="btn-ghost rounded-md px-4 py-2 text-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------- Settings Tab --------------------
function SettingsTab() {
  const { success: showSuccess, error: showError } = useToast();
  const [settings, setSettings] = useState<SocialSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // editable forms mirror settings
  const [global, setGlobal] = useState<SocialSettings["global"] | null>(null);
  const [instagram, setInstagram] = useState<{
    accessToken: string;
    igUserId: string;
    enabled: boolean;
    captionMaxLen: number;
    hashtagCount: number;
  } | null>(null);
  const [showIgToken, setShowIgToken] = useState(false);
  const [facebook, setFacebook] = useState<{
    accessToken: string;
    pageId: string;
    postMode: string;
    enabled: boolean;
  } | null>(null);
  const [showFbToken, setShowFbToken] = useState(false);

  const [threads, setThreads] = useState<{
    accessToken: string;
    threadsUserId: string;
    enabled: boolean;
  } | null>(null);
  const [showThreadsToken, setShowThreadsToken] = useState(false);
  const [threadsAuthCode, setThreadsAuthCode] = useState("");
  const [exchangingThreadsCode, setExchangingThreadsCode] = useState(false);


  const [scanningAccounts, setScanningAccounts] = useState(false);
  const [scannedAccounts, setScannedAccounts] = useState<Array<{
    pageId: string;
    pageName: string;
    pageAccessToken: string;
    instagramId?: string;
    instagramUsername?: string;
    instagramName?: string;
  }>>([]);

  async function handleScanAccounts() {
    if (!instagram) return;
    try {
      setScanningAccounts(true);
      setScannedAccounts([]);
      const res = await fetch("/api/social/scan-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: instagram.accessToken }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Gagal melakukan scan akun.");
      }
      const accounts = json.data?.accounts || [];
      if (accounts.length === 0) {
        showError("Tidak ditemukan akun Instagram Business yang terhubung ke Facebook Page di bawah token ini.");
      } else {
        setScannedAccounts(accounts);
        showSuccess(`Ditemukan ${accounts.length} akun terhubung! Silakan pilih dari daftar.`);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal scan akun");
    } finally {
      setScanningAccounts(false);
    }
  }

  async function handleExchangeThreads() {
    if (!threadsAuthCode.trim()) {
      showError("Harap masukkan kode otorisasi Threads terlebih dahulu.");
      return;
    }
    try {
      setExchangingThreadsCode(true);
      const res = await fetch("/api/social/settings/exchange-threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: threadsAuthCode.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Gagal menghubungkan Threads.");
      }
      showSuccess("Koneksi Threads Berhasil! Akun terhubung dan Auto-Publish diaktifkan.");
      setThreadsAuthCode("");
      fetchSettings(true); // reload all settings
    } catch (err) {
      showError(err instanceof Error ? err.message : "Terjadi kesalahan saat menghubungkan Threads.");
    } finally {
      setExchangingThreadsCode(false);
    }
  }

  const fetchSettings = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const res = await fetch("/api/social/settings");
      const json = await res.json();
      if (res.ok && json.success) {
        const s = json.data as SocialSettings;
        setSettings(s);
        setGlobal({ ...s.global });
        setInstagram({
          accessToken: "",
          igUserId: s.instagram.igUserId || "",
          enabled: s.instagram.enabled,
          captionMaxLen: s.instagram.captionMaxLen,
          hashtagCount: s.instagram.hashtagCount,
        });
        setFacebook({
          accessToken: "",
          pageId: s.facebook.pageId || "",
          postMode: s.facebook.postMode || "link",
          enabled: s.facebook.enabled,
        });
        setThreads({
          accessToken: "",
          threadsUserId: s.threads?.threadsUserId || "",
          enabled: s.threads?.enabled || false,
        });
      } else {
        setError(json.error || `HTTP error ${res.status}: Gagal memuat pengaturan.`);
        showError(json.error || "Gagal memuat pengaturan sosial media.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan koneksi.");
      showError("Gagal menghubungkan ke server.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveScope(
    scope: "global" | "instagram" | "facebook" | "threads",
    data: Record<string, unknown>,
  ) {
    try {
      setSaving(scope);
      const res = await fetch("/api/social/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, data }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menyimpan");
      showSuccess(`Pengaturan ${scope} disimpan.`);
      fetchSettings(true);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(null);
    }
  }

  if (error && !loading) {
    return (
      <div className="py-16 text-center max-w-md mx-auto space-y-4">
        <div className="p-6 rounded-2xl border border-red-200 bg-red-50 space-y-3">
          <span className="text-3xl">⚠️</span>
          <h4 className="font-bold text-txt-primary text-sm">
            Gagal Memuat Pengaturan
          </h4>
          <p className="text-xs text-red-600 font-mono break-all leading-relaxed max-h-[150px] overflow-y-auto">
            {error}
          </p>
        </div>
        <button
          onClick={() => fetchSettings()}
          className="btn-primary inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold"
        >
          <RefreshCw size={14} />
          Coba Lagi
        </button>
      </div>
    );
  }

  if (loading || !settings || !global || !instagram || !facebook || !threads) {
    return (
      <div className="py-16 text-center">
        <Loader2 size={24} className="mx-auto animate-spin text-primary" />
      </div>
    );
  }

  const now = new Date();
  
  const igExpiresAt = settings?.instagram?.tokenExpiresAt ? new Date(settings.instagram.tokenExpiresAt) : null;
  const isIgExpired = igExpiresAt ? igExpiresAt < now : false;
  const igDaysLeft = igExpiresAt ? Math.ceil((igExpiresAt.getTime() - now.getTime()) / 86400000) : null;
  const isIgExpiringSoon = igDaysLeft !== null && igDaysLeft >= 0 && igDaysLeft < 14;

  const fbExpiresAt = settings?.facebook?.tokenExpiresAt ? new Date(settings.facebook.tokenExpiresAt) : null;
  const isFbExpired = fbExpiresAt ? fbExpiresAt < now : false;
  const fbDaysLeft = fbExpiresAt ? Math.ceil((fbExpiresAt.getTime() - now.getTime()) / 86400000) : null;
  const isFbExpiringSoon = fbDaysLeft !== null && fbDaysLeft >= 0 && fbDaysLeft < 14;

  return (
    <div className="space-y-6">
      {/* Expiry Warning Alert Banner */}
      {(isIgExpired || isFbExpired || isIgExpiringSoon || isFbExpiringSoon) && (
        <div className="rounded-2xl border border-red-200 bg-red-50/70 backdrop-blur p-5 text-sm text-red-800">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">⚠️</span>
            <div className="space-y-1">
              <h4 className="font-bold text-red-950 text-sm">
                Perhatian: Status Token Meta Anda Bermasalah!
              </h4>
              <p className="text-xs leading-relaxed text-red-800 font-medium">
                {isIgExpired && "• Access token Instagram Anda telah kedaluwarsa. "}
                {isFbExpired && "• Access token Facebook Anda telah kedaluwarsa. "}
                {isIgExpiringSoon && `• Access token Instagram Anda akan habis dalam ${igDaysLeft} hari. `}
                {isFbExpiringSoon && `• Access token Facebook Anda akan habis dalam ${fbDaysLeft} hari. `}
                Hal ini menyebabkan posting otomatis gagal dilakukan. Silakan ikuti panduan di bawah untuk memperbarui token Anda menggunakan token baru dari Meta Developers.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Guide Accordion */}
      <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center justify-between p-5 text-left font-bold text-txt-primary hover:bg-surface-secondary/50 transition-all duration-300"
        >
          <div className="flex items-center gap-2.5 text-primary">
            <Share2 size={18} className="text-primary animate-pulse" />
            <span className="text-sm font-bold">📖 Panduan Mendapatkan & Memperbarui Meta Token (Instagram / Facebook)</span>
          </div>
          <span className="text-xs text-primary font-bold bg-primary/5 hover:bg-primary/10 px-3 py-1 rounded-full transition-all">
            {showGuide ? "▲ Sembunyikan" : "▼ Tampilkan Panduan"}
          </span>
        </button>

        {showGuide && (
          <div className="p-5 border-t border-border bg-surface-secondary/40 space-y-4 text-xs leading-relaxed text-txt-secondary">
            <div className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-xl text-blue-950 space-y-1.5 backdrop-blur-sm">
              <strong className="text-blue-950 font-bold block text-xs">💡 Info Penting Tentang Tipe Token:</strong>
              Sangat direkomendasikan menggunakan <strong>Page Access Token</strong> yang didapatkan melalui proses &quot;Scan Akun&quot; di bawah. Token ini <strong>tidak akan pernah kedaluwarsa (Never Expires)</strong> jika Anda melakukan scan menggunakan <strong>User Access Token Jangka Panjang (Long-Lived, 60 hari)</strong>. 
              <br/>
              Jika server Anda telah dikonfigurasi dengan App ID &amp; Secret, sistem akan otomatis mengubah token jangka pendek menjadi jangka panjang saat di-scan! Jika belum, harap ikuti langkah perpanjangan manual di bawah.
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-txt-primary text-xs uppercase tracking-wider text-primary">Langkah 1: Hubungkan &amp; Generate Short-Lived Token</h4>
              <ol className="list-decimal list-inside space-y-1.5 ml-1">
                <li>Buka <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener noreferrer" className="text-primary underline font-semibold hover:text-primary-dark inline-flex items-center gap-0.5">Meta Graph API Explorer <ExternalLink size={10} /></a>.</li>
                <li>Di sudut kanan atas, pada pilihan <strong>Meta App</strong>, pilih App yang terhubung (contoh: <code>Kartawarta</code>).</li>
                <li>Pada bagian <strong>User or Page</strong>, pilih <strong>User Access Token</strong>.</li>
                <li>Di kolom <strong>Permissions</strong> (sisi kanan), tambahkan minimal 5 izin wajib berikut:
                  <div className="flex flex-wrap gap-1.5 mt-1.5 mb-1.5">
                    <code className="bg-surface px-2 py-0.5 border border-border rounded text-[10px] font-mono text-pink-600">instagram_basic</code>
                    <code className="bg-surface px-2 py-0.5 border border-border rounded text-[10px] font-mono text-pink-600">instagram_content_publish</code>
                    <code className="bg-surface px-2 py-0.5 border border-border rounded text-[10px] font-mono text-blue-600">pages_read_engagement</code>
                    <code className="bg-surface px-2 py-0.5 border border-border rounded text-[10px] font-mono text-blue-600">pages_show_list</code>
                    <code className="bg-surface px-2 py-0.5 border border-border rounded text-[10px] font-mono text-blue-600">pages_manage_posts</code>
                  </div>
                </li>
                <li>Klik tombol biru <strong>Generate Access Token</strong>. Setujui login Facebook dan pastikan Anda mencentang Page Facebook &amp; Akun Instagram Business Anda yang ingin diposting.</li>
              </ol>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-txt-primary text-xs uppercase tracking-wider text-primary">Langkah 2 (Opsional / Manual): Perpanjang Token Menjadi Jangka Panjang (60 Hari)</h4>
              <p className="ml-1 text-[11px] text-txt-secondary leading-relaxed">
                Jika sistem server Anda tidak melakukan pertukaran otomatis, Anda wajib memperpanjang User Access Token secara manual agar mendapatkan Page Token yang <strong>Never Expires</strong>:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 ml-1">
                <li>Pada Meta Graph API Explorer, di samping token yang baru saja di-generate, klik ikon informasi kecil (berbentuk bulat dengan huruf <strong className="font-bold font-mono">i</strong>) bertuliskan <strong>&quot;Access Token Info&quot;</strong>.</li>
                <li>Pada pop-up yang muncul, klik tombol <strong>&quot;Open in Access Token Tool&quot;</strong> (Buka di Alat Access Token).</li>
                <li>Di bagian bawah halaman alat tersebut, klik tombol biru <strong>&quot;Extend Access Token&quot;</strong> (Perpanjang Access Token) dan masukkan password Facebook Anda jika diminta.</li>
                <li>Copy token baru berdurasi 60 hari yang ditampilkan di kolom hasil perpanjangan tersebut.</li>
              </ol>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-txt-primary text-xs uppercase tracking-wider text-primary">Langkah 3: Menghasilkan Token Page &quot;Never Expires&quot; Secara Otomatis</h4>
              <ol className="list-decimal list-inside space-y-1.5 ml-1">
                <li>Tempelkan token (baik token jangka panjang dari Langkah 2, atau token jangka pendek dari Langkah 1 jika server Anda mendukung auto-extend) pada input <strong>Access Token</strong> di bagian <strong>Instagram</strong> di bawah ini.</li>
                <li>Klik tombol <strong>&quot;Scan Akun &amp; Page Terhubung dari Meta Token&quot;</strong>.</li>
                <li>Daftar Facebook Page dan Akun Instagram Business yang terhubung akan muncul di bawah tombol.</li>
                <li><strong>Klik pada kartu akun Anda di daftar hasil scan.</strong></li>
                <li>Sistem akan mendeteksi token dan otomatis mengisi <strong>IG User ID</strong>, <strong>Page ID</strong>, serta menghasilkan <strong>Page Access Token yang Never Expires</strong> pada kolom token Instagram &amp; Facebook secara bersamaan!</li>
                <li>Terakhir, klik <strong>Simpan Instagram</strong> dan <strong>Simpan Facebook</strong> di bawah untuk menyimpan konfigurasi baru Anda.</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Global */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-bold text-txt-primary mb-4">Global</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={global.draftMode}
              onChange={(e) =>
                setGlobal({ ...global, draftMode: e.target.checked })
              }
              className="h-4 w-4 rounded border-border"
            />
            Draft Mode (semua post butuh approval)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={global.autoPublishIG}
              onChange={(e) =>
                setGlobal({ ...global, autoPublishIG: e.target.checked })
              }
              className="h-4 w-4 rounded border-border"
            />
            Auto-publish Instagram
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={global.autoPublishFB}
              onChange={(e) =>
                setGlobal({ ...global, autoPublishFB: e.target.checked })
              }
              className="h-4 w-4 rounded border-border"
            />
            Auto-publish Facebook
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={global.autoPublishThreads}
              onChange={(e) =>
                setGlobal({ ...global, autoPublishThreads: e.target.checked })
              }
              className="h-4 w-4 rounded border-border"
            />
            Auto-publish Threads
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={global.autoPublishTwitter}
              onChange={(e) =>
                setGlobal({
                  ...global,
                  autoPublishTwitter: e.target.checked,
                })
              }
              className="h-4 w-4 rounded border-border"
            />
            Auto-publish Twitter
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={global.autoPublishReels}
              onChange={(e) =>
                setGlobal({ ...global, autoPublishReels: e.target.checked })
              }
              className="h-4 w-4 rounded border-border"
            />
            Auto-buat Reel IG (saat artikel terbit)
          </label>
          <div className="md:col-span-2 rounded-xl border border-border bg-surface-secondary/40 p-3.5">
            <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-txt-secondary">
              <Music size={12} /> Musik latar default Reel (opsional)
            </label>
            <input
              type="text"
              className="input w-full py-2 text-sm"
              placeholder="/uploads/… URL musik"
              value={global.reelDefaultBgmUrl || ""}
              onChange={(e) => setGlobal({ ...global, reelDefaultBgmUrl: e.target.value })}
            />
            <p className="mt-1.5 text-[10px] leading-relaxed text-txt-muted">
              Judul tetap + deskripsi berita (maks 3 bagian) muncul kata demi kata; foto &amp; latar diam (tanpa zoom). Durasi otomatis mengikuti kecepatan baca.
            </p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-txt-secondary mb-1">
              Default Hashtags
            </label>
            <textarea
              rows={2}
              className="input w-full py-2 text-sm"
              placeholder="#kartawarta #bandung #hukum"
              value={global.defaultHashtags || ""}
              onChange={(e) =>
                setGlobal({ ...global, defaultHashtags: e.target.value })
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-txt-secondary mb-1">
              Default CTA
            </label>
            <input
              type="text"
              className="input w-full py-2 text-sm"
              placeholder="Baca selengkapnya di kartawarta.com"
              value={global.defaultCTA || ""}
              onChange={(e) =>
                setGlobal({ ...global, defaultCTA: e.target.value })
              }
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-txt-secondary">
                Template Caption Global
              </label>
              <span className="text-[10px] text-txt-muted bg-surface-secondary px-2 py-0.5 rounded-full border border-border">
                Customizable Layout
              </span>
            </div>
            <textarea
              rows={5}
              className="input w-full py-2 text-sm font-mono leading-relaxed"
              placeholder="Contoh: {{title}}&#10;&#10;{{summary}}&#10;&#10;Baca selengkapnya di: {{link}}&#10;&#10;{{cta}}&#10;&#10;{{hashtags}}"
              value={global.captionTemplate || ""}
              onChange={(e) =>
                setGlobal({ ...global, captionTemplate: e.target.value })
              }
            />
            <div className="rounded-xl border border-border bg-surface-secondary/40 p-3.5 space-y-2">
              <span className="text-[11px] font-bold text-txt-primary block">
                Placeholders yang didukung:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="flex flex-col p-2 rounded-lg bg-surface border border-border">
                  <code className="text-pink-500 font-mono text-[10px] font-bold mb-0.5">{"{{title}}"}</code>
                  <span className="text-[10px] text-txt-muted">Judul artikel asli</span>
                </div>
                <div className="flex flex-col p-2 rounded-lg bg-surface border border-border">
                  <code className="text-blue-500 font-mono text-[10px] font-bold mb-0.5">{"{{summary}}"}</code>
                  <span className="text-[10px] text-txt-muted">Konten ringkasan hasil AI</span>
                </div>
                <div className="flex flex-col p-2 rounded-lg bg-surface border border-border">
                  <code className="text-emerald-500 font-mono text-[10px] font-bold mb-0.5">{"{{link}}"}</code>
                  <span className="text-[10px] text-txt-muted">Link artikel berita</span>
                </div>
                <div className="flex flex-col p-2 rounded-lg bg-surface border border-border">
                  <code className="text-purple-500 font-mono text-[10px] font-bold mb-0.5">{"{{cta}}"}</code>
                  <span className="text-[10px] text-txt-muted">Teks CTA Default di atas</span>
                </div>
                <div className="flex flex-col p-2 rounded-lg bg-surface border border-border col-span-2 sm:col-span-1">
                  <code className="text-amber-500 font-mono text-[10px] font-bold mb-0.5">{"{{hashtags}}"}</code>
                  <span className="text-[10px] text-txt-muted">Hashtag default & kategori</span>
                </div>
              </div>
              <p className="text-[10px] text-txt-muted leading-relaxed mt-1">
                * Kosongkan field ini jika ingin menggunakan template bawaan sistem:<br />
                <code className="bg-surface px-1.5 py-0.5 rounded border border-border font-mono text-[9px]">
                  {"{{title}} \n\n {{summary}} \n\n Baca selengkapnya di: {{link}} \n\n {{cta}} \n\n {{hashtags}}"}
                </code>
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() =>
              saveScope("global", {
                draftMode: global.draftMode,
                autoPublishIG: global.autoPublishIG,
                autoPublishFB: global.autoPublishFB,
                autoPublishTwitter: global.autoPublishTwitter,
                autoPublishThreads: global.autoPublishThreads,
                autoPublishReels: global.autoPublishReels,
                reelDurationSec: global.reelDurationSec ?? 8,
                reelDefaultBgmUrl: global.reelDefaultBgmUrl || null,
                defaultHashtags: global.defaultHashtags,
                defaultCTA: global.defaultCTA,
                captionTemplate: global.captionTemplate || null,
              })
            }
            disabled={saving === "global"}
            className="btn-primary flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {saving === "global" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Simpan Global
          </button>
        </div>
      </div>

      {/* Instagram */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h3 className="text-base font-bold text-txt-primary flex items-center gap-2">
            <Instagram size={16} className="text-pink-500" />
            Instagram
          </h3>
          {settings.instagram.hasAccessToken ? (
            isIgExpired ? (
              <span className="inline-flex items-center rounded-md bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/10">
                ❌ Expired ({igExpiresAt?.toLocaleDateString("id-ID")})
              </span>
            ) : isIgExpiringSoon ? (
              <span className="inline-flex items-center rounded-md bg-yellow-50 px-2.5 py-0.5 text-xs font-semibold text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
                ⚠️ Expiring Soon ({igDaysLeft} hari lagi)
              </span>
            ) : igExpiresAt ? (
              <span className="inline-flex items-center rounded-md bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">
                ✅ Aktif (Sampai: {igExpiresAt?.toLocaleDateString("id-ID")})
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                ✨ Never Expires / Long-lived
              </span>
            )
          ) : (
            <span className="inline-flex items-center rounded-md bg-gray-50 px-2.5 py-0.5 text-xs font-semibold text-gray-600 ring-1 ring-inset ring-gray-500/10">
              Belum Terkoneksi
            </span>
          )}
        </div>
        <p className="text-xs text-txt-muted mb-4">
          {settings.instagram.hasAccessToken
            ? `Token ter-set (masked: ${settings.instagram.accessToken}). Kosongkan untuk mempertahankan.`
            : "Belum ada access token."}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-txt-secondary mb-1">
              Access Token{" "}
              <span className="text-txt-muted">(long-lived)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore
                style={{ WebkitTextSecurity: showIgToken ? "none" : "disc" } as React.CSSProperties}
                className="input w-full py-2 text-sm pr-16"
                placeholder={
                  settings.instagram.hasAccessToken
                    ? "(tidak berubah)"
                    : "EAA..."
                }
                value={instagram.accessToken}
                onChange={(e) =>
                  setInstagram({ ...instagram, accessToken: e.target.value })
                }
              />
              <button
                type="button"
                onClick={() => setShowIgToken(!showIgToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary"
              >
                {showIgToken ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-txt-secondary mb-1">
              IG User ID
            </label>
            <input
              type="text"
              className="input w-full py-2 text-sm"
              value={instagram.igUserId}
              onChange={(e) =>
                setInstagram({ ...instagram, igUserId: e.target.value })
              }
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={handleScanAccounts}
              disabled={scanningAccounts}
              className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary font-semibold border border-primary/20 rounded-lg hover:bg-primary/5 disabled:opacity-50"
            >
              {scanningAccounts ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              Scan Akun & Page Terhubung dari Meta Token
            </button>

            {scannedAccounts.length > 0 && (
              <div className="mt-3 p-3 bg-surface-secondary border border-border rounded-xl space-y-2">
                <p className="text-xs font-bold text-txt-secondary">
                  Pilih Akun Terhubung untuk mengisi ID secara otomatis:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {scannedAccounts.map((acc, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        if (acc.instagramId) {
                          setInstagram({
                            ...instagram,
                            igUserId: acc.instagramId,
                            accessToken: acc.pageAccessToken || "",
                          });
                          showSuccess(`ID Instagram '${acc.instagramUsername}' & Token terpilih.`);
                        }
                        if (acc.pageId) {
                          setFacebook({
                            ...facebook,
                            pageId: acc.pageId,
                            accessToken: acc.pageAccessToken || "",
                          });
                          showSuccess(`Page Facebook '${acc.pageName}' & Token terpilih.`);
                        }
                      }}
                      className="p-2.5 bg-surface border border-border hover:border-primary rounded-lg cursor-pointer transition-all text-xs space-y-1 hover:shadow-card"
                    >
                      <div className="font-bold text-txt-primary">
                        🚩 Page: {acc.pageName}
                      </div>
                      {acc.instagramId ? (
                        <div className="text-pink-500 font-semibold flex items-center gap-1">
                          <Instagram size={10} />
                          IG: @{acc.instagramUsername} ({acc.instagramName})
                        </div>
                      ) : (
                        <div className="text-txt-muted italic">
                          (Tidak ada IG Business terhubung)
                        </div>
                      )}
                      <div className="text-[10px] text-txt-muted">
                        Klik untuk pilih & isi ID secara otomatis.
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-txt-secondary mb-1">
              Caption Max Len
            </label>
            <input
              type="number"
              className="input w-full py-2 text-sm"
              value={instagram.captionMaxLen}
              onChange={(e) =>
                setInstagram({
                  ...instagram,
                  captionMaxLen: parseInt(e.target.value) || 2200,
                })
              }
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-txt-secondary mb-1">
              Hashtag Count
            </label>
            <input
              type="number"
              className="input w-full py-2 text-sm"
              value={instagram.hashtagCount}
              onChange={(e) =>
                setInstagram({
                  ...instagram,
                  hashtagCount: parseInt(e.target.value) || 15,
                })
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={instagram.enabled}
              onChange={(e) =>
                setInstagram({ ...instagram, enabled: e.target.checked })
              }
              className="h-4 w-4 rounded border-border"
            />
            Enabled
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              const payload: Record<string, unknown> = {
                igUserId: instagram.igUserId || null,
                enabled: instagram.enabled,
                captionMaxLen: instagram.captionMaxLen,
                hashtagCount: instagram.hashtagCount,
              };
              if (instagram.accessToken.trim()) {
                payload.accessToken = instagram.accessToken;
              }
              saveScope("instagram", payload);
            }}
            disabled={saving === "instagram"}
            className="btn-primary flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {saving === "instagram" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Simpan Instagram
          </button>
        </div>
      </div>

      {/* Facebook */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h3 className="text-base font-bold text-txt-primary flex items-center gap-2">
            <Facebook size={16} className="text-blue-600" />
            Facebook
          </h3>
          {settings.facebook.hasAccessToken ? (
            isFbExpired ? (
              <span className="inline-flex items-center rounded-md bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/10">
                ❌ Expired ({fbExpiresAt?.toLocaleDateString("id-ID")})
              </span>
            ) : isFbExpiringSoon ? (
              <span className="inline-flex items-center rounded-md bg-yellow-50 px-2.5 py-0.5 text-xs font-semibold text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
                ⚠️ Expiring Soon ({fbDaysLeft} hari lagi)
              </span>
            ) : fbExpiresAt ? (
              <span className="inline-flex items-center rounded-md bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">
                ✅ Aktif (Sampai: {fbExpiresAt?.toLocaleDateString("id-ID")})
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                ✨ Never Expires / Long-lived
              </span>
            )
          ) : (
            <span className="inline-flex items-center rounded-md bg-gray-50 px-2.5 py-0.5 text-xs font-semibold text-gray-600 ring-1 ring-inset ring-gray-500/10">
              Belum Terkoneksi
            </span>
          )}
        </div>
        <p className="text-xs text-txt-muted mb-4">
          {settings.facebook.hasAccessToken
            ? `Token ter-set (masked: ${settings.facebook.accessToken}). Kosongkan untuk mempertahankan.`
            : "Belum ada access token."}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-txt-secondary mb-1">
              Page ID
            </label>
            <input
              type="text"
              className="input w-full py-2 text-sm"
              value={facebook.pageId}
              onChange={(e) =>
                setFacebook({ ...facebook, pageId: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-txt-secondary mb-1">
              Access Token
            </label>
            <div className="relative">
              <input
                type="text"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore
                style={{ WebkitTextSecurity: showFbToken ? "none" : "disc" } as React.CSSProperties}
                className="input w-full py-2 text-sm pr-16"
                placeholder={
                  settings.facebook.hasAccessToken
                    ? "(tidak berubah)"
                    : "EAAB..."
                }
                value={facebook.accessToken}
                onChange={(e) =>
                  setFacebook({ ...facebook, accessToken: e.target.value })
                }
              />
              <button
                type="button"
                onClick={() => setShowFbToken(!showFbToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary"
              >
                {showFbToken ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-txt-secondary mb-2.5">
              Facebook Post Mode
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label 
                className={`flex flex-col p-4 rounded-xl border transition-all cursor-pointer select-none ${
                  facebook.postMode === "link" ? "border-primary bg-primary/5" : "border-border hover:border-outline-variant"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <input
                    type="radio"
                    name="fbPostMode"
                    className="accent-primary h-4 w-4 shrink-0"
                    checked={facebook.postMode === "link"}
                    onChange={() =>
                      setFacebook({ ...facebook, postMode: "link" })
                    }
                  />
                  <span className="text-sm font-semibold text-txt-primary">Link Share</span>
                </div>
                <span className="text-xs text-txt-secondary leading-relaxed pl-6">
                  Membagikan artikel dengan kartu pratinjau (*link card*) standard Facebook. Gambar diambil otomatis dari Open Graph artikel.
                </span>
              </label>

              <label 
                className={`flex flex-col p-4 rounded-xl border transition-all cursor-pointer select-none ${
                  facebook.postMode === "photo" ? "border-primary bg-primary/5" : "border-border hover:border-outline-variant"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <input
                    type="radio"
                    name="fbPostMode"
                    className="accent-primary h-4 w-4 shrink-0"
                    checked={facebook.postMode === "photo"}
                    onChange={() =>
                      setFacebook({ ...facebook, postMode: "photo" })
                    }
                  />
                  <span className="text-sm font-semibold text-txt-primary">Single Photo</span>
                </div>
                <span className="text-xs text-txt-secondary leading-relaxed pl-6">
                  Mengunggah gambar templat kustom Anda yang cantik sebagai **Foto** tunggal, dengan tautan baca otomatis tersemat di teks caption.
                </span>
              </label>

              <label 
                className={`flex flex-col p-4 rounded-xl border transition-all cursor-pointer select-none ${
                  facebook.postMode === "both" ? "border-primary bg-primary/5" : "border-border hover:border-outline-variant"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <input
                    type="radio"
                    name="fbPostMode"
                    className="accent-primary h-4 w-4 shrink-0"
                    checked={facebook.postMode === "both"}
                    onChange={() =>
                      setFacebook({ ...facebook, postMode: "both" })
                    }
                  />
                  <span className="text-sm font-semibold text-txt-primary">Keduanya (Dua Post)</span>
                </div>
                <span className="text-xs text-txt-secondary leading-relaxed pl-6">
                  Menerbitkan **dua postingan terpisah sekaligus** sekali klik: 1 post Link Share bawaan, dan 1 post Foto kustom templat Anda.
                </span>
              </label>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={facebook.enabled}
              onChange={(e) =>
                setFacebook({ ...facebook, enabled: e.target.checked })
              }
              className="h-4 w-4 rounded border-border"
            />
            Enabled
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              const payload: Record<string, unknown> = {
                pageId: facebook.pageId || null,
                postMode: facebook.postMode,
                enabled: facebook.enabled,
              };
              if (facebook.accessToken.trim()) {
                payload.accessToken = facebook.accessToken;
              }
              saveScope("facebook", payload);
            }}
            disabled={saving === "facebook"}
            className="btn-primary flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {saving === "facebook" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Simpan Facebook
          </button>
        </div>
      </div>

      {/* Threads */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h3 className="text-base font-bold text-txt-primary flex items-center gap-2">
            <Share2 size={16} className="text-emerald-500" />
            Threads
          </h3>
          {settings.threads?.hasAccessToken ? (
            <span className="inline-flex items-center rounded-md bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">
              ✅ Terkoneksi
            </span>
          ) : (
            <span className="inline-flex items-center rounded-md bg-gray-50 px-2.5 py-0.5 text-xs font-semibold text-gray-600 ring-1 ring-inset ring-gray-500/10">
              Belum Terkoneksi
            </span>
          )}
        </div>
        <p className="text-xs text-txt-muted mb-4">
          {settings.threads?.hasAccessToken
            ? `Token ter-set (masked: ${settings.threads.accessToken}). Kosongkan untuk mempertahankan.`
            : "Belum ada access token."}
        </p>

        {/* Quick Connect Section */}
        <div className="mb-6 p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
          <div>
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-1 flex items-center gap-1.5">
              ⚡ Cara Cepat: Hubungkan Threads Otomatis (Rekomendasi)
            </h4>
            <p className="text-[11px] text-txt-secondary leading-relaxed">
              Dapatkan token dan User ID Threads secara otomatis tanpa perlu mengisi kolom-kolom di bawah secara manual:
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <label className="block text-[11px] font-semibold text-txt-secondary mb-1">
                Langkah 1: Klik tombol untuk otorisasi di browser Anda
              </label>
              <a
                href={`https://threads.net/oauth/authorize?client_id=4402452543382960&redirect_uri=${encodeURIComponent("https://kartawarta.com/")}&scope=threads_basic,threads_content_publish&response_type=code`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary hover:bg-primary-dark text-white px-4 py-2 text-sm font-semibold transition-all w-full text-center"
              >
                <ExternalLink size={14} />
                Buka Link Otorisasi Threads
              </a>
            </div>
            
            <div className="flex-1 w-full">
              <label className="block text-[11px] font-semibold text-txt-secondary mb-1">
                Langkah 2: Tempel Kode Otorisasi (?code=...)
              </label>
              <input
                type="text"
                placeholder="Tempel kode di sini..."
                className="input w-full py-2 text-sm"
                value={threadsAuthCode}
                onChange={(e) => setThreadsAuthCode(e.target.value)}
              />
            </div>

            <div className="w-full sm:w-auto font-sans">
              <button
                onClick={handleExchangeThreads}
                disabled={exchangingThreadsCode || !threadsAuthCode.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary hover:bg-primary-dark text-white px-5 py-2 text-sm font-semibold disabled:opacity-50 transition-all w-full min-w-[130px]"
              >
                {exchangingThreadsCode ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Link2 size={14} />
                )}
                Hubungkan
              </button>
            </div>
          </div>
          <p className="text-[10px] text-txt-muted leading-relaxed">
            *Setelah Anda memberikan izin di Threads, Anda akan dialihkan kembali ke kartawarta.com. Salin parameter kode (semua karakter setelah <code>?code=</code> di bilah alamat browser Anda) dan tempel di atas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-txt-secondary mb-1">
              Threads User ID
            </label>
            <input
              type="text"
              className="input w-full py-2 text-sm"
              value={threads.threadsUserId}
              onChange={(e) =>
                setThreads({ ...threads, threadsUserId: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-txt-secondary mb-1">
              Access Token
            </label>
            <div className="relative">
              <input
                type="text"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore
                style={{ WebkitTextSecurity: showThreadsToken ? "none" : "disc" } as React.CSSProperties}
                className="input w-full py-2 text-sm pr-16"
                placeholder={
                  settings.threads?.hasAccessToken
                    ? "(tidak berubah)"
                    : "THAB..."
                }
                value={threads.accessToken}
                onChange={(e) =>
                  setThreads({ ...threads, accessToken: e.target.value })
                }
              />
              <button
                type="button"
                onClick={() => setShowThreadsToken(!showThreadsToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary"
              >
                {showThreadsToken ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={threads.enabled}
              onChange={(e) =>
                setThreads({ ...threads, enabled: e.target.checked })
              }
              className="h-4 w-4 rounded border-border"
            />
            Enabled
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              const payload: Record<string, unknown> = {
                threadsUserId: threads.threadsUserId || null,
                enabled: threads.enabled,
              };
              if (threads.accessToken.trim()) {
                payload.accessToken = threads.accessToken;
              }
              saveScope("threads", payload);
            }}
            disabled={saving === "threads"}
            className="btn-primary flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {saving === "threads" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Simpan Threads
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------- Page --------------------
export default function SocialPage() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = session?.user?.role || "";
  const [tab, setTab] = useState<"posts" | "templates" | "settings">("posts");

  if (sessionStatus !== "loading" && session && userRole !== "SUPER_ADMIN") {
    redirect("/panel/dashboard");
  }

  if (sessionStatus === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Share2 size={24} className="text-primary" />
          <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">
            Sosial Media
          </h1>
        </div>
        <p className="mt-1 text-sm text-txt-secondary">
          Manajemen post, template, dan konfigurasi akun Instagram & Facebook.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-border">
        {(["posts", "templates", "settings"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === k
                ? "border-primary text-primary"
                : "border-transparent text-txt-secondary hover:text-txt-primary"
            }`}
          >
            {k === "posts" ? "Posts" : k === "templates" ? "Templates" : "Settings"}
          </button>
        ))}
      </div>

      {tab === "posts" && <PostsTab />}
      {tab === "templates" && <TemplatesTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}
