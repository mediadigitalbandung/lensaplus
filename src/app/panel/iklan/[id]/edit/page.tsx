"use client";

import { useState, useEffect, FormEvent } from "react";
import DOMPurify from "isomorphic-dompurify";
import { useRouter, useParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import {
  ArrowLeft,
  Info,
  Eye,
  Upload,
  X,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import AdPreviewOverlay from "../../_components/AdPreviewOverlay";
import SlotWireframe from "../../_components/SlotWireframe";
import { slotLabels, slotSpecs, typeLabels } from "../../_components/ad-constants";

interface Ad {
  id: string;
  name: string;
  type: string;
  slot: string;
  imageUrl?: string | null;
  htmlCode?: string | null;
  targetUrl?: string | null;
  isActive: boolean;
  startDate: string;
  endDate: string;
  priority: number;
}

function formatDateInput(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toISOString().split("T")[0];
}

export default function EditIklanPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { success, error: showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("IMAGE");
  const [formSlot, setFormSlot] = useState("HEADER");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formHtmlCode, setFormHtmlCode] = useState("");
  const [formTargetUrl, setFormTargetUrl] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formPriority, setFormPriority] = useState(0);

  const currentSpec = slotSpecs[formSlot];

  useEffect(() => {
    async function fetchAd() {
      try {
        const res = await fetch(`/api/ads?all=true`);
        if (!res.ok) throw new Error("Gagal memuat data iklan");
        const json = await res.json();
        const ad = (json.data || []).find((a: Ad) => a.id === id);
        if (!ad) throw new Error("Iklan tidak ditemukan");

        setFormName(ad.name);
        setFormType(ad.type);
        setFormSlot(ad.slot);
        setFormImageUrl(ad.imageUrl || "");
        setFormHtmlCode(ad.htmlCode || "");
        setFormTargetUrl(ad.targetUrl || "");
        setFormStartDate(formatDateInput(ad.startDate));
        setFormEndDate(formatDateInput(ad.endDate));
        setFormIsActive(ad.isActive);
        setFormPriority(ad.priority);
      } catch (err) {
        showError(err instanceof Error ? err.message : "Gagal memuat iklan");
      } finally {
        setLoading(false);
      }
    }
    fetchAd();
  }, [id, showError]);

  async function handleUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) { showError("Ukuran file maksimal 5MB"); return; }
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Upload gagal"); }
      const json = await res.json();
      setFormImageUrl(json.data?.url || "");
      success("Gambar berhasil diupload");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Upload gagal");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formName || !formStartDate || !formEndDate) {
      showError("Nama, tanggal mulai, dan tanggal selesai wajib diisi.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/ads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          type: formType,
          slot: formSlot,
          imageUrl: formImageUrl || null,
          htmlCode: formHtmlCode || null,
          targetUrl: formTargetUrl || null,
          startDate: new Date(formStartDate).toISOString(),
          endDate: new Date(formEndDate).toISOString(),
          isActive: formIsActive,
          priority: formPriority,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Gagal menyimpan perubahan");
      }
      success("Iklan berhasil diperbarui");
      router.push("/panel/iklan");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menyimpan iklan.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/panel/iklan" className="rounded-lg p-2 hover:bg-surface-secondary transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-txt-primary">Edit Iklan</h1>
          <p className="text-sm text-txt-secondary">Perbarui detail iklan</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Right: Slot Wireframe */}
          <div className="lg:col-span-2 lg:order-2">
            <div className="lg:sticky lg:top-20">
              <SlotWireframe slot={formSlot} />
            </div>
          </div>

          {/* Left: Form */}
          <div className="lg:col-span-3 lg:order-1 space-y-5">
            <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card space-y-5">
              <h2 className="text-base font-bold text-txt-primary">Detail Iklan</h2>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-txt-secondary">Nama Iklan</label>
                <input type="text" placeholder="Contoh: Promo Konsultasi Hukum" value={formName} onChange={(e) => setFormName(e.target.value)} required className="input w-full" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-txt-secondary">Tipe Iklan</label>
                  <select value={formType} onChange={(e) => setFormType(e.target.value)} className="input w-full">
                    {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-txt-secondary">Posisi Slot</label>
                  <select value={formSlot} onChange={(e) => setFormSlot(e.target.value)} className="input w-full">
                    {Object.entries(slotLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>

              {currentSpec && (
                <div className="flex items-center gap-2.5 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
                  <Info size={16} className="text-blue-500 shrink-0" />
                  <div className="text-sm">
                    <span className="font-bold text-blue-800">Ukuran: {currentSpec.ratio}</span>
                    <span className="text-blue-600 ml-2 text-xs">{currentSpec.desc}</span>
                  </div>
                </div>
              )}

              {/* Status & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-txt-secondary">Status</label>
                  <select value={formIsActive ? "true" : "false"} onChange={(e) => setFormIsActive(e.target.value === "true")} className="input w-full">
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-txt-secondary">Prioritas (0-100)</label>
                  <input type="number" min={0} max={100} value={formPriority} onChange={(e) => setFormPriority(Number(e.target.value))} className="input w-full" />
                </div>
              </div>
            </div>

            {/* Image / HTML */}
            <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card space-y-4">
              <h2 className="text-base font-bold text-txt-primary">
                {formType === "HTML" ? "Kode HTML" : "Gambar Iklan"}
              </h2>

              {formType !== "HTML" ? (
                <div className="space-y-3">
                  {!formImageUrl ? (
                    <label className="block cursor-pointer">
                      <div className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-10 hover:border-primary hover:bg-primary-light/20 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-secondary">
                          <Upload size={22} className="text-txt-muted" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-txt-primary">{uploading ? "Mengupload..." : "Klik untuk upload gambar"}</p>
                          <p className="text-xs text-txt-muted mt-0.5">JPEG, PNG, WebP, GIF — Maks 5MB</p>
                          {currentSpec && <p className="text-xs font-medium text-primary mt-1">Rekomendasi: {currentSpec.ratio}</p>}
                        </div>
                      </div>
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={uploading}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
                      />
                    </label>
                  ) : (
                    <div className="rounded-lg border border-border bg-surface-secondary overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                        <p className="text-xs font-semibold text-txt-secondary">Preview Gambar</p>
                        <button type="button" onClick={() => setFormImageUrl("")} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                          <X size={12} /> Hapus
                        </button>
                      </div>
                      <div className="p-4 bg-[repeating-conic-gradient(#f0f1f3_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded ad image URL, cannot whitelist all origins */}
                        <img src={formImageUrl} alt="Preview" className="max-w-full h-auto rounded-lg object-contain shadow-sm" style={{ maxHeight: 300 }} />
                      </div>
                      {currentSpec && (
                        <p className="px-4 py-2 text-xs text-txt-muted text-center border-t border-border">Rekomendasi: {currentSpec.width} x {currentSpec.height} piksel</p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] text-txt-muted font-medium uppercase tracking-wider">atau paste URL</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <input type="url" placeholder="https://contoh.com/banner.jpg" value={formImageUrl} onChange={(e) => setFormImageUrl(e.target.value)} className="input w-full text-sm" />
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea placeholder="<div>Kode HTML iklan Anda...</div>" value={formHtmlCode} onChange={(e) => setFormHtmlCode(e.target.value)} rows={6} className="input w-full font-mono text-sm" />
                  {formHtmlCode && (
                    <div className="rounded-lg border border-border bg-surface-secondary p-3 overflow-hidden">
                      <p className="text-xs font-semibold text-txt-secondary mb-2">Preview HTML:</p>
                      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formHtmlCode, { ADD_TAGS: ["iframe"], ADD_ATTR: ["allowfullscreen", "frameborder"] }) }} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card space-y-4">
              <h2 className="text-base font-bold text-txt-primary">Pengaturan</h2>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-txt-secondary">URL Target (opsional)</label>
                <input type="url" placeholder="https://contoh.com/promo" value={formTargetUrl} onChange={(e) => setFormTargetUrl(e.target.value)} className="input w-full text-sm" />
                <p className="text-xs text-txt-muted mt-1">Halaman yang dibuka saat iklan diklik</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-txt-secondary">Tanggal Mulai</label>
                  <input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} required className="input w-full" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-txt-secondary">Tanggal Selesai</label>
                  <input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} required className="input w-full" />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setShowPreview(true)} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-dark transition-colors">
                <Eye size={15} /> Preview di Halaman
              </button>
              <div className="flex gap-3">
                <Link href="/panel/iklan" className="btn-secondary px-5 py-2.5 text-sm">Batal</Link>
                <button type="submit" disabled={submitting} className="btn-primary px-6 py-2.5 text-sm font-semibold disabled:opacity-50">
                  {submitting ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {showPreview && (
        <AdPreviewOverlay slot={formSlot} imageUrl={formImageUrl} htmlCode={formHtmlCode} type={formType} targetUrl={formTargetUrl} onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
}
