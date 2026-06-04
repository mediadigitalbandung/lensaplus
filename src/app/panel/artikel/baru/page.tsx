"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  Save,
  Send,
  Rocket,
  CalendarClock,
  ChevronDown,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Loader2,
  Sparkles,
  TrendingUp,
  Lightbulb,
  Search,
  X,
} from "lucide-react";
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

import { CAN_SUBMIT_REVIEW, EDITOR_ROLES, roleLabelsMap } from "@/lib/roles";
import { PERPLEXITY_PERSONAS, PERPLEXITY_NOTE_HINTS } from "@/lib/perplexity-personas";

const AUTOSAVE_KEY = "autosave_draft_new";
const AUTOSAVE_DRAFTID_KEY = "autosave_draft_new_id";

type ArticleSnapshot = {
  title: string; content: string; categoryId: string; excerpt: string;
  tags: string; featuredImage: string; seoTitle: string; seoDescription: string;
  sources: Source[]; selectedAuthorId: string; selectedEditorId: string; saving: boolean;
};

// Build the POST/PUT body from a state snapshot. Pure + module-scoped so it can
// be shared by the autosave loop and the manual save without re-creating on
// every render (which would reset the autosave interval).
function buildArticlePayload(s: ArticleSnapshot, status?: "DRAFT" | "IN_REVIEW") {
  const validSources = (s.sources || []).filter((x) => x.name.trim());
  const tagList = s.tags.split(",").map((t) => t.trim()).filter(Boolean);
  const safeStr = (str: string, max: number) =>
    str ? (str.length > max ? str.slice(0, max - 1).trimEnd() + "…" : str) : undefined;
  return {
    title: safeStr(s.title, 255),
    content: s.content,
    excerpt: safeStr(s.excerpt, 500),
    categoryId: s.categoryId,
    tags: tagList,
    featuredImage: s.featuredImage || undefined,
    seoTitle: safeStr(s.seoTitle, 70),
    seoDescription: safeStr(s.seoDescription, 160),
    ...(status ? { status } : {}),
    sources: validSources.length > 0 ? validSources : undefined,
    authorId: s.selectedAuthorId || undefined,
    assignedEditorId: s.selectedEditorId || undefined,
  };
}

export default function NewArticlePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { success, error: showError } = useToast();
  const { confirm } = useConfirm();
  const userRole = session?.user?.role || "";

  const [categories, setCategories] = useState<Category[]>([]);
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
  const [showAutosaveBanner, setShowAutosaveBanner] = useState(false);
  // Schedule-publish (editors/chief editors only)
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  // Perplexity research-and-draft
  const [showResearch, setShowResearch] = useState(false);
  const [researchNotes, setResearchNotes] = useState("");
  const [researchMode, setResearchMode] = useState<"draft" | "research">("draft");
  const [researchPersona, setResearchPersona] = useState("");
  const [researchImages, setResearchImages] = useState(true);
  const [researching, setResearching] = useState(false);
  const [users, setUsers] = useState<{id: string; name: string; role: string}[]>([]);
  const [selectedAuthorId, setSelectedAuthorId] = useState("");
  const [selectedEditorId, setSelectedEditorId] = useState("");
  // Word counter calculations
  const plainText = content.replace(/<[^>]*>/g, "").trim();
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;
  const charCount = plainText.length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));
  // Server-side draft autosave. Once the article meets the API minimums
  // (title >= 5, content >= 50, category chosen) it is persisted as a real
  // DRAFT in the author's account — so an interrupted session (deploy / bad
  // gateway) leaves the work recoverable from the Artikel list, not just this
  // browser. The localStorage copy below is the offline net for the moments
  // before that and while the server is unreachable.
  const draftIdRef = useRef<string | null>(null);
  const autosaveInFlightRef = useRef<Promise<void> | null>(null);
  const lastSavedHashRef = useRef<string>("");
  const [serverSaving, setServerSaving] = useState(false);
  const [serverSavedAt, setServerSavedAt] = useState<number | null>(null);

  // Always-current snapshot so the mount-once autosave interval never reads
  // stale closure values.
  const latestRef = useRef<ArticleSnapshot>({
    title, content, categoryId, excerpt, tags, featuredImage,
    seoTitle, seoDescription, sources, selectedAuthorId, selectedEditorId, saving,
  });
  latestRef.current = {
    title, content, categoryId, excerpt, tags, featuredImage,
    seoTitle, seoDescription, sources, selectedAuthorId, selectedEditorId, saving,
  };

  // Persist the current draft to the server (create once, then update the same
  // record). Best-effort: failures (server mid-deploy) are swallowed because
  // localStorage still protects the work.
  const attemptServerAutosave = useCallback(async () => {
    const s = latestRef.current;
    if (s.saving) return;                        // manual save/submit in progress
    const plain = s.content.replace(/<[^>]*>/g, "").trim();
    if (s.title.trim().length < 5 || plain.length < 50 || !s.categoryId) return; // below API minimums
    if (autosaveInFlightRef.current) return;     // a save is already running
    const payload = buildArticlePayload(s, "DRAFT");
    const hash = JSON.stringify(payload);
    if (hash === lastSavedHashRef.current) return; // nothing changed since last server save
    const run = (async () => {
      setServerSaving(true);
      try {
        const id = draftIdRef.current;
        const res = await fetch(id ? `/api/articles/${id}` : "/api/articles", {
          method: id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          if (!id && data.data?.id) {
            draftIdRef.current = data.data.id;
            try { localStorage.setItem(AUTOSAVE_DRAFTID_KEY, data.data.id); } catch { /* ignore */ }
          }
          lastSavedHashRef.current = hash;
          setServerSavedAt(Date.now());
        }
      } catch {
        // Server unreachable (e.g. deploy) — localStorage net holds it.
      } finally {
        setServerSaving(false);
      }
    })();
    autosaveInFlightRef.current = run;
    try { await run; } finally { autosaveInFlightRef.current = null; }
  }, []);

  // Check for a browser-saved draft on mount.
  useEffect(() => {
    try {
      if (localStorage.getItem(AUTOSAVE_KEY)) setShowAutosaveBanner(true);
    } catch {
      // localStorage not available
    }
  }, []);

  // One interval for the page's lifetime: snapshot to localStorage every cycle
  // (offline net) and attempt a server draft save (account copy). Also fire
  // when the tab is hidden/closed — the moment work is most often lost.
  useEffect(() => {
    const tick = () => {
      const s = latestRef.current;
      try {
        if (s.title.trim() || s.content.trim()) {
          localStorage.setItem(
            AUTOSAVE_KEY,
            JSON.stringify({
              title: s.title, content: s.content, categoryId: s.categoryId,
              excerpt: s.excerpt, tags: s.tags, featuredImage: s.featuredImage,
              sources: s.sources, savedAt: Date.now(),
            }),
          );
        }
      } catch {
        // localStorage not available
      }
      attemptServerAutosave();
    };
    const timer = setInterval(tick, 15000);
    const onHide = () => { if (document.visibilityState === "hidden") tick(); };
    document.addEventListener("visibilitychange", onHide);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onHide); };
  }, [attemptServerAutosave]);

  function loadAutosaveDraft() {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.title) setTitle(String(draft.title).slice(0, 255));
        if (draft.content) setContent(draft.content);
        if (draft.categoryId) setCategoryId(draft.categoryId);
        if (draft.excerpt) setExcerpt(String(draft.excerpt).slice(0, 500));
        if (draft.tags) setTags(draft.tags);
        if (draft.featuredImage) setFeaturedImage(draft.featuredImage);
        if (draft.sources) setSources(draft.sources);
      }
    } catch {
      // ignore
    }
    setShowAutosaveBanner(false);
  }

  function discardAutosaveDraft() {
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
    } catch {
      // ignore
    }
    setShowAutosaveBanner(false);
  }

  const [checklist, setChecklist] = useState({
    notClickbait: false,
    hasSource: false,
    balanced: false,
    noSara: false,
    properLanguage: false,
  });

  const allChecked = Object.values(checklist).every(Boolean);

  const [trendingSuggestions, setTrendingSuggestions] = useState<{ label: string; hot: boolean }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);

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

  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});

  // Hard caps from server-side Zod schema — keep client output within these so we never trip 400.
  const FEATURE_MAX: Record<string, number> = {
    summary: 500,
    seo_title: 70,
    meta_description: 160,
  };

  const clampToMax = (val: string, max: number): string => {
    if (val.length <= max) return val;
    return val.slice(0, max - 1).trimEnd() + "…";
  };

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
        const value = max ? clampToMax(data.data.result, max) : data.data.result;
        setter(value);
      } else {
        setError(data.error || "Gagal generate AI");
      }
    } catch {
      setError("Gagal menghubungi AI service");
    } finally {
      setAiLoading((prev) => ({ ...prev, [feature]: false }));
    }
  };

  const runResearch = async () => {
    // Topic = the title, OR (when writing from scratch) the notes box.
    const topic = (title.trim() || researchNotes.trim());
    if (!topic) {
      setError("Isi Judul atau kolom arahan/topik dulu sebelum riset");
      return;
    }
    setResearching(true);
    setError("");
    try {
      const res = await fetch("/api/ai/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, mode: researchMode, notes: researchNotes, persona: researchPersona, includeImages: researchImages }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Gagal menjalankan riset Perplexity");
        return;
      }
      const d = data.data || {};

      // Fill EVERY field directly — title, excerpt, tags, SEO, meta, content —
      // no review step. Empty fields are filled; existing user input is kept.
      const f = d.fields;
      const html = (f?.content ?? d.content ?? "").toString();
      if (f) {
        const fill = (v: unknown, cur: string, set: (s: string) => void, max?: number) => {
          const val = (v ?? "").toString().trim();
          if (val && !cur.trim()) set(max ? clampToMax(val, max) : val);
        };
        fill(f.title, title, setTitle, 255);
        fill(f.excerpt, excerpt, setExcerpt);
        fill(f.tags, tags, setTags);
        fill(f.seoTitle, seoTitle, setSeoTitle, 60);
        fill(f.metaDescription, seoDescription, setSeoDescription, 160);
        if ((f.seoTitle || f.metaDescription) && (!seoTitle.trim() || !seoDescription.trim())) setShowSeo(true);
      }
      // Optional images from the web (2-3). First fills the featured image (if
      // empty); the rest are appended into the article body as captioned figures.
      const imgs: { url: string; origin: string | null; title: string | null }[] = d.images || [];
      let imgHtml = "";
      if (imgs.length > 0) {
        if (!featuredImage.trim()) setFeaturedImage(imgs[0].url);
        const extra = featuredImage.trim() ? imgs : imgs.slice(1);
        imgHtml = extra
          .map((im) => {
            const cap = im.title ? im.title.replace(/[<>]/g, "") : "";
            let host = "";
            try {
              host = im.origin ? new URL(im.origin).hostname.replace(/^www\./, "") : "";
            } catch {
              /* ignore */
            }
            const credit = host ? `<em>Sumber: ${host}</em>` : "";
            const sep = cap && credit ? " — " : "";
            const figcap = cap || credit ? `<figcaption>${cap}${sep}${credit}</figcaption>` : "";
            return `<figure><img src="${im.url}" alt="${cap}" />${figcap}</figure>`;
          })
          .join("");
      }
      const bodyHtml = `${html || ""}${imgHtml}`;
      if (bodyHtml) setContent((prev) => (prev.trim() ? `${prev}\n${bodyHtml}` : bodyHtml));

      // Auto-add the cited sources (dedup by URL).
      const cited: { title: string | null; url: string }[] = d.sources || [];
      if (cited.length > 0) {
        const newSources: Source[] = cited.slice(0, 12).map((s) => {
          let host = "";
          try {
            host = new URL(s.url).hostname.replace(/^www\./, "");
          } catch {
            /* keep blank */
          }
          return { name: s.title || host || "Sumber", title: "", institution: host, url: s.url };
        });
        setSources((prev) => {
          const existing = prev.filter((p) => p.name.trim() || p.url.trim());
          const seen = new Set(existing.map((e) => e.url));
          const merged = [...existing];
          for (const ns of newSources) {
            if (!ns.url || !seen.has(ns.url)) {
              merged.push(ns);
              seen.add(ns.url);
            }
          }
          return merged.length > 0 ? merged : prev;
        });
      }

      success(
        `Selesai — kolom artikel terisi dari riset${cited.length ? ` + ${cited.length} sumber` : ""}${imgs.length ? ` + ${imgs.length} foto` : ""}. Tinjau & sunting sebelum publikasi.`,
      );
      setShowResearch(false);
      setResearchNotes("");
    } catch {
      setError("Gagal menghubungi layanan riset Perplexity");
    } finally {
      setResearching(false);
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

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

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
          setUsers(list);
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

  const handleSubmit = async (status: "DRAFT" | "IN_REVIEW") => {
    setError("");

    if (!title.trim()) return setError("Judul wajib diisi");
    if (!content.trim()) return setError("Konten tidak boleh kosong");
    if (content.length < 50) return setError("Konten minimal 50 karakter");
    if (!categoryId) return setError("Kategori harus dipilih");

    if (status === "IN_REVIEW" && !allChecked) {
      setShowChecklist(true);
      return setError("Semua checklist jurnalistik harus dipenuhi sebelum submit");
    }

    // Confirmation dialog for review submission
    if (status === "IN_REVIEW") {
      const ok = await confirm({ message: "Artikel akan dikirim untuk review oleh editor. Lanjutkan?", variant: "warning", title: "Konfirmasi" });
      if (!ok) {
        return;
      }
    }

    setSaving(true);

    try {
      // If an autosave already created a server draft, converge onto it so we
      // update that record instead of creating a duplicate. Wait for any
      // in-flight autosave first so its freshly-created id is visible here.
      if (autosaveInFlightRef.current) {
        try { await autosaveInFlightRef.current; } catch { /* ignore */ }
      }
      const existingId = draftIdRef.current;
      const res = await fetch(existingId ? `/api/articles/${existingId}` : "/api/articles", {
        method: existingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildArticlePayload(latestRef.current, status)),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Gagal menyimpan artikel");
        setSaving(false);
        return;
      }

      // Clear autosave state after a successful manual save.
      try {
        localStorage.removeItem(AUTOSAVE_KEY);
        localStorage.removeItem(AUTOSAVE_DRAFTID_KEY);
      } catch { /* ignore */ }
      draftIdRef.current = null;
      success(status === "IN_REVIEW" ? "Artikel berhasil dikirim untuk review" : "Artikel berhasil disimpan sebagai draf");
      router.push("/panel/artikel");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
      setSaving(false);
    }
  };

  // Direct publish — for editors/chief editors who may publish without review.
  // The create API only accepts DRAFT/IN_REVIEW, so we save the draft first
  // (or reuse the autosaved one) then transition it to PUBLISHED via PUT.
  const handlePublish = async (schedTime?: string) => {
    setError("");

    if (!title.trim()) return setError("Judul wajib diisi");
    if (!content.trim()) return setError("Konten tidak boleh kosong");
    if (content.length < 50) return setError("Konten minimal 50 karakter");
    if (!categoryId) return setError("Kategori harus dipilih");

    let scheduledIso: string | undefined;
    if (schedTime) {
      const when = new Date(schedTime);
      if (Number.isNaN(when.getTime())) return setError("Tanggal jadwal tidak valid");
      if (when.getTime() <= Date.now()) return setError("Waktu jadwal harus di masa depan");
      scheduledIso = when.toISOString();
    }

    const ok = await confirm({
      message: scheduledIso
        ? `Artikel akan dijadwalkan terbit pada ${new Date(scheduledIso).toLocaleString("id-ID")}. Lanjutkan?`
        : "Artikel akan LANGSUNG diterbitkan dan tampil di situs tanpa melalui review. Lanjutkan?",
      variant: "warning",
      title: scheduledIso ? "Jadwalkan Publikasi" : "Terbitkan Sekarang",
    });
    if (!ok) return;

    setSaving(true);

    try {
      // Converge onto any autosaved draft so we publish that record, not a dup.
      if (autosaveInFlightRef.current) {
        try { await autosaveInFlightRef.current; } catch { /* ignore */ }
      }

      // Step 1 — ensure the article is persisted (create as DRAFT, or update the
      // existing autosaved draft). Mirrors the proven autosave save path.
      let id = draftIdRef.current;
      const saveRes = await fetch(id ? `/api/articles/${id}` : "/api/articles", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildArticlePayload(latestRef.current, "DRAFT")),
      });
      const saveData = await saveRes.json();
      if (!saveData.success) {
        setError(saveData.error || "Gagal menyimpan artikel");
        setSaving(false);
        return;
      }
      id = id || saveData.data?.id;
      if (!id) {
        setError("Gagal mendapatkan ID artikel untuk diterbitkan");
        setSaving(false);
        return;
      }

      // Step 2 — publish now, or schedule for later when scheduledIso is set.
      const pubRes = await fetch(`/api/articles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED", ...(scheduledIso ? { scheduledAt: scheduledIso } : {}) }),
      });
      const pubData = await pubRes.json();
      if (!pubData.success) {
        setError(pubData.error || (scheduledIso ? "Gagal menjadwalkan artikel" : "Gagal menerbitkan artikel"));
        setSaving(false);
        return;
      }

      try {
        localStorage.removeItem(AUTOSAVE_KEY);
        localStorage.removeItem(AUTOSAVE_DRAFTID_KEY);
      } catch { /* ignore */ }
      draftIdRef.current = null;
      setShowSchedule(false);
      setScheduleDate("");
      success(scheduledIso ? `Publikasi dijadwalkan pada ${new Date(scheduledIso).toLocaleString("id-ID")}` : "Artikel berhasil diterbitkan");
      router.push("/panel/artikel");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-txt-primary">
            Tulis Artikel Baru
          </h1>
          <p className="text-sm text-txt-secondary">
            Pastikan mengikuti standar jurnalistik
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Autosave-to-account status */}
          {(serverSaving || serverSavedAt) && (
            <span className="mr-1 flex items-center gap-1.5 text-xs text-txt-muted">
              {serverSaving ? (
                <><Loader2 size={13} className="animate-spin" /> Menyimpan ke akun…</>
              ) : (
                <>
                  <CheckCircle size={13} className="text-primary" />
                  Tersimpan ke akun
                  {serverSavedAt ? ` ${new Date(serverSavedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : ""}
                </>
              )}
            </span>
          )}
          {/* Save Draft */}
          <button
            onClick={() => handleSubmit("DRAFT")}
            disabled={saving}
            className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            <Save size={16} />
            Simpan Draf
          </button>
          {/* Submit for review */}
          {CAN_SUBMIT_REVIEW.includes(userRole) && (
            <button
              onClick={() => handleSubmit("IN_REVIEW")}
              disabled={saving}
              className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <Send size={16} />
              Kirim untuk Review
            </button>
          )}
          {/* Direct publish + schedule — editors/chief editors only (no review needed) */}
          {EDITOR_ROLES.includes(userRole) && (
            <>
              <button
                onClick={() => handlePublish()}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-secondary-dark disabled:opacity-50"
              >
                <Rocket size={16} />
                Terbitkan
              </button>
              <button
                onClick={() => setShowSchedule((v) => !v)}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
              >
                <CalendarClock size={16} />
                Jadwalkan
              </button>
            </>
          )}
        </div>
      </div>

      {/* Schedule-publish panel — editors/chief editors only */}
      {EDITOR_ROLES.includes(userRole) && showSchedule && (
        <div className="mb-4 rounded-[12px] border border-blue-300 bg-blue-50 p-4 shadow-sm">
          <label className="mb-2 block text-sm font-medium text-blue-800">
            Pilih tanggal &amp; waktu publikasi artikel ini
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
              onClick={() => handlePublish(scheduleDate)}
              disabled={saving || !scheduleDate}
              className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <CalendarClock size={14} />
              Konfirmasi Jadwal
            </button>
            <button
              onClick={() => { setShowSchedule(false); setScheduleDate(""); }}
              className="rounded-md px-4 py-2 text-sm font-medium text-txt-secondary hover:bg-surface-secondary"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Auto-save recovery banner */}
      {showAutosaveBanner && (
        <div className="mb-4 flex items-center gap-3 rounded-[12px] border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span className="flex-1">Ada draf tersimpan otomatis. Muat draf?</span>
          <button
            onClick={loadAutosaveDraft}
            className="rounded-full bg-yellow-500 px-3 py-1 text-xs font-semibold text-white hover:bg-yellow-600"
          >
            Muat
          </button>
          <button
            onClick={discardAutosaveDraft}
            className="rounded-full border border-yellow-400 px-3 py-1 text-xs font-medium text-yellow-700 hover:bg-yellow-100"
          >
            Abaikan
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-[12px] bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Trending Suggestions */}
      {trendingSuggestions.length > 0 && showSuggestions && (
        <div className="mb-4 rounded-[12px] border border-border bg-surface p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-light">
                <Lightbulb size={14} className="text-primary" />
              </div>
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
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary hover:text-primary ${
                  item.hot
                    ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-50"
                    : "border-border bg-surface-secondary text-txt-secondary"
                }`}
              >
                {item.hot && <TrendingUp size={11} />}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main editor */}
        <div className="space-y-4 lg:col-span-2">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Judul Artikel"
            className="input w-full px-4 py-3 text-xl font-bold"
          />

          {/* Riset & Tulis dengan Perplexity */}
          <div className="rounded-[12px] border border-primary/20 bg-primary-light/40 p-3">
            {!showResearch ? (
              <button
                type="button"
                onClick={() => setShowResearch(true)}
                className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                <Search size={16} />
                Riset &amp; Tulis dengan Perplexity AI
                <span className="text-[10px] font-normal text-txt-muted">— riset web real-time + sumber otomatis</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-primary">
                    <Search size={16} /> Riset &amp; Tulis dengan Perplexity
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowResearch(false)}
                    className="text-txt-muted hover:text-txt-secondary"
                    aria-label="Tutup"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="text-xs leading-relaxed text-txt-secondary">
                  Perplexity meriset topik dari berita Indonesia terbaru, lalu memasukkan
                  draf ke editor &amp; mengisi daftar Sumber otomatis. Isi <strong>Judul</strong> di atas
                  sebagai topik, lalu pilih mode.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setResearchMode("draft")}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      researchMode === "draft"
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-surface text-txt-secondary"
                    }`}
                  >
                    Draf artikel lengkap
                  </button>
                  <button
                    type="button"
                    onClick={() => setResearchMode("research")}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      researchMode === "research"
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-surface text-txt-secondary"
                    }`}
                  >
                    Bahan riset saja
                  </button>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-txt-secondary">Gaya penulisan</label>
                  <select
                    value={researchPersona}
                    onChange={(e) => setResearchPersona(e.target.value)}
                    className="input w-full text-sm"
                  >
                    {PERPLEXITY_PERSONAS.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-txt-secondary">
                  <input
                    type="checkbox"
                    checked={researchImages}
                    onChange={(e) => setResearchImages(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  Sertakan foto dari sumber lain (2–3 foto, foto pertama jadi gambar utama)
                </label>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-txt-secondary">
                    Arahan / fokus tambahan (opsional)
                  </label>
                  <textarea
                    rows={4}
                    value={researchNotes}
                    onChange={(e) => setResearchNotes(e.target.value)}
                    placeholder={"Tuliskan arahan khusus untuk artikel ini, mis:\n- Sudut: dampak ke pelaku UMKM Bandung\n- Sertakan jadwal & syarat terbaru\n- Bandingkan dengan kebijakan tahun lalu"}
                    className="input w-full resize-none text-sm leading-relaxed"
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {PERPLEXITY_NOTE_HINTS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() =>
                          setResearchNotes((prev) => {
                            if (prev.includes(h)) return prev;
                            const sep = prev.trim() ? (prev.trim().endsWith(".") ? " " : ". ") : "";
                            return `${prev.trim()}${sep}${h}`;
                          })
                        }
                        className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] text-txt-secondary hover:border-primary hover:text-primary transition-colors"
                      >
                        + {h}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-txt-muted">
                    Arahan global (gaya & SEO) diatur di Pengaturan → AI. Kotak ini untuk fokus spesifik artikel ini.
                  </p>
                </div>
                {!title.trim() && !researchNotes.trim() && (
                  <p className="flex items-center gap-1 text-[11px] font-medium text-amber-600">
                    <AlertCircle size={12} /> Isi <strong>Judul</strong> atau tulis topik di kotak arahan di atas. (Judul bisa digenerate setelah draf jadi.)
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={runResearch}
                    disabled={researching}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-40"
                  >
                    {researching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {researching ? "Meriset & menulis…" : "Jalankan Riset"}
                  </button>
                  <span className="text-[10px] text-txt-muted">
                    Hasil langsung mengisi kolom artikel (judul, ringkasan, tags, SEO, isi). Tinjau sebelum publikasi.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Editor */}
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
              <button
                type="button"
                onClick={addSource}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus size={14} /> Tambah Sumber
              </button>
            </div>
            <div className="space-y-3">
              {sources.map((source, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-[12px] border border-border p-3">
                  <input
                    type="text"
                    placeholder="Nama narasumber *"
                    value={source.name}
                    onChange={(e) => updateSource(i, "name", e.target.value)}
                    className="input text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Jabatan"
                    value={source.title}
                    onChange={(e) => updateSource(i, "title", e.target.value)}
                    className="input text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Institusi"
                    value={source.institution}
                    onChange={(e) => updateSource(i, "institution", e.target.value)}
                    className="input text-sm"
                  />
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="URL referensi"
                      value={source.url}
                      onChange={(e) => updateSource(i, "url", e.target.value)}
                      className="input flex-1 text-sm"
                    />
                    {sources.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSource(i)}
                        className="rounded p-1.5 text-red-400 hover:bg-red-50"
                      >
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
            <button
              type="button"
              onClick={() => setShowSeo(!showSeo)}
              className="flex w-full items-center justify-between px-6 py-3 text-sm font-medium text-txt-primary uppercase tracking-wider"
            >
              Pengaturan SEO
              <ChevronDown size={16} className={showSeo ? "rotate-180" : ""} />
            </button>
            {showSeo && (
              <div className="space-y-3 border-t border-border px-6 py-4">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label htmlFor="artikel-seo-title" className="text-sm font-medium text-txt-primary">SEO Title ({seoTitle.length}/70)</label>
                    <AiButton feature="seo_title" setter={setSeoTitle} />
                  </div>
                  <input
                    id="artikel-seo-title"
                    type="text"
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    maxLength={70}
                    placeholder={title || "Judul untuk mesin pencari"}
                    className="input w-full text-sm"
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label htmlFor="artikel-seo-desc" className="text-sm font-medium text-txt-primary">Meta Description ({seoDescription.length}/160)</label>
                    <AiButton feature="meta_description" setter={setSeoDescription} />
                  </div>
                  <textarea
                    id="artikel-seo-desc"
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    maxLength={160}
                    rows={2}
                    placeholder="Deskripsi singkat untuk hasil pencarian"
                    className="input w-full text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Category */}
          <div className="rounded-[12px] border border-border bg-surface p-6">
            <label htmlFor="artikel-kategori" className="mb-2 block text-sm font-medium text-txt-primary">
              Kategori *
            </label>
            <select
              id="artikel-kategori"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input w-full"
            >
              <option value="">Pilih Kategori</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Pilih Penulis — only for admin/editor */}
          {EDITOR_ROLES.includes(userRole) && (
            <div className="rounded-[12px] border border-border bg-surface p-6">
              <label htmlFor="artikel-penulis" className="mb-2 block text-sm font-medium text-txt-primary">
                Penulis
              </label>
              <select
                id="artikel-penulis"
                value={selectedAuthorId}
                onChange={(e) => setSelectedAuthorId(e.target.value)}
                className="input w-full"
              >
                <option value="">Saya sendiri</option>
                {users
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
            <label htmlFor="artikel-editor" className="mb-2 block text-sm font-medium text-txt-primary">
              Editor
            </label>
            <select
              id="artikel-editor"
              value={selectedEditorId}
              onChange={(e) => setSelectedEditorId(e.target.value)}
              className="input w-full"
            >
              <option value="">Otomatis (random)</option>
              {/* Editor / Kepala Editor boleh menugaskan dirinya sendiri sebagai editor */}
              {["EDITOR", "CHIEF_EDITOR"].includes(userRole) && session?.user?.id && (
                <option value={session.user.id}>Saya sendiri (sebagai editor)</option>
              )}
              {users
                .filter(u => ["EDITOR", "CHIEF_EDITOR", "SUPER_ADMIN"].includes(u.role) && u.id !== session?.user?.id)
                .map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({roleLabelsMap[u.role] || u.role})</option>
                ))
              }
            </select>
          </div>

          {/* Tags */}
          <div className="rounded-[12px] border border-border bg-surface p-6">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="artikel-tags" className="text-sm font-medium text-txt-primary">Tags</label>
              <AiButton feature="tags" setter={setTags} />
            </div>
            <input
              id="artikel-tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tag1, Tag2, Tag3"
              className="input w-full"
            />
            <p className="mt-1 text-xs text-txt-muted">Pisahkan dengan koma</p>
          </div>

          {/* Excerpt */}
          <div className="rounded-[12px] border border-border bg-surface p-6">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="artikel-ringkasan" className="text-sm font-medium text-txt-primary">Ringkasan</label>
              <AiButton feature="summary" setter={setExcerpt} />
            </div>
            <textarea
              id="artikel-ringkasan"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
              placeholder="Ringkasan singkat artikel"
              maxLength={500}
              className="input w-full"
            />
          </div>

          {/* Journalism Checklist */}
          <div className="rounded-[12px] border border-primary/20 bg-primary-50 p-4">
            <button
              type="button"
              onClick={() => setShowChecklist(!showChecklist)}
              className="flex w-full items-center justify-between text-sm font-bold text-primary-dark"
            >
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
                      onChange={(e) =>
                        setChecklist({ ...checklist, [item.key]: e.target.checked })
                      }
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
        </div>
      </div>
    </div>
  );
}
