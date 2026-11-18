"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Plus, Trash2, AlertCircle, Loader2 } from "lucide-react";
import type { Role } from "@prisma/client";
import { canManageTiktok } from "@/lib/tiktok/specs";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

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
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const { error: showError, success: showSuccess } = useToast();
  const { confirm } = useConfirm();
  const userRole = session?.user?.role as Role | undefined;
  const isAuthorized = Boolean(userRole && canManageTiktok(userRole));

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (sessionStatus !== "loading" && !isAuthorized) {
      router.replace("/panel/dashboard");
    }
  }, [sessionStatus, isAuthorized, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/tiktok/accounts");
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || `Gagal memuat daftar akun (HTTP ${res.status})`);
      }
      setAccounts(json.data || []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat daftar akun");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === "authenticated" && isAuthorized) {
      load();
    }
  }, [sessionStatus, isAuthorized, load]);

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
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setError(json.error || "Gagal menambah akun");
        return;
      }
      setUsername("");
      setDisplayName("");
      setAvatarUrl("");
      setShowForm(false);
      showSuccess("Akun TikTok berhasil ditambahkan");
      await load();
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string, targetUsername: string) => {
    const ok = await confirm({
      message: `Hapus akun @${targetUsername}? Konten yang terhubung tidak dihapus, hanya kehilangan referensi akun.`,
      title: "Hapus Akun TikTok",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/tiktok/accounts/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        showError(json.error || "Gagal menghapus akun");
        return;
      }
      showSuccess(`Akun @${targetUsername} dihapus`);
      await load();
    } catch {
      showError("Gagal menghubungi server saat menghapus akun");
    }
  };

  if (sessionStatus === "loading" || !isAuthorized) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

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
          <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">
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
      <div className="mb-5 flex items-start gap-3 rounded-lg border border-yellow-400 border-l-4 border-l-yellow-500 bg-surface p-4">
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

      {loadError && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-red-300 border-l-4 border-l-red-600 bg-surface p-4 text-sm text-red-700">
          <span>{loadError}</span>
          <button type="button" onClick={load} className="btn-ghost text-xs font-semibold text-primary">
            Coba Lagi
          </button>
        </div>
      )}

      {showForm && (
        <div className="mb-5 rounded-lg border border-primary/40 border-l-4 border-l-primary bg-surface p-5">
          <h2 className="mb-3 text-base font-bold text-txt-primary">Tambah Akun Manual</h2>
          {error && (
            <div className="mb-3 rounded-md border border-red-300 border-l-4 border-l-red-600 bg-surface p-2 text-sm text-red-700">
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
                aria-label={`Hapus akun @${a.username}`}
                className="rounded-md p-2 text-red-500 hover:text-red-700"
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
