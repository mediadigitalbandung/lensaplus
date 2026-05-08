"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingDown,
  Search,
  Loader2,
  Download,
} from "lucide-react";

interface Subscriber {
  id: string;
  email: string;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  source: string | null;
  lastSentAt: string | null;
  createdAt: string;
}

interface Summary {
  all: number;
  confirmed: number;
  unsubscribed: number;
  pending: number;
  churnRate: number;
}

type Filter = "all" | "confirmed" | "pending" | "unsubscribed";

const FILTER_LABEL: Record<Filter, string> = {
  all: "Semua",
  confirmed: "Aktif",
  pending: "Menunggu konfirmasi",
  unsubscribed: "Berhenti",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusBadge(s: Subscriber): { label: string; cls: string } {
  if (s.unsubscribedAt) return { label: "Berhenti", cls: "bg-red-50 text-red-700" };
  if (s.confirmedAt) return { label: "Aktif", cls: "bg-emerald-50 text-emerald-700" };
  return { label: "Menunggu", cls: "bg-yellow-50 text-yellow-700" };
}

export default function NewsletterSubscribersPage() {
  const [items, setItems] = useState<Subscriber[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/panel/newsletter-subscribers?page=${page}&limit=50&filter=${filter}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        setItems(json.data?.items || []);
        setSummary(json.data?.summary || null);
        setTotalPages(json.data?.totalPages || 1);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [page, filter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (s) =>
        s.email.toLowerCase().includes(q) ||
        (s.source || "").toLowerCase().includes(q),
    );
  }, [items, search]);

  function exportCsv() {
    const header = ["email", "status", "source", "createdAt", "confirmedAt", "unsubscribedAt", "lastSentAt"];
    const rows = filtered.map((s) => {
      const status = s.unsubscribedAt ? "unsubscribed" : s.confirmedAt ? "confirmed" : "pending";
      return [
        s.email,
        status,
        s.source || "",
        s.createdAt,
        s.confirmedAt || "",
        s.unsubscribedAt || "",
        s.lastSentAt || "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kartawarta-newsletter-${filter}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-txt-primary">Newsletter Subscribers</h1>
          <p className="mt-1 text-sm text-txt-secondary">
            Daftar pelanggan newsletter mingguan Kartawarta
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="btn-ghost inline-flex items-center gap-1.5 text-sm disabled:opacity-50"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            icon={Mail}
            label="Total Pendaftar"
            value={summary.all}
            tone="info"
          />
          <SummaryCard
            icon={CheckCircle2}
            label="Aktif"
            value={summary.confirmed}
            tone="ok"
            hint={`${summary.all > 0 ? Math.round((summary.confirmed / summary.all) * 100) : 0}% dari total`}
          />
          <SummaryCard
            icon={Clock}
            label="Menunggu Konfirmasi"
            value={summary.pending}
            tone="warn"
          />
          <SummaryCard
            icon={TrendingDown}
            label="Berhenti"
            value={summary.unsubscribed}
            tone="danger"
            hint={`Churn ${summary.churnRate}%`}
          />
        </div>
      )}

      {/* Filter + search */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === f
                ? "bg-primary text-white"
                : "bg-surface-secondary text-txt-secondary hover:bg-surface-tertiary"
            }`}
          >
            {FILTER_LABEL[f]}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input
            type="search"
            placeholder="Cari email atau sumber..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full pl-9 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-txt-muted" />
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Mail size={28} className="mx-auto text-border mb-2" />
            <p className="text-sm text-txt-secondary">Tidak ada subscriber dalam filter ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-secondary/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-txt-muted">
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Sumber</th>
                  <th className="px-4 py-2.5">Daftar</th>
                  <th className="px-4 py-2.5">Kirim Terakhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((s) => {
                  const badge = statusBadge(s);
                  return (
                    <tr key={s.id} className="hover:bg-surface-secondary/40">
                      <td className="px-4 py-2.5 font-medium text-txt-primary">{s.email}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-txt-secondary">{s.source || "—"}</td>
                      <td className="px-4 py-2.5 text-txt-muted text-xs">{formatDate(s.createdAt)}</td>
                      <td className="px-4 py-2.5 text-txt-muted text-xs">{formatDate(s.lastSentAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="btn-ghost text-sm disabled:opacity-50"
          >
            ← Sebelumnya
          </button>
          <span className="text-xs text-txt-muted">
            Halaman {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="btn-ghost text-sm disabled:opacity-50"
          >
            Selanjutnya →
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone: "info" | "ok" | "warn" | "danger";
  hint?: string;
}) {
  const toneCls: Record<string, string> = {
    info: "text-blue-600 bg-blue-50",
    ok: "text-emerald-600 bg-emerald-50",
    warn: "text-yellow-600 bg-yellow-50",
    danger: "text-red-600 bg-red-50",
  };
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${toneCls[tone]}`}>
        <Icon size={16} />
      </div>
      <p className="mt-2 text-2xl font-extrabold text-txt-primary tabular-nums">
        {value.toLocaleString("id-ID")}
      </p>
      <p className="text-xs font-semibold text-txt-secondary">{label}</p>
      {hint && <p className="mt-0.5 text-[10px] text-txt-muted">{hint}</p>}
    </div>
  );
}
