"use client";

/**
 * Jadwal Sidang — EDITOR+ / JOURNALIST+
 * CRUD court schedules
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Gavel,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  Calendar,
  Filter,
  Save,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type ScheduleStatus = "SCHEDULED" | "LIVE" | "DONE" | "CANCELLED";

interface CourtSchedule {
  id: string;
  caseName: string;
  caseNumber: string | null;
  courtName: string;
  scheduledAt: string;
  status: ScheduleStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<ScheduleStatus, string> = {
  SCHEDULED: "bg-blue-50 text-blue-600",
  LIVE: "bg-red-50 text-red-600 animate-pulse",
  DONE: "bg-primary-light text-primary",
  CANCELLED: "bg-surface-tertiary text-txt-muted",
};

const STATUS_LABELS: Record<ScheduleStatus, string> = {
  SCHEDULED: "Terjadwal",
  LIVE: "Sedang Berlangsung",
  DONE: "Selesai",
  CANCELLED: "Dibatalkan",
};

const WRITE_ROLES = [
  "SUPER_ADMIN",
  "CHIEF_EDITOR",
  "EDITOR",
  "SENIOR_JOURNALIST",
  "JOURNALIST",
];

function formatDateTime(s: string) {
  return new Date(s).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLocalInput(s: string) {
  const d = new Date(s);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface FormData {
  caseName: string;
  caseNumber: string;
  courtName: string;
  scheduledAt: string;
  status: ScheduleStatus;
  notes: string;
}

const EMPTY_FORM: FormData = {
  caseName: "",
  caseNumber: "",
  courtName: "",
  scheduledAt: toLocalInput(new Date().toISOString()),
  status: "SCHEDULED",
  notes: "",
};

export default function JadwalSidangPage() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = session?.user?.role || "";
  const canWrite = WRITE_ROLES.includes(userRole);
  const { success: showSuccess, error: showError } = useToast();
  const { confirm } = useConfirm();

  const [schedules, setSchedules] = useState<CourtSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<ScheduleStatus | "ALL">(
    "ALL",
  );

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CourtSchedule | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  if (sessionStatus !== "loading" && session && !canWrite && userRole === "CONTRIBUTOR") {
    // Contributor has no access
    redirect("/panel/dashboard");
  }

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      params.set("limit", "200");
      const res = await fetch(`/api/court-schedule?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setSchedules(json.data?.schedules || []);
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(s: CourtSchedule) {
    setEditing(s);
    setForm({
      caseName: s.caseName,
      caseNumber: s.caseNumber || "",
      courtName: s.courtName,
      scheduledAt: toLocalInput(s.scheduledAt),
      status: s.status,
      notes: s.notes || "",
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.caseName.trim() || !form.courtName.trim()) {
      showError("Nama perkara dan pengadilan wajib diisi.");
      return;
    }
    try {
      setSaving(true);
      const iso = new Date(form.scheduledAt).toISOString();
      const payload = {
        caseName: form.caseName,
        caseNumber: form.caseNumber || null,
        courtName: form.courtName,
        scheduledAt: iso,
        status: form.status,
        notes: form.notes || null,
      };
      const url = editing
        ? `/api/court-schedule/${editing.id}`
        : "/api/court-schedule";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menyimpan");
      showSuccess(editing ? "Jadwal diperbarui." : "Jadwal dibuat.");
      setShowForm(false);
      fetchSchedules();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: "Hapus jadwal",
      message: `Yakin ingin menghapus jadwal "${name}"?`,
      variant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/court-schedule/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menghapus");
      showSuccess("Jadwal dihapus.");
      fetchSchedules();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menghapus");
    }
  }

  if (sessionStatus === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Gavel size={24} className="text-primary" />
            <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">
              Jadwal Sidang
            </h1>
          </div>
          <p className="mt-1 text-sm text-txt-secondary">
            Kalender jadwal persidangan. {schedules.length} entri.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchSchedules}
            className="btn-ghost flex items-center gap-2 px-3 py-2.5 text-sm"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          {canWrite && (
            <button
              onClick={openCreate}
              className="btn-primary flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold"
            >
              <Plus size={14} /> Jadwal Baru
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-txt-muted" />
        {(
          [
            "ALL",
            "SCHEDULED",
            "LIVE",
            "DONE",
            "CANCELLED",
          ] as const
        ).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filterStatus === s
                ? "bg-primary text-white"
                : "bg-surface-tertiary text-txt-secondary hover:bg-border"
            }`}
          >
            {s === "ALL" ? "Semua" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 size={24} className="mx-auto animate-spin text-primary" />
          </div>
        ) : schedules.length === 0 ? (
          <div className="py-16 text-center">
            <Gavel size={40} className="mx-auto text-border mb-3" />
            <p className="text-sm text-txt-secondary">
              Belum ada jadwal sidang.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-secondary">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                    Perkara
                  </th>
                  <th className="hidden md:table-cell px-5 py-3 text-left font-medium text-txt-secondary">
                    Pengadilan
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                    Jadwal
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-txt-secondary">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {schedules.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-secondary/50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-txt-primary">
                        {s.caseName}
                      </p>
                      {s.caseNumber && (
                        <p className="text-[11px] text-txt-muted font-mono">
                          No. {s.caseNumber}
                        </p>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-5 py-3 text-xs text-txt-secondary">
                      {s.courtName}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      <div className="flex items-center gap-1.5 text-txt-primary">
                        <Calendar size={12} className="text-txt-muted" />
                        {formatDateTime(s.scheduledAt)}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status]}`}
                      >
                        {STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {canWrite && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(s)}
                            className="btn-ghost rounded p-2"
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() =>
                              handleDelete(s.id, s.caseName)
                            }
                            className="btn-ghost rounded p-2 hover:text-red-500"
                            title="Hapus"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-xl font-bold text-txt-primary mb-4">
              {editing ? "Edit Jadwal" : "Jadwal Baru"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Nama Perkara
                </label>
                <input
                  type="text"
                  className="input w-full py-2 text-sm"
                  value={form.caseName}
                  onChange={(e) =>
                    setForm({ ...form, caseName: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Nomor Perkara (opsional)
                  </label>
                  <input
                    type="text"
                    className="input w-full py-2 text-sm"
                    value={form.caseNumber}
                    onChange={(e) =>
                      setForm({ ...form, caseNumber: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Pengadilan
                  </label>
                  <input
                    type="text"
                    className="input w-full py-2 text-sm"
                    value={form.courtName}
                    onChange={(e) =>
                      setForm({ ...form, courtName: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Tanggal & Waktu
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
                    Status
                  </label>
                  <select
                    className="input w-full py-2 text-sm"
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as ScheduleStatus,
                      })
                    }
                  >
                    <option value="SCHEDULED">Terjadwal</option>
                    <option value="LIVE">Sedang Berlangsung</option>
                    <option value="DONE">Selesai</option>
                    <option value="CANCELLED">Dibatalkan</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Catatan (opsional)
                </label>
                <textarea
                  rows={4}
                  className="input w-full py-2 text-sm"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
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
