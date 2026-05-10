"use client";

/**
 * /panel/pejabat — EDITOR+ CRUD for PublicOfficial
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Users,
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

type OfficialLevel =
  | "NASIONAL"
  | "PROVINSI"
  | "KOTA_KABUPATEN"
  | "KECAMATAN"
  | "YUDIKATIF"
  | "LEMBAGA"
  | "OTHER";

type OfficialStatus = "AKTIF" | "PURNA" | "CUTI" | "NONAKTIF";

interface PublicOfficial {
  id: string;
  slug: string;
  name: string;
  fullName: string | null;
  position: string;
  institution: string;
  level: OfficialLevel;
  region: string | null;
  status: OfficialStatus;
  termStart: string | null;
  termEnd: string | null;
  bio: string | null;
  birthplace: string | null;
  birthdate: string | null;
  education: string | null;
  career: string | null;
  party: string | null;
  photoUrl: string | null;
  websiteUrl: string | null;
  twitterHandle: string | null;
  instagramHandle: string | null;
  isPublished: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

const LEVEL_LABELS: Record<OfficialLevel, string> = {
  NASIONAL: "Nasional",
  PROVINSI: "Provinsi",
  KOTA_KABUPATEN: "Kota/Kabupaten",
  KECAMATAN: "Kecamatan",
  YUDIKATIF: "Yudikatif",
  LEMBAGA: "Lembaga",
  OTHER: "Lainnya",
};

const LEVEL_COLORS: Record<OfficialLevel, string> = {
  NASIONAL: "bg-blue-50 text-blue-700",
  PROVINSI: "bg-violet-50 text-violet-700",
  KOTA_KABUPATEN: "bg-primary-light text-primary",
  KECAMATAN: "bg-teal-50 text-teal-700",
  YUDIKATIF: "bg-red-50 text-red-700",
  LEMBAGA: "bg-amber-50 text-amber-700",
  OTHER: "bg-surface-tertiary text-txt-secondary",
};

const STATUS_LABELS: Record<OfficialStatus, string> = {
  AKTIF: "Aktif",
  PURNA: "Purna",
  CUTI: "Cuti",
  NONAKTIF: "Nonaktif",
};

const STATUS_COLORS: Record<OfficialStatus, string> = {
  AKTIF: "bg-primary-light text-primary",
  PURNA: "bg-surface-tertiary text-txt-muted",
  CUTI: "bg-yellow-50 text-yellow-700",
  NONAKTIF: "bg-red-50 text-red-700",
};

const ALL_LEVELS: OfficialLevel[] = [
  "NASIONAL",
  "PROVINSI",
  "KOTA_KABUPATEN",
  "KECAMATAN",
  "YUDIKATIF",
  "LEMBAGA",
  "OTHER",
];

const WRITE_ROLES = ["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"];
const LIMIT = 20;

interface FormData {
  name: string;
  fullName: string;
  position: string;
  institution: string;
  level: OfficialLevel;
  region: string;
  status: OfficialStatus;
  termStart: string;
  termEnd: string;
  bio: string;
  birthplace: string;
  birthdate: string;
  education: string;
  career: string;
  party: string;
  photoUrl: string;
  websiteUrl: string;
  twitterHandle: string;
  instagramHandle: string;
  isPublished: boolean;
}

const EMPTY_FORM: FormData = {
  name: "",
  fullName: "",
  position: "",
  institution: "",
  level: "KOTA_KABUPATEN",
  region: "",
  status: "AKTIF",
  termStart: "",
  termEnd: "",
  bio: "",
  birthplace: "",
  birthdate: "",
  education: "",
  career: "",
  party: "",
  photoUrl: "",
  websiteUrl: "",
  twitterHandle: "",
  instagramHandle: "",
  isPublished: true,
};

function toDateInput(s: string): string {
  return s ? new Date(s).toISOString().split("T")[0] : "";
}

function toDatetimeInput(s: string): string {
  return s ? new Date(s).toISOString().slice(0, 16) : "";
}

export default function PejabatPanelPage() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = session?.user?.role || "";
  const canWrite = WRITE_ROLES.includes(userRole);
  const { success: showSuccess, error: showError } = useToast();
  const { confirm } = useConfirm();

  const [officials, setOfficials] = useState<PublicOfficial[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterLevel, setFilterLevel] = useState<OfficialLevel | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PublicOfficial | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  if (
    sessionStatus !== "loading" &&
    session &&
    !WRITE_ROLES.includes(userRole)
  ) {
    redirect("/panel/dashboard");
  }

  const fetchOfficials = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(LIMIT),
        page: String(page),
      });
      if (filterLevel !== "ALL") params.set("level", filterLevel);
      if (search) params.set("search", search);
      const res = await fetch(`/api/panel/officials?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setOfficials(json.data?.officials || []);
        setTotal(json.data?.total || 0);
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, [page, filterLevel, search]);

  useEffect(() => {
    fetchOfficials();
  }, [fetchOfficials]);

  useEffect(() => {
    setPage(1);
  }, [filterLevel, search]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  }

  function openEdit(o: PublicOfficial) {
    setEditing(o);
    setForm({
      name: o.name,
      fullName: o.fullName || "",
      position: o.position,
      institution: o.institution,
      level: o.level,
      region: o.region || "",
      status: o.status,
      termStart: o.termStart ? toDateInput(o.termStart) : "",
      termEnd: o.termEnd ? toDateInput(o.termEnd) : "",
      bio: o.bio || "",
      birthplace: o.birthplace || "",
      birthdate: o.birthdate ? toDateInput(o.birthdate) : "",
      education: o.education || "",
      career: o.career || "",
      party: o.party || "",
      photoUrl: o.photoUrl || "",
      websiteUrl: o.websiteUrl || "",
      twitterHandle: o.twitterHandle || "",
      instagramHandle: o.instagramHandle || "",
      isPublished: o.isPublished,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.position.trim() || !form.institution.trim()) {
      showError("Nama, jabatan, dan institusi wajib diisi.");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        fullName: form.fullName.trim() || null,
        position: form.position.trim(),
        institution: form.institution.trim(),
        level: form.level,
        region: form.region.trim() || null,
        status: form.status,
        termStart: form.termStart ? new Date(form.termStart).toISOString() : null,
        termEnd: form.termEnd ? new Date(form.termEnd).toISOString() : null,
        bio: form.bio.trim() || null,
        birthplace: form.birthplace.trim() || null,
        birthdate: form.birthdate ? new Date(form.birthdate).toISOString() : null,
        education: form.education.trim() || null,
        career: form.career.trim() || null,
        party: form.party.trim() || null,
        photoUrl: form.photoUrl.trim() || null,
        websiteUrl: form.websiteUrl.trim() || null,
        twitterHandle: form.twitterHandle.trim() || null,
        instagramHandle: form.instagramHandle.trim() || null,
        isPublished: form.isPublished,
      };

      const url = editing
        ? `/api/panel/officials/${editing.id}`
        : "/api/panel/officials";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menyimpan");
      showSuccess(editing ? "Data pejabat diperbarui." : "Pejabat ditambahkan.");
      setShowForm(false);
      fetchOfficials();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: "Hapus pejabat",
      message: `Yakin ingin menghapus "${name}"?`,
      variant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/panel/officials/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menghapus");
      showSuccess("Pejabat dihapus.");
      fetchOfficials();
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
            <Users size={24} className="text-primary" />
            <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">
              Pejabat Publik
            </h1>
          </div>
          <p className="mt-1 text-sm text-txt-secondary">
            Direktori pejabat daerah Bandung &amp; Jabar. {total} entri total.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchOfficials}
            className="btn-ghost flex items-center gap-2 px-3 py-2.5 text-sm"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          {canWrite && (
            <button
              onClick={openCreate}
              className="btn-primary flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold"
            >
              <Plus size={14} /> Pejabat Baru
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
          placeholder="Cari nama, jabatan, institusi..."
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

      {/* Level filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Filter size={14} className="text-txt-muted shrink-0" />
        <button
          onClick={() => setFilterLevel("ALL")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            filterLevel === "ALL"
              ? "bg-primary text-white"
              : "bg-surface-tertiary text-txt-secondary hover:bg-border"
          }`}
        >
          Semua
        </button>
        {ALL_LEVELS.map((l) => (
          <button
            key={l}
            onClick={() => setFilterLevel(l)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filterLevel === l
                ? "bg-primary text-white"
                : "bg-surface-tertiary text-txt-secondary hover:bg-border"
            }`}
          >
            {LEVEL_LABELS[l]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 size={24} className="mx-auto animate-spin text-primary" />
          </div>
        ) : officials.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={40} className="mx-auto text-border mb-3" />
            <p className="text-sm text-txt-secondary">Belum ada pejabat.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-secondary">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                    Pejabat
                  </th>
                  <th className="hidden sm:table-cell px-5 py-3 text-left font-medium text-txt-secondary">
                    Level
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
                {officials.map((o) => (
                  <tr key={o.id} className="hover:bg-surface-secondary/50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-txt-primary line-clamp-1">
                        {o.name}
                      </p>
                      <p className="text-xs text-txt-muted mt-0.5">
                        {o.position} — {o.institution}
                        {o.region && (
                          <span className="ml-1 text-txt-muted">
                            ({o.region})
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="hidden sm:table-cell px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LEVEL_COLORS[o.level]}`}
                      >
                        {LEVEL_LABELS[o.level]}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[o.status]}`}
                      >
                        {STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          o.isPublished
                            ? "bg-primary-light text-primary"
                            : "bg-surface-tertiary text-txt-muted"
                        }`}
                      >
                        {o.isPublished ? "Publik" : "Draft"}
                      </span>
                    </td>
                    {canWrite && (
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={`/pejabat/${o.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-ghost rounded p-2"
                            title="Lihat halaman publik"
                          >
                            <ExternalLink size={14} />
                          </a>
                          <button
                            onClick={() => openEdit(o)}
                            className="btn-ghost rounded p-2"
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(o.id, o.name)}
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
              {editing ? "Edit Pejabat" : "Pejabat Baru"}
            </h3>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Nama <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="input w-full py-2 text-sm"
                  placeholder="Nama pejabat"
                  maxLength={300}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              {/* Full name */}
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Nama Lengkap (dengan gelar, opsional)
                </label>
                <input
                  type="text"
                  className="input w-full py-2 text-sm"
                  placeholder="Dr. H. Nama Lengkap, M.Si."
                  maxLength={400}
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                />
              </div>

              {/* Position + Institution */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Jabatan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="input w-full py-2 text-sm"
                    placeholder="Walikota Bandung"
                    maxLength={300}
                    value={form.position}
                    onChange={(e) =>
                      setForm({ ...form, position: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Institusi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="input w-full py-2 text-sm"
                    placeholder="Pemerintah Kota Bandung"
                    maxLength={300}
                    value={form.institution}
                    onChange={(e) =>
                      setForm({ ...form, institution: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Level + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Level
                  </label>
                  <select
                    className="input w-full py-2 text-sm"
                    value={form.level}
                    onChange={(e) =>
                      setForm({ ...form, level: e.target.value as OfficialLevel })
                    }
                  >
                    {ALL_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {LEVEL_LABELS[l]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Status
                  </label>
                  <select
                    className="input w-full py-2 text-sm"
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as OfficialStatus })
                    }
                  >
                    <option value="AKTIF">Aktif</option>
                    <option value="PURNA">Purna</option>
                    <option value="CUTI">Cuti</option>
                    <option value="NONAKTIF">Nonaktif</option>
                  </select>
                </div>
              </div>

              {/* Region + Party */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Wilayah (opsional)
                  </label>
                  <input
                    type="text"
                    className="input w-full py-2 text-sm"
                    placeholder="Kota Bandung, Jawa Barat"
                    maxLength={200}
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Partai (opsional)
                  </label>
                  <input
                    type="text"
                    className="input w-full py-2 text-sm"
                    placeholder="PDIP, Golkar, PKS, dll."
                    maxLength={200}
                    value={form.party}
                    onChange={(e) => setForm({ ...form, party: e.target.value })}
                  />
                </div>
              </div>

              {/* Term dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Mulai Jabatan (opsional)
                  </label>
                  <input
                    type="date"
                    className="input w-full py-2 text-sm"
                    value={form.termStart}
                    onChange={(e) => setForm({ ...form, termStart: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Akhir Jabatan (opsional)
                  </label>
                  <input
                    type="date"
                    className="input w-full py-2 text-sm"
                    value={form.termEnd}
                    onChange={(e) => setForm({ ...form, termEnd: e.target.value })}
                  />
                </div>
              </div>

              {/* Birth info */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Tempat Lahir (opsional)
                  </label>
                  <input
                    type="text"
                    className="input w-full py-2 text-sm"
                    placeholder="Bandung"
                    maxLength={200}
                    value={form.birthplace}
                    onChange={(e) =>
                      setForm({ ...form, birthplace: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Tanggal Lahir (opsional)
                  </label>
                  <input
                    type="date"
                    className="input w-full py-2 text-sm"
                    value={form.birthdate}
                    onChange={(e) =>
                      setForm({ ...form, birthdate: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Biografi (opsional)
                </label>
                <textarea
                  rows={4}
                  className="input w-full py-2 text-sm"
                  placeholder="Deskripsi singkat tentang pejabat..."
                  maxLength={20000}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
              </div>

              {/* Education */}
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Pendidikan (opsional)
                </label>
                <textarea
                  rows={3}
                  className="input w-full py-2 text-sm"
                  placeholder="S1 Hukum Universitas Padjadjaran&#10;S2 Administrasi Publik UI"
                  maxLength={10000}
                  value={form.education}
                  onChange={(e) =>
                    setForm({ ...form, education: e.target.value })
                  }
                />
              </div>

              {/* Career */}
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Riwayat Karier (opsional)
                </label>
                <textarea
                  rows={3}
                  className="input w-full py-2 text-sm"
                  placeholder="2019–sekarang: Walikota Bandung&#10;2014–2019: Anggota DPRD Jabar"
                  maxLength={20000}
                  value={form.career}
                  onChange={(e) => setForm({ ...form, career: e.target.value })}
                />
              </div>

              {/* Photo URL */}
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  URL Foto (opsional)
                </label>
                <input
                  type="url"
                  className="input w-full py-2 text-sm"
                  placeholder="https://..."
                  value={form.photoUrl}
                  onChange={(e) =>
                    setForm({ ...form, photoUrl: e.target.value })
                  }
                />
              </div>

              {/* Social + website */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Website (opsional)
                  </label>
                  <input
                    type="url"
                    className="input w-full py-2 text-sm"
                    placeholder="https://..."
                    value={form.websiteUrl}
                    onChange={(e) =>
                      setForm({ ...form, websiteUrl: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Twitter Handle (opsional)
                  </label>
                  <input
                    type="text"
                    className="input w-full py-2 text-sm"
                    placeholder="@username"
                    maxLength={100}
                    value={form.twitterHandle}
                    onChange={(e) =>
                      setForm({ ...form, twitterHandle: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Instagram Handle (opsional)
                  </label>
                  <input
                    type="text"
                    className="input w-full py-2 text-sm"
                    placeholder="@username"
                    maxLength={100}
                    value={form.instagramHandle}
                    onChange={(e) =>
                      setForm({ ...form, instagramHandle: e.target.value })
                    }
                  />
                </div>
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

// Suppress unused import warning — toDatetimeInput kept for future datetime fields
void toDatetimeInput;
