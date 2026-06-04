"use client";

/**
 * Material Artikel — bulk-generate Article DRAFTs from one source document
 * + N photos. Document is the only source of facts. AI splits the document
 * into N angles, one per photo. Each draft ships with the photo embedded
 * as a <figure> at the top, with AI-written caption + "Sumber: Kartawarta"
 * credit.
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
  FileText,
  Upload,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { EDITOR_ROLES } from "@/lib/roles";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Slot {
  uid: string;
  file: File;
  previewUrl: string;
  status: "idle" | "generating" | "done" | "failed";
  resultArticleId?: string;
  resultSlug?: string;
  resultTitle?: string;
  errorMessage?: string;
}

const VALID_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VALID_DOC_EXT = [".docx", ".pdf", ".txt", ".md"];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DOC_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS = 20;

function bytesHuman(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isValidDocFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return VALID_DOC_EXT.some((ext) => lower.endsWith(ext));
}

export default function MaterialArtikelPage() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = session?.user?.role || "";
  const { success: showSuccess, error: showError } = useToast();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [batchName, setBatchName] = useState<string>("");
  const [generating, setGenerating] = useState<boolean>(false);

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

  function handlePhotoFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = MAX_PHOTOS - slots.length;
    if (remaining <= 0) {
      showError(`Sudah mencapai maksimum ${MAX_PHOTOS} foto per batch.`);
      return;
    }

    const incoming: Slot[] = [];
    let rejected = 0;
    for (const file of Array.from(files).slice(0, remaining)) {
      if (!VALID_TYPES.includes(file.type) || file.size > MAX_BYTES) {
        rejected++;
        continue;
      }
      incoming.push({
        uid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "idle",
      });
    }

    if (incoming.length === 0) {
      showError(
        rejected > 0
          ? "Semua file ditolak — JPG/PNG/WebP ≤ 5 MB."
          : "Tidak ada file valid.",
      );
      return;
    }
    if (rejected > 0) {
      showError(`${rejected} file di-skip (format/ukuran).`);
    }
    setSlots((prev) => [...prev, ...incoming]);
  }

  function handleDocFile(file: File | null) {
    if (!file) return;
    if (!isValidDocFile(file)) {
      showError("Hanya .docx, .pdf, .txt, atau .md yang didukung.");
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      showError(
        `Ukuran dokumen > ${Math.round(MAX_DOC_BYTES / 1024 / 1024)} MB.`,
      );
      return;
    }
    setDocFile(file);
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

  /**
   * Reset every slot to "idle" while keeping the same File objects in
   * memory, so the operator can re-run handleGenerate without
   * re-uploading photos and the document. The previously-created Article
   * rows in the DB are NOT deleted — editor can prune them manually
   * from /panel/artikel after reviewing the new batch.
   */
  function resetForRegen() {
    setSlots((prev) =>
      prev.map((s) => ({
        ...s,
        status: "idle" as const,
        resultArticleId: undefined,
        resultSlug: undefined,
        resultTitle: undefined,
        errorMessage: undefined,
      })),
    );
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
    if (!docFile) {
      showError("Upload dokumen sumber dulu.");
      return;
    }

    setGenerating(true);
    setSlots((prev) =>
      prev.map((s) => ({ ...s, status: "generating" as const })),
    );

    try {
      const fd = new FormData();
      fd.append("categoryId", categoryId);
      if (batchName.trim()) fd.append("batchName", batchName.trim());
      fd.append("document", docFile);
      slots.forEach((s, i) => {
        fd.append(`photo_${i}`, s.file);
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

      setSlots((prev) =>
        prev.map((s, i) => {
          const r = results.find((x) => x.photoIndex === i);
          if (!r)
            return {
              ...s,
              status: "failed" as const,
              errorMessage: "Tidak ada respons",
            };
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
        showSuccess(`${created} draf berhasil dibuat dari dokumen.`);
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
            ? {
                ...s,
                status: "failed" as const,
                errorMessage: "Request gagal",
              }
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
  const canGenerate =
    !generating && !allDone && slots.length > 0 && !!docFile && !!categoryId;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={24} className="text-primary" />
            <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">
              Material Artikel
            </h1>
          </div>
          <p className="mt-1 text-sm text-txt-secondary">
            Generate artikel dari satu dokumen sumber + N foto. Dokumen
            menjadi sumber tunggal fakta — AI parafrase, satu artikel per
            foto. Hasil masuk ke{" "}
            <Link
              href="/panel/artikel?status=DRAFT"
              className="text-primary hover:underline"
            >
              /panel/artikel
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <Info size={16} className="mt-0.5 text-blue-600 shrink-0" />
          <div className="text-xs text-blue-700 space-y-1">
            <p>
              <strong>Cara pakai:</strong> (1) pilih kategori, (2) upload
              dokumen sumber (DOCX/PDF/TXT/MD), (3) upload foto-foto
              (N foto = N artikel berbeda angle), (4) klik Generate.
            </p>
            <p>
              AI parafrase dokumen menjadi N artikel. Tiap artikel dapat
              angle berbeda dari dokumen yang sama. Foto otomatis dipasang
              di atas body dengan caption + sumber{" "}
              <em>Kartawarta</em> yang ditulis AI.
            </p>
          </div>
        </div>
      </div>

      {/* Batch settings */}
      <div className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-card">
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
              placeholder="mis. RUPST Bank BJB 28 Apr"
              className="input w-full px-3 py-2 text-sm disabled:opacity-50"
              maxLength={100}
            />
          </div>
        </div>
      </div>

      {/* Document uploader */}
      <div className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-card">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-txt-secondary">
          Dokumen Sumber <span className="text-red-500">*</span>
        </h2>
        {!docFile ? (
          <button
            onClick={() => docInputRef.current?.click()}
            disabled={generating}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface-secondary py-10 text-txt-muted hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            <FileText size={32} />
            <p className="text-sm font-medium">
              Klik untuk upload dokumen sumber
            </p>
            <p className="text-xs">
              .DOCX, .PDF, .TXT, atau .MD — maks 10 MB
            </p>
          </button>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary-light p-4">
            <div className="flex items-center gap-3 min-w-0">
              <FileText size={20} className="shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-txt-primary">
                  {docFile.name}
                </p>
                <p className="text-xs text-txt-secondary">
                  {bytesHuman(docFile.size)} · siap di-parse
                </p>
              </div>
            </div>
            {!generating && (
              <button
                onClick={() => setDocFile(null)}
                className="rounded-full bg-red-500 p-1.5 text-white hover:bg-red-600"
                aria-label="Hapus dokumen"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
        <input
          ref={docInputRef}
          type="file"
          accept=".docx,.pdf,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/plain,text/markdown"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            handleDocFile(f);
            if (docInputRef.current) docInputRef.current.value = "";
          }}
        />
      </div>

      {/* Photos */}
      <div className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-txt-secondary">
            Foto ({slots.length}/{MAX_PHOTOS}) — 1 foto = 1 artikel
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
              onClick={() => photoInputRef.current?.click()}
              disabled={generating || slots.length >= MAX_PHOTOS}
              className="btn-primary flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              <Plus size={12} />
              Tambah Foto
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(e) => {
                handlePhotoFiles(e.target.files);
                if (photoInputRef.current) photoInputRef.current.value = "";
              }}
            />
          </div>
        </div>

        {slots.length === 0 ? (
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={generating}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface-secondary py-10 text-txt-muted hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            <ImageIcon size={32} />
            <p className="text-sm font-medium">Klik untuk upload foto</p>
            <p className="text-xs">
              JPG / PNG / WebP, ≤ 5 MB per file, max {MAX_PHOTOS} foto
            </p>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {slots.map((s, i) => (
              <div
                key={s.uid}
                className={`relative rounded-lg border p-2 transition-colors ${
                  s.status === "done"
                    ? "border-primary/40 bg-primary-light"
                    : s.status === "failed"
                      ? "border-red-300 bg-red-50"
                      : s.status === "generating"
                        ? "border-blue-300 bg-blue-50"
                        : "border-border bg-surface-secondary"
                }`}
              >
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.previewUrl}
                    alt={s.file.name}
                    className="h-32 w-full rounded-lg object-cover"
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
                      <X size={10} />
                    </button>
                  )}
                </div>
                <div className="mt-2 space-y-1">
                  <p
                    className="truncate text-[10px] font-mono text-txt-muted"
                    title={s.file.name}
                  >
                    {s.file.name}
                  </p>
                  {s.status === "generating" && (
                    <p className="flex items-center gap-1 text-[10px] font-semibold text-blue-600">
                      <Loader2 size={10} className="animate-spin" />
                      Generating…
                    </p>
                  )}
                  {s.status === "done" && s.resultArticleId && (
                    <Link
                      href={`/panel/artikel/${s.resultArticleId}/edit`}
                      className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                    >
                      <CheckCircle size={10} />
                      <span className="truncate">
                        {s.resultTitle?.slice(0, 50)}
                      </span>
                      <ArrowRight size={10} className="shrink-0" />
                    </Link>
                  )}
                  {s.status === "failed" && (
                    <p
                      className="flex items-center gap-1 text-[10px] font-semibold text-red-600"
                      title={s.errorMessage}
                    >
                      <AlertCircle size={10} />
                      <span className="truncate">{s.errorMessage}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(slots.length > 0 || docFile) && (
        <div className="sticky bottom-4 z-30 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-ambient sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-txt-secondary sm:text-sm">
            {allDone ? (
              <span className="font-semibold text-primary">
                Semua draft selesai. Buka{" "}
                <Link
                  href="/panel/artikel?status=DRAFT"
                  className="underline"
                >
                  panel artikel
                </Link>{" "}
                untuk review, atau klik <em>Generate Ulang</em> untuk
                versi baru.
              </span>
            ) : !canGenerate && !generating ? (
              <span className="text-txt-muted">
                Lengkapi: {!categoryId && "kategori, "}
                {!docFile && "dokumen, "}
                {slots.length === 0 && "foto"}
              </span>
            ) : (
              <>
                {slots.length} foto + 1 dokumen siap. ~
                {Math.max(20, slots.length * 8)}–
                {Math.max(40, slots.length * 16)} detik.
              </>
            )}
          </div>
          <div className="flex items-center gap-2 sm:shrink-0">
            {allDone && !generating && (
              <button
                onClick={resetForRegen}
                className="btn-ghost flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-xs font-medium sm:flex-none sm:px-4 sm:text-sm"
                title="Reset status semua slot. Foto + dokumen tetap."
              >
                <RefreshCw size={14} />
                <span className="hidden sm:inline">Generate Ulang</span>
                <span className="sm:hidden">Ulang</span>
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="btn-primary flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-xs font-semibold disabled:opacity-50 sm:flex-none sm:px-5 sm:text-sm"
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
                  : `Generate ${slots.length}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
