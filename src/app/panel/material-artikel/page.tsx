"use client";

/**
 * Material Artikel — bulk-generate Article DRAFTs from (photo + notes) pairs.
 *
 * Editor uploads N photos, attaches a free-text note per photo (paste from
 * press release / interview / fact sheet), picks a category, hits Generate.
 * Each pair → one DRAFT article with the photo embedded as the first <img>
 * in the body. Drafts land in /panel/artikel for review.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  X,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Info,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { EDITOR_ROLES } from "@/lib/roles";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Slot {
  /** Stable id for keying React rows; not sent to server. */
  uid: string;
  file: File;
  previewUrl: string;
  note: string;
  status: "idle" | "generating" | "done" | "failed";
  resultArticleId?: string;
  resultSlug?: string;
  resultTitle?: string;
  errorMessage?: string;
}

const VALID_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS = 20;

function bytesHuman(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MaterialArtikelPage() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = session?.user?.role || "";
  const { success: showSuccess, error: showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [batchName, setBatchName] = useState<string>("");
  const [generating, setGenerating] = useState<boolean>(false);

  // Gate access — EDITOR_ROLES = SUPER_ADMIN, CHIEF_EDITOR, EDITOR
  if (
    sessionStatus !== "loading" &&
    session &&
    !EDITOR_ROLES.includes(userRole)
  ) {
    redirect("/panel/dashboard");
  }

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const json = await res.json();
        setCategories(Array.isArray(json.data) ? json.data : []);
      }
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Revoke object URLs on unmount + when slots change. Browsers leak the
  // object URL until the page is unloaded otherwise.
  useEffect(() => {
    return () => {
      slots.forEach((s) => {
        try {
          URL.revokeObjectURL(s.previewUrl);
        } catch {
          /* */
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = MAX_PHOTOS - slots.length;
    if (remaining <= 0) {
      showError(`Sudah mencapai maksimum ${MAX_PHOTOS} foto per batch.`);
      return;
    }

    const incoming: Slot[] = [];
    let rejected = 0;
    for (const file of Array.from(files).slice(0, remaining)) {
      if (!VALID_TYPES.includes(file.type)) {
        rejected++;
        continue;
      }
      if (file.size > MAX_BYTES) {
        rejected++;
        continue;
      }
      incoming.push({
        uid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        note: "",
        status: "idle",
      });
    }

    if (incoming.length === 0) {
      showError(
        rejected > 0
          ? "Semua file ditolak — hanya JPG/PNG/WebP ≤ 5 MB yang diterima."
          : "Tidak ada file yang valid.",
      );
      return;
    }
    if (rejected > 0) {
      showError(
        `${rejected} file di-skip (format tidak didukung atau > 5 MB).`,
      );
    }
    setSlots((prev) => [...prev, ...incoming]);
  }

  function removeSlot(uid: string) {
    setSlots((prev) => {
      const target = prev.find((s) => s.uid === uid);
      if (target) {
        try {
          URL.revokeObjectURL(target.previewUrl);
        } catch {
          /* */
        }
      }
      return prev.filter((s) => s.uid !== uid);
    });
  }

  function updateNote(uid: string, note: string) {
    setSlots((prev) =>
      prev.map((s) => (s.uid === uid ? { ...s, note } : s)),
    );
  }

  function clearAll() {
    slots.forEach((s) => {
      try {
        URL.revokeObjectURL(s.previewUrl);
      } catch {
        /* */
      }
    });
    setSlots([]);
  }

  async function handleGenerate() {
    if (!categoryId) {
      showError("Pilih kategori dulu.");
      return;
    }
    if (slots.length === 0) {
      showError("Tambahkan minimal 1 foto.");
      return;
    }
    const tooShort = slots.filter((s) => s.note.trim().length < 30);
    if (tooShort.length > 0) {
      showError(
        `${tooShort.length} foto belum punya catatan ≥ 30 karakter.`,
      );
      return;
    }

    setGenerating(true);
    setSlots((prev) => prev.map((s) => ({ ...s, status: "generating" as const })));

    try {
      const fd = new FormData();
      fd.append("categoryId", categoryId);
      if (batchName.trim()) fd.append("batchName", batchName.trim());
      slots.forEach((s, i) => {
        fd.append(`photo_${i}`, s.file);
        fd.append(`note_${i}`, s.note);
      });

      const res = await fetch("/api/panel/generate-from-materials", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Gagal generate");
      }

      const { created, failed, results } = json.data as {
        created: number;
        failed: number;
        results: Array<{
          photoIndex: number;
          ok: boolean;
          articleId?: string;
          slug?: string;
          title?: string;
          error?: string;
        }>;
      };

      // Map results back to slots by index.
      setSlots((prev) =>
        prev.map((s, i) => {
          const r = results.find((x) => x.photoIndex === i);
          if (!r) return { ...s, status: "failed" as const, errorMessage: "Tidak ada respons" };
          return r.ok
            ? {
                ...s,
                status: "done" as const,
                resultArticleId: r.articleId,
                resultSlug: r.slug,
                resultTitle: r.title,
              }
            : {
                ...s,
                status: "failed" as const,
                errorMessage: r.error || "Gagal",
              };
        }),
      );

      if (failed === 0) {
        showSuccess(`${created} draf berhasil dibuat.`);
      } else {
        showSuccess(
          `${created} berhasil, ${failed} gagal. Cek detail per foto.`,
        );
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal generate");
      setSlots((prev) =>
        prev.map((s) =>
          s.status === "generating"
            ? { ...s, status: "failed" as const, errorMessage: "Request gagal" }
            : s,
        ),
      );
    } finally {
      setGenerating(false);
    }
  }

  if (sessionStatus === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  const allDone = slots.length > 0 && slots.every((s) => s.status === "done");

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={24} className="text-primary" />
            <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">
              Material Artikel
            </h1>
          </div>
          <p className="mt-1 text-sm text-txt-secondary">
            Generate artikel dari kumpulan foto + catatan. 1 foto + catatan
            kontekstualnya = 1 draft artikel. Draft masuk ke{" "}
            <Link href="/panel/artikel?status=DRAFT" className="text-primary hover:underline">
              /panel/artikel
            </Link>
            .
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <Info size={16} className="mt-0.5 text-blue-600 shrink-0" />
          <div className="text-xs text-blue-700 space-y-1">
            <p>
              Cara pakai: <strong>(1)</strong> upload foto-foto,{" "}
              <strong>(2)</strong> tempel catatan/cuplikan dokumen ke
              setiap kotak <em>Catatan</em>, <strong>(3)</strong> pilih
              kategori, <strong>(4)</strong> klik Generate Semua.
            </p>
            <p>
              AI akan menulis artikel berbasis catatan tersebut sebagai
              satu-satunya sumber fakta. Foto otomatis disisipkan di
              paling atas body artikel.
            </p>
          </div>
        </div>
      </div>

      {/* Batch settings */}
      <div className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-txt-secondary">
          Pengaturan Batch
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-txt-secondary">
              Kategori <span className="text-red-500">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={generating}
              className="input w-full px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">— Pilih kategori —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-txt-muted">
              Semua draft di batch ini akan masuk kategori yang sama.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-txt-secondary">
              Nama Batch (opsional)
            </label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              disabled={generating}
              placeholder="mis. Liputan Sidang KPK 28 Apr"
              className="input w-full px-3 py-2 text-sm disabled:opacity-50"
              maxLength={100}
            />
            <p className="mt-1 text-xs text-txt-muted">
              Hanya untuk audit log — tidak tampil di artikel.
            </p>
          </div>
        </div>
      </div>

      {/* Photo + notes section */}
      <div className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-txt-secondary">
            Foto &amp; Catatan ({slots.length}/{MAX_PHOTOS})
          </h2>
          <div className="flex items-center gap-2">
            {slots.length > 0 && !generating && (
              <button
                onClick={clearAll}
                className="btn-ghost flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-red-500 hover:text-red-700"
              >
                <Trash2 size={12} />
                Hapus Semua
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={generating || slots.length >= MAX_PHOTOS}
              className="btn-primary flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              <Plus size={12} />
              Tambah Foto
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(e) => {
                handleFiles(e.target.files);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
          </div>
        </div>

        {slots.length === 0 ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={generating}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface-secondary py-12 text-txt-muted hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            <ImageIcon size={36} />
            <p className="text-sm font-medium">Klik untuk upload foto</p>
            <p className="text-xs">JPG / PNG / WebP, ≤ 5 MB per file, max {MAX_PHOTOS} foto</p>
          </button>
        ) : (
          <div className="space-y-4">
            {slots.map((s, i) => (
              <div
                key={s.uid}
                className={`rounded-xl border p-4 transition-colors ${
                  s.status === "done"
                    ? "border-primary/30 bg-primary-light"
                    : s.status === "failed"
                      ? "border-red-300 bg-red-50"
                      : s.status === "generating"
                        ? "border-blue-300 bg-blue-50"
                        : "border-border bg-surface-secondary"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row">
                  {/* Photo preview */}
                  <div className="relative shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.previewUrl}
                      alt={s.file.name}
                      className="h-32 w-full rounded-lg object-cover sm:w-48"
                    />
                    <span className="absolute left-2 top-2 rounded-full bg-on-surface/90 px-2 py-0.5 text-[10px] font-bold text-white">
                      #{i + 1}
                    </span>
                    {s.status === "idle" && !generating && (
                      <button
                        onClick={() => removeSlot(s.uid)}
                        className="absolute right-2 top-2 rounded-full bg-red-500 p-1 text-white shadow hover:bg-red-600"
                        aria-label="Hapus foto"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Note + status */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-txt-muted">
                      <span className="truncate font-mono">{s.file.name}</span>
                      <span>·</span>
                      <span>{bytesHuman(s.file.size)}</span>
                      {s.status === "generating" && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1 font-semibold text-blue-600">
                            <Loader2 size={10} className="animate-spin" />
                            Generating…
                          </span>
                        </>
                      )}
                      {s.status === "done" && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1 font-semibold text-primary">
                            <CheckCircle size={10} />
                            Selesai
                          </span>
                        </>
                      )}
                      {s.status === "failed" && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1 font-semibold text-red-600">
                            <AlertCircle size={10} />
                            Gagal
                          </span>
                        </>
                      )}
                    </div>

                    <textarea
                      value={s.note}
                      onChange={(e) => updateNote(s.uid, e.target.value)}
                      disabled={generating || s.status === "done"}
                      placeholder="Tempel catatan, fakta, kutipan, atau cuplikan dokumen yang relevan dengan foto ini. Minimal 30 karakter — semakin lengkap konteksnya, semakin akurat hasilnya."
                      rows={5}
                      className="input w-full px-3 py-2 text-sm disabled:opacity-50"
                      maxLength={8000}
                    />
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={
                          s.note.trim().length < 30
                            ? "text-red-500"
                            : "text-txt-muted"
                        }
                      >
                        {s.note.trim().length} / 8000 karakter
                        {s.note.trim().length > 0 && s.note.trim().length < 30 && (
                          <span> (min 30)</span>
                        )}
                      </span>
                      {s.status === "done" && s.resultArticleId && (
                        <Link
                          href={`/panel/artikel/${s.resultArticleId}/edit`}
                          className="flex items-center gap-1 font-semibold text-primary hover:underline"
                        >
                          {s.resultTitle?.slice(0, 60)}
                          <ArrowRight size={12} />
                        </Link>
                      )}
                      {s.status === "failed" && s.errorMessage && (
                        <span className="text-red-600">{s.errorMessage}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      {slots.length > 0 && (
        <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-ambient">
          <div className="text-sm text-txt-secondary">
            {allDone ? (
              <span className="font-semibold text-primary">
                Semua draft selesai. Buka{" "}
                <Link
                  href="/panel/artikel?status=DRAFT"
                  className="underline"
                >
                  panel artikel
                </Link>{" "}
                untuk review.
              </span>
            ) : (
              <>
                {slots.length} foto siap di-generate. AI akan dipanggil{" "}
                {slots.length}× — perkiraan ~{slots.length * 6}–{slots.length * 12}{" "}
                detik.
              </>
            )}
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || slots.length === 0 || allDone}
            className="btn-primary flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {generating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {generating
              ? "Generating…"
              : allDone
                ? "Selesai"
                : `Generate ${slots.length} Draft`}
          </button>
        </div>
      )}
    </div>
  );
}
