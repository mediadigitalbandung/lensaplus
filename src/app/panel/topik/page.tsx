"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Plus, Edit, Trash2, Layers, X, ExternalLink } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

/* ── Types ──────────────────────────────────────────────────────── */

interface TopicTag {
  id: string;
  name: string;
  slug: string;
}

interface Topic {
  id: string;
  slug: string;
  name: string;
  description: string;
  metaTitle: string | null;
  metaDescription: string | null;
  coverImage: string | null;
  isPublished: boolean;
  tags: TopicTag[];
  createdAt: string;
}

interface FormState {
  slug: string;
  name: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  coverImage: string;
  isPublished: boolean;
  tagSlugsRaw: string; // comma-separated
}

const EMPTY_FORM: FormState = {
  slug: "",
  name: "",
  description: "",
  metaTitle: "",
  metaDescription: "",
  coverImage: "",
  isPublished: true,
  tagSlugsRaw: "",
};

/* ── Helpers ─────────────────────────────────────────────────────── */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ── Modal wrapper ──────────────────────────────────────────────── */

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 py-10">
      <div className="w-[calc(100%-2rem)] max-w-lg rounded-[12px] border border-border bg-surface p-8 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-txt-primary">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-txt-secondary hover:text-txt-primary"
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────── */

export default function PanelTopikPage() {
  const { data: session } = useSession();
  const { confirm } = useConfirm();
  const { success, error: showError } = useToast();

  const userRole = session?.user?.role || "";
  const isAllowed = ["SUPER_ADMIN", "CHIEF_EDITOR"].includes(userRole);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/topics?admin=true");
      const data = await res.json();
      if (data.success) {
        setTopics(data.data);
      }
    } catch {
      showError("Gagal memuat daftar topic");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (topic: Topic) => {
    setEditingId(topic.id);
    setForm({
      slug: topic.slug,
      name: topic.name,
      description: topic.description,
      metaTitle: topic.metaTitle ?? "",
      metaDescription: topic.metaDescription ?? "",
      coverImage: topic.coverImage ?? "",
      isPublished: topic.isPublished,
      tagSlugsRaw: topic.tags.map((t) => t.slug).join(", "),
    });
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleNameChange = (val: string) => {
    setForm((f) => ({
      ...f,
      name: val,
      // Auto-fill slug only when creating (not editing)
      ...(editingId === null && { slug: slugify(val) }),
    }));
  };

  const handleSubmit = async () => {
    setFormError("");
    if (!form.name.trim()) return setFormError("Nama wajib diisi");
    if (!form.slug.trim()) return setFormError("Slug wajib diisi");
    if (!form.description.trim()) return setFormError("Deskripsi wajib diisi");

    const tagSlugs = form.tagSlugsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      slug: form.slug.trim(),
      name: form.name.trim(),
      description: form.description.trim(),
      metaTitle: form.metaTitle.trim() || null,
      metaDescription: form.metaDescription.trim() || null,
      coverImage: form.coverImage.trim() || null,
      isPublished: form.isPublished,
      tagSlugs,
    };

    setSubmitting(true);
    try {
      const url = editingId ? `/api/topics/${editingId}` : "/api/topics";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        setFormError(data.error || "Gagal menyimpan topic");
        return;
      }
      success(editingId ? "Topic berhasil diperbarui" : "Topic berhasil dibuat");
      closeModal();
      fetchTopics();
    } catch {
      setFormError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (topic: Topic) => {
    const ok = await confirm({
      title: "Hapus Topic",
      message: `Hapus topic "${topic.name}"? Aksi ini tidak bisa dibatalkan.`,
      variant: "danger",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/topics/${topic.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) {
        showError(data.error || "Gagal menghapus topic");
        return;
      }
      success("Topic berhasil dihapus");
      fetchTopics();
    } catch {
      showError("Terjadi kesalahan saat menghapus");
    }
  };

  if (!isAllowed) {
    return (
      <div className="container-main py-10 text-center">
        <p className="text-txt-secondary">Hanya Super Admin dan Chief Editor yang dapat mengelola Topic Cluster.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers size={22} className="text-primary" />
            <h1 className="text-xl font-bold text-txt-primary">Topic Cluster</h1>
          </div>
          <p className="mt-1 text-sm text-txt-secondary">
            Kelola topic cluster SEO — kumpulan tag yang membentuk halaman tematik terpadu.
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} />
          Tambah Topic
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-[12px] bg-surface-secondary" />
          ))}
        </div>
      ) : topics.length === 0 ? (
        <div className="rounded-[12px] border-2 border-dashed border-border py-16 text-center">
          <Layers size={36} className="mx-auto mb-3 text-txt-muted" />
          <p className="text-txt-secondary">Belum ada topic cluster.</p>
          <button onClick={openCreate} className="btn-primary mt-4 text-sm">
            Buat Topic Pertama
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-border bg-surface shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-secondary text-left text-xs uppercase tracking-wider text-txt-muted">
              <tr>
                <th className="px-5 py-3">Nama / Slug</th>
                <th className="px-5 py-3">Tags</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {topics.map((topic) => (
                <tr key={topic.id} className="hover:bg-surface-secondary/40">
                  <td className="px-5 py-4">
                    <p className="font-medium text-txt-primary">{topic.name}</p>
                    <p className="text-xs text-txt-muted">/topik/{topic.slug}</p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {topic.tags.slice(0, 3).map((tag) => (
                        <span key={tag.id} className="badge-green text-xs">
                          {tag.name}
                        </span>
                      ))}
                      {topic.tags.length > 3 && (
                        <span className="badge text-xs">+{topic.tags.length - 3}</span>
                      )}
                      {topic.tags.length === 0 && (
                        <span className="text-xs text-txt-muted">Belum ada tag</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={topic.isPublished ? "badge-green" : "badge text-txt-muted"}
                    >
                      {topic.isPublished ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/topik/${topic.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded p-1.5 text-txt-muted hover:text-primary"
                        title="Lihat di publik"
                      >
                        <ExternalLink size={15} />
                      </a>
                      <button
                        onClick={() => openEdit(topic)}
                        className="rounded p-1.5 text-txt-muted hover:text-primary"
                        title="Edit"
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(topic)}
                        className="rounded p-1.5 text-txt-muted hover:text-red-500"
                        title="Hapus"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? "Edit Topic Cluster" : "Tambah Topic Cluster"}
      >
        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-txt-primary">
              Nama Topic *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="input w-full"
              placeholder="contoh: Bank BJB"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-txt-primary">
              Slug *
            </label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) =>
                setForm((f) => ({ ...f, slug: slugify(e.target.value) }))
              }
              className="input w-full font-mono text-sm"
              placeholder="contoh: bank-bjb"
            />
            <p className="mt-1 text-xs text-txt-muted">URL: /topik/{form.slug || "..."}</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-txt-primary">
              Deskripsi Editorial *
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              maxLength={2000}
              className="input w-full text-sm"
              placeholder="Blurb editorial 1-3 kalimat tentang topik ini"
            />
            <p className="mt-1 text-xs text-txt-muted">{form.description.length}/2000</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-txt-primary">
              Tags (slug, pisahkan koma)
            </label>
            <input
              type="text"
              value={form.tagSlugsRaw}
              onChange={(e) => setForm((f) => ({ ...f, tagSlugsRaw: e.target.value }))}
              className="input w-full text-sm"
              placeholder="bank-bjb, bank-jabar-banten, bjb-bandung"
            />
            <p className="mt-1 text-xs text-txt-muted">
              Masukkan slug tag yang sudah ada. Tag harus sudah dibuat terlebih dahulu.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-txt-primary">
              Cover Image URL
            </label>
            <input
              type="url"
              value={form.coverImage}
              onChange={(e) => setForm((f) => ({ ...f, coverImage: e.target.value }))}
              className="input w-full text-sm"
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-txt-primary">
                Meta Title (opsional)
              </label>
              <input
                type="text"
                value={form.metaTitle}
                onChange={(e) => setForm((f) => ({ ...f, metaTitle: e.target.value }))}
                maxLength={70}
                className="input w-full text-sm"
                placeholder="Override SEO title"
              />
              <p className="mt-1 text-xs text-txt-muted">{form.metaTitle.length}/70</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-txt-primary">
                Meta Description (opsional)
              </label>
              <textarea
                value={form.metaDescription}
                onChange={(e) =>
                  setForm((f) => ({ ...f, metaDescription: e.target.value }))
                }
                rows={2}
                maxLength={160}
                className="input w-full text-sm"
                placeholder="Override meta desc"
              />
              <p className="mt-1 text-xs text-txt-muted">{form.metaDescription.length}/160</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPublished"
              checked={form.isPublished}
              onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <label htmlFor="isPublished" className="text-sm text-txt-primary">
              Publikasikan (tampil di halaman publik)
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary flex-1 py-2.5 text-sm"
            >
              {submitting ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Buat Topic"}
            </button>
            <button
              onClick={closeModal}
              disabled={submitting}
              className="btn-ghost px-5 py-2.5 text-sm"
            >
              Batal
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
