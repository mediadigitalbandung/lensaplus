"use client";

/**
 * Panel Live Blog — create new live blog
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Radio, Save, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 150);
}

function toLocalInput(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewLiveBlogPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { success: showSuccess, error: showError } = useToast();

  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    category: "",
    status: "SCHEDULED" as "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED",
    scheduledAt: toLocalInput(),
    coverImage: "",
    liveStreamUrl: "",
    isPublished: true,
    syndicateToSocial: false,
  });
  const [saving, setSaving] = useState(false);
  const [slugManual, setSlugManual] = useState(false);

  if (!session) return null;

  const handleTitleChange = (value: string) => {
    setForm((f) => ({
      ...f,
      title: value,
      slug: slugManual ? f.slug : slugify(value),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        description: form.description || null,
        category: form.category || null,
        coverImage: form.coverImage || null,
        liveStreamUrl: form.liveStreamUrl.trim() || null,
      };

      const res = await fetch("/api/panel/live-blogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        showError(json.error || "Gagal membuat live blog");
        return;
      }

      showSuccess("Live blog berhasil dibuat");
      router.push(`/panel/live-blogs/${json.data.id}`);
    } catch {
      showError("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/panel/live-blogs" className="text-txt-muted hover:text-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <Radio size={20} className="text-secondary" />
          <h1 className="text-xl font-bold text-on-surface">Buat Live Blog</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-label-md font-medium text-on-surface mb-1">
            Judul <span className="text-secondary">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            required
            className="input w-full"
            placeholder="Sidang Terdakwa X di PN Bandung"
          />
        </div>

        {/* Slug */}
        <div>
          <label className="block text-label-md font-medium text-on-surface mb-1">
            Slug <span className="text-secondary">*</span>
          </label>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => {
              setSlugManual(true);
              setForm((f) => ({ ...f, slug: e.target.value }));
            }}
            required
            pattern="[a-z0-9-]+"
            className="input w-full font-mono text-sm"
            placeholder="sidang-terdakwa-x-pn-bandung"
          />
          <p className="mt-1 text-label-sm text-txt-muted">
            URL: /live/{form.slug || "..."}
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-label-md font-medium text-on-surface mb-1">
            Deskripsi
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="input w-full resize-none"
            placeholder="Keterangan singkat tentang peristiwa yang diliput..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Category */}
          <div>
            <label className="block text-label-md font-medium text-on-surface mb-1">
              Kategori
            </label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="input w-full"
              placeholder="Sidang, Demo, Konferensi..."
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-label-md font-medium text-on-surface mb-1">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  status: e.target.value as typeof form.status,
                }))
              }
              className="input w-full"
            >
              <option value="SCHEDULED">Terjadwal</option>
              <option value="LIVE">Live Sekarang</option>
              <option value="ENDED">Selesai</option>
              <option value="CANCELLED">Dibatalkan</option>
            </select>
          </div>
        </div>

        {/* Scheduled At */}
        <div>
          <label className="block text-label-md font-medium text-on-surface mb-1">
            Jadwal / Waktu Mulai <span className="text-secondary">*</span>
          </label>
          <input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
            required
            className="input w-full"
          />
        </div>

        {/* Cover Image */}
        <div>
          <label className="block text-label-md font-medium text-on-surface mb-1">
            URL Gambar Cover
          </label>
          <input
            type="url"
            value={form.coverImage}
            onChange={(e) => setForm((f) => ({ ...f, coverImage: e.target.value }))}
            className="input w-full"
            placeholder="https://..."
          />
        </div>

        {/* Live video embed */}
        <div>
          <label className="block text-label-md font-medium text-on-surface mb-1">
            Video Live / Embed <span className="font-normal text-txt-muted">(opsional)</span>
          </label>
          <input
            type="url"
            value={form.liveStreamUrl}
            onChange={(e) => setForm((f) => ({ ...f, liveStreamUrl: e.target.value }))}
            className="input w-full"
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <p className="mt-1 text-label-sm text-txt-muted">
            Tempel link YouTube Live untuk menampilkan player video di atas timeline.
            Mulai siaran di YouTube (HP/OBS), lalu salin link-nya ke sini. Bisa juga
            ditambahkan nanti saat sudah LIVE.
          </p>
        </div>

        {/* Published */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isPublished}
            onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
            className="h-4 w-4 rounded-lg border-border text-primary focus:ring-primary"
          />
          <span className="text-body-sm text-on-surface">Tampilkan ke publik</span>
        </label>

        {/* Syndicate to social */}
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.syndicateToSocial}
            onChange={(e) => setForm((f) => ({ ...f, syndicateToSocial: e.target.checked }))}
            className="h-4 w-4 rounded-lg border-border text-primary focus:ring-primary mt-0.5"
          />
          <span className="text-body-sm text-on-surface">
            Sebar update ke sosmed
            <span className="block text-label-sm text-txt-muted">
              Tiap update otomatis dikirim ke Telegram/Threads saat status LIVE.{" "}
              <Link href="/panel/live-blogs/pengaturan" className="text-primary hover:underline">
                Atur kanal
              </Link>
            </span>
          </span>
        </label>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Buat Live Blog
          </button>
          <Link href="/panel/live-blogs" className="btn-ghost text-sm">
            Batal
          </Link>
        </div>
      </form>
    </div>
  );
}
