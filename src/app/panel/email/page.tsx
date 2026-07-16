"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import Link from "next/link";
import { Plus, Trash2, Mail, Power, AtSign, ArrowRight, Loader2, RefreshCw, Users, ChevronDown, Copy, Check, ExternalLink } from "lucide-react";

interface EmailRoute {
  id: string;
  name: string;
  enabled: boolean;
  from: string;
  to: string;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

export default function EmailRoutingPage() {
  const { success, error: showError } = useToast();
  const { confirm } = useConfirm();
  const [emails, setEmails] = useState<EmailRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [localPart, setLocalPart] = useState("");
  const [destinationEmail, setDestinationEmail] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [expandedSetup, setExpandedSetup] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  const fetchEmails = useCallback(async () => {
    try {
      setLoading(true);
      const [resEmails, resUsers] = await Promise.all([
        fetch("/api/email-routing"),
        fetch("/api/users?limit=100"),
      ]);
      if (resEmails.ok) {
        const json = await resEmails.json();
        setEmails(json.data || []);
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
        setUsers(list.map((u: { id: string; name: string; email: string }) => ({ id: u.id, name: u.name, email: u.email })));
      }
    } catch {
      showError("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!localPart.trim() || !destinationEmail.trim()) {
      showError("Semua field wajib diisi");
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch("/api/email-routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localPart: localPart.toLowerCase().trim(), destinationEmail: destinationEmail.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membuat email");
      success(json.data?.message || "Email berhasil dibuat");
      setLocalPart("");
      setDestinationEmail("");
      setShowForm(false);
      fetchEmails();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal membuat email");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, from: string) {
    const ok = await confirm({ message: `Hapus email ${from}?`, variant: "danger", title: "Konfirmasi" });
    if (!ok) return;
    try {
      const res = await fetch(`/api/email-routing?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      success("Email berhasil dihapus");
      fetchEmails();
    } catch {
      showError("Gagal menghapus email");
    }
  }

  async function handleToggle(id: string, currentEnabled: boolean) {
    try {
      const res = await fetch("/api/email-routing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled: !currentEnabled }),
      });
      if (!res.ok) throw new Error();
      success(currentEnabled ? "Email dinonaktifkan" : "Email diaktifkan");
      fetchEmails();
    } catch {
      showError("Gagal mengubah status");
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">Email Routing</h1>
          <p className="text-base text-txt-secondary">Kelola email @lensaplus.com — forward ke Gmail/email pribadi</p>
        </div>
        <div className="flex gap-2">
          <Link href="/panel/pengguna" className="btn-ghost flex items-center gap-2 px-3 py-2.5 text-sm">
            <Users size={14} /> Pengguna
          </Link>
          <button onClick={fetchEmails} className="btn-ghost flex items-center gap-2 px-3 py-2.5 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-semibold">
            <Plus size={16} /> Buat Email Baru
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card">
          <h2 className="text-base font-bold text-txt-primary mb-4">Buat Email Baru</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            {/* User selector */}
            {users.length > 0 && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-txt-secondary">Pilih dari Pengguna (opsional)</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    const uid = e.target.value;
                    setSelectedUserId(uid);
                    if (uid) {
                      const user = users.find(u => u.id === uid);
                      if (user) {
                        setLocalPart(user.name.split(" ")[0].toLowerCase().replace(/[^a-z0-9._-]/g, ""));
                        setDestinationEmail(user.email);
                      }
                    } else {
                      setLocalPart("");
                      setDestinationEmail("");
                    }
                  }}
                  className="input w-full"
                >
                  <option value="">— Isi manual —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-txt-secondary">Email Lensaplus</label>
                <div className="flex items-center gap-0">
                  <input
                    type="text"
                    placeholder="owen"
                    value={localPart}
                    onChange={(e) => setLocalPart(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                    className="input rounded-r-none flex-1"
                    required
                  />
                  <span className="inline-flex items-center px-3 py-2 border border-l-0 border-border bg-surface-secondary text-sm text-txt-secondary rounded-r-lg">
                    @lensaplus.com
                  </span>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-txt-secondary">Forward ke Email</label>
                <input
                  type="email"
                  placeholder="emailpribadi@gmail.com"
                  value={destinationEmail}
                  onChange={(e) => setDestinationEmail(e.target.value)}
                  className="input w-full"
                  required
                />
                <p className="text-xs text-txt-muted mt-1">Penerima akan mendapat email verifikasi dari Cloudflare</p>
              </div>
            </div>

            {localPart && (
              <div className="flex items-center gap-2 text-sm text-txt-secondary bg-surface-secondary rounded-lg px-4 py-3">
                <Mail size={14} className="text-primary shrink-0" />
                <span className="font-semibold text-primary">{localPart}@lensaplus.com</span>
                <ArrowRight size={14} className="text-txt-muted shrink-0" />
                <span>{destinationEmail || "..."}</span>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary px-5 py-2.5 text-sm">Batal</button>
              <button type="submit" disabled={submitting} className="btn-primary px-6 py-2.5 text-sm font-semibold disabled:opacity-50">
                {submitting ? <><Loader2 size={14} className="animate-spin mr-1.5" /> Membuat...</> : <><Mail size={14} className="mr-1.5" /> Buat Email</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Email list */}
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-lg border border-border bg-surface p-5 shadow-card">
              <div className="h-4 w-3/4 rounded-lg bg-surface-tertiary mb-3" />
              <div className="h-3 w-1/2 rounded-lg bg-surface-tertiary" />
            </div>
          ))}
        </div>
      ) : emails.length === 0 && !showForm ? (
        <div className="rounded-lg border-2 border-dashed border-border py-16 text-center">
          <AtSign size={40} className="mx-auto text-txt-muted mb-3" />
          <p className="text-txt-muted text-base">Belum ada email @lensaplus.com</p>
          <p className="text-txt-muted text-sm mt-1">Buat email pertama untuk tim redaksi</p>
          <button onClick={() => setShowForm(true)} className="mt-4 btn-primary px-4 py-2 text-sm">
            <Plus size={14} className="mr-1 inline" /> Buat Email Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {emails.map((email) => (
            <div key={email.id} className={`rounded-lg border bg-surface shadow-card transition-all ${email.enabled ? "border-border" : "border-border opacity-60"}`}>
              <div className="flex items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${email.enabled ? "bg-primary/10 text-primary" : "bg-surface-tertiary text-txt-muted"}`}>
                    <Mail size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-txt-primary text-sm truncate">{email.from}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${email.enabled ? "bg-primary-light text-primary" : "bg-red-50 text-red-600"}`}>
                        <Power size={8} /> {email.enabled ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-txt-muted">
                      <ArrowRight size={10} />
                      <span>{email.to}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {email.enabled && (
                    <button
                      onClick={() => setExpandedSetup(expandedSetup === email.id ? null : email.id)}
                      className="btn-ghost rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary flex items-center gap-1"
                      title="Setup Gmail Send As"
                    >
                      Setup Gmail <ChevronDown size={12} className={`transition-transform ${expandedSetup === email.id ? "rotate-180" : ""}`} />
                    </button>
                  )}
                  <button
                    onClick={() => handleToggle(email.id, email.enabled)}
                    className={`btn-ghost rounded-lg p-2 ${email.enabled ? "hover:text-red-500" : "hover:text-primary"}`}
                    title={email.enabled ? "Nonaktifkan" : "Aktifkan"}
                  >
                    <Power size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(email.id, email.from)}
                    className="btn-ghost rounded-lg p-2 hover:text-red-500"
                    title="Hapus"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Gmail Setup Instructions */}
              {expandedSetup === email.id && (
                <div className="border-t border-border px-5 py-4 bg-surface-secondary/50">
                  <h4 className="text-xs font-bold text-txt-primary mb-3">Setup &quot;Send As&quot; di Gmail untuk {email.from}</h4>

                  <div className="space-y-3 mb-4">
                    <p className="text-xs text-txt-secondary">
                      <strong>Langkah 1:</strong> Buka Gmail → Settings (⚙️) → <strong>Accounts and Import</strong> → &quot;Send mail as&quot; → <strong>Add another email address</strong>
                    </p>
                    <p className="text-xs text-txt-secondary">
                      <strong>Langkah 2:</strong> Isi nama dan email <strong>{email.from}</strong>, centang &quot;Treat as an alias&quot;, klik Next
                    </p>
                    <p className="text-xs text-txt-secondary">
                      <strong>Langkah 3:</strong> Isi SMTP credentials berikut:
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { label: "SMTP Server", value: "smtp-relay.brevo.com" },
                      { label: "Port", value: "587" },
                      { label: "Username", value: "a715cf001@smtp-brevo.com" },
                      { label: "Password", value: "4UhR5vsHMc3PIqrD" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 border border-border">
                        <div>
                          <span className="text-[10px] text-txt-muted block">{item.label}</span>
                          <span className="text-xs font-mono font-medium text-txt-primary">{item.value}</span>
                        </div>
                        <button
                          onClick={() => copyText(item.value, item.label)}
                          className="btn-ghost p-1.5 rounded-lg"
                          title="Copy"
                        >
                          {copied === item.label ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 space-y-2 text-xs text-txt-secondary">
                    <p><strong>Langkah 4:</strong> Pilih <strong>Secured connection using TLS</strong> → klik Add Account</p>
                    <p><strong>Langkah 5:</strong> Cek inbox Gmail untuk kode verifikasi, masukkan kode → selesai!</p>
                  </div>

                  <a
                    href="https://mail.google.com/mail/u/0/#settings/accounts"
                    target="_blank"
                    rel="noopener"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <ExternalLink size={10} /> Buka Gmail Settings langsung
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="mt-8 rounded-lg bg-surface-secondary border border-border p-5">
        <h3 className="text-sm font-bold text-txt-primary mb-2">Cara Kerja</h3>
        <ul className="text-sm text-txt-secondary space-y-1.5">
          <li>• Email yang dibuat di sini akan forward ke email pribadi (Gmail, dll)</li>
          <li>• Penerima harus verifikasi email dari Cloudflare (cek inbox/spam)</li>
          <li>• Untuk mengirim email DARI @lensaplus.com, setup &quot;Send as&quot; di Gmail Settings</li>
          <li>• Maksimal 200 alamat email</li>
        </ul>
      </div>
    </div>
  );
}
