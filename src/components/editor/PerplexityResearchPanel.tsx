"use client";

/**
 * Perplexity "Riset & Tulis" — shared by the new-article and edit-article pages
 * so the research UI + fill logic live in ONE place. Renders as a trigger button
 * that opens an elegant modal (Editorial-Authority navy) with the research
 * controls. Calls /api/ai/research, fills ONLY the empty fields (never
 * overwrites the editor's input), appends the drafted HTML + web images to the
 * body, and (optionally) merges the cited sources.
 *
 * Options:
 *   - Foto referensi (web images → featured + inline illustrations)
 *   - Rentang berita (recency: minggu/bulan/tahun/semua)
 *   - Sumber & narasumber: include or HIDE; and how many to include (pick
 *     "Semua" when the auto-found references feel too few)
 */

import { useState, type Dispatch, type SetStateAction } from "react";
import { Search, X, Sparkles, Loader2, AlertCircle, Clock, ImageIcon, BookOpen } from "lucide-react";
import { PERPLEXITY_PERSONAS, PERPLEXITY_NOTE_HINTS } from "@/lib/perplexity-personas";

export interface ResearchSource {
  name: string;
  title: string;
  institution: string;
  url: string;
}

interface PerplexityResearchPanelProps {
  /** Current article-field values — used both as the topic and to decide which
   *  fields are still empty (only empty fields get filled). */
  title: string;
  excerpt: string;
  tags: string;
  seoTitle: string;
  seoDescription: string;
  featuredImage: string;
  setTitle: (s: string) => void;
  setExcerpt: (s: string) => void;
  setTags: (s: string) => void;
  setSeoTitle: (s: string) => void;
  setSeoDescription: (s: string) => void;
  setFeaturedImage: (s: string) => void;
  setContent: Dispatch<SetStateAction<string>>;
  setSources: Dispatch<SetStateAction<ResearchSource[]>>;
  setShowSeo: (b: boolean) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

function clampToMax(val: string, max: number): string {
  if (val.length <= max) return val;
  return val.slice(0, max - 1).trimEnd() + "…";
}

const RECENCY_OPTIONS = [
  { v: "week", l: "1 minggu" },
  { v: "month", l: "1 bulan" },
  { v: "year", l: "1 tahun" },
  { v: "all", l: "Semua waktu" },
] as const;
type Recency = (typeof RECENCY_OPTIONS)[number]["v"];

const SOURCE_COUNTS = [3, 5, 8, 999] as const; // 999 = "Semua"

export default function PerplexityResearchPanel({
  title,
  excerpt,
  tags,
  seoTitle,
  seoDescription,
  featuredImage,
  setTitle,
  setExcerpt,
  setTags,
  setSeoTitle,
  setSeoDescription,
  setFeaturedImage,
  setContent,
  setSources,
  setShowSeo,
  onError,
  onSuccess,
}: PerplexityResearchPanelProps) {
  const [open, setOpen] = useState(false);
  const [researchMode, setResearchMode] = useState<"draft" | "research">("draft");
  const [researchPersona, setResearchPersona] = useState("");
  const [researchImages, setResearchImages] = useState(true);
  const [recency, setRecency] = useState<Recency>("month");
  const [includeSources, setIncludeSources] = useState(true);
  const [maxSources, setMaxSources] = useState<number>(8);
  const [researchNotes, setResearchNotes] = useState("");
  const [researching, setResearching] = useState(false);

  const runResearch = async () => {
    // Topic = the title, OR (when writing from scratch) the notes box.
    const topic = title.trim() || researchNotes.trim();
    if (!topic) {
      onError("Isi Judul atau kolom arahan/topik dulu sebelum riset");
      return;
    }
    setResearching(true);
    onError("");
    try {
      const res = await fetch("/api/ai/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          mode: researchMode,
          notes: researchNotes,
          persona: researchPersona,
          includeImages: researchImages,
          recency,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        onError(data.error || "Gagal menjalankan riset Perplexity");
        return;
      }
      const d = data.data || {};

      // Fill EVERY field directly — empty fields are filled; existing user input
      // is kept (never overwritten).
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
        if ((f.seoTitle || f.metaDescription) && (!seoTitle.trim() || !seoDescription.trim()))
          setShowSeo(true);
      }

      // Optional web images (2-3). First fills the featured image (if empty); the
      // rest are appended into the body as captioned figures (with source credit).
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

      // Cited sources — only when the editor opted to include them, capped at the
      // chosen count (999 = all). Hidden entirely when the toggle is off.
      const cited: { title: string | null; url: string }[] = d.sources || [];
      let addedSources = 0;
      if (includeSources && cited.length > 0) {
        const limit = maxSources >= 999 ? cited.length : maxSources;
        const newSources: ResearchSource[] = cited.slice(0, limit).map((s) => {
          let host = "";
          try {
            host = new URL(s.url).hostname.replace(/^www\./, "");
          } catch {
            /* keep blank */
          }
          return { name: s.title || host || "Sumber", title: "", institution: host, url: s.url };
        });
        addedSources = newSources.length;
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

      onSuccess(
        `Selesai — kolom artikel terisi dari riset${addedSources ? ` + ${addedSources} sumber` : includeSources ? "" : " (sumber disembunyikan)"}${imgs.length ? ` + ${imgs.length} foto` : ""}. Tinjau & sunting sebelum publikasi.`,
      );
      setOpen(false);
      setResearchNotes("");
    } catch {
      onError("Gagal menghubungi layanan riset Perplexity");
    } finally {
      setResearching(false);
    }
  };

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
      active
        ? "border-primary bg-primary text-white"
        : "border-border bg-surface text-txt-secondary hover:border-primary/40"
    }`;

  return (
    <>
      {/* Trigger */}
      <div className="rounded-lg border border-primary/20 bg-primary-light/40 p-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <Search size={16} />
          Riset &amp; Tulis dengan Perplexity AI
          <span className="hidden text-[10px] font-normal text-txt-muted sm:inline">
            — riset web real-time + sumber otomatis
          </span>
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Riset & Tulis dengan Perplexity"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => !researching && setOpen(false)}
          />
          <div className="relative z-10 flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border bg-primary px-5 py-4 text-on-primary">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Search size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-lg font-bold leading-tight">Riset &amp; Tulis dengan Perplexity</h3>
                <p className="text-xs text-white/60">Riset web real-time → mengisi draf + sumber otomatis</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {/* Mode */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-txt-muted">
                  Mode
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setResearchMode("draft")} className={pill(researchMode === "draft")}>
                    Draf artikel lengkap
                  </button>
                  <button type="button" onClick={() => setResearchMode("research")} className={pill(researchMode === "research")}>
                    Bahan riset saja
                  </button>
                </div>
              </div>

              {/* Persona */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-txt-muted">
                  Gaya penulisan
                </label>
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

              {/* Recency */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-txt-muted">
                  <Clock size={12} /> Rentang berita
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {RECENCY_OPTIONS.map((o) => (
                    <button key={o.v} type="button" onClick={() => setRecency(o.v)} className={pill(recency === o.v)}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Foto referensi */}
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-surface-secondary/40 p-3">
                <input
                  type="checkbox"
                  checked={researchImages}
                  onChange={(e) => setResearchImages(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                />
                <span className="text-xs font-medium text-txt-secondary">
                  <span className="flex items-center gap-1.5"><ImageIcon size={13} className="text-primary" /> Sertakan foto referensi dari web</span>
                  <span className="mt-0.5 block text-[10px] font-normal text-txt-muted">
                    2–3 foto; foto pertama jadi gambar utama, sisanya ilustrasi di badan artikel.
                  </span>
                </span>
              </label>

              {/* Sumber & narasumber */}
              <div className="rounded-lg border border-border bg-surface-secondary/40 p-3">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={includeSources}
                    onChange={(e) => setIncludeSources(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-xs font-medium text-txt-secondary">
                    <span className="flex items-center gap-1.5"><BookOpen size={13} className="text-primary" /> Sertakan sumber &amp; narasumber dari riset</span>
                    <span className="mt-0.5 block text-[10px] font-normal text-txt-muted">
                      Matikan bila sumber/narasumber tidak ingin ditampilkan di artikel.
                    </span>
                  </span>
                </label>
                {includeSources && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-7">
                    <span className="text-[11px] text-txt-secondary">Jumlah sumber</span>
                    <select
                      value={maxSources}
                      onChange={(e) => setMaxSources(Number(e.target.value))}
                      className="input h-8 w-auto py-0 text-xs"
                    >
                      {SOURCE_COUNTS.map((n) => (
                        <option key={n} value={n}>{n >= 999 ? "Semua" : n}</option>
                      ))}
                    </select>
                    <span className="text-[10px] text-txt-muted">Pilih &quot;Semua&quot; jika terasa kurang referensi.</span>
                  </div>
                )}
              </div>

              {/* Notes + hints */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-txt-muted">
                  Arahan / fokus tambahan <span className="font-normal normal-case">(opsional)</span>
                </label>
                <textarea
                  rows={4}
                  value={researchNotes}
                  onChange={(e) => setResearchNotes(e.target.value)}
                  placeholder={
                    "Tuliskan arahan khusus untuk artikel ini, mis:\n- Sudut: dampak ke pelaku UMKM Bandung\n- Sertakan jadwal & syarat terbaru\n- Bandingkan dengan kebijakan tahun lalu"
                  }
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
                      className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] text-txt-secondary transition-colors hover:border-primary hover:text-primary"
                    >
                      + {h}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-txt-muted">
                  Arahan global (gaya &amp; SEO) diatur di Pengaturan → AI. Kotak ini untuk fokus spesifik artikel ini.
                </p>
              </div>

              {!title.trim() && !researchNotes.trim() && (
                <p className="flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
                  <AlertCircle size={12} /> Isi <strong>Judul</strong> atau tulis topik di kotak arahan. (Judul bisa digenerate setelah draf jadi.)
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-border bg-surface px-5 py-3">
              <span className="hidden text-[10px] leading-tight text-txt-muted sm:block">
                Hasil mengisi kolom artikel (judul, ringkasan, tags, SEO, isi). Tinjau sebelum publikasi.
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-txt-secondary transition-colors hover:bg-surface-secondary"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={runResearch}
                  disabled={researching}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-40"
                >
                  {researching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {researching ? "Meriset & menulis…" : "Jalankan Riset"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
