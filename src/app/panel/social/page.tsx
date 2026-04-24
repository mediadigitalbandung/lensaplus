"use client";

/**
 * Social Media Panel — SUPER_ADMIN only
 * Tabs: Posts | Templates | Settings
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Share2,
  Instagram,
  Facebook,
  Twitter,
  CheckCircle,
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
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type Platform = "INSTAGRAM" | "FACEBOOK" | "TWITTER";
type PostStatus = "DRAFT" | "PENDING" | "PUBLISHED" | "REJECTED" | "DELETED";

interface SocialPost {
  id: string;
  articleId: string;
  platform: Platform;
  status: PostStatus;
  externalId: string | null;
  imageUrl: string | null;
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
    defaultHashtags: string | null;
    defaultCTA: string | null;
  };
  instagram: {
    accessToken: string | null;
    hasAccessToken: boolean;
    igUserId: string | null;
    enabled: boolean;
    captionMaxLen: number;
    hashtagCount: number;
  };
  facebook: {
    accessToken: string | null;
    hasAccessToken: boolean;
    pageId: string | null;
    postMode: string;
    enabled: boolean;
  };
}

const PLATFORM_ICONS: Record<Platform, React.ElementType> = {
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  TWITTER: Twitter,
};

const PLATFORM_COLORS: Record<Platform, string> = {
  INSTAGRAM: "text-pink-500 bg-pink-50",
  FACEBOOK: "text-blue-600 bg-blue-50",
  TWITTER: "text-sky-500 bg-sky-50",
};

const STATUS_COLORS: Record<PostStatus, string> = {
  DRAFT: "bg-surface-tertiary text-txt-secondary",
  PENDING: "bg-yellow-50 text-yellow-600",
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

  async function doAction(id: string, action: "approve" | "reject" | "takedown") {
    const labels: Record<string, string> = {
      approve: "mempublikasi",
      reject: "menolak",
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
      showSuccess(`Berhasil ${labels[action]}.`);
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
                  {/* Image */}
                  <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-surface-secondary">
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
  textLayersJson: JSON.stringify(
    [
      {
        text: "{{title}}",
        x: 60,
        y: 540,
        width: 960,
        height: 360,
        fontSize: 64,
        fontFamily: "Newsreader",
        weight: 700,
        color: "#ffffff",
        lineHeight: 1.2,
        maxLines: 3,
        align: "left",
      },
    ],
    null,
    2,
  ),
  isActive: true,
};

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

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewArticleId, setPreviewArticleId] = useState("");
  const [previewTemplateId, setPreviewTemplateId] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

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
  }, [fetchTemplates, fetchCategories]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_TEMPLATE);
    setShowForm(true);
  }

  function openEdit(t: SocialTemplate) {
    setEditing(t);
    setForm({
      name: t.name,
      platform: t.platform,
      categoryId: t.categoryId || "",
      backgroundUrl: t.backgroundUrl,
      textLayersJson: JSON.stringify(t.textLayers, null, 2),
      isActive: t.isActive,
    });
    setShowForm(true);
  }

  async function handleSave() {
    try {
      // Validate JSON
      let textLayers: unknown;
      try {
        textLayers = JSON.parse(form.textLayersJson);
      } catch {
        showError("Text Layers JSON tidak valid.");
        return;
      }
      if (!Array.isArray(textLayers)) {
        showError("Text Layers harus array.");
        return;
      }
      if (!form.name.trim() || !form.backgroundUrl.trim()) {
        showError("Nama dan Background URL wajib diisi.");
        return;
      }

      setSaving(true);
      const body = {
        name: form.name,
        platform: form.platform,
        categoryId: form.categoryId || null,
        backgroundUrl: form.backgroundUrl,
        textLayers,
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

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-xl font-bold text-txt-primary mb-4">
              {editing ? "Edit Template" : "Template Baru"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Nama
                </label>
                <input
                  type="text"
                  className="input w-full py-2 text-sm"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Platform
                  </label>
                  <select
                    className="input w-full py-2 text-sm"
                    value={form.platform}
                    onChange={(e) =>
                      setForm({ ...form, platform: e.target.value as Platform })
                    }
                  >
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="FACEBOOK">Facebook</option>
                    <option value="TWITTER">Twitter</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Kategori (opsional)
                  </label>
                  <select
                    className="input w-full py-2 text-sm"
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
              </div>
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Background URL
                </label>
                <input
                  type="text"
                  className="input w-full py-2 text-sm"
                  placeholder="https://... atau /uploads/..."
                  value={form.backgroundUrl}
                  onChange={(e) =>
                    setForm({ ...form, backgroundUrl: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Text Layers (JSON)
                </label>
                <textarea
                  rows={10}
                  className="input w-full py-2 text-xs font-mono"
                  value={form.textLayersJson}
                  onChange={(e) =>
                    setForm({ ...form, textLayersJson: e.target.value })
                  }
                />
                <p className="mt-1 text-[10px] text-txt-muted">
                  Format: array of{" "}
                  {"{text, x, y, width, height, fontSize, color, ...}"}.
                  Template variables: {"{{title}}, {{category}}, {{author}}"}.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border"
                />
                Aktif
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="btn-ghost rounded-md px-4 py-2 text-sm"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
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
  const [saving, setSaving] = useState<string | null>(null);

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

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/social/settings");
      if (res.ok) {
        const json = await res.json();
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
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function saveScope(
    scope: "global" | "instagram" | "facebook",
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
      fetchSettings();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(null);
    }
  }

  if (loading || !settings || !global || !instagram || !facebook) {
    return (
      <div className="py-16 text-center">
        <Loader2 size={24} className="mx-auto animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() =>
              saveScope("global", {
                draftMode: global.draftMode,
                autoPublishIG: global.autoPublishIG,
                autoPublishFB: global.autoPublishFB,
                autoPublishTwitter: global.autoPublishTwitter,
                defaultHashtags: global.defaultHashtags,
                defaultCTA: global.defaultCTA,
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
        <h3 className="text-base font-bold text-txt-primary mb-1 flex items-center gap-2">
          <Instagram size={16} className="text-pink-500" />
          Instagram
        </h3>
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
                type={showIgToken ? "text" : "password"}
                className="input w-full py-2 text-sm pr-16"
                placeholder={
                  settings.instagram.hasAccessToken
                    ? "(tidak berubah)"
                    : "IGQV..."
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
        <h3 className="text-base font-bold text-txt-primary mb-1 flex items-center gap-2">
          <Facebook size={16} className="text-blue-600" />
          Facebook
        </h3>
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
                type={showFbToken ? "text" : "password"}
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
            <label className="block text-xs font-semibold text-txt-secondary mb-1">
              Post Mode
            </label>
            <div className="flex items-center gap-4 py-2">
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="fbPostMode"
                  checked={facebook.postMode === "link"}
                  onChange={() =>
                    setFacebook({ ...facebook, postMode: "link" })
                  }
                />
                Link
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="fbPostMode"
                  checked={facebook.postMode === "photo"}
                  onChange={() =>
                    setFacebook({ ...facebook, postMode: "photo" })
                  }
                />
                Photo
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
