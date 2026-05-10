"use client";

/**
 * /panel/emiten — EDITOR+ CRUD for PublicCompany
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  BarChart2,
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

type Sector =
  | "KEUANGAN"
  | "ENERGI"
  | "KONSUMER"
  | "PROPERTI"
  | "TELEKOMUNIKASI"
  | "INFRASTRUKTUR"
  | "PERTAMBANGAN"
  | "PERTANIAN_PERKEBUNAN"
  | "TRANSPORTASI"
  | "TEKNOLOGI"
  | "KESEHATAN_FARMASI"
  | "MANUFAKTUR"
  | "PARIWISATA"
  | "OTHER";

const SECTOR_LABELS: Record<Sector, string> = {
  KEUANGAN: "Keuangan",
  ENERGI: "Energi",
  KONSUMER: "Konsumer",
  PROPERTI: "Properti",
  TELEKOMUNIKASI: "Telekomunikasi",
  INFRASTRUKTUR: "Infrastruktur",
  PERTAMBANGAN: "Pertambangan",
  PERTANIAN_PERKEBUNAN: "Pertanian & Perkebunan",
  TRANSPORTASI: "Transportasi",
  TEKNOLOGI: "Teknologi",
  KESEHATAN_FARMASI: "Kesehatan & Farmasi",
  MANUFAKTUR: "Manufaktur",
  PARIWISATA: "Pariwisata",
  OTHER: "Lainnya",
};

interface Company {
  id: string;
  ticker: string;
  name: string;
  shortName: string | null;
  sector: Sector;
  marketCap: string | null;
  logoUrl: string | null;
  website: string | null;
  ceo: string | null;
  hq: string | null;
  employees: number | null;
  founded: number | null;
  ipoDate: string | null;
  description: string | null;
  isActive: boolean;
  viewCount: number;
  createdAt: string;
}

const EMPTY_FORM = {
  ticker: "",
  name: "",
  shortName: "",
  sector: "KEUANGAN" as Sector,
  description: "",
  founded: "",
  ipoDate: "",
  marketCap: "",
  website: "",
  logoUrl: "",
  ceo: "",
  hq: "",
  employees: "",
  isActive: true,
};

export default function PanelEmitenPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const userRole = (session?.user as { role?: string })?.role ?? "";
  const isEditor = ["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"].includes(userRole);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(search ? { search } : {}),
        ...(sectorFilter ? { sector: sectorFilter } : {}),
      });
      const res = await fetch(`/api/panel/companies?${params}`);
      if (!res.ok) throw new Error("Gagal memuat data");
      const json = await res.json();
      setCompanies(json.data?.companies ?? []);
      setTotal(json.data?.total ?? 0);
      setTotalPages(json.data?.totalPages ?? 1);
    } catch {
      toast("Gagal memuat daftar emiten", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, sectorFilter, toast]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(c: Company) {
    setEditingId(c.id);
    setForm({
      ticker: c.ticker,
      name: c.name,
      shortName: c.shortName ?? "",
      sector: c.sector,
      description: c.description ?? "",
      founded: c.founded?.toString() ?? "",
      ipoDate: c.ipoDate ? c.ipoDate.slice(0, 10) : "",
      marketCap: c.marketCap ?? "",
      website: c.website ?? "",
      logoUrl: c.logoUrl ?? "",
      ceo: c.ceo ?? "",
      hq: c.hq ?? "",
      employees: c.employees?.toString() ?? "",
      isActive: c.isActive,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.ticker || !form.name || !form.sector) {
      toast("Ticker, nama, dan sektor wajib diisi", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ticker: form.ticker.toUpperCase().trim(),
        name: form.name.trim(),
        shortName: form.shortName.trim() || null,
        sector: form.sector,
        description: form.description.trim() || null,
        founded: form.founded ? parseInt(form.founded) : null,
        ipoDate: form.ipoDate ? new Date(form.ipoDate).toISOString() : null,
        marketCap: form.marketCap ? parseInt(form.marketCap) : null,
        website: form.website.trim() || null,
        logoUrl: form.logoUrl.trim() || null,
        ceo: form.ceo.trim() || null,
        hq: form.hq.trim() || null,
        employees: form.employees ? parseInt(form.employees) : null,
        isActive: form.isActive,
      };

      const url = editingId
        ? `/api/panel/companies/${editingId}`
        : "/api/panel/companies";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal menyimpan");

      toast(editingId ? "Emiten berhasil diperbarui" : "Emiten berhasil ditambahkan", "success");
      setModalOpen(false);
      fetchCompanies();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: Company) {
    const ok = await confirm({
      title: "Hapus Emiten",
      message: `Yakin hapus ${c.ticker} — ${c.name}? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: "Hapus",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/panel/companies/${c.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus");
      toast(`${c.ticker} dihapus`, "success");
      fetchCompanies();
    } catch {
      toast("Gagal menghapus emiten", "error");
    }
  }

  function formatMCap(cap: string | null): string {
    if (!cap) return "—";
    const num = parseInt(cap);
    if (isNaN(num)) return "—";
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)} T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)} M`;
    return num.toLocaleString("id-ID");
  }

  if (!isEditor) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-body-md text-txt-muted">Akses tidak diizinkan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BarChart2 className="text-primary" size={24} />
          <div>
            <h1 className="text-xl font-bold text-txt-primary">Manajemen Emiten</h1>
            <p className="text-sm text-txt-muted">{total} perusahaan terdaftar</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchCompanies()}
            className="btn-ghost rounded-lg p-2"
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm">
            <Plus size={16} />
            Tambah Emiten
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-txt-muted" />
          <select
            value={sectorFilter}
            onChange={(e) => { setSectorFilter(e.target.value); setPage(1); }}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
          >
            <option value="">Semua Sektor</option>
            {(Object.entries(SECTOR_LABELS) as [Sector, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <input
          type="text"
          placeholder="Cari ticker / nama..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm w-56"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border bg-surface-secondary">
            <tr>
              <th className="px-4 py-3 text-left text-label-sm text-txt-muted">Ticker</th>
              <th className="px-4 py-3 text-left text-label-sm text-txt-muted">Nama</th>
              <th className="px-4 py-3 text-left text-label-sm text-txt-muted">Sektor</th>
              <th className="px-4 py-3 text-right text-label-sm text-txt-muted">Market Cap</th>
              <th className="px-4 py-3 text-center text-label-sm text-txt-muted">Status</th>
              <th className="px-4 py-3 text-center text-label-sm text-txt-muted">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-txt-muted">
                  <Loader2 className="mx-auto animate-spin" size={24} />
                </td>
              </tr>
            ) : companies.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-txt-muted">
                  Tidak ada emiten ditemukan.
                </td>
              </tr>
            ) : (
              companies.map((c) => (
                <tr key={c.id} className="hover:bg-surface-secondary">
                  <td className="px-4 py-3 font-mono font-bold text-primary">{c.ticker}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-txt-primary">{c.name}</div>
                    {c.shortName && (
                      <div className="text-xs text-txt-muted">{c.shortName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-txt-secondary">
                    {SECTOR_LABELS[c.sector]}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-txt-primary">
                    {formatMCap(c.marketCap)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        c.isActive
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {c.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <a
                        href={`/emiten/${c.ticker.toLowerCase()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded p-1.5 text-txt-muted hover:text-primary"
                        title="Lihat halaman publik"
                      >
                        <ExternalLink size={15} />
                      </a>
                      <button
                        onClick={() => openEdit(c)}
                        className="rounded p-1.5 text-txt-muted hover:text-primary"
                        title="Edit"
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        className="rounded p-1.5 text-txt-muted hover:text-secondary"
                        title="Hapus"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost rounded-lg p-1.5 disabled:opacity-40"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-txt-muted">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-ghost rounded-lg p-1.5 disabled:opacity-40"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-surface p-6 shadow-2xl">
            <h2 className="mb-6 text-lg font-bold text-txt-primary">
              {editingId ? "Edit Emiten" : "Tambah Emiten"}
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Ticker */}
              <div>
                <label className="mb-1 block text-label-sm font-medium text-txt-secondary">
                  Ticker <span className="text-secondary">*</span>
                </label>
                <input
                  value={form.ticker}
                  onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                  placeholder="BBRI"
                  className="input w-full rounded-md border border-border px-3 py-2 font-mono text-sm uppercase"
                  maxLength={10}
                />
              </div>

              {/* Sektor */}
              <div>
                <label className="mb-1 block text-label-sm font-medium text-txt-secondary">
                  Sektor <span className="text-secondary">*</span>
                </label>
                <select
                  value={form.sector}
                  onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value as Sector }))}
                  className="input w-full rounded-md border border-border px-3 py-2 text-sm"
                >
                  {(Object.entries(SECTOR_LABELS) as [Sector, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Name */}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-label-sm font-medium text-txt-secondary">
                  Nama Perusahaan <span className="text-secondary">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="PT Bank Rakyat Indonesia Tbk"
                  className="input w-full rounded-md border border-border px-3 py-2 text-sm"
                />
              </div>

              {/* Short name */}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-label-sm font-medium text-txt-secondary">
                  Nama Pendek
                </label>
                <input
                  value={form.shortName}
                  onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))}
                  placeholder="Bank BRI"
                  className="input w-full rounded-md border border-border px-3 py-2 text-sm"
                />
              </div>

              {/* CEO */}
              <div>
                <label className="mb-1 block text-label-sm font-medium text-txt-secondary">CEO / Direktur Utama</label>
                <input
                  value={form.ceo}
                  onChange={(e) => setForm((f) => ({ ...f, ceo: e.target.value }))}
                  className="input w-full rounded-md border border-border px-3 py-2 text-sm"
                />
              </div>

              {/* HQ */}
              <div>
                <label className="mb-1 block text-label-sm font-medium text-txt-secondary">Kantor Pusat</label>
                <input
                  value={form.hq}
                  onChange={(e) => setForm((f) => ({ ...f, hq: e.target.value }))}
                  placeholder="Jakarta, Indonesia"
                  className="input w-full rounded-md border border-border px-3 py-2 text-sm"
                />
              </div>

              {/* Founded */}
              <div>
                <label className="mb-1 block text-label-sm font-medium text-txt-secondary">Tahun Berdiri</label>
                <input
                  type="number"
                  value={form.founded}
                  onChange={(e) => setForm((f) => ({ ...f, founded: e.target.value }))}
                  placeholder="1946"
                  className="input w-full rounded-md border border-border px-3 py-2 text-sm"
                  min={1800}
                  max={2100}
                />
              </div>

              {/* IPO date */}
              <div>
                <label className="mb-1 block text-label-sm font-medium text-txt-secondary">Tanggal IPO</label>
                <input
                  type="date"
                  value={form.ipoDate}
                  onChange={(e) => setForm((f) => ({ ...f, ipoDate: e.target.value }))}
                  className="input w-full rounded-md border border-border px-3 py-2 text-sm"
                />
              </div>

              {/* Market cap */}
              <div>
                <label className="mb-1 block text-label-sm font-medium text-txt-secondary">Market Cap (IDR)</label>
                <input
                  type="number"
                  value={form.marketCap}
                  onChange={(e) => setForm((f) => ({ ...f, marketCap: e.target.value }))}
                  placeholder="800000000000000"
                  className="input w-full rounded-md border border-border px-3 py-2 text-sm"
                  min={0}
                />
              </div>

              {/* Employees */}
              <div>
                <label className="mb-1 block text-label-sm font-medium text-txt-secondary">Jumlah Karyawan</label>
                <input
                  type="number"
                  value={form.employees}
                  onChange={(e) => setForm((f) => ({ ...f, employees: e.target.value }))}
                  placeholder="100000"
                  className="input w-full rounded-md border border-border px-3 py-2 text-sm"
                  min={0}
                />
              </div>

              {/* Website */}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-label-sm font-medium text-txt-secondary">Website</label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  placeholder="https://www.bri.co.id"
                  className="input w-full rounded-md border border-border px-3 py-2 text-sm"
                />
              </div>

              {/* Logo URL */}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-label-sm font-medium text-txt-secondary">Logo URL</label>
                <input
                  type="url"
                  value={form.logoUrl}
                  onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                  placeholder="https://..."
                  className="input w-full rounded-md border border-border px-3 py-2 text-sm"
                />
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-label-sm font-medium text-txt-secondary">Deskripsi</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={4}
                  className="input w-full rounded-md border border-border px-3 py-2 text-sm resize-none"
                />
              </div>

              {/* isActive toggle */}
              <div className="sm:col-span-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-border text-primary"
                />
                <label htmlFor="isActive" className="text-body-sm text-txt-secondary">
                  Aktif (tampil di direktori publik)
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="btn-ghost rounded-lg px-4 py-2 text-sm"
                disabled={saving}
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex items-center gap-2 rounded-lg px-5 py-2 text-sm"
              >
                {saving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
