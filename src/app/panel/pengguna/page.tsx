"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import Link from "next/link";
import {
  Plus,
  Search,
  Shield,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Mail,
  ShieldAlert,
  Eye,
  EyeOff,
  AtSign,
  AlertCircle,
  CreditCard,
} from "lucide-react";
import UserCardManager from "@/components/panel/UserCardManager";

interface EmailRoute {
  from: string;
  to: string;
  enabled: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  specialization?: string;
  _count?: { articles: number };
}

const roleLabels: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: "Super Admin", color: "bg-red-50 text-red-600" },
  CHIEF_EDITOR: { label: "Editor Kepala", color: "bg-purple-50 text-purple-600" },
  EDITOR: { label: "Editor", color: "bg-blue-50 text-blue-600" },
  SENIOR_JOURNALIST: { label: "Jurnalis Senior", color: "bg-primary-light text-primary" },
  JOURNALIST: { label: "Jurnalis", color: "bg-blue-50 text-blue-600" },
  CONTRIBUTOR: { label: "Kontributor", color: "bg-surface-tertiary text-txt-secondary" },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      <div className="border-b border-border bg-surface-secondary px-5 py-3">
        <div className="h-4 w-full rounded-lg bg-surface-tertiary" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border px-5 py-3">
          <div className="h-9 w-9 rounded-full bg-surface-tertiary" />
          <div className="flex-1">
            <div className="h-4 w-1/3 rounded-lg bg-surface-tertiary" />
            <div className="mt-1 h-3 w-1/4 rounded-lg bg-surface-secondary" />
          </div>
          <div className="h-5 w-16 rounded-full bg-surface-tertiary" />
          <div className="h-4 w-8 rounded-lg bg-surface-tertiary" />
          <div className="h-4 w-12 rounded-lg bg-surface-tertiary" />
          <div className="h-4 w-20 rounded-lg bg-surface-tertiary" />
        </div>
      ))}
    </div>
  );
}

export default function PenggunaPage() {
  const { data: session } = useSession();
  const { success, error: showError } = useToast();
  const { confirm } = useConfirm();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [cardUser, setCardUser] = useState<{ id: string; name: string } | null>(null);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formRole, setFormRole] = useState("");
  const [formSpec, setFormSpec] = useState("");
  const [formLensaplusEmail, setFormLensaplusEmail] = useState("");
  const [emailRoutes, setEmailRoutes] = useState<EmailRoute[]>([]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [resUsers, resEmails] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/email-routing").catch(() => null),
      ]);

      if (!resUsers.ok) throw new Error("Gagal memuat pengguna");
      const json = await resUsers.json();
      // /api/users returns three possible shapes depending on role + history:
      //   - admin (current):  { data: { users: [...], pagination: {...} } }
      //   - admin (legacy):   { data: { data: [...], total, page, limit } }
      //   - non-admin:        { data: [...] }  (flat array)
      // Defensive parse handles all three so a deploy window mismatch between
      // server and client never blanks the user list.
      const payload = json.data;
      const list: User[] = Array.isArray(payload)
        ? (payload as User[])
        : Array.isArray(payload?.users)
        ? (payload.users as User[])
        : Array.isArray(payload?.data)
        ? (payload.data as User[])
        : [];
      setUsers(list);

      if (resEmails?.ok) {
        const emailJson = await resEmails.json();
        setEmailRoutes(emailJson.data || []);
      }
    } catch (err) {
      setError("Gagal memuat daftar pengguna. Silakan coba lagi.");
      console.error("Fetch users error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function resetForm() {
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("");
    setFormSpec("");
    setFormLensaplusEmail("");
    setEditingUser(null);
  }

  function openEditModal(user: User) {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email.replace("@gmail.com", ""));
    setFormPassword("");
    setFormRole(user.role);
    setFormSpec(user.specialization || "");
    setFormLensaplusEmail("");
    setShowModal(true);
  }

  async function handleSubmitUser(e: FormEvent) {
    e.preventDefault();

    if (!formName || !formEmail || !formRole) {
      showError("Nama, email, dan role wajib diisi.");
      return;
    }

    if (!editingUser && !formPassword) {
      showError("Password wajib diisi untuk pengguna baru.");
      return;
    }

    try {
      setSubmitting(true);

      if (editingUser) {
        // Update existing user
        const fullGmailEdit = formEmail.includes("@") ? formEmail : `${formEmail}@gmail.com`;
        const body: Record<string, string | undefined> = {
          name: formName,
          email: fullGmailEdit,
          role: formRole,
          specialization: formSpec || undefined,
        };
        if (formPassword) {
          body.password = formPassword;
        }

        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "Gagal mengupdate pengguna");
        }

        success("Pengguna berhasil diperbarui");
      } else {
        // Create new user
        const fullGmail = formEmail.includes("@") ? formEmail : `${formEmail}@gmail.com`;
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            email: fullGmail,
            password: formPassword,
            role: formRole,
            specialization: formSpec || undefined,
            lensaplusEmail: formLensaplusEmail || undefined,
          }),
        });

        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "Gagal menambah pengguna");
        }

        const json = await res.json();
        const emailInfo = json.data?.emailCreated ? ` — Email ${formLensaplusEmail}@lensaplus.com dibuat` : "";
        success(`Pengguna berhasil ditambahkan${emailInfo}`);
      }

      setShowModal(false);
      resetForm();
      fetchUsers();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menyimpan pengguna.");
      console.error("Save user error:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({ message: "Apakah Anda yakin ingin menghapus pengguna ini?", variant: "danger", title: "Konfirmasi" });
    if (!ok) {
      return;
    }

    try {
      setDeleting(id);
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Gagal menghapus pengguna");
      }

      success("Pengguna berhasil dihapus");
      fetchUsers();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menghapus pengguna.");
      console.error("Delete user error:", err);
    } finally {
      setDeleting(null);
    }
  }

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedUsers = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // User management is SUPER_ADMIN-only (matches /api/users + middleware
  // SUPER_ONLY). CHIEF_EDITOR has no user-management remit and was previously
  // shown an unusable page (PII is SA-gated server-side anyway).
  if (session && session.user.role !== "SUPER_ADMIN") {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
        <ShieldAlert size={48} className="mb-4 text-red-400" />
        <h1 className="text-xl font-bold text-txt-primary">Akses Ditolak</h1>
        <p className="mt-2 text-base text-txt-secondary">
          Halaman ini hanya dapat diakses oleh Super Admin.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">Kelola Pengguna</h1>
          <p className="text-base text-txt-secondary">{users.length} pengguna terdaftar</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/panel/email"
            className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"
          >
            <AtSign size={16} />
            Kelola Email
          </Link>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"
          >
            <Plus size={16} />
            Tambah Pengguna
          </button>
        </div>
      </div>

      <div className="mb-4 relative sm:max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
        <input
          type="text"
          placeholder="Cari pengguna..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="input w-full pl-9 text-base py-2.5"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-center text-base text-red-700">
          <p>{error}</p>
          <button
            onClick={fetchUsers}
            className="mt-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            aria-label="Coba muat ulang daftar pengguna"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-border bg-surface-secondary">
                <tr>
                  <th className="px-3 sm:px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Pengguna</th>
                  <th className="px-3 sm:px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Role</th>
                  <th className="px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Artikel</th>
                  <th className="px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Status</th>
                  <th className="px-5 py-3.5 text-left text-sm font-medium text-txt-secondary">Terdaftar</th>
                  <th className="px-3 sm:px-5 py-3.5 text-right text-sm font-medium text-txt-secondary">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedUsers.map((user) => {
                  const role = roleLabels[user.role] || { label: user.role, color: "bg-surface-tertiary text-txt-secondary" };
                  return (
                    <tr key={user.id} className="hover:bg-surface-secondary">
                      <td className="px-3 sm:px-5 py-4">
                        {(() => {
                          const isLensaplus = user.email.endsWith("@lensaplus.com");
                          const lensaplusRoute = emailRoutes.find(r => r.to === user.email && r.enabled);
                          const lensaplusEmail = isLensaplus ? user.email : lensaplusRoute?.from || null;
                          return (
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-primary text-xs sm:text-sm font-bold text-white">
                                {user.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-txt-primary text-sm truncate">{user.name}</p>
                                {lensaplusEmail ? (
                                  <p className="flex items-center gap-1 text-xs text-primary font-medium truncate">
                                    <AtSign size={10} /> {lensaplusEmail}
                                  </p>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <p className="flex items-center gap-1 text-xs text-txt-secondary truncate">
                                      <Mail size={10} /> {user.email}
                                    </p>
                                    <Link href="/panel/email" className="inline-flex items-center gap-0.5 text-[9px] text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded-full shrink-0 hover:bg-yellow-100">
                                      <AlertCircle size={8} /> Buat @lensaplus
                                    </Link>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-3 sm:px-5 py-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-sm font-medium ${role.color}`}>
                          <Shield size={10} /> {role.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-txt-secondary">
                        {user._count?.articles ?? 0}
                      </td>
                      <td className="px-5 py-4">
                        {user.isActive ? (
                          <span className="flex items-center gap-1 text-sm text-primary">
                            <UserCheck size={12} /> Aktif
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-sm text-red-500">
                            <UserX size={12} /> Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-txt-secondary">{formatDate(user.createdAt)}</td>
                      <td className="px-3 sm:px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setCardUser({ id: user.id, name: user.name })}
                            className="btn-ghost rounded-lg p-2 hover:text-primary"
                            title="Kelola Kartu Anggota (KTA)"
                            aria-label="Kelola KTA"
                          >
                            <CreditCard size={16} />
                          </button>
                          <button
                            onClick={() => openEditModal(user)}
                            className="btn-ghost rounded-lg p-2"
                            title="Edit"
                            aria-label="Edit pengguna"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id, user.name)}
                            disabled={deleting === user.id}
                            className="btn-ghost rounded-lg p-2 hover:text-red-500 disabled:opacity-50"
                            title="Hapus"
                            aria-label="Hapus pengguna"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {paginatedUsers.length === 0 && (
            <div className="py-12 text-center text-base text-txt-secondary">
              Tidak ada pengguna ditemukan.
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-base text-txt-secondary">
              Halaman {page} dari {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary px-5 py-2.5 text-base disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-secondary px-5 py-2.5 text-base disabled:opacity-40"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
        </>
      )}

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[calc(100%-2rem)] max-w-lg mx-auto rounded-lg border border-border bg-surface p-6 sm:p-8 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-txt-primary">
              {editingUser ? "Edit Pengguna" : "Tambah Pengguna Baru"}
            </h2>
            <form className="space-y-4" onSubmit={handleSubmitUser}>
              <input
                type="text"
                placeholder="Nama lengkap"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                className="input w-full"
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-txt-secondary">Email Gmail</label>
                <div className="flex items-center gap-0">
                  <input
                    type="text"
                    placeholder="namauser"
                    value={formEmail.replace("@gmail.com", "")}
                    onChange={(e) => setFormEmail(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                    required
                    className="input rounded-r-none flex-1"
                  />
                  <span className="inline-flex items-center px-3 py-2 border border-l-0 border-border bg-surface-secondary text-sm text-txt-secondary rounded-r-lg whitespace-nowrap">
                    @gmail.com
                  </span>
                </div>
              </div>
              <div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={editingUser ? "Password baru" : "Password (min. 8 karakter)"}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    required={!editingUser}
                    minLength={8}
                    className="input w-full pr-10"
                    aria-label="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-primary transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {editingUser && (
                  <p className="mt-1 text-sm text-txt-muted">Kosongkan jika tidak ingin mengubah password</p>
                )}
              </div>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                required
                className="input w-full"
              >
                <option value="">Pilih Role</option>
                {Object.entries(roleLabels).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Spesialisasi (opsional)"
                value={formSpec}
                onChange={(e) => setFormSpec(e.target.value)}
                className="input w-full"
              />
              {!editingUser && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-txt-secondary">Email @lensaplus.com (opsional)</label>
                  <div className="flex items-center gap-0">
                    <input
                      type="text"
                      placeholder="contoh: owen"
                      value={formLensaplusEmail}
                      onChange={(e) => setFormLensaplusEmail(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                      className="input rounded-r-none flex-1"
                    />
                    <span className="inline-flex items-center px-3 py-2 border border-l-0 border-border bg-surface-secondary text-sm text-txt-secondary rounded-r-lg whitespace-nowrap">
                      @lensaplus.com
                    </span>
                  </div>
                  {formLensaplusEmail && formEmail && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-txt-muted">
                      <AtSign size={10} className="text-primary shrink-0" />
                      <span><strong className="text-primary">{formLensaplusEmail}@lensaplus.com</strong> akan forward ke <strong>{formEmail}</strong></span>
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-txt-muted">Kosongkan jika tidak perlu email @lensaplus.com</p>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="btn-secondary px-4 py-2 text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {submitting ? "Menyimpan..." : editingUser ? "Simpan" : "Tambah"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cardUser && (
        <UserCardManager
          userId={cardUser.id}
          userName={cardUser.name}
          onClose={() => setCardUser(null)}
        />
      )}
    </div>
  );
}
