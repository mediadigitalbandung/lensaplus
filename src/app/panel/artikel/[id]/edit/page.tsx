"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  Save,
  Send,
  ChevronDown,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  XCircle,
  MessageSquare,
  User,
  Calendar,
  Loader2,
  Sparkles,
  Lock,
  Undo2,
  Upload,
  ArrowRight,
  Eye,
  History,
  CalendarClock,
  FileText,
  Printer,
  StickyNote,
} from "lucide-react";
import ImageUploader from "@/components/editor/ImageUploader";
import { stripHtml, downloadTextFile, exportArticlePdf } from "@/lib/export-utils";

const RichTextEditor = dynamic(
  () => import("@/components/editor/RichTextEditor"),
  { ssr: false, loading: () => <div className="h-[500px] animate-pulse rounded-[12px] bg-surface-secondary" /> }
);

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Source {
  name: string;
  title: string;
  institution: string;
  url: string;
}

import { EDITOR_ROLES, ADMIN_ROLES, CAN_SUBMIT_REVIEW, roleLabelsMap } from "@/lib/roles";

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="h-7 w-48 rounded bg-surface-tertiary" />
          <div className="mt-2 h-4 w-48 sm:w-64 rounded bg-surface-secondary" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded-[12px] bg-surface-tertiary" />
          <div className="h-10 w-40 rounded-[12px] bg-surface-tertiary" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="h-14 rounded-[12px] bg-surface-tertiary" />
          <div className="h-[500px] rounded-[12px] bg-surface-tertiary" />
          <div className="h-40 rounded-[12px] bg-surface-tertiary" />
        </div>
        <div className="space-y-4">
          <div className="h-24 rounded-[12px] bg-surface-tertiary" />
          <div className="h-24 rounded-[12px] bg-surface-tertiary" />
          <div className="h-32 rounded-[12px] bg-surface-tertiary" />
          <div className="h-24 rounded-[12px] bg-surface-tertiary" />
          <div className="h-24 rounded-[12px] bg-surface-tertiary" />
        </div>
      </div>
    </div>
  );
}

export default function EditArticlePage() {
  const router = useRouter();
  const params = useParams();
  const articleId = params.id as string;
  const { data: session } = useSession();
  const { success, error: showError } = useToast();
  const { confirm } = useConfirm();
  const userRole = session?.user?.role || "";
  const userId = session?.user?.id || "";
  const isEditor = EDITOR_ROLES.includes(userRole);
  const isAdmin = ADMIN_ROLES.includes(userRole);

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState("");
  const [featuredImage, setFeaturedImage] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [sources, setSources] = useState<Source[]>([{ name: "", title: "", institution: "", url: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showSeo, setShowSeo] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentStatus, setCurrentStatus] = useState("");
  const [existingReviewNote, setExistingReviewNote] = useState("");
  const [existingReviewedBy, setExistingReviewedBy] = useState("");
  const [existingReviewerName, setExistingReviewerName] = useState("");
  const [existingReviewedAt, setExistingReviewedAt] = useState("");
  const [articleAuthorId, setArticleAuthorId] = useState("");
  const [articleAuthorName, setArticleAuthorName] = useState("");
  const [articleCreatedAt, setArticleCreatedAt] = useState("");

  // Author/Editor selection state
  const [allUsers, setAllUsers] = useState<{id: string; name: string; role: string}[]>([]);
  const [selectedAuthorId, setSelectedAuthorId] = useState("");
  const [selectedEditorId, setSelectedEditorId] = useState("");

  // Editor review state
  const [reviewChoice, setReviewChoice] = useState<"approve" | "reject" | null>(null);
  const [approveNote, setApproveNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  // Admin return-to-editor note
  const [returnNote, setReturnNote] = useState("");
  const [showReturnNote, setShowReturnNote] = useState(false);

  // Scheduling state
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");

  // Auto-save state
  const [autoSaveIndicator, setAutoSaveIndicator] = useState("");
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const AUTOSAVE_KEY = `autosave_draft_${articleId}`;

  // Research notes state
  const [researchNotes, setResearchNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);

  // Word counter calculations
  const plainText = content.replace(/<[^>]*>/g, "").trim();
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;
  const charCount = plainText.length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  // Auto-save every 30 seconds (only when status is DRAFT)
  useEffect(() => {
    if (loading) return;
    if (currentStatus !== "DRAFT" && currentStatus !== "REJECTED") return;

    autosaveTimerRef.current = setInterval(() => {
      if (title.trim() || content.trim()) {
        try {
          const draft = { title, content, categoryId, excerpt, tags, featuredImage, sources };
          localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(draft));
          setAutoSaveIndicator("Draft tersimpan otomatis");
          setTimeout(() => setAutoSaveIndicator(""), 3000);
        } catch {
          // localStorage not available
        }
      }
    }, 30000);

    return () => {
      if (autosaveTimerRef.current) clearInterval(autosaveTimerRef.current);
    };
  }, [loading, currentStatus, title, content, categoryId, excerpt, tags, featuredImage, sources, AUTOSAVE_KEY]);

  // Clear auto-save helper
  const clearAutosave = useCallback(() => {
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch { /* ignore */ }
  }, [AUTOSAVE_KEY]);

  // Load research notes from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`research_notes_${params.id}`);
    if (saved) setResearchNotes(saved);
  }, [params.id]);

  // Auto-save research notes on change
  useEffect(() => {
    if (researchNotes) {
      localStorage.setItem(`research_notes_${params.id}`, researchNotes);
    }
  }, [researchNotes, params.id]);

  const [checklist, setChecklist] = useState({
    notClickbait: false,
    hasSource: false,
    balanced: false,
    noSara: false,
    properLanguage: false,
  });

  const allChecked = Object.values(checklist).every(Boolean);

  // Export functions
  const handleExportPdf = async () => {
    const categoryName = categories.find(c => c.id === categoryId)?.name || "-";
    const authorName = articleAuthorName || "-";
    const dateStr = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

    await exportArticlePdf({
      title,
      excerpt: excerpt || undefined,
      content,
      author: authorName,
      category: categoryName,
      date: dateStr,
      featuredImage: featuredImage || undefined,
      tags: tags.split(",").map((t: string) => t.trim()).filter(Boolean),
      sources: sources.filter((s: { name: string }) => s.name?.trim()),
    });
  };

  const handleExportText = () => {
    const plainText = `${title}\n\n${excerpt ? excerpt + "\n\n" : ""}${stripHtml(content)}`;
    const safeFilename = title.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 80);
    downloadTextFile(`${safeFilename}.txt`, plainText);
  };

  const [generatingTags, setGeneratingTags] = useState(false);
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});

  const generateAI = async (feature: string, setter: (val: string) => void) => {
    if (!title.trim() || !content.trim()) return;
    setAiLoading((prev) => ({ ...prev, [feature]: true }));
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature, title, content }),
      });
      const data = await res.json();
      if (data.success && data.data?.result) {
        setter(data.data.result);
      } else {
        setError(data.error || "Gagal generate AI");
      }
    } catch {
      setError("Gagal menghubungi AI service");
    } finally {
      setAiLoading((prev) => ({ ...prev, [feature]: false }));
    }
  };

  const AiButton = ({ feature, setter }: { feature: string; setter: (val: string) => void }) => (
    <button
      type="button"
      onClick={() => generateAI(feature, setter)}
      disabled={!title.trim() || !content.trim() || aiLoading[feature]}
      className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-40 disabled:no-underline"
    >
      {aiLoading[feature] ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
      Generate AI
    </button>
  );

  const generateTagsAI = async () => {
    if (!title.trim() || !content.trim()) return;
    try {
      setGeneratingTags(true);
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature: "tags", title, content }),
      });
      if (!res.ok) throw new Error("Gagal generate tags");
      const json = await res.json();
      const newTags = json.data?.result?.split(",").map((t: string) => t.trim()).filter(Boolean) || [];
      setTags((prev) => {
        const existing = prev.split(",").map((t) => t.trim()).filter(Boolean);
        const merged = Array.from(new Set([...existing, ...newTags]));
        return merged.join(", ");
      });
    } catch { /* ignore */ } finally {
      setGeneratingTags(false);
    }
  };

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const json = await res.json();
        setCategories(json.data || []);
      }
    } catch {
      console.error("Failed to fetch categories");
    }
  }, []);

  const fetchArticle = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/articles/${articleId}`);
      if (res.status === 404) {
        setError("Artikel tidak ditemukan");
        return;
      }
      if (!res.ok) {
        setError("Gagal memuat artikel");
        return;
      }
      const json = await res.json();
      const article = json.data;

      setTitle(article.title || "");
      setContent(article.content || "");
      setExcerpt(article.excerpt || "");
      setCategoryId(article.categoryId || article.category?.id || "");
      setTags(article.tags?.map((t: { name: string }) => t.name).join(", ") || "");
      setFeaturedImage(article.featuredImage || "");
      setSeoTitle(article.seoTitle || "");
      setSeoDescription(article.seoDescription || "");
      setCurrentStatus(article.status || "DRAFT");
      setExistingReviewNote(article.reviewNote || "");
      setExistingReviewedBy(article.reviewedBy || "");
      setExistingReviewerName(article.reviewerName || "");
      setExistingReviewedAt(article.reviewedAt || "");
      setArticleAuthorId(article.authorId || article.author?.id || "");
      setArticleAuthorName(article.author?.name || "");
      setArticleCreatedAt(article.createdAt || "");
      setSelectedAuthorId(article.authorId || article.author?.id || "");
      setSelectedEditorId(article.reviewedBy || article.assignedEditorId || "");

      if (article.sources && article.sources.length > 0) {
        setSources(
          article.sources.map((s: { name?: string; title?: string; institution?: string; url?: string }) => ({
            name: s.name || "",
            title: s.title || "",
            institution: s.institution || "",
            url: s.url || "",
          }))
        );
      }
    } catch {
      setError("Terjadi kesalahan saat memuat artikel.");
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    fetchCategories();
    fetchArticle();
  }, [fetchCategories, fetchArticle]);

  // Fetch users for author/editor dropdowns
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/users");
        if (res.ok) {
          const json = await res.json();
          setAllUsers(json.data || []);
        }
      } catch { /* ignore */ }
    }
    if (session?.user) {
      fetchUsers();
    }
  }, [session?.user]);

  const addSource = () => {
    if (sources.length > 0 && !sources[sources.length - 1].name.trim()) {
      return;
    }
    setSources([...sources, { name: "", title: "", institution: "", url: "" }]);
  };

  const removeSource = (index: number) => {
    setSources(sources.filter((_, i) => i !== index));
  };

  const updateSource = (index: number, field: keyof Source, value: string) => {
    const updated = [...sources];
    updated[index] = { ...updated[index], [field]: value };
    setSources(updated);
  };

  // Determine user's role in relation to this article
  const isOwner = articleAuthorId === userId;
  const isAssignedEditor = isEditor && existingReviewedBy === userId;

  // Determine what view to show
  const getViewMode = (): "journalist" | "editor" | "admin" | "unauthorized" => {
    if (isAdmin) return "admin";
    if (isEditor && !isOwner) return "editor";
    if (isOwner) return "journalist";
    if (isEditor) return "editor"; // editor viewing any article
    return "unauthorized";
  };

  const viewMode = getViewMode();

  // Check if jurnalis can edit content
  const canJurnalisEdit = isOwner && ["DRAFT", "REJECTED"].includes(currentStatus);

  // --- JURNALIS HANDLERS ---
  const handleJurnalisSubmit = async (status: "DRAFT" | "IN_REVIEW") => {
    setError("");

    if (!title.trim()) return setError("Judul wajib diisi");
    if (!content.trim()) return setError("Konten tidak boleh kosong");
    if (content.length < 50) return setError("Konten minimal 50 karakter");
    if (!categoryId) return setError("Kategori harus dipilih");

    if (status === "IN_REVIEW" && !allChecked) {
      setShowChecklist(true);
      return setError("Semua checklist jurnalistik harus dipenuhi sebelum submit");
    }

    if (status === "IN_REVIEW") {
      const ok = await confirm({ message: "Artikel akan dikirim untuk review oleh editor. Lanjutkan?", variant: "warning", title: "Konfirmasi" });
      if (!ok) return;
    }

    setSaving(true);
    try {
      const validSources = sources.filter((s) => s.name.trim());
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);

      const res = await fetch(`/api/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          excerpt: excerpt || undefined,
          categoryId,
          tags: tagList,
          featuredImage: featuredImage || undefined,
          seoTitle: seoTitle || undefined,
          seoDescription: seoDescription || undefined,
          status,
          sources: validSources.length > 0 ? validSources : undefined,
          assignedEditorId: selectedEditorId || undefined,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Gagal menyimpan artikel");
        setSaving(false);
        return;
      }

      clearAutosave();
      success(status === "IN_REVIEW" ? "Artikel dikirim untuk review" : "Artikel disimpan sebagai draf");
      router.push("/panel/artikel");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
      setSaving(false);
    }
  };

  const handleCancelReview = async () => {
    const ok = await confirm({ message: "Batalkan review dan kembalikan artikel ke draf?", variant: "warning", title: "Konfirmasi" });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DRAFT" }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Gagal membatalkan review");
        setSaving(false);
        return;
      }
      success("Review dibatalkan. Artikel kembali ke draf.");
      router.push("/panel/artikel");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan.");
      setSaving(false);
    }
  };

  // --- EDITOR HANDLERS ---
  const handleEditorApprove = async () => {
    const ok = await confirm({ message: "Setujui artikel ini? Artikel dapat dipublikasi oleh editor atau admin.", variant: "warning", title: "Konfirmasi" });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "APPROVED",
          reviewNote: approveNote || null,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Gagal menyetujui artikel");
        setSaving(false);
        return;
      }
      success("Artikel berhasil disetujui");
      router.push("/panel/artikel");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan.");
      setSaving(false);
    }
  };

  const handleEditorReject = async () => {
    if (!rejectNote.trim()) {
      setError("Alasan penolakan wajib diisi");
      return;
    }
    const ok = await confirm({ message: "Tolak artikel ini? Artikel akan dikembalikan ke penulis.", variant: "danger", title: "Konfirmasi" });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "REJECTED",
          reviewNote: rejectNote,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Gagal menolak artikel");
        setSaving(false);
        return;
      }
      success("Artikel ditolak dan dikembalikan ke penulis");
      router.push("/panel/artikel");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan.");
      setSaving(false);
    }
  };

  const handleEditorCancelApproval = async () => {
    const ok = await confirm({ message: "Batalkan persetujuan? Artikel akan kembali ke status review.", variant: "warning", title: "Konfirmasi" });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_REVIEW" }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Gagal membatalkan persetujuan");
        setSaving(false);
        return;
      }
      success("Persetujuan dibatalkan. Artikel kembali ke review.");
      router.push("/panel/artikel");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan.");
      setSaving(false);
    }
  };

  // --- EDITOR PUBLISH ---
  const handleEditorPublish = async () => {
    const ok = await confirm({ message: "Publikasi artikel ini sekarang? Artikel akan tampil di halaman publik.", variant: "warning", title: "Konfirmasi" });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Gagal mempublikasi artikel");
        setSaving(false);
        return;
      }
      success("Artikel berhasil dipublikasi!");
      router.push("/panel/artikel");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan.");
      setSaving(false);
    }
  };

  // --- ADMIN HANDLERS ---
  const handleAdminPublish = async () => {
    const ok = await confirm({ message: "Publikasi artikel ini sekarang? Artikel akan tampil di halaman publik.", variant: "warning", title: "Konfirmasi" });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Gagal mempublikasi artikel");
        setSaving(false);
        return;
      }
      success("Artikel berhasil dipublikasikan!");
      router.push("/panel/artikel");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan.");
      setSaving(false);
    }
  };

  const handleAdminSchedule = async () => {
    if (!scheduleDate) {
      setError("Pilih tanggal dan waktu publikasi terlebih dahulu");
      return;
    }
    const scheduledTime = new Date(scheduleDate);
    if (scheduledTime <= new Date()) {
      setError("Jadwal publikasi harus di masa depan");
      return;
    }
    const ok = await confirm({ message: `Jadwalkan publikasi pada ${scheduledTime.toLocaleString("id-ID")}?`, variant: "warning", title: "Konfirmasi" });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED", scheduledAt: scheduledTime.toISOString() }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Gagal menjadwalkan publikasi");
        setSaving(false);
        return;
      }
      success(`Publikasi dijadwalkan pada ${scheduledTime.toLocaleString("id-ID")}`);
      router.push("/panel/artikel");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan.");
      setSaving(false);
    }
  };

  const handleAdminReturnToEditor = async () => {
    const ok = await confirm({ message: "Kembalikan artikel ke editor untuk review ulang?", variant: "warning", title: "Konfirmasi" });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "IN_REVIEW",
          reviewNote: returnNote || null,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Gagal mengembalikan artikel");
        setSaving(false);
        return;
      }
      success("Artikel dikembalikan ke editor");
      router.push("/panel/artikel");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan.");
      setSaving(false);
    }
  };

  // --- ADMIN SAVE CONTENT ---
  const handleAdminSave = async () => {
    setError("");
    if (!title.trim()) return setError("Judul wajib diisi");
    if (!content.trim()) return setError("Konten tidak boleh kosong");
    if (!categoryId) return setError("Kategori harus dipilih");

    setSaving(true);
    try {
      const validSources = sources.filter((s) => s.name.trim());
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);

      const res = await fetch(`/api/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          excerpt: excerpt || undefined,
          categoryId,
          tags: tagList,
          featuredImage: featuredImage || undefined,
          seoTitle: seoTitle || undefined,
          seoDescription: seoDescription || undefined,
          sources: validSources.length > 0 ? validSources : undefined,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Gagal menyimpan artikel");
        setSaving(false);
        return;
      }

      success("Artikel berhasil disimpan");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error && !title) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
        <AlertCircle size={48} className="mb-4 text-red-400" />
        <h1 className="text-xl font-bold text-txt-primary">{error}</h1>
        <button
          onClick={() => router.push("/panel/artikel")}
          className="btn-primary mt-4 flex items-center gap-2 px-4 py-2 text-sm font-semibold"
        >
          <ArrowLeft size={16} /> Kembali ke Daftar Artikel
        </button>
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    DRAFT: "Draf",
    IN_REVIEW: "Menunggu Review",
    APPROVED: "Disetujui",
    PUBLISHED: "Dipublikasi",
    REJECTED: "Ditolak",
    ARCHIVED: "Diarsipkan",
  };

  // ============================================================
  // RENDER: ADMIN VIEW
  // ============================================================
  if (viewMode === "admin") {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              onClick={() => router.push("/panel/artikel")}
              className="mb-1 flex items-center gap-1 text-xs text-txt-secondary hover:text-txt-primary"
            >
              <ArrowLeft size={14} /> Kembali ke Daftar Artikel
            </button>
            <h1 className="text-lg sm:text-2xl font-bold text-txt-primary">
              Review Artikel (Admin)
            </h1>
            <p className="text-sm text-txt-secondary">
              Status: <span className="font-medium text-gold">{statusLabel[currentStatus] || currentStatus}</span> | Penulis: {articleAuthorName || "—"}
            </p>
          </div>
          <button
            onClick={handleAdminSave}
            disabled={saving}
            className="btn-primary flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Simpan Perubahan
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-[12px] bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Activity Info */}
        <div className="mb-6 rounded-[12px] border border-border bg-surface p-5 space-y-3">
          <h3 className="text-sm font-bold text-txt-primary uppercase tracking-wider flex items-center gap-2">
            <Eye size={16} />
            Informasi Artikel
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-txt-muted">Penulis:</span>{" "}
              <span className="text-txt-primary font-medium">{articleAuthorName || "—"}</span>
            </div>
            <div>
              <span className="text-txt-muted">Dibuat:</span>{" "}
              <span className="text-txt-primary">
                {articleCreatedAt ? new Date(articleCreatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
              </span>
            </div>
            <div>
              <span className="text-txt-muted">Editor reviewer:</span>{" "}
              <span className="text-txt-primary font-medium">{existingReviewerName || "—"}</span>
            </div>
            <div>
              <span className="text-txt-muted">Waktu review:</span>{" "}
              <span className="text-txt-primary">
                {existingReviewedAt ? new Date(existingReviewedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
              </span>
            </div>
            {existingReviewNote && (
              <div className="sm:col-span-2">
                <span className="text-txt-muted">Catatan review:</span>{" "}
                <span className="text-txt-primary">{existingReviewNote}</span>
              </div>
            )}
          </div>
        </div>

        {/* Admin Actions */}
        {currentStatus === "APPROVED" && (
          <div className="mb-6 rounded-[12px] border-2 border-primary/30 bg-primary-50 p-5">
            <h3 className="flex items-center gap-2 text-base font-bold text-primary-dark">
              <CheckCircle size={18} />
              Artikel Disetujui — Siap Dipublikasi
            </h3>
            <p className="mt-1 text-sm text-primary">
              Artikel ini telah disetujui oleh editor. Anda dapat mempublikasi sekarang, menjadwalkan, atau mengembalikan ke editor.
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleAdminPublish}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-[12px] bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                >
                  <Upload size={16} />
                  Publikasi Sekarang
                </button>
                <button
                  onClick={() => { setShowSchedule(!showSchedule); setShowReturnNote(false); }}
                  className="flex items-center gap-1.5 rounded-[12px] border border-blue-300 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  <CalendarClock size={16} />
                  Jadwalkan Publikasi
                </button>
                <button
                  onClick={() => { setShowReturnNote(!showReturnNote); setShowSchedule(false); }}
                  className="flex items-center gap-1.5 rounded-[12px] border border-yellow-300 bg-yellow-50 px-5 py-2.5 text-sm font-semibold text-yellow-700 hover:bg-yellow-100"
                >
                  <Undo2 size={16} />
                  Kembalikan ke Editor
                </button>
              </div>

              {/* Schedule picker */}
              {showSchedule && (
                <div className="rounded-[12px] border border-blue-300 bg-blue-50 p-4 mt-3">
                  <label className="mb-2 block text-sm font-medium text-blue-800">
                    Pilih tanggal & waktu publikasi
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="input w-full max-w-xs text-sm"
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={handleAdminSchedule}
                      disabled={saving || !scheduleDate}
                      className="flex items-center gap-1.5 rounded-[12px] bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <CalendarClock size={14} />
                      Konfirmasi Jadwal
                    </button>
                    <button
                      onClick={() => { setShowSchedule(false); setScheduleDate(""); }}
                      className="rounded-[12px] px-4 py-2 text-sm font-medium text-txt-secondary hover:bg-surface-secondary"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {showReturnNote && (
                <div className="rounded-[12px] border border-yellow-300 bg-yellow-50 p-4 mt-3">
                  <label className="mb-1 block text-sm font-medium text-yellow-800">
                    Catatan untuk editor
                  </label>
                  <textarea
                    value={returnNote}
                    onChange={(e) => setReturnNote(e.target.value)}
                    rows={3}
                    placeholder="Tuliskan catatan mengapa artikel dikembalikan..."
                    className="input w-full text-sm"
                    autoFocus
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={handleAdminReturnToEditor}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-[12px] bg-yellow-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-600 disabled:opacity-50"
                    >
                      <Undo2 size={14} />
                      Konfirmasi Kembalikan
                    </button>
                    <button
                      onClick={() => { setShowReturnNote(false); setReturnNote(""); }}
                      className="rounded-[12px] px-4 py-2 text-sm font-medium text-txt-secondary hover:bg-surface-secondary"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {currentStatus === "PUBLISHED" && (
          <div className="mb-6 rounded-[12px] border border-primary/30 bg-primary-50 p-5">
            <h3 className="flex items-center gap-2 text-base font-bold text-primary-dark">
              <CheckCircle size={18} />
              Artikel Sudah Dipublikasikan
            </h3>
          </div>
        )}

        {currentStatus === "IN_REVIEW" && (
          <div className="mb-6 rounded-[12px] border border-yellow-300 bg-yellow-50 p-5">
            <h3 className="flex items-center gap-2 text-base font-bold text-yellow-800">
              <MessageSquare size={18} />
              Artikel Sedang Direview oleh Editor
            </h3>
            <p className="mt-1 text-sm text-yellow-600">
              Editor: {existingReviewerName || "Belum ditugaskan"}
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={async () => {
                    const ok = await confirm({ message: "Setujui artikel ini? Artikel akan berpindah ke status Approved.", variant: "warning", title: "Konfirmasi" });
                    if (!ok) return;
                    setSaving(true);
                    try {
                      const res = await fetch(`/api/articles/${articleId}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "APPROVED", reviewNote: approveNote || null }),
                      });
                      const d = await res.json();
                      if (!d.success) { setError(d.error || "Gagal menyetujui artikel"); setSaving(false); return; }
                      success("Artikel berhasil disetujui");
                      router.push("/panel/artikel");
                      router.refresh();
                    } catch { setError("Terjadi kesalahan."); setSaving(false); }
                  }}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-[12px] bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle size={16} />
                  Approve
                </button>
                <button
                  onClick={handleAdminPublish}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-[12px] bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                >
                  <Upload size={16} />
                  Publikasi Langsung
                </button>
                <button
                  onClick={() => { setReviewChoice(reviewChoice === "reject" ? null : "reject"); }}
                  className="flex items-center gap-1.5 rounded-[12px] border border-red-300 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  <XCircle size={16} />
                  Tolak
                </button>
              </div>

              {reviewChoice === "reject" && (
                <div className="rounded-[12px] border border-red-300 bg-red-50 p-4 mt-3">
                  <label className="mb-1 block text-sm font-medium text-red-800">
                    Alasan penolakan (wajib)
                  </label>
                  <textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    rows={3}
                    placeholder="Tuliskan alasan penolakan..."
                    className="input w-full text-sm"
                    autoFocus
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if (!rejectNote.trim()) { setError("Alasan penolakan wajib diisi"); return; }
                        const ok = await confirm({ message: "Tolak artikel ini? Artikel akan dikembalikan ke penulis.", variant: "danger", title: "Konfirmasi" });
                        if (!ok) return;
                        setSaving(true);
                        try {
                          const res = await fetch(`/api/articles/${articleId}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: "REJECTED", reviewNote: rejectNote }),
                          });
                          const d = await res.json();
                          if (!d.success) { setError(d.error || "Gagal menolak artikel"); setSaving(false); return; }
                          success("Artikel ditolak dan dikembalikan ke penulis");
                          router.push("/panel/artikel");
                          router.refresh();
                        } catch { setError("Terjadi kesalahan."); setSaving(false); }
                      }}
                      disabled={saving || !rejectNote.trim()}
                      className="flex items-center gap-1.5 rounded-[12px] bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircle size={14} />
                      Konfirmasi Tolak
                    </button>
                    <button
                      onClick={() => { setReviewChoice(null); setRejectNote(""); }}
                      className="rounded-[12px] px-4 py-2 text-sm font-medium text-txt-secondary hover:bg-surface-secondary"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Riwayat Revisi link */}
        <div className="mb-6">
          <Link
            href={`/panel/artikel/${articleId}/revisions`}
            className="inline-flex items-center gap-1.5 rounded-[12px] border border-border bg-surface px-4 py-2.5 text-sm font-medium text-txt-primary hover:bg-surface-secondary transition-colors"
          >
            <History size={16} className="text-primary" />
            Riwayat Revisi
          </Link>
        </div>

        {/* Editable article content */}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul Artikel"
              className="input w-full px-4 py-3 text-xl font-bold"
            />
            <div className="rounded-[12px] border border-border overflow-hidden">
              <RichTextEditor content={content} onChange={setContent} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[12px] border border-border bg-surface p-4">
              <label className="mb-2 block text-xs font-medium text-txt-muted uppercase tracking-wider">Kategori</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input w-full">
                <option value="">Pilih kategori</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="rounded-[12px] border border-border bg-surface p-4">
              <label className="mb-2 block text-xs font-medium text-txt-muted uppercase tracking-wider">Tags</label>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className="input w-full" placeholder="Tag1, Tag2, Tag3" />
            </div>
            <div className="rounded-[12px] border border-border bg-surface p-4">
              <label className="mb-2 block text-xs font-medium text-txt-muted uppercase tracking-wider">Ringkasan</label>
              <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} className="input w-full" rows={3} placeholder="Ringkasan artikel..." />
            </div>
            {featuredImage && (
              <div className="rounded-[12px] border border-border bg-surface p-4">
                <label className="mb-2 block text-xs font-medium text-txt-muted uppercase tracking-wider">Gambar Utama</label>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={featuredImage} alt="Featured" className="mt-1 max-h-48 rounded-[8px] object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: EDITOR VIEW
  // ============================================================
  if (viewMode === "editor") {
    // Not assigned to this editor
    if (currentStatus === "IN_REVIEW" && !isAssignedEditor && !isAdmin) {
      return (
        <div className="mx-auto max-w-5xl">
          <button
            onClick={() => router.push("/panel/artikel")}
            className="mb-4 flex items-center gap-1 text-xs text-txt-secondary hover:text-txt-primary"
          >
            <ArrowLeft size={14} /> Kembali
          </button>
          <div className="flex min-h-[30vh] flex-col items-center justify-center text-center">
            <Lock size={48} className="mb-4 text-yellow-400" />
            <h1 className="text-xl font-bold text-txt-primary">Artikel ini tidak ditugaskan kepada Anda</h1>
            <p className="mt-2 text-sm text-txt-secondary">
              Artikel ini sedang direview oleh editor lain ({existingReviewerName || "tidak diketahui"}).
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <button
            onClick={() => router.push("/panel/artikel")}
            className="mb-1 flex items-center gap-1 text-xs text-txt-secondary hover:text-txt-primary"
          >
            <ArrowLeft size={14} /> Kembali ke Daftar Artikel
          </button>
          <h1 className="text-lg sm:text-2xl font-bold text-txt-primary">
            Review Artikel
          </h1>
          <p className="text-sm text-txt-secondary">
            Status: <span className="font-medium text-gold">{statusLabel[currentStatus] || currentStatus}</span>
            {" | "}Penulis: <span className="font-medium">{articleAuthorName}</span>
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-[12px] bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Editor Review Panel - IN_REVIEW */}
        {currentStatus === "IN_REVIEW" && isAssignedEditor && (
          <div className="mb-6 rounded-[12px] border-2 border-yellow-300 bg-yellow-50 p-5">
            <h3 className="flex items-center gap-2 text-base font-bold text-yellow-800">
              <MessageSquare size={18} />
              Panel Review Editor
            </h3>
            <p className="mt-1 text-sm text-yellow-600">
              Periksa artikel di bawah, kemudian pilih salah satu aksi.
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Approve Card */}
              <div
                onClick={() => { setReviewChoice("approve"); setRejectNote(""); }}
                className={`cursor-pointer rounded-[12px] border-2 p-4 transition-all ${
                  reviewChoice === "approve"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-white hover:border-primary/50"
                } ${reviewChoice === "reject" ? "opacity-40 pointer-events-none" : ""}`}
              >
                <div className="flex items-center gap-2 text-primary font-bold">
                  <CheckCircle size={20} />
                  Setujui
                </div>
                <p className="mt-1 text-xs text-txt-secondary">Artikel memenuhi standar. Teruskan untuk publikasi.</p>
                {reviewChoice === "approve" && (
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-txt-secondary">
                      Catatan (opsional)
                    </label>
                    <textarea
                      value={approveNote}
                      onChange={(e) => setApproveNote(e.target.value)}
                      rows={2}
                      placeholder="Catatan untuk penulis..."
                      className="input w-full text-sm"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
              </div>

              {/* Reject Card */}
              <div
                onClick={() => { setReviewChoice("reject"); setApproveNote(""); }}
                className={`cursor-pointer rounded-[12px] border-2 p-4 transition-all ${
                  reviewChoice === "reject"
                    ? "border-red-500 bg-red-500/5"
                    : "border-border bg-white hover:border-red-300"
                } ${reviewChoice === "approve" ? "opacity-40 pointer-events-none" : ""}`}
              >
                <div className="flex items-center gap-2 text-red-600 font-bold">
                  <XCircle size={20} />
                  Tolak
                </div>
                <p className="mt-1 text-xs text-txt-secondary">Artikel perlu diperbaiki. Kembalikan ke penulis dengan catatan.</p>
                {reviewChoice === "reject" && (
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-red-700">
                      Alasan penolakan (wajib)
                    </label>
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      rows={2}
                      placeholder="Jelaskan alasan penolakan..."
                      className="input w-full text-sm border-red-200"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Reset choice */}
            {reviewChoice && (
              <button
                onClick={() => { setReviewChoice(null); setApproveNote(""); setRejectNote(""); }}
                className="mt-3 text-xs text-txt-muted hover:text-txt-secondary underline"
              >
                Reset pilihan
              </button>
            )}

            {/* Submit button */}
            {reviewChoice && (
              <div className="mt-4">
                <button
                  onClick={reviewChoice === "approve" ? handleEditorApprove : handleEditorReject}
                  disabled={saving || (reviewChoice === "reject" && !rejectNote.trim())}
                  className={`flex items-center gap-1.5 rounded-[12px] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                    reviewChoice === "approve"
                      ? "bg-primary hover:bg-primary-dark"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {reviewChoice === "approve" ? (
                    <>
                      <CheckCircle size={16} />
                      Konfirmasi Setujui
                    </>
                  ) : (
                    <>
                      <XCircle size={16} />
                      Konfirmasi Tolak
                    </>
                  )}
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Editor APPROVED — Publish or Cancel */}
        {currentStatus === "APPROVED" && isAssignedEditor && (
          <div className="mb-6 rounded-[12px] border-2 border-primary/30 bg-primary-50 p-5">
            <h3 className="flex items-center gap-2 text-base font-bold text-primary-dark">
              <CheckCircle size={18} />
              Artikel Telah Disetujui — Siap Dipublikasi
            </h3>
            <p className="mt-1 text-sm text-primary">
              Artikel siap dipublikasi. Anda dapat mempublikasi atau membatalkan persetujuan.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={handleEditorPublish}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-[12px] bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                <Upload size={16} />
                Publikasi Sekarang
              </button>
              <button
                onClick={handleEditorCancelApproval}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-[12px] border border-yellow-300 bg-yellow-50 px-4 py-2.5 text-sm font-semibold text-yellow-700 hover:bg-yellow-100 disabled:opacity-50"
              >
                <Undo2 size={16} />
                Batalkan Persetujuan
              </button>
            </div>
          </div>
        )}

        {currentStatus === "PUBLISHED" && (
          <div className="mb-6 rounded-[12px] border border-primary/30 bg-primary-50 p-5">
            <h3 className="flex items-center gap-2 text-base font-bold text-primary-dark">
              <CheckCircle size={18} />
              Artikel Telah Dipublikasikan
            </h3>
          </div>
        )}

        {/* Riwayat Revisi link (editor view) */}
        <div className="mb-6">
          <Link
            href={`/panel/artikel/${articleId}/revisions`}
            className="inline-flex items-center gap-1.5 rounded-[12px] border border-border bg-surface px-4 py-2.5 text-sm font-medium text-txt-primary hover:bg-surface-secondary transition-colors"
          >
            <History size={16} className="text-primary" />
            Riwayat Revisi
          </Link>
        </div>

        {/* Editable article content — editor can edit like journalist */}
        {currentStatus === "IN_REVIEW" && isAssignedEditor ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Main content — 2/3 */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-[12px] border border-border bg-surface p-5">
                <label className="mb-2 block text-sm font-medium text-txt-primary">Judul</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input w-full text-lg font-bold" />
              </div>
              <div className="rounded-[12px] border border-border bg-surface p-5">
                <label className="mb-2 block text-sm font-medium text-txt-primary">Konten</label>
                <div className="rounded-[12px] border border-border overflow-hidden">
                  <RichTextEditor content={content} onChange={setContent} />
                  <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-sm text-txt-muted">
                    <span>{wordCount} kata</span>
                    <span className="text-border">|</span>
                    <span>{charCount} karakter</span>
                    <span className="text-border">|</span>
                    <span>{readTime} menit baca</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Sidebar — 1/3 */}
            <div className="space-y-4">
              <div className="rounded-[12px] border border-border bg-surface p-5">
                <label className="mb-2 block text-sm font-medium text-txt-primary">Kategori</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input w-full">
                  <option value="">Pilih kategori</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="rounded-[12px] border border-border bg-surface p-5">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-txt-primary">Tags</label>
                  <button
                    type="button"
                    onClick={generateTagsAI}
                    disabled={generatingTags || !title.trim() || !content.trim()}
                    className="btn-secondary text-sm flex items-center gap-1.5"
                  >
                    {generatingTags ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Generate Tags AI
                  </button>
                </div>
                <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className="input w-full" placeholder="Tag1, Tag2, Tag3" />
                <p className="mt-1 text-xs text-txt-muted">Pisahkan dengan koma</p>
              </div>
              <div className="rounded-[12px] border border-border bg-surface p-5">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-txt-primary">Ringkasan</label>
                  <AiButton feature="summary" setter={setExcerpt} />
                </div>
                <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} className="input w-full" placeholder="Ringkasan singkat artikel" maxLength={500} />
              </div>
              <div className="rounded-[12px] border border-border bg-surface p-5">
                <label className="mb-2 block text-sm font-medium text-txt-primary">Gambar Utama</label>
                <ImageUploader onUpload={(url: string) => setFeaturedImage(url)} currentImage={featuredImage} />
                <div className="mt-2">
                  <input type="url" value={featuredImage} onChange={(e) => setFeaturedImage(e.target.value)} placeholder="Atau paste URL gambar" className="input w-full text-xs" />
                </div>
                {featuredImage && !featuredImage.startsWith("data:") && (
                  <Image src={featuredImage} alt="Preview" width={800} height={400} className="mt-2 w-full rounded-[8px] object-cover" style={{ maxHeight: 200 }} unoptimized />
                )}
              </div>
              <div className="rounded-[12px] border border-border bg-surface p-5">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-txt-primary">SEO Title</label>
                  <AiButton feature="seo_title" setter={setSeoTitle} />
                </div>
                <input type="text" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className="input w-full" placeholder="SEO Title (maks 60 karakter)" maxLength={60} />
                <p className="mt-1 text-xs text-txt-muted">{seoTitle.length}/60</p>
              </div>
              <div className="rounded-[12px] border border-border bg-surface p-5">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-txt-primary">Meta Description</label>
                  <AiButton feature="meta_description" setter={setSeoDescription} />
                </div>
                <textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={2} className="input w-full" placeholder="Meta description (maks 155 karakter)" maxLength={155} />
                <p className="mt-1 text-xs text-txt-muted">{seoDescription.length}/155</p>
              </div>
              <button
                onClick={async () => {
                  setSaving(true);
                  setError("");
                  try {
                    const res = await fetch(`/api/articles/${articleId}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ title, content, excerpt, categoryId, featuredImage, seoTitle, seoDescription, tags: tags.split(",").map(t => t.trim()).filter(Boolean) }),
                    });
                    if (res.ok) {
                      clearAutosave();
                      success("Artikel berhasil disimpan");
                    } else {
                      const json = await res.json();
                      setError(json.error || "Gagal menyimpan");
                    }
                  } catch { setError("Terjadi kesalahan"); }
                  setSaving(false);
                }}
                disabled={saving}
                className="btn-primary w-full flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Save size={16} />
                Simpan Perubahan
              </button>
            </div>
          </div>
        ) : (
          /* Read-only for non-assigned or non-IN_REVIEW status */
          <div className="space-y-4">
            <div className="rounded-[12px] border border-border bg-surface p-5">
              <label className="mb-1 block text-xs font-medium text-txt-muted uppercase tracking-wider">Judul</label>
              <p className="text-lg font-bold text-txt-primary">{title}</p>
            </div>
            <div className="rounded-[12px] border border-border bg-surface p-5">
              <label className="mb-1 block text-xs font-medium text-txt-muted uppercase tracking-wider">Kategori</label>
              <p className="text-sm text-txt-primary">{categories.find(c => c.id === categoryId)?.name || categoryId}</p>
            </div>
            {excerpt && (
              <div className="rounded-[12px] border border-border bg-surface p-5">
                <label className="mb-1 block text-xs font-medium text-txt-muted uppercase tracking-wider">Ringkasan</label>
                <p className="text-sm text-txt-primary">{excerpt}</p>
              </div>
            )}
            {featuredImage && (
              <div className="rounded-[12px] border border-border bg-surface p-5">
                <label className="mb-1 block text-xs font-medium text-txt-muted uppercase tracking-wider">Gambar Utama</label>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={featuredImage} alt="Featured" className="mt-2 max-h-64 rounded-[8px] object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
            <div className="rounded-[12px] border border-border bg-surface p-5">
              <label className="mb-2 block text-xs font-medium text-txt-muted uppercase tracking-wider">Konten</label>
              <div className="prose prose-sm max-w-none text-txt-primary text-justify" dangerouslySetInnerHTML={{ __html: content }} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // RENDER: JOURNALIST VIEW (article owner)
  // ============================================================
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            onClick={() => router.push("/panel/artikel")}
            className="mb-1 flex items-center gap-1 text-xs text-txt-secondary hover:text-txt-primary"
          >
            <ArrowLeft size={14} /> Kembali ke Daftar Artikel
          </button>
          <h1 className="text-lg sm:text-2xl font-bold text-txt-primary">
            Edit Artikel
          </h1>
          <p className="text-sm text-txt-secondary">
            Status saat ini: <span className="font-medium text-gold">{statusLabel[currentStatus] || currentStatus}</span>
          </p>
        </div>
        {/* Action buttons only for editable states */}
        {canJurnalisEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {autoSaveIndicator && (
              <span className="text-xs text-txt-muted">{autoSaveIndicator}</span>
            )}
            <button
              onClick={() => handleJurnalisSubmit("DRAFT")}
              disabled={saving}
              className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              <Save size={16} />
              Simpan Draf
            </button>
            {CAN_SUBMIT_REVIEW.includes(userRole) && (
              <button
                onClick={() => handleJurnalisSubmit("IN_REVIEW")}
                disabled={saving}
                className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                <Send size={16} />
                Kirim untuk Review
              </button>
            )}
          </div>
        )}
      </div>

      {/* Export buttons */}
      {title && content && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-txt-muted uppercase tracking-wider">Export:</span>
          <button
            onClick={handleExportPdf}
            className="btn-ghost flex items-center gap-1.5 rounded-[12px] px-3 py-1.5 text-xs font-medium text-txt-secondary hover:text-txt-primary"
          >
            <Printer size={14} />
            Export PDF
          </button>
          <button
            onClick={handleExportText}
            className="btn-ghost flex items-center gap-1.5 rounded-[12px] px-3 py-1.5 text-xs font-medium text-txt-secondary hover:text-txt-primary"
          >
            <FileText size={14} />
            Export Teks
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-[12px] bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* REJECTED: Show editor's rejection note */}
      {currentStatus === "REJECTED" && existingReviewNote && (
        <div className="mb-4 rounded-[12px] border-2 border-red-300 bg-red-50 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-red-700">
            <XCircle size={16} />
            Artikel Ditolak oleh Editor
          </h3>
          <p className="mt-2 text-sm text-red-600 font-medium">{existingReviewNote}</p>
          <div className="mt-2 flex items-center gap-4 text-xs text-red-400">
            {existingReviewerName && (
              <span className="flex items-center gap-1">
                <User size={12} />
                Editor: {existingReviewerName}
              </span>
            )}
            {existingReviewedAt && (
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {new Date(existingReviewedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
          <p className="mt-3 text-xs text-red-500">
            Silakan perbaiki artikel sesuai catatan editor, kemudian kirim kembali untuk review.
          </p>
        </div>
      )}

      {/* IN_REVIEW: Article locked, show who is reviewing */}
      {currentStatus === "IN_REVIEW" && isOwner && (
        <div className="mb-4 rounded-[12px] border-2 border-yellow-300 bg-yellow-50 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-yellow-800">
            <Lock size={16} />
            Artikel Sedang Direview
          </h3>
          <p className="mt-1 text-sm text-yellow-600">
            Artikel sedang direview oleh <span className="font-semibold">{existingReviewerName || "editor"}</span>.
            Anda tidak dapat mengedit artikel selama proses review.
          </p>
          <button
            onClick={handleCancelReview}
            disabled={saving}
            className="mt-3 flex items-center gap-1.5 rounded-[12px] border border-yellow-400 bg-white px-4 py-2 text-sm font-semibold text-yellow-700 hover:bg-yellow-100 disabled:opacity-50"
          >
            <Undo2 size={16} />
            Batalkan Review
          </button>
        </div>
      )}

      {/* APPROVED: Article locked */}
      {currentStatus === "APPROVED" && isOwner && (
        <div className="mb-4 rounded-[12px] border border-blue-200 bg-blue-50 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-700">
            <CheckCircle size={16} />
            Artikel Telah Disetujui
          </h3>
          <p className="mt-1 text-sm text-blue-600">
            Artikel telah disetujui oleh editor. Artikel siap dipublikasi.
          </p>
          {existingReviewNote && (
            <p className="mt-2 text-sm text-blue-500">Catatan editor: {existingReviewNote}</p>
          )}
        </div>
      )}

      {/* PUBLISHED: Article locked */}
      {currentStatus === "PUBLISHED" && isOwner && (
        <div className="mb-4 rounded-[12px] border border-primary/30 bg-primary-50 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-primary-dark">
            <CheckCircle size={16} />
            Artikel Telah Dipublikasikan
          </h3>
        </div>
      )}

      {/* Riwayat Revisi link (journalist view) */}
      <div className="mb-4">
        <Link
          href={`/panel/artikel/${articleId}/revisions`}
          className="inline-flex items-center gap-1.5 rounded-[12px] border border-border bg-surface px-4 py-2.5 text-sm font-medium text-txt-primary hover:bg-surface-secondary transition-colors"
        >
          <History size={16} className="text-primary" />
          Riwayat Revisi
        </Link>
      </div>

      {/* Article content — editable only when DRAFT or REJECTED */}
      {canJurnalisEdit ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main editor */}
          <div className="space-y-4 lg:col-span-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul Artikel"
              className="input w-full px-4 py-3 text-xl font-bold"
            />
            <div className="rounded-[12px] border border-border overflow-hidden">
              <RichTextEditor content={content} onChange={setContent} />
              <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-sm text-txt-muted">
                <span>{wordCount} kata</span>
                <span className="text-border">|</span>
                <span>{charCount} karakter</span>
                <span className="text-border">|</span>
                <span>{readTime} menit baca</span>
              </div>
            </div>
            {/* Sources */}
            <div className="rounded-[12px] border border-border bg-surface p-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-txt-primary uppercase tracking-wider">
                  Sumber & Narasumber
                </h3>
                <button type="button" onClick={addSource} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Plus size={14} /> Tambah Sumber
                </button>
              </div>
              <div className="space-y-3">
                {sources.map((source, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-[12px] border border-border p-3">
                    <input type="text" placeholder="Nama narasumber *" value={source.name} onChange={(e) => updateSource(i, "name", e.target.value)} className="input text-sm" />
                    <input type="text" placeholder="Jabatan" value={source.title} onChange={(e) => updateSource(i, "title", e.target.value)} className="input text-sm" />
                    <input type="text" placeholder="Institusi" value={source.institution} onChange={(e) => updateSource(i, "institution", e.target.value)} className="input text-sm" />
                    <div className="flex gap-2">
                      <input type="url" placeholder="URL referensi" value={source.url} onChange={(e) => updateSource(i, "url", e.target.value)} className="input flex-1 text-sm" />
                      {sources.length > 1 && (
                        <button type="button" onClick={() => removeSource(i)} className="rounded p-1.5 text-red-400 hover:bg-red-50">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* SEO Settings */}
            <div className="rounded-[12px] border border-border bg-surface">
              <button type="button" onClick={() => setShowSeo(!showSeo)} className="flex w-full items-center justify-between px-6 py-3 text-sm font-medium text-txt-primary uppercase tracking-wider">
                Pengaturan SEO
                <ChevronDown size={16} className={showSeo ? "rotate-180" : ""} />
              </button>
              {showSeo && (
                <div className="space-y-3 border-t border-border px-6 py-4">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-sm font-medium text-txt-primary">SEO Title ({seoTitle.length}/70)</label>
                      <AiButton feature="seo_title" setter={setSeoTitle} />
                    </div>
                    <input type="text" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={70} placeholder={title || "Judul untuk mesin pencari"} className="input w-full text-sm" />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-sm font-medium text-txt-primary">Meta Description ({seoDescription.length}/160)</label>
                      <AiButton feature="meta_description" setter={setSeoDescription} />
                    </div>
                    <textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} maxLength={160} rows={2} placeholder="Deskripsi singkat untuk hasil pencarian" className="input w-full text-sm" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="rounded-[12px] border border-border bg-surface p-6">
              <label className="mb-2 block text-sm font-medium text-txt-primary">Kategori *</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input w-full">
                <option value="">Pilih Kategori</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            {/* Pilih Penulis — only for admin/editor */}
            {EDITOR_ROLES.includes(userRole) && (
              <div className="rounded-[12px] border border-border bg-surface p-6">
                <label className="mb-2 block text-sm font-medium text-txt-primary">
                  Penulis
                </label>
                <select
                  value={selectedAuthorId}
                  onChange={(e) => setSelectedAuthorId(e.target.value)}
                  className="input w-full"
                >
                  <option value="">Saya sendiri</option>
                  {allUsers
                    .filter(u => ["JOURNALIST", "SENIOR_JOURNALIST", "CONTRIBUTOR", "EDITOR", "CHIEF_EDITOR", "SUPER_ADMIN"].includes(u.role))
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({roleLabelsMap[u.role] || u.role})</option>
                    ))
                  }
                </select>
              </div>
            )}
            {/* Pilih Editor — for all roles */}
            <div className="rounded-[12px] border border-border bg-surface p-6">
              <label className="mb-2 block text-sm font-medium text-txt-primary">
                Editor
              </label>
              <select
                value={selectedEditorId}
                onChange={(e) => setSelectedEditorId(e.target.value)}
                className="input w-full"
              >
                <option value="">Otomatis (random)</option>
                {allUsers
                  .filter(u => ["EDITOR", "CHIEF_EDITOR", "SUPER_ADMIN"].includes(u.role))
                  .map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({roleLabelsMap[u.role] || u.role})</option>
                  ))
                }
              </select>
            </div>
            <div className="rounded-[12px] border border-border bg-surface p-6">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-txt-primary">Tags</label>
                <AiButton feature="tags" setter={setTags} />
              </div>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tag1, Tag2, Tag3" className="input w-full" />
              <p className="mt-1 text-xs text-txt-muted">Pisahkan dengan koma</p>
            </div>
            <div className="rounded-[12px] border border-border bg-surface p-6">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-txt-primary">Ringkasan</label>
                <AiButton feature="summary" setter={setExcerpt} />
              </div>
              <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} placeholder="Ringkasan singkat artikel" maxLength={500} className="input w-full" />
            </div>
            <div className="rounded-[12px] border border-border bg-surface p-6">
              <label className="mb-2 block text-sm font-medium text-txt-primary">Gambar Utama</label>
              <ImageUploader onUpload={(url: string) => setFeaturedImage(url)} currentImage={featuredImage} />
              <div className="mt-2">
                <input type="url" value={featuredImage} onChange={(e) => setFeaturedImage(e.target.value)} placeholder="Atau paste URL gambar" className="input w-full text-xs" />
              </div>
              {featuredImage && !featuredImage.startsWith("data:") && (
                <Image src={featuredImage} alt="Preview" width={800} height={400} className="mt-2 w-full rounded-[8px] object-cover" style={{ maxHeight: 200 }} unoptimized />
              )}
            </div>
            {/* Journalism Checklist */}
            <div className="rounded-[12px] border border-primary/20 bg-primary-50 p-4">
              <button type="button" onClick={() => setShowChecklist(!showChecklist)} className="flex w-full items-center justify-between text-sm font-bold text-primary-dark">
                <span className="flex items-center gap-1.5">
                  <CheckCircle size={16} />
                  Checklist Jurnalistik
                </span>
                <ChevronDown size={14} className={showChecklist ? "rotate-180" : ""} />
              </button>
              {showChecklist && (
                <div className="mt-3 space-y-2">
                  {[
                    { key: "notClickbait" as const, label: "Judul tidak clickbait / sensasional berlebihan" },
                    { key: "hasSource" as const, label: "Minimal 1 sumber terverifikasi" },
                    { key: "balanced" as const, label: "Cover both sides (perspektif berimbang)" },
                    { key: "noSara" as const, label: "Tidak mengandung unsur SARA" },
                    { key: "properLanguage" as const, label: "Bahasa sesuai PUEBI" },
                  ].map((item) => (
                    <label key={item.key} className="flex items-start gap-2 text-xs text-primary">
                      <input
                        type="checkbox"
                        checked={checklist[item.key]}
                        onChange={(e) => setChecklist({ ...checklist, [item.key]: e.target.checked })}
                        className="mt-0.5 rounded"
                      />
                      {item.label}
                    </label>
                  ))}
                  {allChecked && (
                    <p className="mt-2 flex items-center gap-1 text-xs font-medium text-primary">
                      <CheckCircle size={12} /> Semua checklist terpenuhi
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Catatan Riset */}
            <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
              <button
                onClick={() => setNotesOpen(!notesOpen)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-txt-primary hover:bg-surface-secondary"
              >
                <span className="flex items-center gap-2">
                  <StickyNote size={16} className="text-yellow-500" />
                  Catatan Riset
                </span>
                <ChevronDown size={16} className={`transition-transform ${notesOpen ? "rotate-180" : ""}`} />
              </button>
              {notesOpen && (
                <div className="px-4 pb-4">
                  <textarea
                    value={researchNotes}
                    onChange={(e) => setResearchNotes(e.target.value)}
                    className="input w-full resize-none text-sm"
                    rows={6}
                    placeholder="Catatan wawancara, referensi, kutipan yang belum dipakai... (tersimpan otomatis, tidak ikut terpublikasi)"
                  />
                  <p className="mt-1 text-xs text-txt-muted">Catatan ini hanya tersimpan di browser Anda</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Read-only view for locked articles */
        <div className="space-y-4">
          <div className="rounded-[12px] border border-border bg-surface p-5">
            <label className="mb-1 block text-xs font-medium text-txt-muted uppercase tracking-wider">Judul</label>
            <p className="text-lg font-bold text-txt-primary">{title}</p>
          </div>
          <div className="rounded-[12px] border border-border bg-surface p-5">
            <label className="mb-1 block text-xs font-medium text-txt-muted uppercase tracking-wider">Kategori</label>
            <p className="text-sm text-txt-primary">{categories.find(c => c.id === categoryId)?.name || categoryId}</p>
          </div>
          {excerpt && (
            <div className="rounded-[12px] border border-border bg-surface p-5">
              <label className="mb-1 block text-xs font-medium text-txt-muted uppercase tracking-wider">Ringkasan</label>
              <p className="text-sm text-txt-primary">{excerpt}</p>
            </div>
          )}
          {featuredImage && (
            <div className="rounded-[12px] border border-border bg-surface p-5">
              <label className="mb-1 block text-xs font-medium text-txt-muted uppercase tracking-wider">Gambar Utama</label>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={featuredImage} alt="Featured" className="mt-2 max-h-64 rounded-[8px] object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}
          <div className="rounded-[12px] border border-border bg-surface p-5">
            <label className="mb-2 block text-xs font-medium text-txt-muted uppercase tracking-wider">Konten</label>
            <div className="prose prose-sm max-w-none text-txt-primary text-justify" dangerouslySetInnerHTML={{ __html: content }} />
          </div>
        </div>
      )}
    </div>
  );
}
