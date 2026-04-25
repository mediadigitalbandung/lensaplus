"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Save,
  Plus,
  Trash2,
  Music2,
  Hash,
  Send,
  Download,
  Image as ImageIcon,
  Video as VideoIcon,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Volume2,
  Layers,
  CalendarClock,
  Settings,
  Pencil,
  Sparkles,
} from "lucide-react";

interface Slot {
  id: string;
  contentId: string;
  order: number;
  kind: "IMAGE" | "VIDEO";
  url: string;
  filename: string | null;
  mimeType: string | null;
  durationMs: number;
  trimStartMs: number;
  trimEndMs: number | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  size: number | null;
}

interface Account {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: string;
}

interface Content {
  id: string;
  title: string;
  caption: string | null;
  hashtags: string;
  status: string;
  aspectRatio: "PORTRAIT_9_16" | "SQUARE_1_1";
  templateKey: string | null;
  bgmUrl: string | null;
  bgmVolume: number;
  overlayJson: Record<string, unknown> | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  outputUrl: string | null;
  account: Account | null;
  accountId: string | null;
  slots: Slot[];
  updatedAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  READY: "Siap",
  RENDERING: "Render",
  RENDER_FAILED: "Render Gagal",
  SCHEDULED: "Dijadwalkan",
  PUBLISHING: "Posting",
  PUBLISHED: "Tayang",
  PUBLISH_FAILED: "Posting Gagal",
  ARCHIVED: "Diarsip",
};

type TabKey = "caption" | "music" | "overlay" | "publish";

function humanSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TiktokEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [content, setContent] = useState<Content | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [tab, setTab] = useState<TabKey>("caption");

  // Editable fields
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [accountId, setAccountId] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"PORTRAIT_9_16" | "SQUARE_1_1">("PORTRAIT_9_16");
  const [bgmUrl, setBgmUrl] = useState<string | null>(null);
  const [bgmVolume, setBgmVolume] = useState(0.6);
  const [overlayJson, setOverlayJson] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [status, setStatus] = useState("DRAFT");

  const slotInputRef = useRef<HTMLInputElement>(null);
  const bgmInputRef = useRef<HTMLInputElement>(null);

  const totalDurationMs = useMemo(
    () => content?.slots.reduce((sum, s) => sum + (s.durationMs || 0), 0) || 0,
    [content?.slots],
  );

  const fetchContent = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/tiktok/contents/${id}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Gagal memuat konten");
      }
      const json = await res.json();
      const data: Content = json.data;
      setContent(data);
      setTitle(data.title);
      setCaption(data.caption || "");
      setHashtags(data.hashtags || "");
      setAccountId(data.accountId || "");
      setAspectRatio(data.aspectRatio);
      setBgmUrl(data.bgmUrl);
      setBgmVolume(data.bgmVolume);
      setOverlayJson(data.overlayJson ? JSON.stringify(data.overlayJson, null, 2) : "");
      setScheduledAt(data.scheduledAt ? data.scheduledAt.slice(0, 16) : "");
      setStatus(data.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat konten");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchContent();
    fetch("/api/tiktok/accounts")
      .then((r) => r.json())
      .then((j) => setAccounts(j?.data || []))
      .catch(() => {});
  }, [fetchContent]);

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const saveContent = async (overrides: Record<string, unknown> = {}) => {
    setSaving(true);
    setError("");
    try {
      let parsedOverlay: unknown = undefined;
      if (overlayJson.trim()) {
        try {
          parsedOverlay = JSON.parse(overlayJson);
        } catch {
          throw new Error("Overlay JSON tidak valid");
        }
      } else {
        parsedOverlay = null;
      }

      const body: Record<string, unknown> = {
        title,
        caption: caption || null,
        hashtags,
        accountId: accountId || null,
        aspectRatio,
        bgmUrl,
        bgmVolume,
        overlayJson: parsedOverlay,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        ...overrides,
      };

      const res = await fetch(`/api/tiktok/contents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Gagal menyimpan");

      setContent(json.data);
      setStatus(json.data.status);
      flashToast("Tersimpan");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const uploadSlot = async (file: File) => {
    setSaving(true);
    setError("");
    try {
      // Upload file
      const formData = new FormData();
      formData.append("file", file);
      formData.append("target", "slot");
      const upRes = await fetch("/api/tiktok/upload", { method: "POST", body: formData });
      const upJson = await upRes.json();
      if (!upRes.ok || !upJson.success) throw new Error(upJson.error || "Upload gagal");

      // Append slot
      const slotRes = await fetch(`/api/tiktok/contents/${id}/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: upJson.data.kind,
          url: upJson.data.url,
          filename: upJson.data.filename,
          mimeType: upJson.data.mimeType,
          size: upJson.data.size,
          durationMs: upJson.data.kind === "VIDEO" ? 5000 : 3000,
        }),
      });
      const slotJson = await slotRes.json();
      if (!slotRes.ok || !slotJson.success) throw new Error(slotJson.error || "Gagal menambah slot");

      flashToast("Slot ditambahkan");
      await fetchContent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal upload");
    } finally {
      setSaving(false);
    }
  };

  const uploadBgm = async (file: File) => {
    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("target", "bgm");
      const upRes = await fetch("/api/tiktok/upload", { method: "POST", body: formData });
      const upJson = await upRes.json();
      if (!upRes.ok || !upJson.success) throw new Error(upJson.error || "Upload BGM gagal");
      setBgmUrl(upJson.data.url);
      flashToast("BGM diupload — klik Simpan untuk konfirmasi");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal upload BGM");
    } finally {
      setSaving(false);
    }
  };

  const removeSlot = async (slotId: string) => {
    if (!confirm("Hapus slot ini?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tiktok/contents/${id}/slots/${slotId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Gagal hapus");
      await fetchContent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal hapus slot");
    } finally {
      setSaving(false);
    }
  };

  const moveSlot = async (slotId: string, direction: -1 | 1) => {
    if (!content) return;
    const idx = content.slots.findIndex((s) => s.id === slotId);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= content.slots.length) return;
    const newOrder = [...content.slots.map((s) => s.id)];
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    setSaving(true);
    try {
      const res = await fetch(`/api/tiktok/contents/${id}/slots`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordered: newOrder }),
      });
      if (!res.ok) throw new Error("Gagal mengurutkan");
      await fetchContent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengurutkan");
    } finally {
      setSaving(false);
    }
  };

  const updateSlotDuration = async (slotId: string, durationMs: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/tiktok/contents/${id}/slots/${slotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationMs }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Gagal update durasi");
      await fetchContent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal update");
    } finally {
      setSaving(false);
    }
  };

  const exportManifest = async () => {
    try {
      const res = await fetch(`/api/tiktok/contents/${id}/export`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Export gagal");
      const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `tiktok-${id}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      flashToast("Manifest diunduh");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal export");
    }
  };

  const tryRender = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/tiktok/contents/${id}/render`, { method: "POST" });
      const json = await res.json();
      if (res.status === 501) {
        setError(json.error || "Render belum aktif");
        return;
      }
      if (!res.ok) throw new Error(json.error || "Gagal render");
      flashToast("Render dimulai");
      await fetchContent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal render");
    } finally {
      setSaving(false);
    }
  };

  const tryPublish = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/tiktok/contents/${id}/publish`, { method: "POST" });
      const json = await res.json();
      if (res.status === 501) {
        setError(json.error || "Posting otomatis belum aktif");
        return;
      }
      if (!res.ok) throw new Error(json.error || "Gagal posting");
      flashToast("Posting dimulai");
      await fetchContent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal posting");
    } finally {
      setSaving(false);
    }
  };

  const deleteContent = async () => {
    if (!confirm("Hapus konten TikTok ini secara permanen?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tiktok/contents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal hapus");
      router.push("/panel/tiktok");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal hapus");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-5 text-red-700">
        {error || "Konten tidak ditemukan"}
        <Link href="/panel/tiktok" className="ml-2 underline">
          Kembali
        </Link>
      </div>
    );
  }

  const captionFinal = (() => {
    const tags = hashtags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => `#${t}`)
      .join(" ");
    return tags ? `${caption}\n\n${tags}` : caption;
  })();

  const aspectClass = aspectRatio === "PORTRAIT_9_16" ? "aspect-[9/16]" : "aspect-square";

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href="/panel/tiktok"
            className="mb-1 inline-flex items-center gap-1.5 text-xs text-txt-secondary hover:text-primary"
          >
            <ArrowLeft size={12} />
            Daftar Konten
          </Link>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent text-lg font-bold text-txt-primary outline-none focus:bg-surface-container-low focus:px-2 sm:text-2xl"
            maxLength={150}
          />
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-txt-muted">
            <span className="rounded bg-surface-tertiary px-2 py-0.5 font-medium text-txt-secondary">
              {STATUS_LABEL[status] || status}
            </span>
            <span>Total durasi: {(totalDurationMs / 1000).toFixed(1)}s</span>
            <span>{content.slots.length} slot</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportManifest}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <Download size={14} />
            Export
          </button>
          <button
            type="button"
            onClick={() => saveContent()}
            disabled={saving}
            className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Simpan
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left — slot list (4 cols) */}
        <div className="lg:col-span-4">
          <div className="rounded-[12px] border border-border bg-surface p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-txt-primary">
                <Layers size={14} className="text-primary" />
                Slot Media
              </h2>
              <button
                type="button"
                onClick={() => slotInputRef.current?.click()}
                className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark"
              >
                <Plus size={12} />
                Tambah
              </button>
              <input
                ref={slotInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadSlot(f);
                  e.target.value = "";
                }}
              />
            </div>

            {content.slots.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-surface-container-low p-6 text-center text-xs text-txt-muted">
                Belum ada slot. Klik <strong>Tambah</strong> untuk upload foto atau video.
              </p>
            ) : (
              <ul className="space-y-2">
                {content.slots.map((s, idx) => (
                  <li
                    key={s.id}
                    className="flex items-start gap-3 rounded-md border border-border bg-surface-container-low p-2"
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-surface-secondary">
                      {s.kind === "IMAGE" ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={s.url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <video src={s.url} className="h-full w-full object-cover" muted />
                      )}
                      <span className="absolute bottom-0 left-0 bg-black/60 px-1 text-[9px] font-bold text-white">
                        {s.kind === "IMAGE" ? <ImageIcon size={10} /> : <VideoIcon size={10} />}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-txt-primary">
                        #{idx + 1} · {s.filename || s.url.split("/").pop()}
                      </p>
                      <p className="text-[10px] text-txt-muted">{humanSize(s.size)}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <label className="text-[10px] text-txt-muted">Durasi</label>
                        <input
                          type="number"
                          value={s.durationMs}
                          step={500}
                          min={500}
                          max={30000}
                          onBlur={(e) => {
                            const ms = parseInt(e.target.value);
                            if (ms !== s.durationMs) updateSlotDuration(s.id, ms);
                          }}
                          onChange={() => {
                            /* uncontrolled to avoid jitter */
                          }}
                          defaultValue={s.durationMs}
                          className="w-16 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px]"
                        />
                        <span className="text-[10px] text-txt-muted">ms</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveSlot(s.id, -1)}
                        disabled={idx === 0}
                        className="rounded p-1 text-txt-secondary hover:bg-surface-container disabled:opacity-30"
                        title="Naik"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        onClick={() => moveSlot(s.id, 1)}
                        disabled={idx === content.slots.length - 1}
                        className="rounded p-1 text-txt-secondary hover:bg-surface-container disabled:opacity-30"
                        title="Turun"
                      >
                        <ChevronDown size={12} />
                      </button>
                      <button
                        onClick={() => removeSlot(s.id)}
                        className="rounded p-1 text-red-500 hover:bg-red-50"
                        title="Hapus"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Center — preview (4 cols) */}
        <div className="lg:col-span-4">
          <div className="rounded-[12px] border border-border bg-surface p-4 shadow-card">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-txt-primary">
              <Pencil size={14} className="text-primary" />
              Preview
            </h2>
            <div
              className={`relative ${aspectClass} mx-auto max-w-[280px] overflow-hidden rounded-md bg-black`}
            >
              {content.outputUrl ? (
                <video src={content.outputUrl} controls className="h-full w-full object-contain" />
              ) : content.slots[0] ? (
                content.slots[0].kind === "IMAGE" ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={content.slots[0].url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <video src={content.slots[0].url} controls className="h-full w-full object-cover" />
                )
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-white/40">
                  Tambah slot media untuk preview
                </div>
              )}
            </div>
            <p className="mt-3 text-center text-[11px] text-txt-muted">
              Preview tampilan slot 1. Render final tersedia di Fase 2.
            </p>
            {captionFinal.trim() && (
              <div className="mt-3 max-h-32 overflow-y-auto rounded-md bg-surface-container-low p-2 text-xs text-txt-secondary">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-txt-muted">
                  Caption final
                </p>
                <pre className="whitespace-pre-wrap font-sans">{captionFinal}</pre>
              </div>
            )}
          </div>
        </div>

        {/* Right — settings tabs (4 cols) */}
        <div className="lg:col-span-4">
          <div className="overflow-hidden rounded-[12px] border border-border bg-surface shadow-card">
            <div className="flex border-b border-border bg-surface-container-low">
              {(
                [
                  { key: "caption", icon: Hash, label: "Caption" },
                  { key: "music", icon: Music2, label: "Musik" },
                  { key: "overlay", icon: Settings, label: "Overlay" },
                  { key: "publish", icon: Send, label: "Publikasi" },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-semibold transition ${
                      tab === t.key
                        ? "bg-surface text-primary border-b-2 border-primary"
                        : "text-txt-secondary hover:text-txt-primary"
                    }`}
                  >
                    <Icon size={12} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="p-4">
              {tab === "caption" && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-txt-primary">Caption</label>
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={5}
                      maxLength={2200}
                      placeholder="Tulis caption TikTok di sini..."
                      className="input w-full resize-none text-sm"
                    />
                    <p className="mt-1 text-[10px] text-txt-muted">{caption.length}/2200</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-txt-primary">
                      Hashtag (pisah dengan koma atau spasi)
                    </label>
                    <input
                      type="text"
                      value={hashtags}
                      onChange={(e) => setHashtags(e.target.value)}
                      placeholder="hukum, bandung, mk, putusan"
                      className="input w-full text-sm"
                    />
                    <p className="mt-1 text-[10px] text-txt-muted">
                      Tanpa #. Otomatis dinormalkan saat simpan.
                    </p>
                  </div>
                </div>
              )}

              {tab === "music" && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-txt-primary">
                      Backsong (BGM)
                    </label>
                    {bgmUrl ? (
                      <div className="rounded-md border border-border bg-surface-container-low p-3">
                        <audio controls src={bgmUrl} className="w-full" />
                        <button
                          type="button"
                          onClick={() => setBgmUrl(null)}
                          className="mt-2 text-xs text-red-600 hover:underline"
                        >
                          Hapus BGM
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => bgmInputRef.current?.click()}
                        className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-border p-6 text-sm text-txt-secondary hover:border-primary/50"
                      >
                        <Music2 size={16} />
                        Upload audio (MP3 / M4A / WAV, maks 25MB)
                      </button>
                    )}
                    <input
                      ref={bgmInputRef}
                      type="file"
                      accept="audio/mpeg,audio/mp3,audio/mp4,audio/aac,audio/wav,audio/x-m4a"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadBgm(f);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 flex items-center gap-1 text-xs font-medium text-txt-primary">
                      <Volume2 size={12} />
                      Volume BGM ({Math.round(bgmVolume * 100)}%)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={bgmVolume}
                      onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <p className="rounded-md bg-yellow-50 p-2 text-[10px] text-yellow-800">
                    Catatan: BGM hanya akan ter-mix saat render otomatis aktif (Fase 2). Sebelum itu,
                    file BGM tetap tersimpan dan ikut terbawa di paket Export.
                  </p>
                </div>
              )}

              {tab === "overlay" && (
                <div className="space-y-3">
                  <p className="text-[11px] text-txt-secondary">
                    Definisikan overlay teks atau efek per slot dengan JSON. Skema bebas — akan
                    diparse oleh template Hyperframes di Fase 2.
                  </p>
                  <textarea
                    value={overlayJson}
                    onChange={(e) => setOverlayJson(e.target.value)}
                    rows={10}
                    placeholder={`{\n  "intro": {"text": "BREAKING", "color": "#b7102a"},\n  "outro": {"text": "Selengkapnya di kartawarta.com"}\n}`}
                    className="input w-full resize-none font-mono text-[11px]"
                  />
                  <p className="text-[10px] text-txt-muted">
                    Kosongkan jika tidak ada overlay. Harus JSON valid.
                  </p>
                </div>
              )}

              {tab === "publish" && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-txt-primary">
                      Akun TikTok
                    </label>
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className="input w-full text-sm"
                    >
                      <option value="">— Pilih akun —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          @{a.username}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 flex items-center gap-1 text-xs font-medium text-txt-primary">
                      <CalendarClock size={12} />
                      Jadwal Posting (opsional)
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-txt-primary">Aspek</label>
                    <div className="flex gap-2">
                      {(["PORTRAIT_9_16", "SQUARE_1_1"] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setAspectRatio(r)}
                          className={`flex-1 rounded-md border px-2 py-1.5 text-xs ${
                            aspectRatio === r
                              ? "border-primary bg-primary-light text-primary"
                              : "border-border bg-surface-container-low text-txt-secondary"
                          }`}
                        >
                          {r === "PORTRAIT_9_16" ? "9:16" : "1:1"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={tryRender}
                      disabled={saving}
                      className="btn-secondary flex w-full items-center justify-center gap-1.5 text-sm disabled:opacity-50"
                    >
                      <Sparkles size={14} />
                      Render Otomatis (Fase 2)
                    </button>
                    <button
                      type="button"
                      onClick={tryPublish}
                      disabled={saving}
                      className="btn-primary flex w-full items-center justify-center gap-1.5 text-sm disabled:opacity-50"
                    >
                      <Send size={14} />
                      Posting ke TikTok (Fase 3)
                    </button>
                    <p className="rounded-md bg-yellow-50 p-2 text-[10px] text-yellow-800">
                      Kedua tombol di atas akan menampilkan pesan &quot;belum aktif&quot; sampai
                      Fase 2 (render worker) dan Fase 3 (audit TikTok) selesai. Saat ini gunakan
                      tombol <strong>Export</strong> di pojok kanan atas untuk dapat manifest JSON
                      dengan semua media + caption final, lalu post manual.
                    </p>
                  </div>

                  <div className="border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={deleteContent}
                      className="flex w-full items-center justify-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      <Trash2 size={12} />
                      Hapus Konten Permanen
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
