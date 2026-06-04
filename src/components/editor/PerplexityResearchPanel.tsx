"use client";

/**
 * Perplexity "Riset & Tulis" panel — shared by the new-article and edit-article
 * pages so the research UI + fill logic live in ONE place (previously this block
 * was copy-pasted in both, risking silent divergence).
 *
 * Owns its own UI state (mode, persona, images, notes, open/loading). The parent
 * passes the current article-field values + their setters; this panel calls
 * /api/ai/research and fills ONLY the empty fields (never overwrites the editor's
 * input), appends the drafted HTML + web images to the body, and merges the cited
 * sources (deduped by URL).
 */

import { useState, type Dispatch, type SetStateAction } from "react";
import { Search, X, Sparkles, Loader2, AlertCircle } from "lucide-react";
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
  const [showResearch, setShowResearch] = useState(false);
  const [researchMode, setResearchMode] = useState<"draft" | "research">("draft");
  const [researchPersona, setResearchPersona] = useState("");
  const [researchImages, setResearchImages] = useState(true);
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

      // Auto-add the cited sources (dedup by URL).
      const cited: { title: string | null; url: string }[] = d.sources || [];
      if (cited.length > 0) {
        const newSources: ResearchSource[] = cited.slice(0, 12).map((s) => {
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

      onSuccess(
        `Selesai — kolom artikel terisi dari riset${cited.length ? ` + ${cited.length} sumber` : ""}${imgs.length ? ` + ${imgs.length} foto` : ""}. Tinjau & sunting sebelum publikasi.`,
      );
      setShowResearch(false);
      setResearchNotes("");
    } catch {
      onError("Gagal menghubungi layanan riset Perplexity");
    } finally {
      setResearching(false);
    }
  };

  return (
    <div className="rounded-[12px] border border-primary/20 bg-primary-light/40 p-3">
      {!showResearch ? (
        <button
          type="button"
          onClick={() => setShowResearch(true)}
          className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <Search size={16} />
          Riset &amp; Tulis dengan Perplexity AI
          <span className="text-[10px] font-normal text-txt-muted">
            — riset web real-time + sumber otomatis
          </span>
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
            Perplexity meriset topik dari berita Indonesia terbaru, lalu memasukkan draf ke
            editor &amp; mengisi daftar Sumber otomatis. Isi <strong>Judul</strong> di atas
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
            <label className="mb-1 block text-[11px] font-semibold text-txt-secondary">
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
                  className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] text-txt-secondary hover:border-primary hover:text-primary transition-colors"
                >
                  + {h}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-txt-muted">
              Arahan global (gaya &amp; SEO) diatur di Pengaturan → AI. Kotak ini untuk fokus
              spesifik artikel ini.
            </p>
          </div>
          {!title.trim() && !researchNotes.trim() && (
            <p className="flex items-center gap-1 text-[11px] font-medium text-amber-600">
              <AlertCircle size={12} /> Isi <strong>Judul</strong> atau tulis topik di kotak
              arahan di atas. (Judul bisa digenerate setelah draf jadi.)
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={runResearch}
              disabled={researching}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-40"
            >
              {researching ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              {researching ? "Meriset & menulis…" : "Jalankan Riset"}
            </button>
            <span className="text-[10px] text-txt-muted">
              Hasil langsung mengisi kolom artikel (judul, ringkasan, tags, SEO, isi). Tinjau
              sebelum publikasi.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
