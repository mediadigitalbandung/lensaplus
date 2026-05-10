"use client";

/**
 * /panel/kalender-emiten — EDITOR+ CRUD for MarketEvent
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  Save,
  Filter,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type MarketEventType =
  | "EARNINGS"
  | "IPO"
  | "RUPS"
  | "DIVIDEND"
  | "STOCK_SPLIT"
  | "RIGHTS_ISSUE"
  | "OTHER";

interface MarketEvent {
  id: string;
  type: MarketEventType;
  ticker: string | null;
  companyName: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  endsAt: string | null;
  source: string | null;
  articleId: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

const TYPE_LABELS: Record<MarketEventType, string> = {
  EARNINGS: "Laporan Keuangan",
  IPO: "IPO",
  RUPS: "RUPS",
  DIVIDEND: "Dividen",
  STOCK_SPLIT: "Stock Split",
  RIGHTS_ISSUE: "Rights Issue",
  OTHER: "Lainnya",
};

const TYPE_COLORS: Record<MarketEventType, string> = {
  EARNINGS: "bg-blue-50 text-blue-700",
  IPO: "bg-emerald-50 text-emerald-700",
  RUPS: "bg-purple-50 text-purple-700",
  DIVIDEND: "bg-yellow-50 text-yellow-700",
  STOCK_SPLIT: "bg-pink-50 text-pink-700",
  RIGHTS_ISSUE: "bg-orange-50 text-orange-700",
  OTHER: "bg-surface-tertiary text-txt-secondary",
};

const WRITE_ROLES = ["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"];

function toLocalInput(s: string): string {
  const d = new Date(s);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(s: string): string {
  return new Date(s).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface FormData {
  type: MarketEventType;
  ticker: string;
  companyName: string;
  title: string;
  description: string;
  scheduledAt: string;
  endsAt: string;
  source: string;
  articleId: string;
  isPublished: boolean;
}

function nowLocalInput(): string {
  return toLocalInput(new Date().toISOString());
}

const EMPTY_FORM: FormData = {
  type: "EARNINGS",
  ticker: "",
  companyName: "",
  title: "",
  description: "",
  scheduledAt: nowLocalInput(),
  endsAt: "",
  source: "",
  articleId: "",
  isPublished: true,
};

const ALL_TYPES: MarketEventType[] = [
  "EARNINGS",
  "IPO",
  "RUPS",
  "DIVIDEND",
  "STOCK_SPLIT",
  "RIGHTS_ISSUE",
  "OTHER",
];

export default function KalenderEmitenPanelPage() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = session?.user?.role || "";
  const canWrite = WRITE_ROLES.includes(userRole);
  const { success: showSuccess, error: showError } = useToast();
  const { confirm } = useConfirm();

  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<MarketEventType | "ALL">("ALL");
  const LIMIT = 20;

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MarketEvent | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  if (
    sessionStatus !== "loading" &&
    session &&
    !WRITE_ROLES.includes(userRole)
  ) {
    redirect("/panel/dashboard");
  }

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(LIMIT),
        page: String(page),
      });
      if (filterType !== "ALL") params.set("type", filterType);
      const res = await fetch(`/api/panel/market-events?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setEvents(json.data?.events || []);
        setTotal(json.data?.total || 0);
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, [page, filterType]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setPage(1);
  }, [filterType]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, scheduledAt: nowLocalInput() });
    setShowForm(true);
  }

  function openEdit(e: MarketEvent) {
    setEditing(e);
    setForm({
      type: e.type,
      ticker: e.ticker || "",
      companyName: e.companyName,
      title: e.title,
      description: e.description || "",
      scheduledAt: toLocalInput(e.scheduledAt),
      endsAt: e.endsAt ? toLocalInput(e.endsAt) : "",
      source: e.source || "",
      articleId: e.articleId || "",
      isPublished: e.isPublished,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.companyName.trim() || !form.title.trim()) {
      showError("Nama perusahaan dan judul event wajib diisi.");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        type: form.type,
        ticker: form.ticker.trim().toUpperCase() || null,
        companyName: form.companyName.trim(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        source: form.source.trim() || null,
        articleId: form.articleId.trim() || null,
        isPublished: form.isPublished,
      };

      const url = editing
        ? `/api/panel/market-events/${editing.id}`
        : "/api/panel/market-events";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menyimpan");
      showSuccess(editing ? "Event diperbarui." : "Event ditambahkan.");
      setShowForm(false);
      fetchEvents();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    const ok = await confirm({
      title: "Hapus event",
      message: `Yakin ingin menghapus "${title}"?`,
      variant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/panel/market-events/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menghapus");
      showSuccess("Event dihapus.");
      fetchEvents();
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
            <TrendingUp size={24} className="text-primary" />
            <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">
              Kalender Emiten
            </h1>
          </div>
          <p className="mt-1 text-sm text-txt-secondary">
            Event emiten: earnings, IPO, RUPS, dividen. {total} entri total.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchEvents}
            className="btn-ghost flex items-center gap-2 px-3 py-2.5 text-sm"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          {canWrite && (
            <button
              onClick={openCreate}
              className="btn-primary flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold"
            >
              <Plus size={14} /> Event Baru
            </button>
          )}
        </div>
      </div>

      {/* Type filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Filter size={14} className="text-txt-muted shrink-0" />
        {(["ALL", ...ALL_TYPES] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t as typeof filterType)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filterType === t
                ? "bg-primary text-white"
                : "bg-surface-tertiary text-txt-secondary hover:bg-border"
            }`}
          >
            {t === "ALL" ? "Semua" : TYPE_LABELS[t as MarketEventType]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 size={24} className="mx-auto animate-spin text-primary" />
          </div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarDays size={40} className="mx-auto text-border mb-3" />
            <p className="text-sm text-txt-secondary">Belum ada event.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-secondary">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                    Event
                  </th>
                  <th className="hidden sm:table-cell px-5 py-3 text-left font-medium text-txt-secondary">
                    Tipe
                  </th>
                  <th className="hidden md:table-cell px-5 py-3 text-left font-medium text-txt-secondary">
                    Jadwal
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                    Status
                  </th>
                  {canWrite && (
                    <th className="px-5 py-3 text-right font-medium text-txt-secondary">
                      Aksi
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-secondary/50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-txt-primary line-clamp-1">
                        {e.title}
                      </p>
                      <p className="text-xs text-txt-muted mt-0.5">
                        {e.companyName}
                        {e.ticker && (
                          <span className="ml-1.5 font-mono font-bold text-primary">
                            [{e.ticker}]
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="hidden sm:table-cell px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[e.type]}`}
                      >
                        {TYPE_LABELS[e.type]}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-5 py-3 text-xs text-txt-secondary">
                      <div className="flex items-center gap-1">
                        <CalendarDays size={12} className="text-txt-muted" />
                        {formatDateTime(e.scheduledAt)}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          e.isPublished
                            ? "bg-primary-light text-primary"
                            : "bg-surface-tertiary text-txt-muted"
                        }`}
                      >
                        {e.isPublished ? "Publik" : "Draft"}
                      </span>
                    </td>
                    {canWrite && (
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(e)}
                            className="btn-ghost rounded p-2"
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(e.id, e.title)}
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
          <div className="bg-surface rounded-2xl shadow-2xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-xl font-bold text-txt-primary mb-5">
              {editing ? "Edit Event" : "Event Baru"}
            </h3>

            <div className="space-y-4">
              {/* Type + Ticker */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Tipe Event
                  </label>
                  <select
                    className="input w-full py-2 text-sm"
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value as MarketEventType })
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
                    Ticker Emiten (opsional)
                  </label>
                  <input
                    type="text"
                    className="input w-full py-2 text-sm font-mono uppercase"
                    placeholder="BBRI"
                    maxLength={10}
                    value={form.ticker}
                    onChange={(e) =>
                      setForm({ ...form, ticker: e.target.value.toUpperCase() })
                    }
                  />
                </div>
              </div>

              {/* Company Name */}
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Nama Perusahaan
                </label>
                <input
                  type="text"
                  className="input w-full py-2 text-sm"
                  placeholder="Bank Rakyat Indonesia"
                  maxLength={200}
                  value={form.companyName}
                  onChange={(e) =>
                    setForm({ ...form, companyName: e.target.value })
                  }
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Judul Event
                </label>
                <input
                  type="text"
                  className="input w-full py-2 text-sm"
                  placeholder="Release Laporan Keuangan Q1 2026"
                  maxLength={300}
                  value={form.title}
                  onChange={(e) =>
                    setForm({ ...form, title: e.target.value })
                  }
                />
              </div>

              {/* scheduledAt + endsAt */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Tanggal &amp; Waktu
                  </label>
                  <input
                    type="datetime-local"
                    className="input w-full py-2 text-sm"
                    value={form.scheduledAt}
                    onChange={(e) =>
                      setForm({ ...form, scheduledAt: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Selesai (opsional)
                  </label>
                  <input
                    type="datetime-local"
                    className="input w-full py-2 text-sm"
                    value={form.endsAt}
                    onChange={(e) =>
                      setForm({ ...form, endsAt: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Keterangan (opsional)
                </label>
                <textarea
                  rows={3}
                  className="input w-full py-2 text-sm"
                  maxLength={5000}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>

              {/* Source + ArticleId */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    URL Sumber (opsional)
                  </label>
                  <input
                    type="url"
                    className="input w-full py-2 text-sm"
                    placeholder="https://idx.co.id/..."
                    value={form.source}
                    onChange={(e) =>
                      setForm({ ...form, source: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    ID Artikel Coverage (opsional)
                  </label>
                  <input
                    type="text"
                    className="input w-full py-2 text-sm font-mono"
                    placeholder="article-cuid"
                    value={form.articleId}
                    onChange={(e) =>
                      setForm({ ...form, articleId: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* isPublished toggle */}
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
