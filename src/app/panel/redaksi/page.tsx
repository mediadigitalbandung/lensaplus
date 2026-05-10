"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  Plus,
  Edit,
  Trash2,
  GripVertical,
  Save,
  X,
  Users,
  Upload,
  UserPlus,
} from "lucide-react";

interface RedaksiMember {
  id: string;
  position: string;
  name: string;
  desc: string | null;
  photo: string | null;
  order: number;
  isActive: boolean;
}

interface UserOption {
  id: string;
  name: string;
  avatar: string | null;
  role: string;
}

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  CHIEF_EDITOR: "Pemimpin Redaksi",
  EDITOR: "Editor",
  SENIOR_JOURNALIST: "Jurnalis Senior",
  JOURNALIST: "Jurnalis",
  CONTRIBUTOR: "Kontributor",
};

const emptyForm = { position: "", name: "", desc: "", photo: "", order: 0, isActive: true, userId: "" };

export default function RedaksiPanelPage() {
  const { success, error: showError } = useToast();
  const { confirm } = useConfirm();
  const [members, setMembers] = useState<RedaksiMember[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function handlePhotoUpload(file: File) {
    if (file.size > 2 * 1024 * 1024) { showError("Ukuran foto maksimal 2MB"); return; }
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Upload gagal"); }
      const json = await res.json();
      setForm((f) => ({ ...f, photo: json.data?.url || "" }));
      success("Foto berhasil diupload");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Upload gagal");
    } finally {
      setUploading(false);
    }
  }

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resMembers, resUsers] = await Promise.all([
        fetch("/api/redaksi"),
        fetch("/api/users?limit=100"),
      ]);
      if (resMembers.ok) {
        const json = await resMembers.json();
        setMembers(json.data || []);
      }
      if (resUsers.ok) {
        // /api/users sejak Sprint 0 CRIT-03 return paginated shape:
        //   json.data = { users: [...], total, page, limit, totalPages }
        // Backward-compat fallback ke array kalau API berubah.
        const json = await resUsers.json();
        const list = Array.isArray(json.data?.users)
          ? json.data.users
          : Array.isArray(json.data)
          ? json.data
          : [];
        setUsers(list.filter((u: UserOption & { isActive: boolean }) => u.isActive !== false));
      }
    } catch {
      showError("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyForm, order: members.length });
    setShowForm(true);
  }

  function openEdit(m: RedaksiMember) {
    setEditingId(m.id);
    setForm({ position: m.position, name: m.name, desc: m.desc || "", photo: m.photo || "", order: m.order, isActive: m.isActive, userId: "" });
    setShowForm(true);
  }

  function selectUser(user: UserOption) {
    setForm((f) => ({
      ...f,
      name: user.name,
      photo: user.avatar || f.photo,
      position: f.position || (roleLabels[user.role] || user.role),
      userId: user.id,
    }));
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.position || !form.name) { showError("Jabatan dan nama wajib diisi"); return; }

    try {
      setSubmitting(true);
      const url = editingId ? `/api/redaksi/${editingId}` : "/api/redaksi";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: form.position,
          name: form.name,
          desc: form.desc || null,
          photo: form.photo || null,
          order: form.order,
          isActive: form.isActive,
        }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Gagal menyimpan"); }

      // Update avatar di profil user jika foto diupload dan user dipilih
      if (form.userId && form.photo) {
        const selectedUser = users.find((u) => u.id === form.userId);
        if (selectedUser && selectedUser.avatar !== form.photo) {
          await fetch(`/api/users/${form.userId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ avatar: form.photo }),
          }).catch(() => {});
        }
      }

      success(editingId ? "Berhasil diperbarui" : "Berhasil ditambahkan");
      closeForm();
      fetchData();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({ message: `Hapus "${name}" dari susunan redaksi?`, variant: "danger", title: "Konfirmasi" });
    if (!ok) return;
    try {
      const res = await fetch(`/api/redaksi/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus");
      success("Berhasil dihapus");
      fetchData();
    } catch {
      showError("Gagal menghapus anggota redaksi");
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">Susunan Redaksi</h1>
          <p className="text-base text-txt-secondary">Kelola susunan redaksi yang tampil di halaman publik</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-semibold">
          <Plus size={16} /> Tambah Anggota
        </button>
      </div>

      {/* Form + Preview split layout */}
      {showForm && (
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Form */}
          <div className="lg:col-span-3 rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-txt-primary">{editingId ? "Edit Anggota" : "Tambah Anggota Baru"}</h2>
              <button onClick={closeForm} className="p-1 hover:bg-surface-secondary rounded-lg"><X size={18} /></button>
            </div>

            {/* Pick from existing users */}
            {users.length > 0 && (
              <div className="mb-5">
                <label htmlFor="redaksi-user-select" className="mb-1.5 block text-sm font-medium text-txt-secondary">Pilih dari Pengguna Terdaftar</label>
                <select
                  id="redaksi-user-select"
                  className="input w-full"
                  value={form.userId}
                  onChange={(e) => {
                    const user = users.find((u) => u.id === e.target.value);
                    if (user) selectUser(user);
                  }}
                >
                  <option value="">— Pilih pengguna untuk autofill —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({roleLabels[u.role] || u.role})
                    </option>
                  ))}
                </select>
                {form.userId && !form.photo && (
                  <div className="mt-2 flex items-start gap-2 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3">
                    <span className="text-yellow-500 text-base leading-none mt-0.5">!</span>
                    <div className="text-sm">
                      <p className="font-semibold text-yellow-800">Pengguna ini belum memiliki foto</p>
                      <p className="text-yellow-700 mt-0.5">Upload foto di bawah, foto akan otomatis tersimpan di profil pengguna ini juga.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="redaksi-jabatan" className="mb-1.5 block text-sm font-medium text-txt-secondary">Jabatan *</label>
                  <input id="redaksi-jabatan" type="text" placeholder="Contoh: Pemimpin Redaksi" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} required aria-required="true" className="input w-full" />
                </div>
                <div>
                  <label htmlFor="redaksi-nama" className="mb-1.5 block text-sm font-medium text-txt-secondary">Nama *</label>
                  <input id="redaksi-nama" type="text" placeholder="Nama lengkap" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required aria-required="true" className="input w-full" />
                </div>
              </div>
              <div>
                <label htmlFor="redaksi-deskripsi" className="mb-1.5 block text-sm font-medium text-txt-secondary">Deskripsi</label>
                <input id="redaksi-deskripsi" type="text" placeholder="Tugas dan tanggung jawab" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} className="input w-full" />
              </div>

              {/* Foto upload */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-txt-secondary">Foto</label>
                {form.photo ? (
                  <div className="flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded member photo URL, cannot whitelist all origins */}
                    <img src={form.photo} alt="Foto" className="h-16 w-16 rounded-full object-cover border border-border" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-txt-muted truncate">{form.photo}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <label className="text-xs text-primary hover:text-primary-dark cursor-pointer flex items-center gap-1">
                          <Upload size={12} /> Ganti foto
                          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }}
                          />
                        </label>
                        <button type="button" onClick={() => setForm({ ...form, photo: "" })} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                          <X size={12} /> Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="block cursor-pointer">
                    <div className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border py-6 hover:border-primary hover:bg-primary-light/20 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                      <Upload size={20} className="text-txt-muted" />
                      <span className="text-sm font-medium text-txt-primary">{uploading ? "Mengupload..." : "Upload foto anggota"}</span>
                      <span className="text-xs text-txt-muted">JPEG, PNG, WebP — Maks 2MB</span>
                      <span className="text-[11px] text-primary">Foto juga akan tersimpan di profil pengguna</span>
                    </div>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }}
                    />
                  </label>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="redaksi-urutan" className="mb-1.5 block text-sm font-medium text-txt-secondary">Urutan</label>
                  <input id="redaksi-urutan" type="number" min={0} value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} className="input w-full" />
                </div>
                <div>
                  <label htmlFor="redaksi-status" className="mb-1.5 block text-sm font-medium text-txt-secondary">Status</label>
                  <select id="redaksi-status" value={form.isActive ? "true" : "false"} onChange={(e) => setForm({ ...form, isActive: e.target.value === "true" })} className="input w-full">
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeForm} className="btn-secondary px-5 py-2.5 text-sm">Batal</button>
                <button type="submit" disabled={submitting} className="btn-primary px-6 py-2.5 text-sm font-semibold disabled:opacity-50">
                  <Save size={14} className="mr-1.5" />
                  {submitting ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah"}
                </button>
              </div>
            </form>
          </div>

          {/* Right: Live Preview */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-20 rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-card">
              <h3 className="text-sm font-bold text-txt-primary mb-4">Preview Tampilan</h3>

              {/* Preview card — sama persis seperti di halaman publik */}
              <div className="flex items-center gap-4 rounded-[12px] border border-border bg-surface p-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-white overflow-hidden">
                  {form.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- user-uploaded member photo URL, cannot whitelist all origins
                    <img src={form.photo} alt={form.name || "Preview"} className="h-14 w-14 object-cover" />
                  ) : form.name ? (
                    form.name.charAt(0).toUpperCase()
                  ) : (
                    "?"
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {form.position || "Jabatan"}
                  </p>
                  <p className="font-bold text-txt-primary text-base">
                    {form.name || "Nama Anggota"}
                  </p>
                  {form.desc && <p className="text-sm text-txt-muted">{form.desc}</p>}
                </div>
              </div>

              <p className="text-[11px] text-txt-muted mt-3 text-center">
                Seperti ini tampilannya di halaman Redaksi
              </p>

              {/* Mini overview — all members */}
              {members.length > 0 && (
                <div className="mt-5 pt-4 border-t border-border">
                  <p className="text-xs font-semibold text-txt-secondary mb-3">Susunan Lengkap ({members.length} anggota)</p>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide">
                    {members.map((m) => (
                      <div
                        key={m.id}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors ${
                          editingId === m.id ? "bg-primary-light/50 border border-primary/30" : "bg-surface-secondary"
                        }`}
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white overflow-hidden">
                          {m.photo ? (
                            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded member photo URL, cannot whitelist all origins
                            <img src={m.photo} alt={m.name} className="h-7 w-7 object-cover" />
                          ) : (
                            m.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-txt-primary block truncate">{m.name}</span>
                          <span className="text-txt-muted text-[10px]">{m.position}</span>
                        </div>
                        {editingId === m.id && (
                          <span className="text-[9px] font-bold text-primary">EDITING</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-[12px] border border-border bg-surface p-4 shadow-card">
              <div className="flex gap-4"><div className="h-12 w-12 rounded-full bg-surface-tertiary" /><div className="flex-1 space-y-2"><div className="h-4 w-32 rounded bg-surface-tertiary" /><div className="h-3 w-48 rounded bg-surface-tertiary" /></div></div>
            </div>
          ))}
        </div>
      ) : members.length === 0 && !showForm ? (
        <div className="rounded-[12px] border-2 border-dashed border-border py-16 text-center">
          <Users size={40} className="mx-auto text-txt-muted mb-3" />
          <p className="text-txt-muted text-base">Belum ada anggota redaksi.</p>
          <button onClick={openAdd} className="mt-3 btn-primary px-4 py-2 text-sm"><Plus size={14} className="mr-1" /> Tambah Anggota Pertama</button>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className={`rounded-[12px] border bg-surface p-4 sm:p-5 shadow-card flex items-center gap-4 hover:shadow-card-hover transition-all ${editingId === m.id ? "border-primary bg-primary-light/10" : "border-border"}`}>
              <GripVertical size={16} className="text-txt-muted shrink-0 hidden sm:block" />
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white overflow-hidden">
                {m.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- user-uploaded member photo URL, cannot whitelist all origins
                  <img src={m.photo} alt={m.name} className="h-12 w-12 object-cover" />
                ) : (
                  m.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">{m.position}</p>
                <p className="font-bold text-txt-primary text-base">{m.name}</p>
                {m.desc && <p className="text-sm text-txt-muted truncate">{m.desc}</p>}
              </div>
              <span className="text-xs text-txt-muted hidden sm:block">#{m.order}</span>
              {!m.isActive && (
                <span className="rounded-full bg-red-50 text-red-600 px-2.5 py-0.5 text-xs font-medium">Nonaktif</span>
              )}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(m)} className="btn-ghost rounded p-2" title="Edit"><Edit size={16} /></button>
                <button onClick={() => handleDelete(m.id, m.name)} className="btn-ghost rounded p-2 hover:text-red-500" title="Hapus"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
