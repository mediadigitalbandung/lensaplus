"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, AtSign, AlertCircle, Loader2 } from "lucide-react";

interface Account {
  id: string;
  ownerName: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  createdAt: string;
  platformUserId: string | null;
  expiresAt: string | null;
}

export default function TiktokAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tiktok/accounts");
      const json = await res.json();
      setAccounts(json.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    setError("");
    if (!username.trim() || !displayName.trim()) {
      setError("Username dan nama tampilan wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/tiktok/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          displayName: displayName.trim(),
          avatarUrl: avatarUrl.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || "Gagal menambah akun");
        return;
      }
      setUsername("");
      setDisplayName("");
      setAvatarUrl("");
      setShowForm(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string, username: string) => {
    if (!confirm(`Hapus akun @${username}? Konten yang terhubung tidak dihapus, hanya kehilangan referensi akun.`)) return;
    await fetch(`/api/tiktok/accounts/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div>
      <Link
        href="/panel/tiktok"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-txt-secondary hover:text-primary"
      >
        <ArrowLeft size={14} />
        Kembali
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl sm:text-3xl font-bold text-txt-primary">
            <AtSign size={24} className="text-primary" />
            Akun TikTok
          </h1>
          <p className="text-sm text-txt-secondary">
            Daftar akun TikTok yang dapat dipakai sebagai target posting konten.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="btn-primary flex items-center gap-1.5 text-sm"
        >
          <Plus size={14} />
          Tambah Akun
        </button>
      </div>

      {/* Phase 3 disclaimer */}
      <div className="mb-5 flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-yellow-700" />
        <div className="text-sm text-yellow-800">
          <p className="font-semibold">OAuth TikTok belum aktif (Fase 3)</p>
          <p className="mt-0.5 text-yellow-700">
            Saat ini akun ditambahkan secara manual sebagai placeholder — tidak ada token yang
            tersimpan dan tidak ada koneksi langsung. Setelah aplikasi TikTok kami lulus audit
            Content Posting API, halaman ini akan diganti dengan tombol &quot;Connect dengan TikTok&quot;
            yang menjalankan OAuth resmi.
          </p>
        </div>
      </div>

      {showForm && (
        <div className="mb-5 rounded-lg border border-primary/30 bg-primary-50 p-5">
          <h2 className="mb-3 text-base font-bold text-txt-primary">Tambah Akun Manual</h2>
          {error && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-txt-primary">Username</label>
              <div className="flex">
                <span className="flex items-center rounded-l-md border border-r-0 border-border bg-surface-container-low px-3 text-sm text-txt-secondary">
                  @
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input flex-1 rounded-l-none text-sm"
                  placeholder="lensaplus_id"
                  maxLength={60}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-txt-primary">Nama Tampilan</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input w-full text-sm"
                placeholder="Lensaplus News"
                maxLength={120}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-txt-primary">Avatar URL (opsional)</label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="input w-full text-sm"
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn-ghost text-sm"
              disabled={submitting}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50"
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              Simpan
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-border bg-surface p-10 text-center">
          <Loader2 className="mx-auto animate-spin text-primary" size={24} />
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-10 text-center text-sm text-txt-secondary">
          Belum ada akun TikTok terdaftar.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 shadow-card"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-lg font-bold text-white">
                {a.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={a.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  a.displayName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-txt-primary">@{a.username}</p>
                <p className="truncate text-xs text-txt-secondary">{a.displayName}</p>
                <p className="truncate text-[10px] text-txt-muted">
                  {a.platformUserId ? "OAuth ✓" : "Placeholder manual"} · oleh {a.ownerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(a.id, a.username)}
                className="rounded-md p-2 text-red-500 hover:bg-red-50"
                title="Hapus"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
