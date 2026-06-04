"use client";

/**
 * Panel Live Blog Editor — edit metadata + post/manage entries in real time
 * Auth: SUPER_ADMIN | CHIEF_EDITOR | EDITOR | JOURNALIST
 */

import { useState, useEffect, useCallback, use } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Radio,
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Pin,
  Zap,
  RefreshCw,
  ExternalLink,
  Square,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type LiveBlogStatus = "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";

interface LiveBlog {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
  status: LiveBlogStatus;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
  coverImage: string | null;
  liveStreamUrl: string | null;
  isPublished: boolean;
  syndicateToSocial: boolean;
}

interface LiveBlogEntry {
  id: string;
  content: string;
  postedAt: string;
  authorId: string | null;
  isPinned: boolean;
  isHighlight: boolean;
  imageUrl: string | null;
  videoUrl: string | null;
}

const STATUS_LABELS: Record<LiveBlogStatus, string> = {
  SCHEDULED: "Terjadwal",
  LIVE: "Live Sekarang",
  ENDED: "Selesai",
  CANCELLED: "Dibatalkan",
};

function toLocalInput(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

export default function LiveBlogEditorPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  // Client component pakai React.use() hook untuk unwrap params Promise.
  const { id } = use(paramsPromise);
  const { data: session } = useSession();
  const { success: showSuccess, error: showError } = useToast();
  const { confirm } = useConfirm();

  const [blog, setBlog] = useState<LiveBlog | null>(null);
  const [entries, setEntries] = useState<LiveBlogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMeta, setSavingMeta] = useState(false);
  const [entryContent, setEntryContent] = useState("");
  const [entryImageUrl, setEntryImageUrl] = useState("");
  const [entryIsPinned, setEntryIsPinned] = useState(false);
  const [entryIsHighlight, setEntryIsHighlight] = useState(false);
  const [postingEntry, setPostingEntry] = useState(false);
  const [meta, setMeta] = useState<Partial<LiveBlog>>({});

  const fetchBlog = useCallback(async () => {
    try {
      const res = await fetch(`/api/panel/live-blogs/${id}`);
      if (res.ok) {
        const json = await res.json();
        const b: LiveBlog = json.data?.liveBlog;
        setBlog(b);
        setMeta({
          title: b.title,
          description: b.description,
          category: b.category,
          status: b.status,
          scheduledAt: b.scheduledAt,
          coverImage: b.coverImage,
          liveStreamUrl: b.liveStreamUrl,
          isPublished: b.isPublished,
          syndicateToSocial: b.syndicateToSocial,
        });
      }
    } catch { /* noop */ }
  }, [id]);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch(`/api/panel/live-blogs/${id}/entries?limit=100`);
      if (res.ok) {
        const json = await res.json();
        setEntries(json.data?.entries || []);
      }
    } catch { /* noop */ }
  }, [id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchBlog(), fetchEntries()]);
      setLoading(false);
    };
    load();
  }, [fetchBlog, fetchEntries]);

  const saveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blog) return;
    setSavingMeta(true);
    try {
      const payload: Record<string, unknown> = { ...meta };
      if (meta.scheduledAt) {
        payload.scheduledAt = new Date(meta.scheduledAt).toISOString();
      }
      const res = await fetch(`/api/panel/live-blogs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { showError(json.error || "Gagal menyimpan"); return; }
      setBlog(json.data?.liveBlog);
      showSuccess("Tersimpan");
    } catch {
      showError("Terjadi kesalahan");
    } finally {
      setSavingMeta(false);
    }
  };

  // One-click status switch — "Mulai Live Sekarang" / "Akhiri Siaran" without
  // touching the schedule. The API auto-stamps startedAt/endedAt on transition.
  const quickStatus = async (newStatus: LiveBlogStatus) => {
    if (!blog) return;
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/panel/live-blogs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) { showError(json.error || "Gagal mengubah status"); return; }
      setBlog(json.data?.liveBlog);
      setMeta((m) => ({ ...m, status: newStatus }));
      showSuccess(
        newStatus === "LIVE"
          ? "🔴 Siaran dimulai — sekarang LIVE"
          : newStatus === "ENDED"
            ? "Siaran diakhiri"
            : "Status diperbarui"
      );
    } catch {
      showError("Terjadi kesalahan");
    } finally {
      setSavingMeta(false);
    }
  };

  const postEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryContent.trim()) return;
    setPostingEntry(true);
    try {
      const res = await fetch(`/api/panel/live-blogs/${id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: entryContent,
          isPinned: entryIsPinned,
          isHighlight: entryIsHighlight,
          imageUrl: entryImageUrl || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { showError(json.error || "Gagal posting"); return; }
      setEntries((prev) => [json.data, ...prev]);
      setEntryContent("");
      setEntryImageUrl("");
      setEntryIsPinned(false);
      setEntryIsHighlight(false);
      showSuccess("Entry berhasil diposting");
    } catch {
      showError("Terjadi kesalahan");
    } finally {
      setPostingEntry(false);
    }
  };

  const deleteEntry = async (entry: LiveBlogEntry) => {
    const ok = await confirm({
      title: "Hapus Entry",
      message: "Hapus update ini?",
      confirmText: "Hapus",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(
        `/api/panel/live-blogs/${id}/entries/${entry.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) { showError("Gagal menghapus"); return; }
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      showSuccess("Entry dihapus");
    } catch {
      showError("Terjadi kesalahan");
    }
  };

  const togglePin = async (entry: LiveBlogEntry) => {
    try {
      const res = await fetch(
        `/api/panel/live-blogs/${id}/entries/${entry.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPinned: !entry.isPinned }),
        }
      );
      const json = await res.json();
      if (!res.ok) { showError(json.error); return; }
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? json.data : e))
      );
    } catch { /* noop */ }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="py-16 text-center text-txt-muted">
        <p>Live blog tidak ditemukan.</p>
        <Link href="/panel/live-blogs" className="text-primary hover:underline mt-2 inline-block">
          Kembali
        </Link>
      </div>
    );
  }

  const userRole = session?.user?.role || "";
  const canDelete = ["SUPER_ADMIN", "CHIEF_EDITOR"].includes(userRole);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Left: Metadata editor */}
      <div className="lg:col-span-2 space-y-5">
        <div className="flex items-center gap-2">
          <Link href="/panel/live-blogs" className="text-txt-muted hover:text-primary">
            <ArrowLeft size={18} />
          </Link>
          <Radio size={18} className="text-secondary" />
          <h1 className="text-lg font-bold text-on-surface truncate">{blog.title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/live/${blog.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-label-sm text-primary hover:underline"
          >
            <ExternalLink size={12} />
            Lihat publik
          </Link>
        </div>

        {/* Quick status action — go live / end without editing the schedule */}
        {blog.status !== "LIVE" ? (
          <button
            type="button"
            onClick={() => quickStatus("LIVE")}
            disabled={savingMeta}
            className="btn-urgent w-full flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {savingMeta ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
              </span>
            )}
            Mulai Live Sekarang
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-md bg-secondary/10 px-3 py-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-secondary" />
              </span>
              <span className="text-label-md font-bold text-secondary">SEDANG LIVE</span>
            </div>
            <button
              type="button"
              onClick={() => quickStatus("ENDED")}
              disabled={savingMeta}
              className="btn-ghost w-full flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {savingMeta ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
              Akhiri Siaran
            </button>
          </div>
        )}

        <form onSubmit={saveMeta} className="card p-4 space-y-4">
          <h2 className="text-label-md font-semibold text-on-surface">Metadata</h2>

          <div>
            <label className="block text-label-sm text-txt-muted mb-1">Judul</label>
            <input
              type="text"
              value={meta.title || ""}
              onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
              className="input w-full text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-label-sm text-txt-muted mb-1">Status</label>
            <select
              value={meta.status || blog.status}
              onChange={(e) =>
                setMeta((m) => ({ ...m, status: e.target.value as LiveBlogStatus }))
              }
              className="input w-full text-sm"
            >
              {(["SCHEDULED", "LIVE", "ENDED", "CANCELLED"] as const).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-label-sm text-txt-muted mb-1">Jadwal</label>
            <input
              type="datetime-local"
              value={toLocalInput(meta.scheduledAt)}
              onChange={(e) => setMeta((m) => ({ ...m, scheduledAt: e.target.value }))}
              className="input w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-label-sm text-txt-muted mb-1">Kategori</label>
            <input
              type="text"
              value={meta.category || ""}
              onChange={(e) => setMeta((m) => ({ ...m, category: e.target.value }))}
              className="input w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-label-sm text-txt-muted mb-1">Deskripsi</label>
            <textarea
              value={meta.description || ""}
              onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
              rows={2}
              className="input w-full text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-label-sm text-txt-muted mb-1">
              Video Live / Embed (YouTube Live)
            </label>
            <input
              type="url"
              value={meta.liveStreamUrl || ""}
              onChange={(e) => setMeta((m) => ({ ...m, liveStreamUrl: e.target.value }))}
              className="input w-full text-sm"
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <p className="mt-1 text-label-sm text-txt-muted">
              Tempel link YouTube Live → player video muncul di atas timeline halaman publik.
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={meta.isPublished ?? true}
              onChange={(e) => setMeta((m) => ({ ...m, isPublished: e.target.checked }))}
              className="h-4 w-4 rounded-lg border-border text-primary"
            />
            <span className="text-sm text-on-surface">Tampilkan ke publik</span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={meta.syndicateToSocial ?? false}
              onChange={(e) => setMeta((m) => ({ ...m, syndicateToSocial: e.target.checked }))}
              className="h-4 w-4 rounded-lg border-border text-primary mt-0.5"
            />
            <span className="text-sm text-on-surface">
              Sebar update ke sosmed
              <span className="block text-label-sm text-txt-muted">
                Tiap update otomatis dikirim ke Telegram/Threads (saat status LIVE).{" "}
                <Link href="/panel/live-blogs/pengaturan" className="text-primary hover:underline">
                  Atur kanal
                </Link>
              </span>
            </span>
          </label>

          <button
            type="submit"
            disabled={savingMeta}
            className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
          >
            {savingMeta ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Simpan Perubahan
          </button>
        </form>
      </div>

      {/* Right: Entries */}
      <div className="lg:col-span-3 space-y-5">
        {/* Post new entry */}
        <form onSubmit={postEntry} className="card p-4 space-y-3">
          <h2 className="text-label-md font-semibold text-on-surface flex items-center gap-2">
            <Plus size={16} />
            Posting Update Baru
          </h2>
          <textarea
            value={entryContent}
            onChange={(e) => setEntryContent(e.target.value)}
            rows={4}
            className="input w-full resize-none text-sm"
            placeholder="Tulis update langsung di sini... HTML dasar diizinkan."
            required
          />
          <input
            type="url"
            value={entryImageUrl}
            onChange={(e) => setEntryImageUrl(e.target.value)}
            className="input w-full text-sm"
            placeholder="URL gambar (opsional)"
          />
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer text-txt-secondary">
              <input
                type="checkbox"
                checked={entryIsPinned}
                onChange={(e) => setEntryIsPinned(e.target.checked)}
                className="h-4 w-4 rounded-lg border-border text-primary"
              />
              <Pin size={13} />
              Sematkan
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer text-txt-secondary">
              <input
                type="checkbox"
                checked={entryIsHighlight}
                onChange={(e) => setEntryIsHighlight(e.target.checked)}
                className="h-4 w-4 rounded-lg border-border text-primary"
              />
              <Zap size={13} />
              Highlight
            </label>
            <button
              type="submit"
              disabled={postingEntry || !entryContent.trim()}
              className="ml-auto btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50"
            >
              {postingEntry ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />}
              Post
            </button>
          </div>
        </form>

        {/* Entries list */}
        <div className="flex items-center justify-between">
          <h2 className="text-label-md font-semibold text-on-surface">
            Timeline ({entries.length} update)
          </h2>
          <button
            onClick={fetchEntries}
            className="btn-ghost flex items-center gap-1 text-sm"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>

        <div className="space-y-3">
          {entries.length === 0 && (
            <div className="py-8 text-center text-txt-muted text-sm">
              Belum ada update. Posting update pertama di atas.
            </div>
          )}
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={`card p-4 ${entry.isPinned ? "border-l-2 border-l-primary" : ""} ${entry.isHighlight ? "border-l-2 border-l-secondary" : ""}`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <time className="text-label-sm text-primary font-semibold tabular-nums">
                    {formatTime(entry.postedAt)}
                  </time>
                  {entry.isPinned && (
                    <span className="text-label-sm text-primary flex items-center gap-1">
                      <Pin size={10} /> Disematkan
                    </span>
                  )}
                  {entry.isHighlight && (
                    <span className="text-label-sm text-secondary flex items-center gap-1">
                      <Zap size={10} /> Highlight
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => togglePin(entry)}
                    className={`rounded-lg p-1 text-xs transition-colors ${entry.isPinned ? "text-primary bg-primary-light" : "text-txt-muted hover:text-primary"}`}
                    title={entry.isPinned ? "Lepas sematan" : "Sematkan"}
                  >
                    <Pin size={13} />
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => deleteEntry(entry)}
                      className="rounded-lg p-1 text-txt-muted hover:text-secondary transition-colors"
                      title="Hapus"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
              <div
                className="text-sm text-on-surface prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: entry.content }}
              />
              {entry.imageUrl && (
                <img
                  src={entry.imageUrl}
                  alt="Entry media"
                  className="mt-2 rounded-lg max-h-40 object-cover"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
