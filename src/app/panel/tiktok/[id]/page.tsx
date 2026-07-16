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
  Scissors,
  Play,
  Pause,
  X,
  Check,
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

  // Clipper Modal states
  const [isClipperOpen, setIsClipperOpen] = useState(false);
  const [selectedSlotForEdit, setSelectedSlotForEdit] = useState<Slot | null>(null);

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
            <span className="rounded-lg bg-surface-tertiary px-2 py-0.5 font-medium text-txt-secondary">
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
          <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-txt-primary">
                <Layers size={14} className="text-primary" />
                Slot Media
              </h2>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSlotForEdit(null);
                    setIsClipperOpen(true);
                  }}
                  className="flex items-center gap-1 rounded-md bg-surface-tertiary border border-border px-2.5 py-1.5 text-xs font-semibold text-txt-primary hover:bg-surface-secondary"
                  title="Potong Video Master menjadi Clip"
                >
                  <Scissors size={12} className="text-primary" />
                  Clipper
                </button>
                <button
                  type="button"
                  onClick={() => slotInputRef.current?.click()}
                  className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark"
                >
                  <Plus size={12} />
                  Tambah
                </button>
              </div>
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
                Belum ada slot. Klik <strong>Tambah</strong> untuk upload foto atau video, atau gunakan <strong>Clipper</strong>.
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
                      <p className="text-[10px] text-txt-muted flex flex-wrap items-center gap-1.5">
                        <span>{humanSize(s.size)}</span>
                        {s.kind === "VIDEO" && (s.trimStartMs > 0 || s.trimEndMs !== null) && (
                          <span className="inline-flex items-center rounded-lg bg-primary-light px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                            Trim: {(s.trimStartMs / 1000).toFixed(1)}s - {s.trimEndMs !== null ? `${(s.trimEndMs / 1000).toFixed(1)}s` : "end"}
                          </span>
                        )}
                      </p>
                      {s.caption && (
                        <p className="text-[10px] text-txt-secondary italic mt-0.5 truncate" title={s.caption}>
                          &quot;{s.caption}&quot;
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-1.5">
                        <label className="text-[10px] text-txt-muted">Durasi</label>
                        <input
                          // Uncontrolled (defaultValue + onBlur) to avoid re-render
                          // jitter while typing. `key` forces a remount when the
                          // server value changes (e.g. after Clipper edit) so the
                          // displayed default refreshes.
                          key={`dur-${s.id}-${s.durationMs}`}
                          type="number"
                          step={500}
                          min={500}
                          max={30000}
                          defaultValue={s.durationMs}
                          onBlur={(e) => {
                            const raw = parseInt(e.target.value, 10);
                            if (Number.isNaN(raw)) {
                              e.target.value = String(s.durationMs); // restore invalid input
                              return;
                            }
                            const ms = Math.min(30000, Math.max(500, raw));
                            if (ms !== s.durationMs) updateSlotDuration(s.id, ms);
                            else e.target.value = String(ms); // reflect clamped value
                          }}
                          className="w-16 rounded-lg border border-border bg-surface px-1.5 py-0.5 text-[10px]"
                        />
                        <span className="text-[10px] text-txt-muted">ms</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveSlot(s.id, -1)}
                        disabled={idx === 0}
                        className="rounded-lg p-1 text-txt-secondary hover:bg-surface-container disabled:opacity-30"
                        title="Naik"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        onClick={() => moveSlot(s.id, 1)}
                        disabled={idx === content.slots.length - 1}
                        className="rounded-lg p-1 text-txt-secondary hover:bg-surface-container disabled:opacity-30"
                        title="Turun"
                      >
                        <ChevronDown size={12} />
                      </button>
                      {s.kind === "VIDEO" && (
                        <button
                          onClick={() => {
                            setSelectedSlotForEdit(s);
                            setIsClipperOpen(true);
                          }}
                          className="rounded-lg p-1 text-blue-600 hover:bg-blue-50"
                          title="Edit Trim Video"
                        >
                          <Scissors size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => removeSlot(s.id)}
                        className="rounded-lg p-1 text-red-500 hover:bg-red-50"
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
          <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
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
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
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
                    placeholder={`{\n  "intro": {"text": "BREAKING", "color": "#b7102a"},\n  "outro": {"text": "Selengkapnya di lensaplus.com"}\n}`}
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

      <VideoClipperModal
        isOpen={isClipperOpen}
        onClose={() => {
          setIsClipperOpen(false);
          setSelectedSlotForEdit(null);
        }}
        contentId={id}
        onSuccess={fetchContent}
        editingSlot={selectedSlotForEdit}
      />
    </div>
  );
}

interface VideoClipperModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentId: string;
  onSuccess: () => Promise<void>;
  editingSlot: Slot | null;
}

function VideoClipperModal({ isOpen, onClose, contentId, onSuccess, editingSlot }: VideoClipperModalProps) {
  const [videoFile, setVideoFile] = useState<{
    url: string;
    filename: string;
    mimeType: string;
    size: number;
  } | null>(null);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [trimStart, setTrimStart] = useState(0); // in seconds
  const [trimEnd, setTrimEnd] = useState(10); // in seconds
  const [videoDuration, setVideoDuration] = useState(0); // in seconds
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [caption, setCaption] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewTimerRef = useRef<number | null>(null);

  // Pre-load if editing
  useEffect(() => {
    if (editingSlot && isOpen) {
      setVideoFile({
        url: editingSlot.url,
        filename: editingSlot.filename || "video.mp4",
        mimeType: editingSlot.mimeType || "video/mp4",
        size: editingSlot.size || 0,
      });
      setTrimStart(editingSlot.trimStartMs / 1000);
      setTrimEnd(editingSlot.trimEndMs !== null ? editingSlot.trimEndMs / 1000 : editingSlot.durationMs / 1000);
      setCaption(editingSlot.caption || "");
      setError("");
      setSuccessMsg("");
    } else if (isOpen) {
      // resetting
      setVideoFile(null);
      setTrimStart(0);
      setTrimEnd(10);
      setVideoDuration(0);
      setCurrentTime(0);
      setIsPlaying(false);
      setPreviewing(false);
      setCaption("");
      setError("");
      setSuccessMsg("");
    }
  }, [editingSlot, isOpen]);

  // Cleanup timers on unmount or close
  useEffect(() => {
    return () => {
      if (previewTimerRef.current) {
        window.clearInterval(previewTimerRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError("");
    setSuccessMsg("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("target", "slot");
      const res = await fetch("/api/tiktok/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Upload gagal");

      setVideoFile({
        url: json.data.url,
        filename: json.data.filename,
        mimeType: json.data.mimeType,
        size: json.data.size,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunggah video");
    } finally {
      setUploading(false);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration || 0;
      setVideoDuration(dur);
      // only set trimEnd to full duration if we are NOT editing
      if (!editingSlot) {
        setTrimEnd(Math.min(dur, 10)); // default to 10s or full duration
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        if (videoRef.current.currentTime >= trimEnd || videoRef.current.currentTime < trimStart) {
          videoRef.current.currentTime = trimStart;
        }
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const startPreview = () => {
    if (videoRef.current) {
      if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);

      videoRef.current.currentTime = trimStart;
      videoRef.current.play();
      setIsPlaying(true);
      setPreviewing(true);

      const interval = window.setInterval(() => {
        if (videoRef.current) {
          if (videoRef.current.currentTime >= trimEnd) {
            videoRef.current.pause();
            setIsPlaying(false);
            setPreviewing(false);
            window.clearInterval(interval);
          }
        }
      }, 50);
      previewTimerRef.current = interval;
    }
  };

  const handleSaveClip = async () => {
    if (!videoFile) return;
    if (trimStart < 0 || trimEnd <= trimStart) {
      setError("Rentang waktu tidak valid");
      return;
    }
    const durationMs = Math.round((trimEnd - trimStart) * 1000);
    if (durationMs > 30000) {
      setError("Durasi clip tidak boleh lebih dari 30 detik");
      return;
    }
    if (durationMs < 500) {
      setError("Durasi clip minimal 0.5 detik");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMsg("");

    try {
      if (editingSlot) {
        const res = await fetch(`/api/tiktok/contents/${contentId}/slots/${editingSlot.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            durationMs,
            trimStartMs: Math.round(trimStart * 1000),
            trimEndMs: Math.round(trimEnd * 1000),
            caption: caption || null,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Gagal memperbarui clip");

        setSuccessMsg("Clip berhasil diperbarui");
        await onSuccess();
        setTimeout(onClose, 1500);
      } else {
        const res = await fetch(`/api/tiktok/contents/${contentId}/slots`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "VIDEO",
            url: videoFile.url,
            filename: videoFile.filename,
            mimeType: videoFile.mimeType,
            size: videoFile.size,
            durationMs,
            trimStartMs: Math.round(trimStart * 1000),
            trimEndMs: Math.round(trimEnd * 1000),
            caption: caption || null,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Gagal membuat clip");

        setSuccessMsg(`Clip berhasil ditambahkan sebagai Slot!`);
        await onSuccess();
        setCaption("");
        setTrimStart(Math.min(trimEnd, videoDuration));
        setTrimEnd(Math.min(trimEnd + 10, videoDuration));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memproses clip");
    } finally {
      setSaving(false);
    }
  };

  const clipDuration = Math.max(0, trimEnd - trimStart);
  const isDurationValid = clipDuration >= 0.5 && clipDuration <= 30;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-surface p-6 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-lg font-bold text-txt-primary flex items-center gap-2">
            <Scissors size={18} className="text-primary" />
            {editingSlot ? "Edit Trim Slot" : "Clipper Video TikTok"}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-txt-muted hover:bg-surface-secondary">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              <Check size={14} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {!videoFile ? (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-12 bg-surface-container-low">
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-primary" size={32} />
                  <p className="text-sm font-medium text-txt-secondary">Mengunggah video master...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center space-y-4">
                  <VideoIcon size={48} className="text-txt-muted" />
                  <div>
                    <p className="text-sm font-semibold text-txt-primary">Pilih Video Master untuk Dipotong</p>
                    <p className="text-xs text-txt-muted mt-1">Mendukung MP4, MOV, WebM (Maks 100MB)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-primary text-sm px-4 py-2"
                  >
                    Unggah Video
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Interactive Player */}
              <div className="relative overflow-hidden rounded-md border border-border bg-black">
                <video
                  ref={videoRef}
                  src={videoFile.url}
                  className="mx-auto max-h-[260px] w-full object-contain"
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onClick={togglePlay}
                />
                
                {/* Visual playback time overlay */}
                <div className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
                  {currentTime.toFixed(1)}s / {videoDuration.toFixed(1)}s
                </div>
              </div>

              {/* Player Timeline Click-to-Seek / Progress bar */}
              <div className="space-y-1">
                <div 
                  className="h-2 w-full bg-surface-secondary rounded-lg cursor-pointer relative overflow-hidden"
                  onClick={(e) => {
                    if (videoRef.current && videoDuration) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      const percent = clickX / rect.width;
                      const seekTime = percent * videoDuration;
                      videoRef.current.currentTime = seekTime;
                    }
                  }}
                >
                  {videoDuration > 0 && (
                    <div 
                      className="absolute top-0 bottom-0 bg-primary/20 border-l border-r border-primary/40"
                      style={{
                        left: `${(trimStart / videoDuration) * 100}%`,
                        width: `${((trimEnd - trimStart) / videoDuration) * 100}%`
                      }}
                    />
                  )}
                  {videoDuration > 0 && (
                    <div 
                      className="absolute top-0 bottom-0 bg-primary w-0.5"
                      style={{ left: `${(currentTime / videoDuration) * 100}%` }}
                    />
                  )}
                </div>
                <div className="flex justify-between text-[10px] text-txt-muted">
                  <span>0.0s</span>
                  <span>{videoDuration.toFixed(1)}s</span>
                </div>
              </div>

              {/* Controls Bar */}
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="flex items-center gap-1 rounded-lg bg-surface-secondary px-3 py-1.5 text-xs font-semibold hover:bg-surface-tertiary"
                  >
                    {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                    {isPlaying ? "Pause" : "Play"}
                  </button>
                  <button
                    type="button"
                    onClick={startPreview}
                    disabled={previewing}
                    className="flex items-center gap-1 rounded-lg bg-blue-50 text-blue-700 px-3 py-1.5 text-xs font-semibold hover:bg-blue-100 disabled:opacity-50"
                  >
                    <Play size={12} className="text-blue-700" />
                    Preview Clip
                  </button>
                </div>

                <div className="text-right">
                  <p className="text-xs text-txt-muted">Video Master: {videoFile.filename}</p>
                </div>
              </div>

              {/* Trim Bounds Panel */}
              <div className="grid grid-cols-2 gap-4 bg-surface-container-low p-3 rounded-md border border-border">
                {/* Trim Start */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-txt-primary">Mulai Trim (Start)</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      max={trimEnd}
                      value={parseFloat(trimStart.toFixed(1))}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(parseFloat(e.target.value) || 0, trimEnd));
                        setTrimStart(val);
                        if (videoRef.current) videoRef.current.currentTime = val;
                      }}
                      className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (videoRef.current) {
                          const val = Math.min(videoRef.current.currentTime, trimEnd);
                          setTrimStart(val);
                        }
                      }}
                      className="shrink-0 bg-primary text-white rounded-lg px-2 text-[10px] font-semibold hover:bg-primary-dark"
                    >
                      Set Mulai
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const val = Math.max(0, trimStart - 1);
                        setTrimStart(val);
                        if (videoRef.current) videoRef.current.currentTime = val;
                      }}
                      className="flex-1 bg-surface border border-border hover:bg-surface-secondary text-[10px] py-0.5 rounded-lg"
                    >
                      -1s
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const val = Math.min(trimStart + 1, trimEnd);
                        setTrimStart(val);
                        if (videoRef.current) videoRef.current.currentTime = val;
                      }}
                      className="flex-1 bg-surface border border-border hover:bg-surface-secondary text-[10px] py-0.5 rounded-lg"
                    >
                      +1s
                    </button>
                  </div>
                </div>

                {/* Trim End */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-txt-primary">Selesai Trim (End)</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      step={0.1}
                      min={trimStart}
                      max={videoDuration}
                      value={parseFloat(trimEnd.toFixed(1))}
                      onChange={(e) => {
                        const val = Math.max(trimStart, Math.min(parseFloat(e.target.value) || 0, videoDuration));
                        setTrimEnd(val);
                        if (videoRef.current) videoRef.current.currentTime = val;
                      }}
                      className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (videoRef.current) {
                          const val = Math.max(videoRef.current.currentTime, trimStart);
                          setTrimEnd(val);
                        }
                      }}
                      className="shrink-0 bg-primary text-white rounded-lg px-2 text-[10px] font-semibold hover:bg-primary-dark"
                    >
                      Set Selesai
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const val = Math.max(trimStart, trimEnd - 1);
                        setTrimEnd(val);
                        if (videoRef.current) videoRef.current.currentTime = val;
                      }}
                      className="flex-1 bg-surface border border-border hover:bg-surface-secondary text-[10px] py-0.5 rounded-lg"
                    >
                      -1s
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const val = Math.min(trimEnd + 1, videoDuration);
                        setTrimEnd(val);
                        if (videoRef.current) videoRef.current.currentTime = val;
                      }}
                      className="flex-1 bg-surface border border-border hover:bg-surface-secondary text-[10px] py-0.5 rounded-lg"
                    >
                      +1s
                    </button>
                  </div>
                </div>
              </div>

              {/* Clip Stats Summary */}
              <div className="flex items-center justify-between p-2.5 rounded-md border border-border bg-surface-container">
                <span className="text-xs text-txt-secondary font-medium">Durasi Clip:</span>
                <span className={`text-sm font-bold ${isDurationValid ? "text-green-600" : "text-red-600"}`}>
                  {clipDuration.toFixed(1)} detik
                  {clipDuration > 30 && " (Maksimal 30 detik!)"}
                  {clipDuration < 0.5 && " (Minimal 0.5 detik!)"}
                </span>
              </div>

              {/* Clip Caption Input */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-txt-primary">Teks / Keterangan Clip (Opsional)</label>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Keterangan untuk clip slot ini..."
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                />
              </div>

              {/* Reset Action */}
              {!editingSlot && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setVideoFile(null)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Ganti Video Master
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-border pt-4 flex justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-txt-secondary hover:bg-surface-secondary"
          >
            {editingSlot ? "Batal" : "Selesai"}
          </button>
          
          {videoFile && (
            <button
              type="button"
              onClick={handleSaveClip}
              disabled={saving || !isDurationValid}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              {editingSlot ? "Simpan Perubahan" : "Buat Clip & Tambah ke Slot"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
