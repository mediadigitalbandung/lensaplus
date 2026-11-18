"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toLocalDatetimeInputValue } from "@/lib/utils";
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
  ExternalLink,
  Archive,
  ArrowDownToLine,
  TrendingUp,
  ImageIcon,
} from "lucide-react";
import { stripHtml, downloadTextFile, exportArticlePdf } from "@/lib/export-utils";
import { stripAttributionFooter } from "@/lib/scraper/source-label";
import DOMPurify from "isomorphic-dompurify";
import ImageUploader from "@/components/editor/ImageUploader";
import ImagePickerModal, { type PickedImage } from "@/components/editor/ImagePickerModal";

const RichTextEditor = dynamic(
  () => import("@/components/editor/RichTextEditor"),
  { ssr: false, loading: () => <div className="h-[500px] animate-pulse rounded-lg bg-surface-secondary" /> }
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

import { EDITOR_ROLES, CAN_SUBMIT_REVIEW, roleLabelsMap } from "@/lib/roles";
import PerplexityResearchPanel from "@/components/editor/PerplexityResearchPanel";

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="h-7 w-48 rounded-lg bg-surface-tertiary" />
          <div className="mt-2 h-4 w-48 sm:w-64 rounded-lg bg-surface-secondary" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded-lg bg-surface-tertiary" />
          <div className="h-10 w-40 rounded-lg bg-surface-tertiary" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="h-14 rounded-lg bg-surface-tertiary" />
          <div className="h-[500px] rounded-lg bg-surface-tertiary" />
          <div className="h-40 rounded-lg bg-surface-tertiary" />
        </div>
        <div className="space-y-4">
          <div className="h-24 rounded-lg bg-surface-tertiary" />
          <div className="h-24 rounded-lg bg-surface-tertiary" />
          <div className="h-32 rounded-lg bg-surface-tertiary" />
          <div className="h-24 rounded-lg bg-surface-tertiary" />
          <div className="h-24 rounded-lg bg-surface-tertiary" />
        </div>
      </div>
    </div>
  );
}

export default function EditArticlePage() {
  const router = useRouter();
  const params = useParams();
  const articleId = params.id as string;
  const { data: session, status: sessionStatus } = useSession();
  const { success, error: showError } = useToast();
  const { confirm } = useConfirm();
  const userRole = session?.user?.role || "";
  const userId = session?.user?.id || "";
  const isEditor = EDITOR_ROLES.includes(userRole);
  const isAdmin = ["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"].includes(userRole);

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
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [showAutosaveBanner, setShowAutosaveBanner] = useState(false);
  // Perplexity research-and-draft
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentStatus, setCurrentStatus] = useState("");
  const [articleSlug, setArticleSlug] = useState("");
  const [existingReviewNote, setExistingReviewNote] = useState("");
  const [existingReviewedBy, setExistingReviewedBy] = useState("");
  const [existingReviewerName, setExistingReviewerName] = useState("");
  const [existingReviewedAt, setExistingReviewedAt] = useState("");
  const [existingApproverName, setExistingApproverName] = useState("");
  const [existingApprovedAt, setExistingApprovedAt] = useState("");
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
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSnapshotRef = useRef<string>("");
  const isMountedRef = useRef(false);
  const AUTOSAVE_KEY = `autosave_draft_${articleId}`;
  const AUTOSAVE_INTERVAL = 15000;

  // Research notes state
  const [researchNotes, setResearchNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const notesLoadedRef = useRef(false);

  // Trending Suggestions state
  const [trendingSuggestions, setTrendingSuggestions] = useState<{ label: string; hot: boolean }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Word counter calculations
  const plainText = content.replace(/<[^>]*>/g, "").trim();
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;
  const charCount = plainText.length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  // Build a stable snapshot of the editable fields used for dirty-detection
  const buildSnapshot = useCallback(() => {
    return JSON.stringify({
      title,
      content,
      excerpt,
      categoryId,
      tags,
      featuredImage,
      seoTitle,
      seoDescription,
      sources,
      assignedEditorId: selectedEditorId,
    });
  }, [title, content, excerpt, categoryId, tags, featuredImage, seoTitle, seoDescription, sources, selectedEditorId]);

  // Mark snapshot as clean when article first loads
  useEffect(() => {
    if (!loading && !isMountedRef.current && (title || content)) {
      lastSnapshotRef.current = buildSnapshot();
      isMountedRef.current = true;
    }
  }, [loading, title, content, buildSnapshot]);

  // Track form dirtiness
  useEffect(() => {
    if (!isMountedRef.current) return;
    const snap = buildSnapshot();
    setFormDirty(snap !== lastSnapshotRef.current);
  }, [buildSnapshot]);

  // Silent draft save — PUT to /api/articles/:id with current values, status DRAFT.
  // Only runs when current status is DRAFT or REJECTED, owner-edit allowed.
  const saveDraft = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      const silent = opts.silent ?? true;
      if (!title.trim() && !content.trim()) return false;
      if (autoSaving) return false;
      try {
        setAutoSaving(true);
        const validSources = sources.filter((s) => s.name.trim());
        const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
        // Only write a status if we are still in a draftable state
        const allowStatusWrite = ["DRAFT", "REJECTED"].includes(currentStatus);
        const body: Record<string, unknown> = {
          title,
          content,
          excerpt: excerpt || undefined,
          categoryId: categoryId || undefined,
          tags: tagList,
          featuredImage: featuredImage || null,
          seoTitle: seoTitle || undefined,
          seoDescription: seoDescription || undefined,
          sources: validSources.length > 0 ? validSources : undefined,
          ...(isAdmin ? { authorId: selectedAuthorId || undefined } : {}),
          assignedEditorId: selectedEditorId || null,
        };
        if (allowStatusWrite) body.status = "DRAFT";
        if (silent) body.isAutosave = true;

        const res = await fetch(`/api/articles/${articleId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          if (!silent) showError("Gagal menyimpan draf otomatis");
          return false;
        }
        const now = new Date();
        setLastSavedAt(now);
        setFormDirty(false);
        lastSnapshotRef.current = buildSnapshot();
        try { localStorage.removeItem(AUTOSAVE_KEY); } catch { /* ignore */ }
        if (!silent) success("Draf tersimpan");
        else setAutoSaveIndicator(`Tersimpan otomatis ${now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`);
        return true;
      } catch {
        if (!silent) showError("Gagal menyimpan draf");
        return false;
      } finally {
        setAutoSaving(false);
      }
    },
    [
      articleId,
      autoSaving,
      buildSnapshot,
      categoryId,
      content,
      currentStatus,
      excerpt,
      featuredImage,
      isAdmin,
      selectedAuthorId,
      seoDescription,
      seoTitle,
      sources,
      success,
      showError,
      tags,
      title,
      selectedEditorId,
      AUTOSAVE_KEY,
    ]
  );

  // Latest-state ref so the 15s autosave timer does not reset on every keystroke
  const latestEditRef = useRef({
    title,
    content,
    categoryId,
    excerpt,
    tags,
    featuredImage,
    sources,
    formDirty,
    autoSaving,
    saveDraft,
  });
  latestEditRef.current = {
    title,
    content,
    categoryId,
    excerpt,
    tags,
    featuredImage,
    sources,
    formDirty,
    autoSaving,
    saveDraft,
  };

  // Auto-save every AUTOSAVE_INTERVAL ms (only DRAFT / REJECTED, owner)
  useEffect(() => {
    if (loading) return;
    const isDraftable = ["DRAFT", "REJECTED"].includes(currentStatus);
    if (!isDraftable) return;
    if (articleAuthorId && articleAuthorId !== userId) return; // only owner autosaves

    autosaveTimerRef.current = setInterval(() => {
      const cur = latestEditRef.current;
      if (cur.formDirty && !cur.autoSaving) {
        try {
          const draft = {
            title: cur.title,
            content: cur.content,
            categoryId: cur.categoryId,
            excerpt: cur.excerpt,
            tags: cur.tags,
            featuredImage: cur.featuredImage,
            sources: cur.sources,
          };
          localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(draft));
        } catch { /* ignore */ }
        cur.saveDraft({ silent: true });
      }
    }, AUTOSAVE_INTERVAL);

    return () => {
      if (autosaveTimerRef.current) clearInterval(autosaveTimerRef.current);
    };
  }, [loading, currentStatus, articleAuthorId, userId, AUTOSAVE_KEY]);

  // Offer local autosave recovery banner when an unsaved local copy exists for editable drafts
  useEffect(() => {
    if (loading) return;
    const isDraftable = ["DRAFT", "REJECTED"].includes(currentStatus);
    if (!isDraftable || (articleAuthorId && articleAuthorId !== userId)) return;
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (raw) setShowAutosaveBanner(true);
    } catch { /* ignore */ }
  }, [loading, currentStatus, articleAuthorId, userId, AUTOSAVE_KEY]);

  const loadAutosaveDraft = () => {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.title) setTitle(draft.title);
      if (draft.content) setContent(draft.content);
      if (draft.categoryId) setCategoryId(draft.categoryId);
      if (draft.excerpt !== undefined) setExcerpt(draft.excerpt);
      if (draft.tags !== undefined) setTags(draft.tags);
      if (draft.featuredImage !== undefined) setFeaturedImage(draft.featuredImage);
      if (Array.isArray(draft.sources) && draft.sources.length > 0) setSources(draft.sources);
      setShowAutosaveBanner(false);
      success("Draf autosave lokal dipulihkan");
    } catch {
      setShowAutosaveBanner(false);
    }
  };

  const discardAutosaveDraft = () => {
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch { /* ignore */ }
    setShowAutosaveBanner(false);
  };

  // beforeunload warning when form has unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (formDirty) {
        e.preventDefault();
        e.returnValue = "Ada perubahan belum tersimpan. Yakin ingin keluar?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [formDirty]);

  // Clear auto-save helper (used after explicit save / submit)
  const clearAutosave = useCallback(() => {
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch { /* ignore */ }
    lastSnapshotRef.current = buildSnapshot();
    setFormDirty(false);
    setShowAutosaveBanner(false);
  }, [AUTOSAVE_KEY, buildSnapshot]);

  // Load research notes from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`research_notes_${params.id}`);
      if (saved) setResearchNotes(saved);
    } catch { /* ignore */ }
    notesLoadedRef.current = true;
  }, [params.id]);

  // Auto-save research notes on change (remove key when cleared)
  useEffect(() => {
    if (!notesLoadedRef.current) return;
    try {
      if (researchNotes) {
        localStorage.setItem(`research_notes_${params.id}`, researchNotes);
      } else {
        localStorage.removeItem(`research_notes_${params.id}`);
      }
    } catch { /* ignore */ }
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
  const [generatingFaq, setGeneratingFaq] = useState(false);
  const [faqCount, setFaqCount] = useState<number | null>(null);

  const handleGenerateFaq = async () => {
    if (!title.trim() || !content.trim()) return;
    setGeneratingFaq(true);
    try {
      const res = await fetch(`/api/articles/${articleId}/generate-faq`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setFaqCount(data.data.generated);
        success(`FAQ berhasil digenerate: ${data.data.generated} pasangan Q&A`);
      } else {
        showError(data.error || "Gagal generate FAQ");
      }
    } catch {
      showError("Gagal menghubungi server");
    } finally {
      setGeneratingFaq(false);
    }
  };

  // Hard caps from server-side Zod schema — keep client output within these so we never trip 400.
  const FEATURE_MAX: Record<string, number> = {
    summary: 500,
    seo_title: 70,
    meta_description: 160,
  };
  const clampToMax = (val: string, max: number): string =>
    val.length <= max ? val : val.slice(0, max - 1).trimEnd() + "…";

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
        const max = FEATURE_MAX[feature];
        setter(max ? clampToMax(data.data.result, max) : data.data.result);
      } else {
        setError(data.error || "Gagal generate AI");
      }
    } catch {
      setError("Gagal menghubungi AI service");
    } finally {
      setAiLoading((prev) => ({ ...prev, [feature]: false }));
    }
  };

  const handleExpandArticle = async () => {
    if (!title.trim() || !content.trim()) {
      setError("Isi judul dan draf awal artikel terlebih dahulu sebelum memperpanjang isi.");
      return;
    }
    setAiLoading((prev) => ({ ...prev, expand_article: true }));
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature: "expand_article", title, content }),
      });
      const data = await res.json();
      if (data.success && data.data?.result) {
        const extra = String(data.data.result).trim();
        setContent((prev) => `${stripAttributionFooter(prev).trimEnd()}\n${extra}`);
        setError("");
        success("Isi artikel berhasil diperpanjang dengan paragraf tambahan AI!");
      } else {
        setError(data.error || "Gagal memperpanjang artikel dengan AI");
      }
    } catch {
      setError("Gagal menghubungi AI service");
    } finally {
      setAiLoading((prev) => ({ ...prev, expand_article: false }));
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


  const researchPanel = (
    <PerplexityResearchPanel
      title={title}
      excerpt={excerpt}
      tags={tags}
      seoTitle={seoTitle}
      seoDescription={seoDescription}
      featuredImage={featuredImage}
      setTitle={setTitle}
      setExcerpt={setExcerpt}
      setTags={setTags}
      setSeoTitle={setSeoTitle}
      setSeoDescription={setSeoDescription}
      setFeaturedImage={setFeaturedImage}
      setContent={setContent}
      setSources={setSources}
      setShowSeo={setShowSeo}
      onError={setError}
      onSuccess={success}
    />
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

      const clamp = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s);
      setTitle(clamp(article.title || "", 255));
      setContent(stripAttributionFooter(article.content || ""));
      setExcerpt(clamp(article.excerpt || "", 500));
      setCategoryId(article.categoryId || article.category?.id || "");
      setTags(article.tags?.map((t: { name: string }) => t.name).join(", ") || "");
      setFeaturedImage(article.featuredImage || "");
      setSeoTitle(clamp(article.seoTitle || "", 70));
      setSeoDescription(clamp(article.seoDescription || "", 160));
      setCurrentStatus(article.status || "DRAFT");
      setArticleSlug(article.slug || "");
      setExistingReviewNote(article.reviewNote || "");
      setExistingReviewedBy(article.reviewedBy || "");
      setExistingReviewerName(article.reviewerName || "");
      setExistingReviewedAt(article.reviewedAt || "");
      setExistingApproverName(article.approverName || "");
      setExistingApprovedAt(article.approvedAt || "");
      setArticleAuthorId(article.authorId || article.author?.id || "");
      setArticleAuthorName(article.author?.name || "");
      setArticleCreatedAt(article.createdAt || "");
      setSelectedAuthorId(article.authorId || article.author?.id || "");
      setSelectedEditorId(article.assignedEditorId || "");

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

  // Fetch trending suggestions on mount
  useEffect(() => {
    async function fetchTrending() {
      try {
        const res = await fetch("/api/trending");
        if (res.ok) {
          const json = await res.json();
          const data = json.data || [];
          setTrendingSuggestions(data);
        }
      } catch { /* ignore */ }
    }
    fetchTrending();
  }, []);

  // Fetch users for author/editor dropdowns
  useEffect(() => {
    async function fetchUsers() {
      try {
        // /api/users sejak Sprint 0 CRIT-03 return paginated shape:
        //   json.data = { users: [...], total, page, limit, totalPages }
        // Backward-compat fallback ke json.data array kalau API berubah.
        const res = await fetch("/api/users?limit=100");
        if (res.ok) {
          const json = await res.json();
          const list = Array.isArray(json.data?.users)
            ? json.data.users
            : Array.isArray(json.data)
            ? json.data
            : [];
          setAllUsers(list);
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

  // Determine what view to show.
  //
  // The author's own DRAFT or REJECTED article ALWAYS renders in the full
  // journalist editor — regardless of whether the author also has admin or
  // editor role. Otherwise a SUPER_ADMIN writing their own draft would land
  // in the stripped-down "Review (Admin)" surface and lose access to the
  // featured image picker, sources, scheduling, AI helpers, etc.
  //
  // The admin/editor review surface is reserved for reviewing somebody
  // else's work, or for admin action on an already-submitted/published
  // article (where the editorial workflow takes precedence over authoring).
  const getViewMode = (): "journalist" | "admin" | "unauthorized" => {
    if (isOwner && ["DRAFT", "REJECTED"].includes(currentStatus)) return "journalist";
    // PUBLISHED articles get the full editable view only for editors/admins;
    // non-editor owners stay in read-only journalist preview (matching PUT /api/articles/:id RBAC).
    if (isAdmin && currentStatus === "PUBLISHED") return "journalist";
    if (isAdmin) return "admin";
    if (isOwner) return "journalist";
    return "unauthorized";
  };

  const viewMode = getViewMode();

  // Check if jurnalis/editor can edit content. Owners can edit DRAFT/REJECTED;
  // only editors/admins (isAdmin) can edit PUBLISHED articles (post-publish update).
  const canJurnalisEdit =
    (isOwner && ["DRAFT", "REJECTED"].includes(currentStatus)) ||
    (isAdmin && currentStatus === "PUBLISHED");

  // --- JURNALIS HANDLERS ---
  const handleJurnalisSubmit = async (status: "DRAFT" | "IN_REVIEW" | "PUBLISHED", schedTime?: string) => {
    setError("");

    if (!title.trim()) return setError("Judul wajib diisi");
    if (!content.trim()) return setError("Konten tidak boleh kosong");
    if (content.length < 50) return setError("Konten minimal 50 karakter");
    if (!categoryId) return setError("Kategori harus dipilih");

    if (status === "IN_REVIEW" && !allChecked) {
      setShowChecklist(true);
      return setError("Semua checklist jurnalistik harus dipenuhi sebelum submit");
    }

    let scheduledIso: string | undefined;
    if (status === "PUBLISHED") {
      if (schedTime) {
        const scheduledTime = new Date(schedTime);
        if (Number.isNaN(scheduledTime.getTime())) {
          return setError("Format jadwal publikasi tidak valid");
        }
        if (scheduledTime <= new Date()) {
          return setError("Jadwal publikasi harus di masa depan");
        }
        const ok = await confirm({ message: `Jadwalkan publikasi pada ${scheduledTime.toLocaleString("id-ID")}?`, variant: "warning", title: "Konfirmasi" });
        if (!ok) return;
        scheduledIso = scheduledTime.toISOString();
      } else {
        const ok = await confirm({ message: "Publikasi artikel ini sekarang? Artikel akan tampil di halaman publik.", variant: "warning", title: "Konfirmasi" });
        if (!ok) return;
      }
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
          featuredImage: featuredImage || null,
          seoTitle: seoTitle || undefined,
          seoDescription: seoDescription || undefined,
          status,
          scheduledAt: scheduledIso,
          sources: validSources.length > 0 ? validSources : undefined,
          ...(isAdmin ? { authorId: selectedAuthorId || undefined } : {}),
          assignedEditorId: selectedEditorId || null,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Gagal menyimpan artikel");
        setSaving(false);
        return;
      }

      clearAutosave();
      if (status === "PUBLISHED") {
        success(scheduledIso ? `Publikasi dijadwalkan pada ${new Date(scheduledIso).toLocaleString("id-ID")}` : "Artikel berhasil dipublikasikan!");
      } else {
        success(status === "IN_REVIEW" ? "Artikel dikirim untuk review" : "Artikel disimpan sebagai draf");
      }
      router.push("/panel/artikel");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
      setSaving(false);
    }
  };

  // Save edits to a PUBLISHED article without changing its status (stays live).
  const handlePublishedSave = async () => {
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
          featuredImage: featuredImage || null,
          seoTitle: seoTitle || undefined,
          seoDescription: seoDescription || undefined,
          sources: validSources.length > 0 ? validSources : undefined,
          ...(isAdmin
            ? {
                authorId: selectedAuthorId || undefined,
                assignedEditorId: selectedEditorId || null,
              }
            : {}),
          // No status — admin edit branch keeps PUBLISHED as is.
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Gagal menyimpan perubahan");
        setSaving(false);
        return;
      }

      clearAutosave();
      success("Perubahan tersimpan. Artikel tetap LIVE.");
      setFormDirty(false);
      setSaving(false);
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
      setSaving(false);
    }
  };

  // Takedown: PUBLISHED -> DRAFT (admin only). Article disappears from public.
  const handleTakedown = async () => {
    const ok = await confirm({
      message: "Takedown artikel ini? Status akan kembali ke DRAFT — artikel langsung hilang dari publik dan bisa diedit ulang sebelum re-publish.",
      variant: "warning",
      title: "Konfirmasi Takedown",
    });
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
        setError(data.error || "Gagal takedown artikel");
        setSaving(false);
        return;
      }
      success("Artikel di-takedown. Status sekarang DRAFT.");
      router.push("/panel/artikel");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan.");
      setSaving(false);
    }
  };

  // Archive: any status -> ARCHIVED (admin only). Final state, hidden + locked.
  const handleArchive = async () => {
    const ok = await confirm({
      message: "Arsipkan artikel ini? Artikel akan disembunyikan dari publik dan ditandai sebagai arsip. Bisa dikembalikan ke DRAFT nanti kalau perlu.",
      variant: "danger",
      title: "Konfirmasi Arsipkan",
    });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Gagal mengarsipkan artikel");
        setSaving(false);
        return;
      }
      success("Artikel diarsipkan.");
      router.push("/panel/artikel");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan.");
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
          featuredImage: featuredImage || null,
          seoTitle: seoTitle || undefined,
          seoDescription: seoDescription || undefined,
          sources: validSources.length > 0 ? validSources : undefined,
          authorId: selectedAuthorId || undefined,
          assignedEditorId: selectedEditorId || null,
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

  if (loading || sessionStatus === "loading") {
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
              Status: <span className="font-medium text-amber-700">{statusLabel[currentStatus] || currentStatus}</span> | Penulis: {articleAuthorName || "—"}
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300 border-l-4 border-l-red-600 bg-surface px-4 py-3 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
            {(error.toLowerCase().includes("terlalu pendek") || wordCount < 300) && (
              <button
                type="button"
                onClick={handleExpandArticle}
                disabled={aiLoading.expand_article}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-50"
              >
                {aiLoading.expand_article ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Sparkles size={13} />
                )}
                {aiLoading.expand_article ? "Menambahkan Paragraf..." : "+ Perpanjang Isi Otomatis (AI)"}
              </button>
            )}
          </div>
        )}

        {/* Activity Info */}
        <div className="mb-6 rounded-lg border border-border bg-surface p-5 space-y-3">
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
            {["APPROVED", "PUBLISHED"].includes(currentStatus) && (
              <>
                <div>
                  <span className="text-txt-muted">Disetujui oleh:</span>{" "}
                  <span className="font-medium text-primary">{existingApproverName || "—"}</span>
                </div>
                <div>
                  <span className="text-txt-muted">Waktu disetujui:</span>{" "}
                  <span className="text-txt-primary">
                    {existingApprovedAt ? new Date(existingApprovedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </span>
                </div>
              </>
            )}
            {existingReviewNote && (
              <div className="sm:col-span-2">
                <span className="text-txt-muted">Catatan review:</span>{" "}
                <span className="text-txt-primary">{existingReviewNote}</span>
              </div>
            )}
          </div>
        </div>

        {/* Admin Actions */}
        {["DRAFT", "REJECTED"].includes(currentStatus) && (
          <div className="mb-6 rounded-lg border-2 border-border bg-surface p-5">
            <h3 className="flex items-center gap-2 text-base font-bold text-txt-primary">
              <FileText size={18} className="text-primary" />
              Artikel Masih Berupa Draf
            </h3>
            <p className="mt-1 text-sm text-txt-secondary">
              Artikel ini belum dipublikasikan. Anda dapat mempublikasikannya sekarang atau menjadwalkan publikasinya.
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleAdminPublish}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                >
                  <Upload size={16} />
                  Publikasikan Sekarang
                </button>
                <button
                  onClick={() => { setShowSchedule(!showSchedule); setShowReturnNote(false); }}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-400 bg-surface px-5 py-2.5 text-sm font-semibold text-blue-700 hover:border-blue-600"
                >
                  <CalendarClock size={16} />
                  Jadwalkan Publikasi
                </button>
              </div>

              {/* Schedule picker */}
              {showSchedule && (
                <div className="rounded-lg border border-blue-300 border-l-4 border-l-blue-600 bg-surface p-4 mt-3">
                  <label className="mb-2 block text-sm font-medium text-blue-800">
                    Pilih tanggal & waktu publikasi
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={toLocalDatetimeInputValue(new Date())}
                    className="input w-full max-w-xs text-sm"
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={handleAdminSchedule}
                      disabled={saving || !scheduleDate}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <CalendarClock size={14} />
                      Konfirmasi Jadwal
                    </button>
                    <button
                      onClick={() => { setShowSchedule(false); setScheduleDate(""); }}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-txt-secondary hover:bg-surface-secondary"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {currentStatus === "APPROVED" && (
          <div className="mb-6 rounded-lg border border-primary/40 border-l-4 border-l-primary bg-surface p-5">
            <h3 className="flex items-center gap-2 text-base font-bold text-primary-dark">
              <CheckCircle size={18} />
              Artikel Disetujui — Siap Dipublikasi
            </h3>
            <p className="mt-1 text-sm text-primary">
              Artikel ini telah disetujui
              {existingApproverName ? ` oleh ${existingApproverName}` : " oleh editor"}
              {existingApprovedAt
                ? ` pada ${new Date(existingApprovedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
                : ""}
              . Anda dapat mempublikasi sekarang, menjadwalkan, atau mengembalikan ke editor.
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleAdminPublish}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                >
                  <Upload size={16} />
                  Publikasi Sekarang
                </button>
                <button
                  onClick={() => { setShowSchedule(!showSchedule); setShowReturnNote(false); }}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-400 bg-surface px-5 py-2.5 text-sm font-semibold text-blue-700 hover:border-blue-600"
                >
                  <CalendarClock size={16} />
                  Jadwalkan Publikasi
                </button>
                <button
                  onClick={() => { setShowReturnNote(!showReturnNote); setShowSchedule(false); }}
                  className="flex items-center gap-1.5 rounded-lg border border-yellow-500 bg-surface px-5 py-2.5 text-sm font-semibold text-yellow-800 hover:border-yellow-600"
                >
                  <Undo2 size={16} />
                  Kembalikan ke Editor
                </button>
              </div>

              {/* Schedule picker */}
              {showSchedule && (
                <div className="rounded-lg border border-blue-300 border-l-4 border-l-blue-600 bg-surface p-4 mt-3">
                  <label className="mb-2 block text-sm font-medium text-blue-800">
                    Pilih tanggal & waktu publikasi
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={toLocalDatetimeInputValue(new Date())}
                    className="input w-full max-w-xs text-sm"
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={handleAdminSchedule}
                      disabled={saving || !scheduleDate}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <CalendarClock size={14} />
                      Konfirmasi Jadwal
                    </button>
                    <button
                      onClick={() => { setShowSchedule(false); setScheduleDate(""); }}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-txt-secondary hover:bg-surface-secondary"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {showReturnNote && (
                <div className="rounded-lg border border-yellow-400 border-l-4 border-l-yellow-500 bg-surface p-4 mt-3">
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
                      className="flex items-center gap-1.5 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-600 disabled:opacity-50"
                    >
                      <Undo2 size={14} />
                      Konfirmasi Kembalikan
                    </button>
                    <button
                      onClick={() => { setShowReturnNote(false); setReturnNote(""); }}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-txt-secondary hover:bg-surface-secondary"
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
          <div className="mb-6 rounded-lg border border-primary/40 border-l-4 border-l-primary bg-surface p-5">
            <h3 className="flex items-center gap-2 text-base font-bold text-primary-dark">
              <CheckCircle size={18} />
              Artikel Sudah Dipublikasikan
            </h3>
          </div>
        )}

        {currentStatus === "IN_REVIEW" && (
          <div className="mb-6 rounded-lg border border-yellow-400 border-l-4 border-l-yellow-500 bg-surface p-5">
            <h3 className="flex items-center gap-2 text-base font-bold text-yellow-800">
              <MessageSquare size={18} />
              Artikel Sedang Direview oleh Editor
            </h3>
            <p className="mt-1 text-sm text-yellow-700">
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
                  className="flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                >
                  <CheckCircle size={16} />
                  Approve
                </button>
                <button
                  onClick={handleAdminPublish}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                >
                  <Upload size={16} />
                  Publikasi Langsung
                </button>
                <button
                  onClick={() => { setReviewChoice(reviewChoice === "reject" ? null : "reject"); }}
                  className="flex items-center gap-1.5 rounded-lg border border-red-400 bg-surface px-5 py-2.5 text-sm font-semibold text-red-700 hover:border-red-600"
                >
                  <XCircle size={16} />
                  Tolak
                </button>
              </div>

              {reviewChoice === "reject" && (
                <div className="rounded-lg border border-red-300 border-l-4 border-l-red-600 bg-surface p-4 mt-3">
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
                      className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircle size={14} />
                      Konfirmasi Tolak
                    </button>
                    <button
                      onClick={() => { setReviewChoice(null); setRejectNote(""); }}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-txt-secondary hover:bg-surface-secondary"
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-txt-primary hover:bg-surface-secondary transition-colors"
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
            {researchPanel}
            <div className="rounded-lg border border-border overflow-hidden">
              <RichTextEditor
                content={content}
                onChange={setContent}
                articleTitle={title}
                onAiTitle={(s) => { setTitle(s); success("Judul AI disisipkan"); }}
                onAiMeta={(s) => { setSeoDescription(s); success("Meta description AI disisipkan"); }}
                onAiCaption={(s) => {
                  navigator.clipboard?.writeText(s).then(
                    () => success("Caption disalin ke clipboard"),
                    () => setError("Clipboard diblokir browser. Silakan salin manual dari pratinjau caption.")
                  );
                }}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t border-border text-sm text-txt-muted">
                <div className="flex items-center gap-4">
                  <span className={wordCount < 300 ? "font-semibold text-amber-600" : ""}>
                    {wordCount} kata {wordCount < 300 ? "(minimal 300)" : ""}
                  </span>
                  <span className="text-border">|</span>
                  <span>{charCount} karakter</span>
                  <span className="text-border">|</span>
                  <span>{readTime} menit baca</span>
                </div>
                {wordCount > 0 && wordCount < 300 && (
                  <button
                    type="button"
                    onClick={handleExpandArticle}
                    disabled={aiLoading.expand_article}
                    className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    {aiLoading.expand_article ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    {aiLoading.expand_article ? "Menambahkan Paragraf..." : "+ Tambah / Perpanjang Isi (AI)"}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-txt-muted uppercase tracking-wider">Gambar Utama</label>
                <button
                  type="button"
                  onClick={() => setShowCoverPicker(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <ImageIcon size={13} aria-hidden="true" />
                  Pilih dari Galeri
                </button>
              </div>
              <ImageUploader
                currentImage={featuredImage}
                onUpload={(url) => setFeaturedImage(url)}
              />
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <label className="mb-2 block text-xs font-medium text-txt-muted uppercase tracking-wider">Kategori</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input w-full">
                <option value="">Pilih kategori</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {/* Pilih Penulis — Admins only */}
            <div className="rounded-lg border border-border bg-surface p-4">
              <label htmlFor="admin-edit-penulis" className="mb-2 block text-xs font-medium text-txt-muted uppercase tracking-wider">
                Penulis
              </label>
              <select
                id="admin-edit-penulis"
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
            {/* Pilih Editor — Admins only */}
            <div className="rounded-lg border border-border bg-surface p-4">
              <label htmlFor="admin-edit-editor" className="mb-2 block text-xs font-medium text-txt-muted uppercase tracking-wider">
                Editor
              </label>
              <select
                id="admin-edit-editor"
                value={selectedEditorId}
                onChange={(e) => setSelectedEditorId(e.target.value)}
                className="input w-full"
              >
                <option value="">Otomatis (random)</option>
                {/* Editor / Kepala Editor (dan Super Admin) boleh menugaskan dirinya sendiri sebagai editor */}
                {["EDITOR", "CHIEF_EDITOR", "SUPER_ADMIN"].includes(userRole) && userId && (
                  <option value={userId}>Saya sendiri (sebagai editor)</option>
                )}
                {allUsers
                  .filter(u => ["EDITOR", "CHIEF_EDITOR", "SUPER_ADMIN"].includes(u.role) && u.id !== userId)
                  .map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({roleLabelsMap[u.role] || u.role})</option>
                  ))
                }
              </select>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <label className="mb-2 block text-xs font-medium text-txt-muted uppercase tracking-wider">Tags</label>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className="input w-full" placeholder="Tag1, Tag2, Tag3" />
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <label className="mb-2 block text-xs font-medium text-txt-muted uppercase tracking-wider">Ringkasan</label>
              <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} className="input w-full" rows={3} placeholder="Ringkasan artikel..." />
            </div>
          </div>
        </div>

        <ImagePickerModal
          open={showCoverPicker}
          onClose={() => setShowCoverPicker(false)}
          onSelect={(picked: string | PickedImage) => {
            const url = typeof picked === "string" ? picked : picked.url;
            setFeaturedImage(url);
          }}
        />
      </div>
    );
  }

  // ============================================================
  // RENDER: UNAUTHORIZED VIEW
  // ============================================================
  if (viewMode === "unauthorized") {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <Lock size={48} className="mx-auto mb-4 text-txt-muted" />
        <h1 className="text-xl font-bold text-txt-primary">Akses Ditolak</h1>
        <p className="mt-2 text-sm text-txt-secondary">
          Anda tidak memiliki izin untuk membuka atau menyunting artikel ini.
        </p>
        <button
          onClick={() => router.push("/panel/artikel")}
          className="btn-primary mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
        >
          <ArrowLeft size={16} /> Kembali ke Daftar Artikel
        </button>
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
            Status saat ini: <span className="font-medium text-amber-700">{statusLabel[currentStatus] || currentStatus}</span>
          </p>
        </div>
        {/* Action buttons only for editable states */}
        {canJurnalisEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Autosave status badge */}
            {autoSaving ? (
              <span className="flex items-center gap-1.5 text-xs text-txt-muted">
                <Loader2 size={12} className="animate-spin" />
                Menyimpan otomatis...
              </span>
            ) : formDirty ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-secondary">
                <AlertCircle size={12} />
                Belum tersimpan
              </span>
            ) : lastSavedAt ? (
              <span className="flex items-center gap-1.5 text-xs text-txt-muted">
                <CheckCircle size={12} className="text-primary" />
                Tersimpan otomatis {lastSavedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : autoSaveIndicator ? (
              <span className="text-xs text-txt-muted">{autoSaveIndicator}</span>
            ) : null}

            {currentStatus === "PUBLISHED" ? (
              <>
                {articleSlug && (
                  <a
                    href={`/berita/${articleSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
                    title="Buka artikel di tab baru"
                  >
                    <ExternalLink size={16} />
                    Lihat Artikel
                  </a>
                )}
                <button
                  onClick={handlePublishedSave}
                  disabled={saving}
                  className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  <Save size={16} />
                  Simpan Perubahan
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={handleTakedown}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-md border border-yellow-500 bg-surface px-4 py-2 text-sm font-semibold text-yellow-800 hover:border-yellow-600 disabled:opacity-50"
                      title="Turunkan dari publik, kembali ke DRAFT"
                    >
                      <ArrowDownToLine size={16} />
                      Takedown
                    </button>
                    <button
                      onClick={handleArchive}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-md border border-red-400 bg-surface px-4 py-2 text-sm font-semibold text-red-700 hover:border-red-600 disabled:opacity-50"
                      title="Arsipkan — sembunyikan dari publik permanen"
                    >
                      <Archive size={16} />
                      Arsipkan
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => handleJurnalisSubmit("DRAFT")}
                  disabled={saving}
                  className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  <Save size={16} />
                  Simpan Draf
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => handleJurnalisSubmit("PUBLISHED")}
                      disabled={saving}
                      className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      <Upload size={16} />
                      Publikasikan Sekarang
                    </button>
                    <button
                      onClick={() => { setShowSchedule(!showSchedule); }}
                      className="flex items-center gap-1.5 rounded-md border border-blue-400 bg-surface px-4 py-2 text-sm font-semibold text-blue-700 hover:border-blue-600"
                    >
                      <CalendarClock size={16} />
                      Jadwalkan Publikasi
                    </button>
                  </>
                )}
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
              </>
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
            className="btn-ghost flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-txt-secondary hover:text-txt-primary"
          >
            <Printer size={14} />
            Export PDF
          </button>
          <button
            onClick={handleExportText}
            className="btn-ghost flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-txt-secondary hover:text-txt-primary"
          >
            <FileText size={14} />
            Export Teks
          </button>
        </div>
      )}

      {showAutosaveBanner && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400 border-l-4 border-l-amber-500 bg-surface px-4 py-3 text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-amber-600" />
            <span>Ditemukan draf tersimpan otomatis lokal yang lebih baru dari server. Pulihkan perubahan?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadAutosaveDraft}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Pulihkan Draf
            </button>
            <button
              type="button"
              onClick={discardAutosaveDraft}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-txt-secondary hover:bg-surface-secondary"
            >
              Abaikan
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300 border-l-4 border-l-red-600 bg-surface px-4 py-3 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
          {(error.toLowerCase().includes("terlalu pendek") || wordCount < 300) && (
            <button
              type="button"
              onClick={handleExpandArticle}
              disabled={aiLoading.expand_article}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-50"
            >
              {aiLoading.expand_article ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Sparkles size={13} />
              )}
              {aiLoading.expand_article ? "Menambahkan Paragraf..." : "+ Perpanjang Isi Otomatis (AI)"}
            </button>
          )}
        </div>
      )}

      {/* Journalist Direct Schedule Picker */}
      {viewMode === "journalist" && showSchedule && (
        <div className="mb-4 rounded-lg border border-blue-300 border-l-4 border-l-blue-600 bg-surface p-4 shadow-sm">
          <label className="mb-2 block text-sm font-medium text-blue-800">
            Pilih tanggal & waktu publikasi draf ini
          </label>
          <input
            type="datetime-local"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            min={toLocalDatetimeInputValue(new Date())}
            className="input w-full max-w-xs text-sm"
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => handleJurnalisSubmit("PUBLISHED", scheduleDate)}
              disabled={saving || !scheduleDate}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <CalendarClock size={14} />
              Konfirmasi Jadwal
            </button>
            <button
              onClick={() => { setShowSchedule(false); setScheduleDate(""); }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-txt-secondary hover:bg-surface-secondary"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Trending Suggestions */}
      {canJurnalisEdit && ["DRAFT", "REJECTED"].includes(currentStatus) && trendingSuggestions.length > 0 && showSuggestions && (
        <div className="mb-4 rounded-lg border border-border bg-surface p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 border-l-[3px] border-primary pl-2.5">
              <h3 className="text-sm font-bold text-txt-primary">Ide Berita dari Trending</h3>
              <span className="text-xs text-txt-muted">— klik untuk pakai sebagai judul</span>
            </div>
            <button
              type="button"
              onClick={() => setShowSuggestions(false)}
              className="text-xs text-txt-muted hover:text-txt-secondary"
            >
              Tutup
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {trendingSuggestions.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setTitle(item.label)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary hover:text-primary bg-surface ${
                  item.hot
                    ? "border-red-300 text-red-700"
                    : "border-border text-txt-secondary"
                }`}
              >
                {item.hot && <TrendingUp size={11} />}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* REJECTED: Show editor's rejection note */}
      {(currentStatus === "REJECTED" || currentStatus === "DRAFT") && existingReviewNote && (
        <div className="mb-4 rounded-lg border border-red-300 border-l-4 border-l-red-600 bg-surface p-4">
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
        <div className="mb-4 rounded-lg border border-yellow-400 border-l-4 border-l-yellow-500 bg-surface p-4">
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
            className="mt-3 flex items-center gap-1.5 rounded-lg border border-yellow-400 bg-white px-4 py-2 text-sm font-semibold text-yellow-700 hover:bg-yellow-100 disabled:opacity-50"
          >
            <Undo2 size={16} />
            Batalkan Review
          </button>
        </div>
      )}

      {/* APPROVED: Article locked */}
      {currentStatus === "APPROVED" && isOwner && (
        <div className="mb-4 rounded-lg border border-blue-300 border-l-4 border-l-blue-600 bg-surface p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-700">
            <CheckCircle size={16} />
            Artikel Telah Disetujui
          </h3>
          <p className="mt-1 text-sm text-blue-600">
            Artikel telah disetujui{existingApproverName ? ` oleh ${existingApproverName}` : " oleh editor"}
            {existingApprovedAt
              ? ` pada ${new Date(existingApprovedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
              : ""}
            . Artikel siap dipublikasi.
          </p>
          {existingReviewNote && (
            <p className="mt-2 text-sm text-blue-500">Catatan editor: {existingReviewNote}</p>
          )}
        </div>
      )}

      {/* PUBLISHED: Article locked */}
      {currentStatus === "PUBLISHED" && isOwner && (
        <div className="mb-4 rounded-lg border border-primary/40 border-l-4 border-l-primary bg-surface p-4">
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
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-txt-primary hover:bg-surface-secondary transition-colors"
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
            {researchPanel}
            <div className="rounded-lg border border-border overflow-hidden">
              <RichTextEditor
                content={content}
                onChange={setContent}
                articleTitle={title}
                onAiTitle={(s) => { setTitle(s); success("Judul AI disisipkan"); }}
                onAiMeta={(s) => { setSeoDescription(s); success("Meta description AI disisipkan"); }}
                onAiCaption={(s) => {
                  navigator.clipboard?.writeText(s).then(
                    () => success("Caption disalin ke clipboard"),
                    () => setError("Clipboard diblokir browser. Silakan salin manual dari pratinjau caption.")
                  );
                }}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t border-border text-sm text-txt-muted">
                <div className="flex items-center gap-4">
                  <span className={wordCount < 300 ? "font-semibold text-amber-600" : ""}>
                    {wordCount} kata {wordCount < 300 ? "(minimal 300)" : ""}
                  </span>
                  <span className="text-border">|</span>
                  <span>{charCount} karakter</span>
                  <span className="text-border">|</span>
                  <span>{readTime} menit baca</span>
                </div>
                {wordCount > 0 && wordCount < 300 && (
                  <button
                    type="button"
                    onClick={handleExpandArticle}
                    disabled={aiLoading.expand_article}
                    className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    {aiLoading.expand_article ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    {aiLoading.expand_article ? "Menambahkan Paragraf..." : "+ Tambah / Perpanjang Isi (AI)"}
                  </button>
                )}
              </div>
            </div>
            {/* Sources */}
            <div className="rounded-lg border border-border bg-surface p-6">
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
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-border p-3">
                    <input type="text" placeholder="Nama narasumber *" value={source.name} onChange={(e) => updateSource(i, "name", e.target.value)} className="input text-sm" />
                    <input type="text" placeholder="Jabatan" value={source.title} onChange={(e) => updateSource(i, "title", e.target.value)} className="input text-sm" />
                    <input type="text" placeholder="Institusi" value={source.institution} onChange={(e) => updateSource(i, "institution", e.target.value)} className="input text-sm" />
                    <div className="flex gap-2">
                      <input type="url" placeholder="URL referensi" value={source.url} onChange={(e) => updateSource(i, "url", e.target.value)} className="input flex-1 text-sm" />
                      {sources.length > 1 && (
                        <button type="button" onClick={() => removeSource(i)} aria-label="Hapus narasumber" className="rounded-lg p-1.5 text-red-500 hover:text-red-700">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* SEO Settings */}
            <div className="rounded-lg border border-border bg-surface">
              <button type="button" onClick={() => setShowSeo(!showSeo)} className="flex w-full items-center justify-between px-6 py-3 text-sm font-medium text-txt-primary uppercase tracking-wider">
                Pengaturan SEO
                <ChevronDown size={16} className={showSeo ? "rotate-180" : ""} />
              </button>
              {showSeo && (
                <div className="space-y-3 border-t border-border px-6 py-4">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label htmlFor="edit-seo-title" className="text-sm font-medium text-txt-primary">SEO Title ({seoTitle.length}/70)</label>
                      <AiButton feature="seo_title" setter={setSeoTitle} />
                    </div>
                    <input id="edit-seo-title" type="text" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={70} placeholder={title || "Judul untuk mesin pencari"} className="input w-full text-sm" />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label htmlFor="edit-seo-desc" className="text-sm font-medium text-txt-primary">Meta Description ({seoDescription.length}/160)</label>
                      <AiButton feature="meta_description" setter={setSeoDescription} />
                    </div>
                    <textarea id="edit-seo-desc" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} maxLength={160} rows={2} placeholder="Deskripsi singkat untuk hasil pencarian" className="input w-full text-sm" />
                  </div>
                  {/* FAQ Generator — only for editors */}
                  {EDITOR_ROLES.includes(userRole) && (
                    <div className="rounded-lg border border-border bg-surface-secondary px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-txt-primary">FAQ Page (JSON-LD)</p>
                          <p className="text-xs text-txt-muted">
                            {faqCount !== null
                              ? `${faqCount} pasangan Q&A tersimpan. Klik untuk regenerate.`
                              : "Generate 5-7 Q&A dari konten artikel untuk rich result Google."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateFaq}
                          disabled={generatingFaq || !title.trim() || !content.trim()}
                          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:bg-primary-dark disabled:opacity-40"
                        >
                          {generatingFaq ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                          {generatingFaq ? "Generating..." : "Generate FAQ"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Gambar Utama (Cover) */}
            <div className="rounded-lg border border-border bg-surface p-6">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-txt-primary">Gambar Utama</label>
                <button
                  type="button"
                  onClick={() => setShowCoverPicker(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <ImageIcon size={13} aria-hidden="true" />
                  Pilih dari Galeri
                </button>
              </div>
              <ImageUploader
                currentImage={featuredImage}
                onUpload={(url) => setFeaturedImage(url)}
              />
            </div>

            <div className="rounded-lg border border-border bg-surface p-6">
              <label htmlFor="edit-kategori" className="mb-2 block text-sm font-medium text-txt-primary">Kategori *</label>
              <select id="edit-kategori" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input w-full">
                <option value="">Pilih Kategori</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            {/* Pilih Penulis — only for admin/editor */}
            {EDITOR_ROLES.includes(userRole) && (
              <div className="rounded-lg border border-border bg-surface p-6">
                <label htmlFor="edit-penulis" className="mb-2 block text-sm font-medium text-txt-primary">
                  Penulis
                </label>
                <select
                  id="edit-penulis"
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
            <div className="rounded-lg border border-border bg-surface p-6">
              <label htmlFor="edit-editor" className="mb-2 block text-sm font-medium text-txt-primary">
                Editor
              </label>
              <select
                id="edit-editor"
                value={selectedEditorId}
                onChange={(e) => setSelectedEditorId(e.target.value)}
                className="input w-full"
              >
                <option value="">Otomatis (random)</option>
                {/* Editor / Kepala Editor (dan Super Admin) boleh menugaskan dirinya sendiri sebagai editor */}
                {["EDITOR", "CHIEF_EDITOR", "SUPER_ADMIN"].includes(userRole) && userId && (
                  <option value={userId}>Saya sendiri (sebagai editor)</option>
                )}
                {allUsers
                  .filter(u => ["EDITOR", "CHIEF_EDITOR", "SUPER_ADMIN"].includes(u.role) && u.id !== userId)
                  .map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({roleLabelsMap[u.role] || u.role})</option>
                  ))
                }
              </select>
            </div>
            <div className="rounded-lg border border-border bg-surface p-6">
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="edit-tags" className="text-sm font-medium text-txt-primary">Tags</label>
                <AiButton feature="tags" setter={setTags} />
              </div>
              <input id="edit-tags" type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tag1, Tag2, Tag3" className="input w-full" />
              <p className="mt-1 text-xs text-txt-muted">Pisahkan dengan koma</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-6">
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="edit-ringkasan" className="text-sm font-medium text-txt-primary">Ringkasan</label>
                <AiButton feature="summary" setter={setExcerpt} />
              </div>
              <textarea id="edit-ringkasan" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} placeholder="Ringkasan singkat artikel" maxLength={500} className="input w-full" />
            </div>
            {/* Journalism Checklist */}
            <div className="rounded-lg border border-border border-l-4 border-l-primary bg-surface p-4">
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
                        className="mt-0.5 rounded-lg"
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
            <div className="rounded-lg border border-border bg-surface shadow-card overflow-hidden">
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
          <div className="rounded-lg border border-border bg-surface p-5">
            <label className="mb-1 block text-xs font-medium text-txt-muted uppercase tracking-wider">Judul</label>
            <p className="text-lg font-bold text-txt-primary">{title}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <label className="mb-1 block text-xs font-medium text-txt-muted uppercase tracking-wider">Kategori</label>
            <p className="text-sm text-txt-primary">{categories.find(c => c.id === categoryId)?.name || categoryId}</p>
          </div>
          {excerpt && (
            <div className="rounded-lg border border-border bg-surface p-5">
              <label className="mb-1 block text-xs font-medium text-txt-muted uppercase tracking-wider">Ringkasan</label>
              <p className="text-sm text-txt-primary">{excerpt}</p>
            </div>
          )}
          <div className="rounded-lg border border-border bg-surface p-5">
            <label className="mb-2 block text-xs font-medium text-txt-muted uppercase tracking-wider">Konten</label>
            {/* Defense-in-depth: sanitize live editor state before preview render */}
            <div className="prose prose-sm max-w-none text-txt-primary text-justify" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />
          </div>
        </div>
      )}
      <ImagePickerModal
        open={showCoverPicker}
        onClose={() => setShowCoverPicker(false)}
        onSelect={(picked: string | PickedImage) => {
          const url = typeof picked === "string" ? picked : picked.url;
          setFeaturedImage(url);
        }}
      />
    </div>
  );
}
