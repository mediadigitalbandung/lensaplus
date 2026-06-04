"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { Plus, Edit, Trash2, Tag, FolderOpen, X } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmDialog";

/* ── Types ─────────────────────────────────────────────────────────── */

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order: number;
  _count: { articles: number };
}

interface TagItem {
  id: string;
  name: string;
  slug: string;
  _count: { articles: number };
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ── Loading skeleton ──────────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-[12px] border border-border bg-surface shadow-card">
      <div className="border-b border-border bg-surface-secondary px-5 py-3">
        <div className="h-4 w-full rounded bg-surface-tertiary" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border px-5 py-3">
          <div className="flex-1">
            <div className="h-4 w-1/3 rounded bg-surface-tertiary" />
          </div>
          <div className="h-4 w-20 rounded bg-surface-tertiary" />
          <div className="h-4 w-16 rounded bg-surface-tertiary" />
        </div>
      ))}
    </div>
  );
}

/* ── Modal wrapper ─────────────────────────────────────────────────── */

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[calc(100%-2rem)] max-w-lg mx-auto rounded-[12px] border border-border bg-surface p-8 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-txt-primary">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-txt-secondary hover:text-txt-primary" aria-label="Tutup">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────────── */

export default function KategoriPage() {
  const { data: session } = useSession();
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = useState<"kategori" | "tag">("kategori");

  // ── Category state ──
  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState<string | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catSubmitting, setCatSubmitting] = useState(false);
  const [catDeleting, setCatDeleting] = useState<string | null>(null);
  const [catForm, setCatForm] = useState({ name: "", slug: "", description: "", order: 0 });
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // ── Tag state ──
  const [tags, setTags] = useState<TagItem[]>([]);
  const [tagLoading, setTagLoading] = useState(true);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [tagSubmitting, setTagSubmitting] = useState(false);
  const [tagDeleting, setTagDeleting] = useState<string | null>(null);
  const [tagForm, setTagForm] = useState({ name: "", slug: "" });

  const isAllowed =
    session?.user?.role === "SUPER_ADMIN" ||
    session?.user?.role === "CHIEF_EDITOR" ||
    session?.user?.role === "EDITOR";

  /* ── Fetch categories ── */
  const fetchCategories = useCallback(async () => {
    setCatLoading(true);
    setCatError(null);
    try {
      const res = await fetch("/api/categories");
      const json = await res.json();
      if (json.success) setCategories(json.data);
      else setCatError(json.error || "Gagal memuat kategori");
    } catch {
      setCatError("Gagal terhubung ke server");
    } finally {
      setCatLoading(false);
    }
  }, []);

  /* ── Fetch tags ── */
  const fetchTags = useCallback(async () => {
    setTagLoading(true);
    try {
      const res = await fetch("/api/tags");
      const json = await res.json();
      if (json.success) setTags(json.data);
    } catch {
      /* ignore */
    } finally {
      setTagLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchTags();
  }, [fetchCategories, fetchTags]);

  /* ── Show feedback ── */
  function showFeedback(type: "success" | "error", message: string) {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  }

  /* ── Category CRUD ── */
  function openCatModal(cat?: Category) {
    if (cat) {
      setEditingCat(cat);
      setCatForm({ name: cat.name, slug: cat.slug, description: cat.description || "", order: cat.order });
    } else {
      setEditingCat(null);
      setCatForm({ name: "", slug: "", description: "", order: 0 });
    }
    setCatModalOpen(true);
  }

  async function handleCatSubmit(e: FormEvent) {
    e.preventDefault();
    if (!catForm.name.trim()) return;
    setCatSubmitting(true);
    try {
      const slug = catForm.slug.trim() || slugify(catForm.name);
      if (editingCat) {
        const res = await fetch(`/api/categories/${editingCat.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: catForm.name.trim(), slug, description: catForm.description.trim() || null, order: catForm.order }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        showFeedback("success", "Kategori berhasil diperbarui");
      } else {
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: catForm.name.trim(), slug, description: catForm.description.trim() || undefined, order: catForm.order }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        showFeedback("success", "Kategori berhasil ditambahkan");
      }
      setCatModalOpen(false);
      fetchCategories();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
      showFeedback("error", msg);
    } finally {
      setCatSubmitting(false);
    }
  }

  async function handleCatDelete(cat: Category) {
    const ok = await confirm({ message: `Hapus kategori "${cat.name}"? Tindakan ini tidak bisa dibatalkan.`, variant: "danger", title: "Konfirmasi" });
    if (!ok) return;
    setCatDeleting(cat.id);
    try {
      const res = await fetch(`/api/categories/${cat.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      showFeedback("success", "Kategori berhasil dihapus");
      fetchCategories();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus kategori";
      showFeedback("error", msg);
    } finally {
      setCatDeleting(null);
    }
  }

  /* ── Tag CRUD ── */
  function openTagModal(tag?: TagItem) {
    if (tag) {
      setEditingTag(tag);
      setTagForm({ name: tag.name, slug: tag.slug });
    } else {
      setEditingTag(null);
      setTagForm({ name: "", slug: "" });
    }
    setTagModalOpen(true);
  }

  async function handleTagSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tagForm.name.trim()) return;
    setTagSubmitting(true);
    try {
      const slug = tagForm.slug.trim() || slugify(tagForm.name);
      if (editingTag) {
        // Tags API doesn't have PUT by id, so delete + recreate
        const delRes = await fetch(`/api/tags?id=${editingTag.id}`, { method: "DELETE" });
        if (!delRes.ok) throw new Error("Gagal menghapus tag lama");
        try {
          const res = await fetch("/api/tags", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: tagForm.name.trim(), slug }),
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.error);
        } catch {
          throw new Error("Gagal memperbarui tag. Tag mungkin terhapus, silakan buat ulang.");
        }
        showFeedback("success", "Tag berhasil diperbarui");
      } else {
        const res = await fetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: tagForm.name.trim(), slug }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        showFeedback("success", "Tag berhasil ditambahkan");
      }
      setTagModalOpen(false);
      fetchTags();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
      showFeedback("error", msg);
    } finally {
      setTagSubmitting(false);
    }
  }

  async function handleTagDelete(tag: TagItem) {
    const ok = await confirm({ message: `Hapus tag "${tag.name}"?`, variant: "danger", title: "Konfirmasi" });
    if (!ok) return;
    setTagDeleting(tag.id);
    try {
      const res = await fetch(`/api/tags?id=${tag.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      showFeedback("success", "Tag berhasil dihapus");
      fetchTags();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus tag";
      showFeedback("error", msg);
    } finally {
      setTagDeleting(null);
    }
  }

  /* ── Guard ── */
  if (!isAllowed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-txt-secondary">Anda tidak memiliki akses ke halaman ini.</p>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="space-y-6">
      {/* Feedback toast */}
      {feedback && (
        <div
          className={`fixed right-4 top-4 z-[60] rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            feedback.type === "success"
              ? "bg-primary text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">Kelola Kategori &amp; Tag</h1>
          <p className="mt-1 text-base text-txt-secondary">Atur kategori dan tag untuk artikel</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-surface-secondary p-1">
        <button
          onClick={() => setActiveTab("kategori")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "kategori"
              ? "bg-surface text-primary shadow-sm"
              : "text-txt-secondary hover:text-txt-primary"
          }`}
        >
          <FolderOpen size={16} />
          Kategori
        </button>
        <button
          onClick={() => setActiveTab("tag")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "tag"
              ? "bg-surface text-primary shadow-sm"
              : "text-txt-secondary hover:text-txt-primary"
          }`}
        >
          <Tag size={16} />
          Tag
        </button>
      </div>

      {/* ────────── KATEGORI TAB ────────── */}
      {activeTab === "kategori" && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => openCatModal()}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} />
              Tambah Kategori
            </button>
          </div>

          {catLoading ? (
            <LoadingSkeleton />
          ) : catError ? (
            <div className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              {catError}
            </div>
          ) : categories.length === 0 ? (
            <div className="rounded-[12px] border border-border bg-surface p-4 sm:p-8 text-center text-txt-secondary">
              Belum ada kategori. Klik &quot;Tambah Kategori&quot; untuk memulai.
            </div>
          ) : (
            <div className="overflow-hidden rounded-[12px] border border-border bg-surface shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-secondary text-left">
                      <th className="px-5 py-3.5 text-sm font-medium text-txt-secondary">Nama</th>
                      <th className="px-5 py-3.5 text-sm font-medium text-txt-secondary">Slug</th>
                      <th className="hidden px-5 py-3.5 text-sm font-medium text-txt-secondary md:table-cell">Deskripsi</th>
                      <th className="px-5 py-3.5 text-sm font-medium text-txt-secondary text-center">Urutan</th>
                      <th className="px-5 py-3.5 text-sm font-medium text-txt-secondary text-center">Artikel</th>
                      <th className="px-5 py-3.5 text-sm font-medium text-txt-secondary text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr key={cat.id} className="border-b border-border last:border-0 hover:bg-surface-secondary/50 transition-colors">
                        <td className="px-5 py-4 text-sm font-medium text-txt-primary">{cat.name}</td>
                        <td className="px-5 py-4 text-sm text-txt-secondary">{cat.slug}</td>
                        <td className="hidden px-5 py-4 text-sm text-txt-secondary md:table-cell">
                          {cat.description ? (cat.description.length > 40 ? cat.description.slice(0, 40) + "..." : cat.description) : "-"}
                        </td>
                        <td className="px-5 py-4 text-center text-sm text-txt-secondary">{cat.order}</td>
                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-0.5 text-sm font-medium text-primary">
                            {cat._count.articles}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openCatModal(cat)}
                              className="rounded-lg p-2 text-txt-secondary hover:bg-surface-secondary hover:text-primary transition-colors"
                              title="Edit"
                              aria-label="Edit kategori"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleCatDelete(cat)}
                              disabled={catDeleting === cat.id}
                              className="rounded-lg p-2 text-txt-secondary hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                              title="Hapus"
                              aria-label="Hapus kategori"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Category modal */}
          <Modal
            open={catModalOpen}
            onClose={() => setCatModalOpen(false)}
            title={editingCat ? "Edit Kategori" : "Tambah Kategori"}
          >
            <form onSubmit={handleCatSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-base font-medium text-txt-primary">Nama</label>
                <input
                  type="text"
                  value={catForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCatForm((f) => ({ ...f, name, slug: slugify(name) }));
                  }}
                  className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2.5 text-base text-txt-primary placeholder:text-txt-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Nama kategori"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-base font-medium text-txt-primary">Slug</label>
                <input
                  type="text"
                  value={catForm.slug}
                  onChange={(e) => setCatForm((f) => ({ ...f, slug: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2.5 text-base text-txt-primary placeholder:text-txt-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="slug-kategori"
                />
              </div>
              <div>
                <label className="mb-1 block text-base font-medium text-txt-primary">Deskripsi</label>
                <textarea
                  value={catForm.description}
                  onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2.5 text-base text-txt-primary placeholder:text-txt-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Deskripsi singkat (opsional)"
                />
              </div>
              <div>
                <label className="mb-1 block text-base font-medium text-txt-primary">Urutan</label>
                <input
                  type="number"
                  min={0}
                  value={catForm.order}
                  onChange={(e) => setCatForm((f) => ({ ...f, order: parseInt(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2.5 text-base text-txt-primary placeholder:text-txt-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCatModalOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-txt-secondary hover:bg-surface-secondary transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={catSubmitting}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {catSubmitting ? "Menyimpan..." : editingCat ? "Simpan Perubahan" : "Tambah"}
                </button>
              </div>
            </form>
          </Modal>
        </>
      )}

      {/* ────────── TAG TAB ────────── */}
      {activeTab === "tag" && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => openTagModal()}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} />
              Tambah Tag
            </button>
          </div>

          {tagLoading ? (
            <LoadingSkeleton />
          ) : tags.length === 0 ? (
            <div className="rounded-[12px] border border-border bg-surface p-4 sm:p-8 text-center text-txt-secondary">
              Belum ada tag. Klik &quot;Tambah Tag&quot; untuk memulai.
            </div>
          ) : (
            <div className="overflow-hidden rounded-[12px] border border-border bg-surface shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-secondary text-left">
                      <th className="px-5 py-3.5 text-sm font-medium text-txt-secondary">Nama</th>
                      <th className="px-5 py-3.5 text-sm font-medium text-txt-secondary">Slug</th>
                      <th className="px-5 py-3.5 text-sm font-medium text-txt-secondary text-center">Artikel</th>
                      <th className="px-5 py-3.5 text-sm font-medium text-txt-secondary text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tags.map((tag) => (
                      <tr key={tag.id} className="border-b border-border last:border-0 hover:bg-surface-secondary/50 transition-colors">
                        <td className="px-5 py-4 text-sm font-medium text-txt-primary">{tag.name}</td>
                        <td className="px-5 py-4 text-sm text-txt-secondary">{tag.slug}</td>
                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-0.5 text-sm font-medium text-primary">
                            {tag._count.articles}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openTagModal(tag)}
                              className="rounded-lg p-2 text-txt-secondary hover:bg-surface-secondary hover:text-primary transition-colors"
                              title="Edit"
                              aria-label="Edit tag"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleTagDelete(tag)}
                              disabled={tagDeleting === tag.id}
                              className="rounded-lg p-2 text-txt-secondary hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                              title="Hapus"
                              aria-label="Hapus tag"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tag modal */}
          <Modal
            open={tagModalOpen}
            onClose={() => setTagModalOpen(false)}
            title={editingTag ? "Edit Tag" : "Tambah Tag"}
          >
            <form onSubmit={handleTagSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-base font-medium text-txt-primary">Nama</label>
                <input
                  type="text"
                  value={tagForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setTagForm({ name, slug: slugify(name) });
                  }}
                  className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2.5 text-base text-txt-primary placeholder:text-txt-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Nama tag"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-base font-medium text-txt-primary">Slug</label>
                <input
                  type="text"
                  value={tagForm.slug}
                  onChange={(e) => setTagForm((f) => ({ ...f, slug: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2.5 text-base text-txt-primary placeholder:text-txt-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="slug-tag"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTagModalOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-txt-secondary hover:bg-surface-secondary transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={tagSubmitting}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {tagSubmitting ? "Menyimpan..." : editingTag ? "Simpan Perubahan" : "Tambah"}
                </button>
              </div>
            </form>
          </Modal>
        </>
      )}
    </div>
  );
}
