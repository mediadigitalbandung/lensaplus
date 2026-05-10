"use client";

/**
 * /panel/regulasi — EDITOR+ CRUD for Regulation
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Scale,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  Save,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type RegulationType =
  | "UU"
  | "PERPPU"
  | "PP"
  | "PERPRES"
  | "KEPPRES"
  | "INPRES"
  | "PERMEN"
  | "KEPMEN"
  | "PERDA_PROV"
  | "PERDA_KAB"
  | "PERGUB"
  | "PERWAL"
  | "PUTUSAN_MK"
  | "PUTUSAN_MA"
  | "OTHER";

type RegulationStatus = "DRAFT_RUU" | "ENACTED" | "AMENDED" | "REVOKED";

interface Regulation {
  id: string;
  type: RegulationType;
  number: string;
  year: number;
  title: string;
  shortTitle: string | null;
  topic: string | null;
  description: string | null;
  enactedAt: string | null;
  effectiveAt: string | null;
  issuedBy: string | null;
  status: RegulationStatus;
  sourceUrl: string | null;
  pdfUrl: string | null;
  articleId: string | null;
  isPublished: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

const TYPE_LABELS: Record<RegulationType, string> = {
  UU: "Undang-Undang",
  PERPPU: "Perppu",
  PP: "PP",
  PERPRES: "Perpres",
  KEPPRES: "Keppres",
  INPRES: "Inpres",
  PERMEN: "Permen",
  KEPMEN: "Kepmen",
  PERDA_PROV: "Perda Prov.",
  PERDA_KAB: "Perda Kab./Kota",
  PERGUB: "Pergub",
  PERWAL: "Perwal/Perbup",
  PUTUSAN_MK: "Putusan MK",
  PUTUSAN_MA: "Putusan MA",
  OTHER: "Lainnya",
};

const TYPE_COLORS: Record<RegulationType, string> = {
  UU: "bg-blue-50 text-blue-700",
  PERPPU: "bg-indigo-50 text-indigo-700",
  PP: "bg-sky-50 text-sky-700",
  PERPRES: "bg-violet-50 text-violet-700",
  KEPPRES: "bg-purple-50 text-purple-700",
  INPRES: "bg-fuchsia-50 text-fuchsia-700",
  PERMEN: "bg-teal-50 text-teal-700",
  KEPMEN: "bg-cyan-50 text-cyan-700",
  PERDA_PROV: "bg-emerald-50 text-emerald-700",
  PERDA_KAB: "bg-green-50 text-green-700",
  PERGUB: "bg-lime-50 text-lime-700",
  PERWAL: "bg-yellow-50 text-yellow-700",
  PUTUSAN_MK: "bg-red-50 text-red-700",
  PUTUSAN_MA: "bg-orange-50 text-orange-700",
  OTHER: "bg-surface-tertiary text-txt-secondary",
};

const STATUS_LABELS: Record<RegulationStatus, string> = {
  DRAFT_RUU: "RUU",
  ENACTED: "Berlaku",
  AMENDED: "Diubah",
  REVOKED: "Dicabut",
};

const STATUS_COLORS: Record<RegulationStatus, string> = {
  DRAFT_RUU: "bg-yellow-50 text-yellow-700",
  ENACTED: "bg-primary-light text-primary",
  AMENDED: "bg-blue-50 text-blue-700",
  REVOKED: "bg-red-50 text-red-700",
};

const ALL_TYPES: RegulationType[] = [
  "UU",
  "PERPPU",
  "PP",
  "PERPRES",
  "KEPPRES",
  "INPRES",
  "PERMEN",
  "KEPMEN",
  "PERDA_PROV",
  "PERDA_KAB",
  "PERGUB",
  "PERWAL",
  "PUTUSAN_MK",
  "PUTUSAN_MA",
  "OTHER",
];

const WRITE_ROLES = ["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"];
const LIMIT = 20;

interface FormData {
  type: RegulationType;
  number: string;
  year: string;
  title: string;
  shortTitle: string;
  topic: string;
  description: string;
  enactedAt: string;
  effectiveAt: string;
  issuedBy: string;
  status: RegulationStatus;
  sourceUrl: string;
  pdfUrl: string;
  articleId: string;
  isPublished: boolean;
}

const EMPTY_FORM: FormData = {
  type: "UU",
  number: "",
  year: String(new Date().getFullYear()),
  title: "",
  shortTitle: "",
  topic: "",
  description: "",
  enactedAt: "",
  effectiveAt: "",
  issuedBy: "",
  status: "ENACTED",
  sourceUrl: "",
  pdfUrl: "",
  articleId: "",
  isPublished: true,
};

function toDateInput(s: string): string {
  return s ? new Date(s).toISOString().split("T")[0] : "";
}

export default function RegulasiPanelPage() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = session?.user?.role || "";
  const canWrite = WRITE_ROLES.includes(userRole);
  const { success: showSuccess, error: showError } = useToast();
  const { confirm } = useConfirm();

  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<RegulationType | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Regulation | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  if (
    sessionStatus !== "loading" &&
    session &&
    !WRITE_ROLES.includes(userRole)
  ) {
    redirect("/panel/dashboard");
  }

  const fetchRegulations = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(LIMIT),
        page: String(page),
      });
      if (filterType !== "ALL") params.set("type", filterType);
      if (search) params.set("search", search);
      const res = await fetch(`/api/panel/regulations?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setRegulations(json.data?.regulations || []);
        setTotal(json.data?.total || 0);
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, [page, filterType, search]);

  useEffect(() => {
    fetchRegulations();
  }, [fetchRegulations]);

  useEffect(() => {
    setPage(1);
  }, [filterType, search]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  }

  function openEdit(r: Regulation) {
    setEditing(r);
    setForm({
      type: r.type,
      number: r.number,
      year: String(r.year),
      title: r.title,
      shortTitle: r.shortTitle || "",
      topic: r.topic || "",
      description: r.description || "",
      enactedAt: r.enactedAt ? toDateInput(r.enactedAt) : "",
      effectiveAt: r.effectiveAt ? toDateInput(r.effectiveAt) : "",
      issuedBy: r.issuedBy || "",
      status: r.status,
      sourceUrl: r.sourceUrl || "",
      pdfUrl: r.pdfUrl || "",
      articleId: r.articleId || "",
      isPublished: r.isPublished,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.number.trim() || !form.title.trim()) {
      showError("Nomor dan judul regulasi wajib diisi.");
      return;
    }
    const yearNum = parseInt(form.year, 10);
    if (isNaN(yearNum) || yearNum < 1945 || yearNum > 2100) {
      showError("Tahun tidak valid (1945–2100).");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        type: form.type,
        number: form.number.trim(),
        year: yearNum,
        title: form.title.trim(),
        shortTitle: form.shortTitle.trim() || null,
        topic: form.topic.trim() || null,
        description: form.description.trim() || null,
        enactedAt: form.enactedAt
          ? new Date(form.enactedAt).toISOString()
          : null,
        effectiveAt: form.effectiveAt
          ? new Date(form.effectiveAt).toISOString()
          : null,
        issuedBy: form.issuedBy.trim() || null,
        status: form.status,
        sourceUrl: form.sourceUrl.trim() || null,
        pdfUrl: form.pdfUrl.trim() || null,
        articleId: form.articleId.trim() || null,
        isPublished: form.isPublished,
      };

      const url = editing
        ? `/api/panel/regulations/${editing.id}`
        : "/api/panel/regulations";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menyimpan");
      showSuccess(editing ? "Regulasi diperbarui." : "Regulasi ditambahkan.");
      setShowForm(false);
      fetchRegulations();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    const ok = await confirm({
      title: "Hapus regulasi",
      message: `Yakin ingin menghapus "${title.slice(0, 80)}..."?`,
      variant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/panel/regulations/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menghapus");
      showSuccess("Regulasi dihapus.");
      fetchRegulations();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menghapus");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  if (sessionStatus === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Scale size={24} className="text-primary" />
            <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">
              Regulasi
            </h1>
          </div>
          <p className="mt-1 text-sm text-txt-secondary">
            Direktori UU, PP, Perpres, Permen, Perda, Putusan MK/MA. {total} entri total.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchRegulations}
            className="btn-ghost flex items-center gap-2 px-3 py-2.5 text-sm"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          {canWrite && (
            <button
              onClick={openCreate}
              className="btn-primary flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold"
            >
              <Plus size={14} /> Regulasi Baru
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setSearch(searchInput);
          }}
          placeholder="Cari judul, nomor, topik..."
          className="input flex-1 py-2 text-sm"
        />
        <button
          onClick={() => setSearch(searchInput)}
          className="btn-primary rounded-md px-4 py-2 text-sm"
        >
          Cari
        </button>
        {search && (
          <button
            onClick={() => {
              setSearch("");
              setSearchInput("");
            }}
            className="btn-ghost rounded-md px-3 py-2 text-sm"
          >
            Reset
          </button>
        )}
      </div>

      {/* Type filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Filter size={14} className="text-txt-muted shrink-0" />
        <button
          onClick={() => setFilterType("ALL")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            filterType === "ALL"
              ? "bg-primary text-white"
              : "bg-surface-tertiary text-txt-secondary hover:bg-border"
          }`}
        >
          Semua
        </button>
        {ALL_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filterType === t
                ? "bg-primary text-white"
                : "bg-surface-tertiary text-txt-secondary hover:bg-border"
            }`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 size={24} className="mx-auto animate-spin text-primary" />
          </div>
        ) : regulations.length === 0 ? (
          <div className="py-16 text-center">
            <Scale size={40} className="mx-auto text-border mb-3" />
            <p className="text-sm text-txt-secondary">Belum ada regulasi.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-secondary">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                    Regulasi
                  </th>
                  <th className="hidden sm:table-cell px-5 py-3 text-left font-medium text-txt-secondary">
                    Tipe
                  </th>
                  <th className="hidden md:table-cell px-5 py-3 text-left font-medium text-txt-secondary">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                    Publik
                  </th>
                  {canWrite && (
                    <th className="px-5 py-3 text-right font-medium text-txt-secondary">
                      Aksi
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {regulations.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-secondary/50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-txt-primary line-clamp-1">
                        {r.shortTitle && (
                          <span className="text-primary mr-1">{r.shortTitle} —</span>
                        )}
                        {r.title}
                      </p>
                      <p className="text-xs text-txt-muted mt-0.5 font-mono">
                        No. {r.number} Tahun {r.year}
                        {r.topic && (
                          <span className="ml-2 font-sans text-txt-muted">
                            [{r.topic}]
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="hidden sm:table-cell px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[r.type]}`}
                      >
                        {TYPE_LABELS[r.type]}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}
                      >
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          r.isPublished
                            ? "bg-primary-light text-primary"
                            : "bg-surface-tertiary text-txt-muted"
                        }`}
                      >
                        {r.isPublished ? "Publik" : "Draft"}
                      </span>
                    </td>
                    {canWrite && (
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {r.sourceUrl && (
                            <a
                              href={r.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-ghost rounded p-2"
                              title="Lihat sumber"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                          <button
                            onClick={() => openEdit(r)}
                            className="btn-ghost rounded p-2"
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(r.id, r.title)}
                            className="btn-ghost rounded p-2 hover:text-red-500"
                            title="Hapus"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-txt-secondary">
          <span>
            Hal {page} dari {totalPages} ({total} total)
          </span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="btn-ghost rounded p-2 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="btn-ghost rounded p-2 disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6">
            <h3 className="text-xl font-bold text-txt-primary mb-5">
              {editing ? "Edit Regulasi" : "Regulasi Baru"}
            </h3>

            <div className="space-y-4">
              {/* Type + Year */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Jenis Peraturan
                  </label>
                  <select
                    className="input w-full py-2 text-sm"
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value as RegulationType })
                    }
                  >
                    {ALL_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Tahun
                  </label>
                  <input
                    type="number"
                    className="input w-full py-2 text-sm"
                    min={1945}
                    max={2100}
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                  />
                </div>
              </div>

              {/* Number */}
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Nomor <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="input w-full py-2 text-sm"
                  placeholder="27/2022 atau 13 Tahun 2003"
                  maxLength={100}
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                />
              </div>

              {/* Short title */}
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Nama Singkat (opsional)
                </label>
                <input
                  type="text"
                  className="input w-full py-2 text-sm"
                  placeholder="UU PDP, UU Cipta Kerja, dsb."
                  maxLength={200}
                  value={form.shortTitle}
                  onChange={(e) => setForm({ ...form, shortTitle: e.target.value })}
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Judul Lengkap <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  className="input w-full py-2 text-sm"
                  placeholder="Peraturan ... tentang ..."
                  maxLength={2000}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              {/* Topic + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Topik (opsional)
                  </label>
                  <input
                    type="text"
                    className="input w-full py-2 text-sm"
                    placeholder="Privasi, Pajak, Tenaga Kerja..."
                    maxLength={200}
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Status
                  </label>
                  <select
                    className="input w-full py-2 text-sm"
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as RegulationStatus })
                    }
                  >
                    <option value="DRAFT_RUU">Masih RUU</option>
                    <option value="ENACTED">Berlaku</option>
                    <option value="AMENDED">Telah Diubah</option>
                    <option value="REVOKED">Dicabut</option>
                  </select>
                </div>
              </div>

              {/* Issued by */}
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Penerbit (opsional)
                </label>
                <input
                  type="text"
                  className="input w-full py-2 text-sm"
                  placeholder="Pemerintah, MK, MA, Kemenkumham..."
                  maxLength={300}
                  value={form.issuedBy}
                  onChange={(e) => setForm({ ...form, issuedBy: e.target.value })}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Tanggal Diundangkan (opsional)
                  </label>
                  <input
                    type="date"
                    className="input w-full py-2 text-sm"
                    value={form.enactedAt}
                    onChange={(e) => setForm({ ...form, enactedAt: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Mulai Berlaku (opsional)
                  </label>
                  <input
                    type="date"
                    className="input w-full py-2 text-sm"
                    value={form.effectiveAt}
                    onChange={(e) => setForm({ ...form, effectiveAt: e.target.value })}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Ringkasan / Keterangan (opsional)
                </label>
                <textarea
                  rows={4}
                  className="input w-full py-2 text-sm"
                  maxLength={20000}
                  placeholder="Isi singkat tentang pokok-pokok peraturan ini..."
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>

              {/* URLs */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    URL Sumber Resmi (opsional)
                  </label>
                  <input
                    type="url"
                    className="input w-full py-2 text-sm"
                    placeholder="https://peraturan.go.id/..."
                    value={form.sourceUrl}
                    onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    URL PDF (opsional)
                  </label>
                  <input
                    type="url"
                    className="input w-full py-2 text-sm"
                    placeholder="https://...pdf"
                    value={form.pdfUrl}
                    onChange={(e) => setForm({ ...form, pdfUrl: e.target.value })}
                  />
                </div>
              </div>

              {/* Article ID */}
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  ID Artikel Coverage (opsional)
                </label>
                <input
                  type="text"
                  className="input w-full py-2 text-sm font-mono"
                  placeholder="article-cuid"
                  value={form.articleId}
                  onChange={(e) => setForm({ ...form, articleId: e.target.value })}
                />
              </div>

              {/* isPublished */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  id="isPublished"
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  checked={form.isPublished}
                  onChange={(e) =>
                    setForm({ ...form, isPublished: e.target.checked })
                  }
                />
                <label
                  htmlFor="isPublished"
                  className="text-sm font-medium text-txt-primary cursor-pointer"
                >
                  Tampilkan di halaman publik
                </label>
              </div>
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
    </div>
  );
}
