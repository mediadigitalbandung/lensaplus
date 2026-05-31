"use client";

/**
 * Live Blog → Social syndication settings.
 * Configure the Telegram channel + which platforms broadcast live updates.
 * Auth: SUPER_ADMIN (the /api/social/settings endpoint enforces it).
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Radio,
  Send,
  AtSign,
  Save,
  Loader2,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface GlobalToggles {
  liveSyndicateTelegram: boolean;
  liveSyndicateThreads: boolean;
  liveSyndicateHighlightsOnly: boolean;
}

export default function LiveSyndicationSettingsPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const { success: showSuccess, error: showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tgEnabled, setTgEnabled] = useState(false);
  const [tgChatId, setTgChatId] = useState("");
  const [tgBotTokenInput, setTgBotTokenInput] = useState("");
  const [tgHasToken, setTgHasToken] = useState(false);

  const [threadsConfigured, setThreadsConfigured] = useState(false);

  const [toggles, setToggles] = useState<GlobalToggles>({
    liveSyndicateTelegram: false,
    liveSyndicateThreads: false,
    liveSyndicateHighlightsOnly: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/social/settings");
      if (!res.ok) {
        if (res.status === 403) showError("Khusus Super Admin");
        else showError("Gagal memuat pengaturan");
        return;
      }
      const json = await res.json();
      const d = json.data || {};
      setTgEnabled(Boolean(d.telegram?.enabled));
      setTgChatId(d.telegram?.chatId || "");
      setTgHasToken(Boolean(d.telegram?.hasBotToken));
      setThreadsConfigured(Boolean(d.threads?.enabled && d.threads?.hasAccessToken));
      setToggles({
        liveSyndicateTelegram: Boolean(d.global?.liveSyndicateTelegram),
        liveSyndicateThreads: Boolean(d.global?.liveSyndicateThreads),
        liveSyndicateHighlightsOnly: Boolean(d.global?.liveSyndicateHighlightsOnly),
      });
    } catch {
      showError("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // 1) Telegram credentials/enable
      const tgData: Record<string, unknown> = {
        chatId: tgChatId || null,
        enabled: tgEnabled,
      };
      // Only send the token when the admin actually typed a new one.
      if (tgBotTokenInput.trim()) tgData.botToken = tgBotTokenInput.trim();

      const tgRes = await fetch("/api/social/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "telegram", data: tgData }),
      });
      if (!tgRes.ok) {
        const j = await tgRes.json().catch(() => ({}));
        showError(j.error || "Gagal menyimpan Telegram");
        return;
      }

      // 2) Global live-syndication switches
      const gRes = await fetch("/api/social/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "global", data: toggles }),
      });
      if (!gRes.ok) {
        const j = await gRes.json().catch(() => ({}));
        showError(j.error || "Gagal menyimpan toggle");
        return;
      }

      setTgBotTokenInput("");
      setTgHasToken((prev) => prev || Boolean(tgData.botToken));
      showSuccess("Pengaturan tersimpan");
    } catch {
      showError("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="py-16 text-center text-txt-muted">
        <p>Pengaturan ini khusus Super Admin.</p>
        <Link href="/panel/live-blogs" className="text-primary hover:underline mt-2 inline-block">
          Kembali ke Live Blog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/panel/live-blogs" className="text-txt-muted hover:text-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <Radio size={20} className="text-secondary" />
          <h1 className="text-xl font-bold text-on-surface">Kanal Sosmed Live</h1>
        </div>
      </div>

      <p className="text-body-sm text-txt-muted">
        Saat live blog berstatus <b>LIVE</b> dan opsi “Sebar update ke sosmed”
        dinyalakan, tiap update otomatis dikirim sebagai thread ke kanal di bawah.
        Update teks saja (v1) — gambar/video belum ikut disebar.
      </p>

      <form onSubmit={save} className="space-y-6">
        {/* Telegram */}
        <div className="card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Send size={16} className="text-primary" />
            <h2 className="text-label-md font-semibold text-on-surface">Telegram</h2>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={tgEnabled}
              onChange={(e) => setTgEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary"
            />
            <span className="text-sm text-on-surface">Aktifkan kanal Telegram</span>
          </label>

          <div>
            <label className="block text-label-sm text-txt-muted mb-1">
              Bot Token{" "}
              {tgHasToken && (
                <span className="text-primary">(tersimpan — kosongkan untuk pakai yang ada)</span>
              )}
            </label>
            <input
              type="password"
              value={tgBotTokenInput}
              onChange={(e) => setTgBotTokenInput(e.target.value)}
              className="input w-full text-sm font-mono"
              placeholder={tgHasToken ? "••••••••••••" : "123456:ABC-DEF..."}
              autoComplete="off"
            />
            <p className="mt-1 text-label-sm text-txt-muted">
              Buat bot via @BotFather, lalu jadikan bot itu admin channel Anda.
            </p>
          </div>

          <div>
            <label className="block text-label-sm text-txt-muted mb-1 flex items-center gap-1">
              <AtSign size={11} /> Channel / Chat ID
            </label>
            <input
              type="text"
              value={tgChatId}
              onChange={(e) => setTgChatId(e.target.value)}
              className="input w-full text-sm font-mono"
              placeholder="@kartawarta atau -1001234567890"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-border">
            <input
              type="checkbox"
              checked={toggles.liveSyndicateTelegram}
              onChange={(e) =>
                setToggles((t) => ({ ...t, liveSyndicateTelegram: e.target.checked }))
              }
              className="h-4 w-4 rounded border-border text-primary mt-3"
            />
            <span className="text-sm text-on-surface mt-3">
              Sebar update live ke Telegram
            </span>
          </label>
        </div>

        {/* Threads */}
        <div className="card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-label-md font-semibold text-on-surface">Threads</h2>
            <Link
              href="/panel/social"
              className="inline-flex items-center gap-1 text-label-sm text-primary hover:underline"
            >
              <ExternalLink size={12} />
              Atur token di Social
            </Link>
          </div>
          <p className="text-label-sm text-txt-muted">
            Status koneksi:{" "}
            {threadsConfigured ? (
              <span className="text-green-600 font-medium">Terhubung</span>
            ) : (
              <span className="text-secondary font-medium">Belum dikonfigurasi</span>
            )}
            . Token Threads dikelola di halaman Social.
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={toggles.liveSyndicateThreads}
              onChange={(e) =>
                setToggles((t) => ({ ...t, liveSyndicateThreads: e.target.checked }))
              }
              className="h-4 w-4 rounded border-border text-primary"
            />
            <span className="text-sm text-on-surface">Sebar update live ke Threads</span>
          </label>
        </div>

        {/* Behaviour */}
        <div className="card p-4 space-y-3">
          <h2 className="text-label-md font-semibold text-on-surface">Perilaku</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={toggles.liveSyndicateHighlightsOnly}
              onChange={(e) =>
                setToggles((t) => ({ ...t, liveSyndicateHighlightsOnly: e.target.checked }))
              }
              className="h-4 w-4 rounded border-border text-primary"
            />
            <span className="text-sm text-on-surface">
              Hanya sebar update ber-<b>Highlight</b>
              <span className="block text-label-sm text-txt-muted">
                Hindari spam — hanya update penting (ditandai Highlight) yang dikirim.
              </span>
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Simpan Pengaturan
        </button>
      </form>
    </div>
  );
}
