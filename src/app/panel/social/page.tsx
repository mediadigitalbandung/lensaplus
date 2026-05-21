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
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PLATFORM_DIMENSIONS, type TextLayer } from "@/lib/social/types";

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
  textLayersJson: "",
  isActive: true,
};

const ASPECT_RATIO_LABELS: Record<Platform, string> = {
  INSTAGRAM: "Instagram Portrait 4:5 (1080 × 1350)",
  FACEBOOK: "Facebook Link Share 1.91:1 (1200 × 630)",
  TWITTER: "Twitter/X Feed 16:9 (1200 × 675)",
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

  // Preview state
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

  // Drag and resize handlers
  useEffect(() => {
    if (!draggedLayer) return;

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const platformDims = getPlatformDims(form.platform);

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
  }, [draggedLayer, layers, form.platform]);

  function handleCanvasMouseDown(e: React.MouseEvent, index: number, type: "drag" | "resize") {
    e.preventDefault();
    e.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const layer = layers[index];
    const platformDims = getPlatformDims(form.platform);

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
      textLayersJson: JSON.stringify(t.textLayers, null, 2),
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
      const body = {
        name: form.name,
        platform: form.platform,
        categoryId: form.categoryId || null,
        backgroundUrl: form.backgroundUrl,
        textLayers: layers,
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
  const dims = getPlatformDims(form.platform);

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
        <div className="fixed inset-0 z-[9999] bg-[#001025] flex flex-col overflow-y-auto text-slate-100 font-sans">
          {/* Top Navbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1e293b] px-6 py-4 bg-[#020c1b]/80 backdrop-blur-md sticky top-0 z-50">
            <div className="space-y-0.5">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                {editing ? "Edit Template" : "Template Baru"}
              </h2>
              <p className="text-xs text-slate-400">
                Placeholder: <span className="font-mono text-emerald-400">{"{{paraphrased_title}}"}</span>{" "}
                <span className="font-mono text-emerald-400">{"{{short_summary}}"}</span>{" "}
                <span className="font-mono text-emerald-400">{"{{category}}"}</span>{" "}
                <span className="font-mono text-emerald-400">{"{{date}}"}</span> · AI auto-fill
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              {editing && (
                <button
                  onClick={() => {
                    handleDelete(editing.id);
                  }}
                  className="border border-red-500/30 hover:bg-red-500/10 text-red-400 font-semibold text-sm px-4 py-2 rounded-lg transition-all"
                >
                  Hapus
                </button>
              )}
              <button
                onClick={() => setShowForm(false)}
                className="border border-[#1e293b] hover:bg-slate-800 text-slate-300 font-semibold text-sm px-4 py-2 rounded-lg transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-6 py-2 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-emerald-950/20"
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
                <div className="rounded-xl border border-[#1e293b] bg-slate-900/40 p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                        Nama Template
                      </label>
                      <input
                        type="text"
                        className="w-full bg-[#020c1b] border border-[#1e293b] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-emerald-500 transition-all font-medium"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="contoh: IG Portrait Berita Terkini"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                        Platform
                      </label>
                      <select
                        className="w-full bg-[#020c1b] border border-[#1e293b] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-emerald-500 transition-all font-medium"
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
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                        Aspek Rasio
                      </label>
                      <div className="w-full bg-[#020c1b]/60 border border-[#1e293b] text-slate-300 text-sm rounded-lg px-3 py-2.5 font-medium select-none truncate">
                        {ASPECT_RATIO_LABELS[form.platform]}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                        Kategori (opsional)
                      </label>
                      <select
                        className="w-full bg-[#020c1b] border border-[#1e293b] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-emerald-500 transition-all font-medium"
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
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                        Background Template (PNG transparan di area foto)
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 border border-[#1e293b] hover:border-slate-600 shadow-sm"
                        >
                          <Plus size={12} />
                          Ganti
                        </button>
                        <span className="text-xs text-slate-400 font-mono truncate max-w-[280px]">
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
                      className="h-4 w-4 rounded border-[#1e293b] bg-[#020c1b] accent-emerald-500"
                    />
                    Template Aktif
                  </label>
                </div>

                {/* Drag-and-resize Visual Canvas Box */}
                <div className="rounded-xl border border-[#1e293b] bg-slate-900/40 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-200">
                      Area Foto Artikel (drag untuk pindah, pojok kanan-bawah untuk resize)
                    </h3>
                  </div>

                  <div className="flex justify-center bg-[#020612] p-6 rounded-lg border border-[#1e293b] shadow-inner">
                    <div
                      ref={canvasRef}
                      className="relative border-2 border-slate-700 bg-slate-950 overflow-hidden shadow-2xl container-type-inline-size select-none"
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
                                  ? "border-2 border-dashed border-[#10b981] bg-[#10b981]/25 z-20"
                                  : "border border-dashed border-[#10b981]/70 bg-[#10b981]/15 z-0"
                                : isSelected
                                  ? "border-2 border-dashed border-[#3b82f6] bg-[#3b82f6]/20 z-30"
                                  : "border border-dashed border-[#3b82f6]/50 bg-[#3b82f6]/5 z-20 hover:border-[#3b82f6]/80"
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
                                <span className="bg-[#022c16]/90 border border-[#10b981] text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded shadow">
                                  AREA FOTO
                                </span>
                              </div>
                            ) : (
                              <div
                                className="absolute inset-0 p-1 pointer-events-none text-white truncate text-[9px] font-mono leading-none"
                                style={{
                                  fontFamily: layer.fontFamily?.includes("Newsreader") ? "serif" : "sans-serif",
                                  fontWeight: layer.weight === "Bold" ? "bold" : "normal",
                                  textAlign: layer.align || "left",
                                  color: layer.color || "#ffffff",
                                }}
                              >
                                <span className="bg-[#02183d]/95 border border-[#3b82f6]/80 text-[#3b82f6] px-1 py-0.5 rounded text-[8px] mr-1 font-sans select-none">
                                  {`T${idx}: ${layer.text.replace(/[{}]/g, "")}`}
                                </span>
                              </div>
                            )}

                            {/* Resize handle */}
                            {isSelected && (
                              <div
                                className={`absolute bottom-0 right-0 w-3 h-3 translate-x-1/2 translate-y-1/2 rounded-full shadow-lg border border-white cursor-se-resize z-40 ${
                                  isPhoto ? "bg-[#10b981]" : "bg-[#3b82f6]"
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
                    <div className="text-center text-xs font-semibold text-slate-400 font-mono select-none pt-1">
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
                    <h3 className="text-sm font-bold text-slate-200">
                      Text Layers ({layers.length})
                    </h3>
                    <button
                      type="button"
                      onClick={addTextLayer}
                      className="text-emerald-400 hover:text-emerald-300 font-bold text-xs flex items-center gap-1 transition-all"
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
                              ? "border-[#10b981]/50 bg-emerald-950/15"
                              : "border-[#3b82f6]/50 bg-[#001c3d]/20"
                            : "border-[#1e293b] bg-slate-900/25 hover:border-slate-800"
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
                                isPhoto ? "bg-[#10b981]" : "bg-[#3b82f6]"
                              }`}
                            />
                            <span className="text-sm font-bold text-slate-200">
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
                            <span className="text-xs text-slate-500 font-mono">
                              {isSelected ? "Tutup" : "Edit"}
                            </span>
                          </div>
                        </div>

                        {/* Collapsible content editor */}
                        {isSelected && (
                          <div className="px-5 pb-5 pt-1 border-t border-[#1e293b]/60 space-y-4">
                            {!isPhoto && (
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                  Teks / Placeholder
                                </label>
                                <textarea
                                  rows={1.5}
                                  className="w-full bg-[#020c1b] border border-[#1e293b] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-emerald-500 font-medium font-mono"
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
                                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                  X (%)
                                </label>
                                <input
                                  type="number"
                                  className="w-full bg-[#020c1b] border border-[#1e293b] text-white text-sm rounded-lg px-2.5 py-1.5 outline-none font-medium font-mono"
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
                                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                  Y (%)
                                </label>
                                <input
                                  type="number"
                                  className="w-full bg-[#020c1b] border border-[#1e293b] text-white text-sm rounded-lg px-2.5 py-1.5 outline-none font-medium font-mono"
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
                                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                  Lebar (%)
                                </label>
                                <input
                                  type="number"
                                  className="w-full bg-[#020c1b] border border-[#1e293b] text-white text-sm rounded-lg px-2.5 py-1.5 outline-none font-medium font-mono"
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
                                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                  Tinggi (%)
                                </label>
                                <input
                                  type="number"
                                  className="w-full bg-[#020c1b] border border-[#1e293b] text-white text-sm rounded-lg px-2.5 py-1.5 outline-none font-medium font-mono"
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
                                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                      Font Family
                                    </label>
                                    <select
                                      className="w-full bg-[#020c1b] border border-[#1e293b] text-white text-xs rounded-lg px-2.5 py-2 outline-none font-medium focus:border-emerald-500"
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
                                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                      Font Size (px)
                                    </label>
                                    <input
                                      type="number"
                                      className="w-full bg-[#020c1b] border border-[#1e293b] text-white text-sm rounded-lg px-2.5 py-1.5 outline-none font-medium font-mono"
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
                                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                      Warna (Hex)
                                    </label>
                                    <div className="flex gap-1.5 items-center">
                                      <input
                                        type="color"
                                        className="w-8 h-8 rounded border border-[#1e293b] cursor-pointer bg-transparent p-0"
                                        value={layer.color || "#ffffff"}
                                        onChange={(e) => {
                                          const updated = [...layers];
                                          updated[idx].color = e.target.value;
                                          setLayers(updated);
                                        }}
                                      />
                                      <input
                                        type="text"
                                        className="flex-1 bg-[#020c1b] border border-[#1e293b] text-white text-sm rounded-lg px-2 py-1.5 outline-none font-medium font-mono"
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
                                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                      Alignment
                                    </label>
                                    <select
                                      className="w-full bg-[#020c1b] border border-[#1e293b] text-white text-xs rounded-lg px-2.5 py-2 outline-none font-medium focus:border-emerald-500"
                                      value={layer.align || "left"}
                                      onChange={(e) => {
                                        const updated = [...layers];
                                        updated[idx].align = e.target.value as "left" | "center" | "right";
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
                                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                      Weight
                                    </label>
                                    <select
                                      className="w-full bg-[#020c1b] border border-[#1e293b] text-white text-xs rounded-lg px-2.5 py-2 outline-none font-medium focus:border-emerald-500"
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
                                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                      Line Height
                                    </label>
                                    <input
                                      type="number"
                                      step="0.1"
                                      className="w-full bg-[#020c1b] border border-[#1e293b] text-white text-sm rounded-lg px-2.5 py-1.5 outline-none font-medium font-mono"
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
                                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                      Max Lines
                                    </label>
                                    <input
                                      type="number"
                                      className="w-full bg-[#020c1b] border border-[#1e293b] text-white text-sm rounded-lg px-2.5 py-1.5 outline-none font-medium font-mono"
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
                <div className="rounded-xl border border-[#1e293b] bg-slate-900/40 p-5 space-y-4">
                  <div className="flex items-center justify-between select-none">
                    <h3 className="text-sm font-bold text-slate-200">
                      Preview Template
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        showSuccess("Preview di-refresh");
                      }}
                      className="text-emerald-400 hover:text-emerald-300 font-bold text-xs flex items-center gap-1 transition-all"
                    >
                      <RefreshCw size={12} className="animate-pulse" />
                      Refresh
                    </button>
                  </div>

                  {/* Responsive high fidelity HTML mockup preview block */}
                  <div className="bg-[#020612] p-6 rounded-lg border border-[#1e293b] flex justify-center shadow-inner">
                    <div
                      className="relative rounded-lg overflow-hidden bg-white text-slate-800 shadow-2xl container-type-inline-size select-none"
                      style={{
                        aspectRatio: `${dims.width} / ${dims.height}`,
                        width: "100%",
                        maxWidth: "360px",
                      }}
                    >
                      {/* 1. Article photo inside its cutout at absolute coordinates */}
                      {(() => {
                        const photoLayer = layers.find((l) => l.text === "{{photo}}");
                        if (!photoLayer) return null;

                        const pctX = (photoLayer.x / dims.width) * 100;
                        const pctY = (photoLayer.y / dims.height) * 100;
                        const pctW = (photoLayer.width / dims.width) * 100;
                        const pctH = (photoLayer.height / dims.height) * 100;

                        return (
                          <div
                            className="absolute pointer-events-none z-0"
                            style={{
                              left: `${pctX}%`,
                              top: `${pctY}%`,
                              width: `${pctW}%`,
                              height: `${pctH}%`,
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=1080"
                              alt="Court"
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


                      {/* 3. Text Layers rendered dynamically */}
                      {layers
                        .filter((l) => l.text !== "{{photo}}")
                        .map((layer, idx) => {
                          const pctX = (layer.x / dims.width) * 100;
                          const pctY = (layer.y / dims.height) * 100;
                          const pctW = (layer.width / dims.width) * 100;
                          const pctH = (layer.height / dims.height) * 100;

                          // Dynamic content resolution
                          let resolvedText = layer.text;
                          resolvedText = resolvedText
                            .replace(/\{\{category\}\}/g, "TIPIKOR")
                            .replace(/\{\{paraphrased_title\}\}/g, "Eks Dirut Pertamina Dituntut 4 Tahun Bui Kasus Korupsi Katalis")
                            .replace(/\{\{short_summary\}\}/g, "Mantan Direktur Pengolahan PT Pertamina Chrisna Damayanto dituntut 4 tahun penjara akibat korupsi pengadaan katalis di Kilang Balongan senilai Rp176,4 Miliar.")
                            .replace(/\{\{date\}\}/g, "21 Mei 2026")
                            .replace(/\{\{title\}\}/g, "Eks Dirut Pertamina Dituntut 4 Tahun Bui Kasus Korupsi Katalis")
                            .replace(/\{\{summary\}\}/g, "Mantan Direktur Pengolahan PT Pertamina Chrisna Damayanto dituntut 4 tahun penjara akibat korupsi pengadaan katalis di Kilang Balongan senilai Rp176,4 Miliar.");

                          // Custom style compilation
                          const fontSerif = layer.fontFamily?.includes("Newsreader") || layer.fontFamily?.includes("Georgia");

                          return (
                            <div
                              key={idx}
                              className="absolute pointer-events-none z-20 overflow-hidden text-ellipsis leading-tight flex flex-col justify-start"
                              style={{
                                left: `${pctX}%`,
                                top: `${pctY}%`,
                                width: `${pctW}%`,
                                height: `${pctH}%`,
                                color: layer.color || "#ffffff",
                                textAlign: layer.align || "left",
                                fontSize: `calc((${layer.fontSize} / ${dims.width}) * 100cqw)`,
                                fontFamily: fontSerif ? "'Newsreader', 'Georgia', serif" : "Arial, sans-serif",
                                fontWeight: layer.weight === "Bold" ? "bold" : "normal",
                                fontStyle: layer.weight === "Italic" ? "italic" : "normal",
                                lineHeight: layer.lineHeight || 1.2,
                              }}
                            >
                              {/* If category layer, let's wrap it in a beautiful badge matching the mockup */}
                              {layer.text === "{{category}}" ? (
                                <span className="bg-[#002045] text-white font-extrabold px-3 py-1 rounded inline-block text-center uppercase tracking-wider mx-auto shadow-sm">
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

                  <p className="text-[10px] text-slate-500 text-center select-none mt-1">
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
