"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";

interface AccountOption {
  id: string;
  username: string;
  displayName: string;
}

interface TemplateOption {
  id: string;
  key: string;
  name: string;
  description: string | null;
  aspectRatio: string;
}

export default function TiktokCreatePage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [accountId, setAccountId] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"PORTRAIT_9_16" | "SQUARE_1_1">("PORTRAIT_9_16");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/tiktok/accounts").then((r) => r.json()).catch(() => ({})),
      fetch("/api/tiktok/templates").then((r) => r.json()).catch(() => ({})),
    ]).then(([accRes, tplRes]) => {
      setAccounts(accRes?.data || []);
      setTemplates(tplRes?.data || []);
    });
  }, []);

  const submit = async () => {
    if (!title.trim()) {
      setError("Judul wajib diisi");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tiktok/contents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          accountId: accountId || null,
          templateKey: templateKey || null,
          aspectRatio,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || "Gagal membuat konten");
        return;
      }
      router.push(`/panel/tiktok/${json.data.id}`);
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/panel/tiktok"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-txt-secondary hover:text-primary"
      >
        <ArrowLeft size={14} />
        Kembali ke daftar konten
      </Link>

      <div className="rounded-[12px] border border-border bg-surface p-6 shadow-card">
        <h1 className="flex items-center gap-2 text-xl font-bold text-txt-primary">
          <Sparkles size={20} className="text-primary" />
          Buat Konten TikTok Baru
        </h1>
        <p className="mt-1 text-sm text-txt-secondary">
          Setelah dibuat, kamu bisa upload foto/video, atur caption, hashtag, BGM, dan jadwal post.
        </p>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-txt-primary">
              Judul Internal <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={150}
              placeholder='Contoh: "Putusan MK UU Cipta Kerja — versi 60s"'
              className="input w-full"
            />
            <p className="mt-1 text-[11px] text-txt-muted">
              Hanya untuk identifikasi internal di panel. Caption TikTok diatur belakangan.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-txt-primary">Akun TikTok</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="input w-full"
            >
              <option value="">— Pilih nanti —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  @{a.username} ({a.displayName})
                </option>
              ))}
            </select>
            {accounts.length === 0 && (
              <p className="mt-1 text-[11px] text-txt-muted">
                Belum ada akun.{" "}
                <Link href="/panel/tiktok/akun" className="text-primary underline">
                  Tambah akun
                </Link>
                .
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-txt-primary">Aspek Rasio</label>
            <div className="flex gap-2">
              {(["PORTRAIT_9_16", "SQUARE_1_1"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setAspectRatio(r)}
                  className={`flex-1 rounded-md border px-4 py-2.5 text-sm font-medium transition ${
                    aspectRatio === r
                      ? "border-primary bg-primary-light text-primary"
                      : "border-border bg-surface-container-low text-txt-secondary hover:border-primary/40"
                  }`}
                >
                  {r === "PORTRAIT_9_16" ? "9:16 — Feed Standar" : "1:1 — Square"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-txt-primary">
              Template (Fase 2 — opsional)
            </label>
            <select
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              className="input w-full"
            >
              <option value="">— Tidak pakai template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.key}>
                  {t.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-txt-muted">
              Template Hyperframes akan dipakai saat render otomatis aktif (Fase 2). Boleh dikosongkan.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Link href="/panel/tiktok" className="btn-ghost text-sm">
            Batal
          </Link>
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? "Membuat..." : "Buat & Lanjut Edit"}
          </button>
        </div>
      </div>
    </div>
  );
}
