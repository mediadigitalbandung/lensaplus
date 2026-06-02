"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import { UserCircle, Save, Loader2, Camera, KeyRound, Eye, EyeOff } from "lucide-react";

import { roleLabelsMap } from "@/lib/roles";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  bio: string | null;
  specialization: string | null;
  phone: string | null;
  nomorKartuPers: string | null;
  organisasiPers: string | null;
  pendidikan: string | null;
  pengalaman: string | null;
  keahlian: string | null;
  portofolio: string | null;
  mediaSosial: string | null;
  alamat: string | null;
  avatar: string | null;
  createdAt: string;
  _count: { articles: number };
}

export default function ProfilPage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [phone, setPhone] = useState("");
  const [nomorKartuPers, setNomorKartuPers] = useState("");
  const [organisasiPers, setOrganisasiPers] = useState("");
  const [pendidikan, setPendidikan] = useState("");
  const [pengalaman, setPengalaman] = useState("");
  const [keahlian, setKeahlian] = useState("");
  const [portofolio, setPortofolio] = useState("");
  const [mediaSosial, setMediaSosial] = useState("");
  const [alamat, setAlamat] = useState("");

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/users/me");
        if (!res.ok) throw new Error("Gagal memuat profil");
        const json = await res.json();
        const user = json.data as UserProfile;
        setProfile(user);
        setName(user.name || "");
        setBio(user.bio || "");
        setSpecialization(user.specialization || "");
        setPhone(user.phone || "");
        setNomorKartuPers(user.nomorKartuPers || "");
        setOrganisasiPers(user.organisasiPers || "");
        setPendidikan(user.pendidikan || "");
        setPengalaman(user.pengalaman || "");
        setKeahlian(user.keahlian || "");
        setPortofolio(user.portofolio || "");
        setMediaSosial(user.mediaSosial || "");
        setAlamat(user.alamat || "");
      } catch {
        setMessage({ type: "error", text: "Gagal memuat data profil." });
      } finally {
        setLoading(false);
      }
    }
    if (session?.user) fetchProfile();
  }, [session?.user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, bio: bio || null, specialization: specialization || null,
          phone: phone || null, nomorKartuPers: nomorKartuPers || null,
          organisasiPers: organisasiPers || null, pendidikan: pendidikan || null,
          pengalaman: pengalaman || null, keahlian: keahlian || null,
          portofolio: portofolio || null, mediaSosial: mediaSosial || null,
          alamat: alamat || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Gagal memperbarui profil");
      }

      const json = await res.json();
      setProfile((prev) => (prev ? { ...prev, ...json.data } : prev));
      setMessage({ type: "success", text: "Profil berhasil diperbarui" });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal memperbarui profil.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage(null);

    if (newPassword.length < 8) {
      setPwMessage({ type: "error", text: "Password baru minimal 8 karakter." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: "error", text: "Konfirmasi password tidak cocok." });
      return;
    }
    if (newPassword === currentPassword) {
      setPwMessage({ type: "error", text: "Password baru tidak boleh sama dengan password saat ini." });
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/users/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengubah password");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwMessage({
        type: "success",
        text: "Password berhasil diubah. Anda akan keluar otomatis, silakan login kembali.",
      });
      // Password change invalidates the active session — sign out so the user
      // re-authenticates with the new password.
      setTimeout(() => signOut({ callbackUrl: "/login" }), 2000);
    } catch (err) {
      setPwMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal mengubah password.",
      });
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage({ type: "error", text: "Format file harus JPEG, PNG, atau WebP" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: "error", text: "Ukuran file maksimal 2MB" });
      return;
    }

    setUploadingAvatar(true);
    setMessage(null);

    try {
      // Upload file
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Gagal mengupload foto");
      const uploadJson = await uploadRes.json();
      const avatarUrl = uploadJson.url || uploadJson.data?.url;

      // Update profile with avatar URL
      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: avatarUrl }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan foto profil");

      const json = await res.json();
      setProfile((prev) => (prev ? { ...prev, avatar: json.data?.avatar || avatarUrl } : prev));
      setMessage({ type: "success", text: "Foto profil berhasil diperbarui" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Gagal mengupload foto" });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">Profil Saya</h1>
        <p className="text-base text-txt-secondary">Kelola informasi profil Anda</p>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-[12px] border p-4 text-sm ${
            message.type === "success"
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="rounded-[12px] border border-border bg-surface p-6 shadow-card">
          <div className="flex flex-col items-center text-center">
            {/* Avatar with upload */}
            <div className="relative mb-4 group">
              {profile?.avatar ? (
                <Image
                  src={profile.avatar}
                  alt={profile.name || "Avatar"}
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-full object-cover border-2 border-border"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-tertiary text-xl sm:text-3xl font-bold text-txt-secondary">
                  {profile?.name?.charAt(0) || <UserCircle size={40} />}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-lg border-2 border-surface hover:bg-primary-dark transition-colors disabled:opacity-50"
                aria-label="Ganti foto profil"
              >
                {uploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <h2 className="text-lg font-semibold text-txt-primary">{profile?.name}</h2>
            <p className="text-sm text-txt-secondary">{profile?.email}</p>
            <span className="mt-2 inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              {roleLabelsMap[profile?.role || ""] || profile?.role}
            </span>
          </div>

          <div className="mt-6 space-y-3 border-t border-border pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-txt-muted">Total Artikel</span>
              <span className="font-medium text-txt-primary">{profile?._count?.articles || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-txt-muted">Bergabung</span>
              <span className="font-medium text-txt-primary">
                {profile?.createdAt
                  ? new Date(profile.createdAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "-"}
              </span>
            </div>
            {profile?.specialization && (
              <div className="flex justify-between text-sm">
                <span className="text-txt-muted">Spesialisasi</span>
                <span className="font-medium text-txt-primary">{profile.specialization}</span>
              </div>
            )}
          </div>
        </div>

        {/* Edit Form */}
        <div className="lg:col-span-2 rounded-[12px] border border-border bg-surface p-6 shadow-card">
          <h3 className="mb-4 text-lg font-semibold text-txt-primary">Edit Profil</h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-base font-medium text-txt-secondary">Nama</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input w-full"
                required
                minLength={2}
                maxLength={100}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-base font-medium text-txt-secondary">Email</label>
              <input
                type="email"
                value={profile?.email || ""}
                className="input w-full cursor-not-allowed opacity-60"
                disabled
              />
              <p className="mt-1 text-sm text-txt-muted">
                Email tidak dapat diubah. Hubungi admin untuk perubahan.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-base font-medium text-txt-secondary">Peran</label>
              <input
                type="text"
                value={roleLabelsMap[profile?.role || ""] || profile?.role || ""}
                className="input w-full cursor-not-allowed opacity-60"
                disabled
              />
              <p className="mt-1 text-sm text-txt-muted">
                Peran hanya dapat diubah oleh admin.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-base font-medium text-txt-secondary">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="input w-full resize-none"
                rows={4}
                maxLength={500}
                placeholder="Tulis bio singkat tentang Anda..."
              />
              <p className="mt-1 text-sm text-txt-muted">{bio.length}/500 karakter</p>
            </div>

            <div>
              <label className="mb-1.5 block text-base font-medium text-txt-secondary">Spesialisasi</label>
              <input type="text" value={specialization} onChange={(e) => setSpecialization(e.target.value)} className="input w-full" maxLength={200} placeholder="Mis: Hukum Pidana, Hukum Tata Negara..." />
            </div>

            <h4 className="pt-4 text-base font-bold text-txt-primary border-t border-border mt-2">Informasi Profesional</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-base font-medium text-txt-secondary">No. Telepon</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input w-full" placeholder="08xx-xxxx-xxxx" />
              </div>
              <div>
                <label className="mb-1.5 block text-base font-medium text-txt-secondary">Nomor Kartu Pers</label>
                <input type="text" value={nomorKartuPers} onChange={(e) => setNomorKartuPers(e.target.value)} className="input w-full" placeholder="Nomor kartu pers / ID pers" />
              </div>
              <div>
                <label className="mb-1.5 block text-base font-medium text-txt-secondary">Organisasi Pers</label>
                <input type="text" value={organisasiPers} onChange={(e) => setOrganisasiPers(e.target.value)} className="input w-full" placeholder="Mis: AJI, PWI, IJTI, SMSI..." />
              </div>
              <div>
                <label className="mb-1.5 block text-base font-medium text-txt-secondary">Pendidikan Terakhir</label>
                <input type="text" value={pendidikan} onChange={(e) => setPendidikan(e.target.value)} className="input w-full" placeholder="Mis: S1 Ilmu Hukum — UNPAD" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-base font-medium text-txt-secondary">Keahlian / Skill</label>
              <input type="text" value={keahlian} onChange={(e) => setKeahlian(e.target.value)} className="input w-full" placeholder="Mis: Investigasi, Hukum Pidana, Data Journalism..." />
              <p className="mt-1 text-sm text-txt-muted">Pisahkan dengan koma</p>
            </div>

            <div>
              <label className="mb-1.5 block text-base font-medium text-txt-secondary">Pengalaman Kerja</label>
              <textarea value={pengalaman} onChange={(e) => setPengalaman(e.target.value)} rows={3} className="input w-full" placeholder="Ceritakan pengalaman kerja Anda di bidang jurnalistik..." />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-base font-medium text-txt-secondary">Portofolio / Website</label>
                <input type="url" value={portofolio} onChange={(e) => setPortofolio(e.target.value)} className="input w-full" placeholder="https://portofolio-anda.com" />
              </div>
              <div>
                <label className="mb-1.5 block text-base font-medium text-txt-secondary">Media Sosial</label>
                <input type="text" value={mediaSosial} onChange={(e) => setMediaSosial(e.target.value)} className="input w-full" placeholder="@username (Twitter/Instagram)" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-base font-medium text-txt-secondary">Alamat</label>
              <textarea value={alamat} onChange={(e) => setAlamat(e.target.value)} rows={2} className="input w-full" placeholder="Alamat domisili saat ini" />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex items-center gap-2 px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Ganti Password */}
      <div className="mt-6 rounded-[12px] border border-border bg-surface p-6 shadow-card">
        <div className="mb-1 flex items-center gap-2">
          <KeyRound size={20} className="text-primary" />
          <h3 className="text-lg font-semibold text-txt-primary">Ganti Password</h3>
        </div>
        <p className="mb-4 text-sm text-txt-secondary">
          Demi keamanan, Anda akan otomatis keluar setelah password diubah dan harus login kembali.
        </p>

        {pwMessage && (
          <div
            className={`mb-4 rounded-[12px] border p-4 text-sm ${
              pwMessage.type === "success"
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-red-500/30 bg-red-500/10 text-red-400"
            }`}
          >
            {pwMessage.text}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
          <div>
            <label className="mb-1.5 block text-base font-medium text-txt-secondary">Password Saat Ini</label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input w-full pr-10"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-primary"
                aria-label={showCurrent ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-base font-medium text-txt-secondary">Password Baru</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input w-full pr-10"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-primary"
                aria-label={showNew ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="mt-1 text-sm text-txt-muted">Minimal 8 karakter.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-base font-medium text-txt-secondary">Konfirmasi Password Baru</label>
            <input
              type={showNew ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input w-full"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={changingPassword}
              className="btn-primary flex items-center gap-2 px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {changingPassword ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              {changingPassword ? "Menyimpan..." : "Ganti Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
