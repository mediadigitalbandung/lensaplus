"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Plus,
  Search,
  Music2,
  Video,
  ImageIcon,
  Clock,
  Send,
  AlertCircle,
  Inbox,
  Sparkles,
  Youtube,
  X,
  Loader2,
  Scissors,
  ExternalLink,
} from "lucide-react";

interface SlotPreview {
  id: string;
  kind: "IMAGE" | "VIDEO";
  url: string;
  order: number;
}

interface TiktokContent {
  id: string;
  title: string;
  caption: string | null;
  hashtags: string;
  status: string;
  aspectRatio: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  outputUrl: string | null;
  thumbnailUrl: string | null;
  account: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  slots: SlotPreview[];
  _count: { slots: number };
  updatedAt: string;
  createdAt: string;
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

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-surface-tertiary text-txt-secondary",
  READY: "bg-blue-50 text-blue-600",
  RENDERING: "bg-purple-50 text-purple-600",
  RENDER_FAILED: "bg-red-50 text-red-600",
  SCHEDULED: "bg-yellow-50 text-yellow-700",
  PUBLISHING: "bg-purple-50 text-purple-600",
  PUBLISHED: "bg-primary-light text-primary",
  PUBLISH_FAILED: "bg-red-50 text-red-600",
  ARCHIVED: "bg-surface-tertiary text-txt-muted",
};

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function TiktokListPage() {
  const { data: session } = useSession();
  const [contents, setContents] = useState<TiktokContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [ytOpen, setYtOpen] = useState(false);

  const fetchContents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/tiktok/contents?${params}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Gagal memuat konten");
      }
      const json = await res.json();
      setContents(json.data?.contents || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat konten");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchContents();
  }, [fetchContents]);

  const userRole = session?.user?.role || "";
  const canManage = ["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"].includes(userRole);

  if (!canManage && !loading) {
    return (
      <div className="rounded-[12px] border border-red-200 bg-red-50 p-5 text-red-700">
        Anda tidak memiliki izin untuk mengelola konten TikTok.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl sm:text-3xl font-bold text-txt-primary">
            <Video size={24} className="text-primary" />
            TikTok Konten
          </h1>
          <p className="text-sm text-txt-secondary">
            Otomasi & jadwal konten TikTok — upload media, atur caption, lalu export atau auto-post.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/panel/tiktok/akun" className="btn-secondary text-sm">
            Kelola Akun
          </Link>
          <button
            type="button"
            onClick={() => setYtOpen(true)}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <Youtube size={16} className="text-red-600" />
            Import YouTube
          </button>
          <Link href="/panel/tiktok/baru" className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={16} />
            Buat Konten
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul / caption..."
            className="input pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input max-w-[180px] text-sm"
        >
          <option value="">Semua Status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Phase warning banner */}
      <div className="mb-5 flex items-start gap-3 rounded-[12px] border border-yellow-200 bg-yellow-50 p-4">
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-yellow-700" />
        <div className="text-sm text-yellow-800">
          <p className="font-semibold">Fase 1 — Workflow Manual</p>
          <p className="mt-0.5 text-yellow-700">
            Saat ini konten dapat diatur (slot media, caption, hashtag, BGM). Render otomatis (Hyperframes)
            dan posting langsung ke TikTok belum aktif — gunakan tombol <strong>Export</strong> untuk dapatkan
            paket media + caption final, lalu post manual via TikTok app/CapCut.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button onClick={fetchContents} className="ml-3 font-semibold underline">
            Coba lagi
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-[12px] border border-border bg-surface"
            />
          ))}
        </div>
      ) : contents.length === 0 ? (
        <div className="rounded-[12px] border border-border bg-surface p-10 text-center shadow-card">
          <Inbox size={36} className="mx-auto text-border" />
          <p className="mt-3 text-base text-txt-secondary">Belum ada konten TikTok.</p>
          <Link
            href="/panel/tiktok/baru"
            className="btn-primary mt-4 inline-flex items-center gap-1.5 text-sm"
          >
            <Sparkles size={14} />
            Buat konten pertama
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contents.map((c) => {
            const cover = c.thumbnailUrl || c.slots[0]?.url || null;
            const slotImg = c.slots.filter((s) => s.kind === "IMAGE").length;
            const slotVid = c.slots.filter((s) => s.kind === "VIDEO").length;
            return (
              <Link
                key={c.id}
                href={`/panel/tiktok/${c.id}`}
                className="group flex flex-col overflow-hidden rounded-[12px] border border-border bg-surface shadow-card transition-all hover:shadow-lg"
              >
                <div className="relative aspect-[9/16] max-h-72 bg-surface-secondary">
                  {cover ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={cover}
                      alt={c.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Video size={36} className="text-border" />
                    </div>
                  )}
                  <span
                    className={`absolute right-2 top-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_COLOR[c.status] || STATUS_COLOR.DRAFT}`}
                  >
                    {STATUS_LABEL[c.status] || c.status}
                  </span>
                  {c._count.slots > 1 && (
                    <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {c._count.slots} slot
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <p className="line-clamp-2 text-sm font-semibold text-txt-primary group-hover:text-primary">
                    {c.title}
                  </p>
                  {c.caption && (
                    <p className="mt-1 line-clamp-2 text-xs text-txt-secondary">{c.caption}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-txt-muted">
                    {c.account ? (
                      <span className="font-semibold text-primary">@{c.account.username}</span>
                    ) : (
                      <span className="italic text-txt-muted">akun belum dipilih</span>
                    )}
                    {slotImg > 0 && (
                      <span className="flex items-center gap-1">
                        <ImageIcon size={11} /> {slotImg}
                      </span>
                    )}
                    {slotVid > 0 && (
                      <span className="flex items-center gap-1">
                        <Video size={11} /> {slotVid}
                      </span>
                    )}
                    {c.scheduledAt && (
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {new Date(c.scheduledAt).toLocaleString("id-ID")}
                      </span>
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-3 text-[10px] text-txt-muted">
                    <span>{formatRelative(c.updatedAt)}</span>
                    {c.outputUrl && (
                      <span className="flex items-center gap-1 text-primary">
                        <Send size={10} /> render siap
                      </span>
                    )}
                    {c.hashtags && (
                      <span className="flex items-center gap-1">
                        <Music2 size={10} className="text-txt-muted" />
                        {c.hashtags.split(",").length} tag
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <YoutubeImportModal open={ytOpen} onClose={() => setYtOpen(false)} onDone={fetchContents} />
    </div>
  );
}

interface YtJobStatus {
  status: string;
  stage: string | null;
  progress: number;
  errorMessage?: string | null;
  resultContentIds: string[];
  clipCount?: number;
  contents: Array<{ id: string; title: string; status: string; slots: number }>;
}

const YT_STAGE_LABEL: Record<string, string> = {
  DOWNLOADING: "Mengunduh video",
  TRANSCRIBING: "Transkripsi audio",
  SELECTING: "AI memilih potongan",
  CUTTING: "Memotong klip",
  CREATING_CONTENTS: "Membuat draft konten",
};

function YoutubeImportModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [url, setUrl] = useState("");
  const [clips, setClips] = useState(5);
  const [targetLength, setTargetLength] = useState(30);
  const [reframe, setReframe] = useState(true);
  const [rightsBasis, setRightsBasis] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<YtJobStatus | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/tiktok/youtube/jobs/${jobId}`);
        const j = await res.json();
        if (active && res.ok && j.success) {
          setJob(j.data as YtJobStatus);
          if (j.data.status === "SUCCEEDED" || j.data.status === "FAILED") {
            onDone();
            return true;
          }
        }
      } catch {
        /* keep polling */
      }
      return false;
    };
    const id = setInterval(async () => {
      if (await poll()) clearInterval(id);
    }, 4000);
    poll();
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [jobId, onDone]);

  if (!open) return null;

  const submit = async () => {
    if (!url.trim()) {
      setError("Tempel URL video YouTube dulu.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/tiktok/youtube/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          clips,
          targetLengthSec: targetLength,
          reframe,
          rightsBasis: rightsBasis.trim() || null,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Gagal memulai import");
      setJobId(j.data.jobId);
      setJob({ status: "QUEUED", stage: null, progress: 0, resultContentIds: [], contents: [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memulai import");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setJobId(null);
    setJob(null);
  };
  const close = () => {
    reset();
    setUrl("");
    setError("");
    onClose();
  };

  const running = jobId && job && job.status !== "SUCCEEDED" && job.status !== "FAILED";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="flex items-center gap-2 text-base font-bold text-txt-primary">
            <Youtube size={18} className="text-red-600" />
            Import & Auto-Clip dari YouTube
          </h3>
          <button onClick={close} className="rounded p-1 text-txt-muted hover:bg-surface-secondary">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-[11px] text-yellow-800">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>
              Semua klip dibuat sebagai <strong>DRAFT</strong> untuk ditinjau editor sebelum tayang.
              Pastikan kamu punya hak atas video (konten sendiri / berlisensi / kutipan wajar dengan
              atribusi) — tanggung jawab hak cipta ada di redaksi.
            </span>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>
          )}

          {!jobId && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-txt-primary">URL Video YouTube</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="input w-full text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-txt-primary">Jumlah klip</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={clips}
                    onChange={(e) => setClips(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                    className="input w-full text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-txt-primary">Panjang/klip (detik)</label>
                  <input
                    type="number"
                    min={5}
                    max={60}
                    value={targetLength}
                    onChange={(e) => setTargetLength(Math.max(5, Math.min(60, parseInt(e.target.value) || 30)))}
                    className="input w-full text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-txt-primary">
                <input type="checkbox" checked={reframe} onChange={(e) => setReframe(e.target.checked)} />
                Reframe ke vertikal 9:16 (disarankan untuk TikTok)
              </label>
              <div>
                <label className="mb-1 block text-xs font-medium text-txt-primary">Dasar hak (opsional, untuk audit)</label>
                <input
                  type="text"
                  value={rightsBasis}
                  onChange={(e) => setRightsBasis(e.target.value)}
                  placeholder="mis. channel sendiri / lisensi Antara / kutipan wajar"
                  className="input w-full text-sm"
                />
              </div>
            </>
          )}

          {jobId && job && (
            <div className="space-y-3">
              {running && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-txt-primary">
                    <Loader2 size={14} className="animate-spin text-primary" />
                    {job.stage ? YT_STAGE_LABEL[job.stage] || job.stage : "Menunggu antrean…"}
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded bg-surface-secondary">
                    <div className="h-full bg-primary transition-all" style={{ width: `${job.progress}%` }} />
                  </div>
                  <p className="text-[11px] text-txt-muted">
                    Proses berjalan di server (unduh + transkripsi + AI + potong). Boleh ditutup — hasil
                    muncul di daftar konten saat selesai.
                  </p>
                </div>
              )}

              {job.status === "SUCCEEDED" && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                    <Scissors size={14} /> {job.contents.length} klip DRAFT dibuat
                  </p>
                  <ul className="space-y-1">
                    {job.contents.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/panel/tiktok/${c.id}`}
                          className="flex items-center justify-between rounded-md border border-border bg-surface-container-low px-3 py-2 text-xs hover:border-primary/40"
                        >
                          <span className="truncate text-txt-primary">{c.title}</span>
                          <span className="ml-2 flex shrink-0 items-center gap-1 text-primary">
                            Buka <ExternalLink size={11} />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {job.status === "FAILED" && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  Gagal: {job.errorMessage || "kesalahan tidak diketahui"}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-4">
          {!jobId && (
            <>
              <button onClick={close} className="btn-ghost text-sm" disabled={submitting}>
                Batal
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Scissors size={14} />}
                Mulai Auto-Clip
              </button>
            </>
          )}
          {jobId && job?.status === "SUCCEEDED" && (
            <>
              <button onClick={reset} className="btn-secondary text-sm">
                Import lagi
              </button>
              <button onClick={close} className="btn-primary text-sm">
                Selesai
              </button>
            </>
          )}
          {jobId && job?.status === "FAILED" && (
            <button onClick={reset} className="btn-primary text-sm">
              Coba lagi
            </button>
          )}
          {running && (
            <button onClick={close} className="btn-secondary text-sm">
              Tutup (lanjut di background)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
