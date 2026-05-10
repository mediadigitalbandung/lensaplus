"use client";

/**
 * Pengaturan Sistem — SUPER_ADMIN only.
 *
 * Sections:
 *  1. Umum
 *  2. AI Providers (Anthropic + DeepSeek)
 *  3. Google Services (Indexing + GA4 + GSC)
 *  4. Meta (Instagram + Facebook) — uses /api/social/settings
 *  5. Twitter / X
 *  6. Cloudflare
 *  7. Resend (Email)
 *  8. Auto-Artikel
 *  9. Toggle Global
 *
 * Save per section. Sensitive fields hidden by default with eye toggle.
 * Test Connection buttons per integrasi.
 */

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Settings,
  Save,
  Eye,
  EyeOff,
  Sparkles,
  Globe,
  Instagram,
  Facebook,
  Twitter,
  Cloud,
  Mail,
  Bot,
  ToggleRight,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  PlugZap,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

// =====================================================================
// Types
// =====================================================================

type SettingsMap = Record<string, string>;

interface SocialSettings {
  global: {
    draftMode: boolean;
    autoPublishIG: boolean;
    autoPublishFB: boolean;
    autoPublishTwitter: boolean;
    defaultHashtags: string | null;
    defaultCTA: string | null;
  };
  instagram: {
    accessToken: string | null;
    hasAccessToken: boolean;
    igUserId: string | null;
    enabled: boolean;
    captionMaxLen: number;
    hashtagCount: number;
  };
  facebook: {
    accessToken: string | null;
    hasAccessToken: boolean;
    pageId: string | null;
    postMode: "link" | "photo";
    enabled: boolean;
  };
}

interface TestResult {
  loading: boolean;
  success?: boolean;
  message?: string;
}

// =====================================================================
// Helpers
// =====================================================================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

function isValidUrl(s: string): boolean {
  return URL_RE.test(s.trim());
}

function isValidServiceAccountJson(text: string): { ok: boolean; error?: string } {
  if (!text || text.trim().length === 0) return { ok: true }; // empty allowed (clear)
  try {
    const obj = JSON.parse(text);
    if (typeof obj !== "object" || obj === null) {
      return { ok: false, error: "JSON harus berupa objek." };
    }
    if (obj.type !== "service_account") {
      return { ok: false, error: "Field `type` harus 'service_account'." };
    }
    if (typeof obj.private_key !== "string" || obj.private_key.length < 20) {
      return { ok: false, error: "Field `private_key` tidak valid." };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: `JSON parse error: ${e instanceof Error ? e.message : "invalid"}`,
    };
  }
}

// =====================================================================
// Reusable bits
// =====================================================================

function Section({
  icon,
  title,
  description,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-surface-secondary/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
            {icon}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-txt-primary">{title}</h2>
            {description && (
              <p className="text-xs text-txt-secondary truncate">{description}</p>
            )}
          </div>
        </div>
        {open ? (
          <ChevronDown size={18} className="text-txt-muted shrink-0" />
        ) : (
          <ChevronRight size={18} className="text-txt-muted shrink-0" />
        )}
      </button>
      {open && (
        <div className="border-t border-border px-5 py-5 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-txt-primary">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-txt-muted">{hint}</p>}
    </div>
  );
}

function SecretInput({
  value,
  onChange,
  placeholder,
  monospace = true,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  monospace?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`input flex-1 ${monospace ? "font-mono text-sm" : ""}`}
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="btn-ghost px-3"
        aria-label={show ? "Sembunyikan" : "Tampilkan"}
        title={show ? "Sembunyikan" : "Tampilkan"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="btn-ghost px-3 text-red-500"
          aria-label="Hapus"
          title="Hapus nilai"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-surface-tertiary"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function SaveBar({
  onSave,
  saving,
  dirty,
  testResult,
  testButton,
}: {
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  testResult?: TestResult;
  testButton?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
      <div className="flex items-center gap-3 text-xs">
        {testResult?.loading && (
          <span className="flex items-center gap-1.5 text-txt-secondary">
            <Loader2 size={12} className="animate-spin" /> Menguji…
          </span>
        )}
        {testResult && !testResult.loading && testResult.success === true && (
          <span className="flex items-center gap-1.5 text-green-600">
            <CheckCircle2 size={12} /> {testResult.message || "OK"}
          </span>
        )}
        {testResult && !testResult.loading && testResult.success === false && (
          <span className="flex items-center gap-1.5 text-red-600">
            <XCircle size={12} /> {testResult.message || "Gagal"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {testButton}
        <button
          onClick={onSave}
          disabled={saving || !dirty}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// Main page
// =====================================================================

export default function PengaturanPage() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = session?.user?.role || "";
  const { success: showSuccess, error: showError } = useToast();

  const [loaded, setLoaded] = useState(false);
  const [allSettings, setAllSettings] = useState<SettingsMap>({});

  // Per-section dirty flags
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Test results per integration
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  // Social settings (separate API)
  const [socialSettings, setSocialSettings] = useState<SocialSettings | null>(null);

  // ---------------- Section state ----------------
  // Umum
  const [siteName, setSiteName] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [alamatRedaksi, setAlamatRedaksi] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  // AI
  const [anthropicKey, setAnthropicKey] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [enableAi, setEnableAi] = useState(true);

  // Google
  const [googleCredentials, setGoogleCredentials] = useState("");
  const [googleIndexingEnabled, setGoogleIndexingEnabled] = useState(false);
  const [ga4PropertyId, setGa4PropertyId] = useState("");
  const [gscSiteUrl, setGscSiteUrl] = useState("");

  // Meta — IG
  const [igAccessToken, setIgAccessToken] = useState("");
  const [igUserId, setIgUserId] = useState("");
  const [igEnabled, setIgEnabled] = useState(false);
  const [igHasToken, setIgHasToken] = useState(false);

  // Meta — FB
  const [fbAccessToken, setFbAccessToken] = useState("");
  const [fbPageId, setFbPageId] = useState("");
  const [fbPostMode, setFbPostMode] = useState<"link" | "photo">("link");
  const [fbEnabled, setFbEnabled] = useState(false);
  const [fbHasToken, setFbHasToken] = useState(false);

  // Twitter
  const [twBearer, setTwBearer] = useState("");
  const [twAccessToken, setTwAccessToken] = useState("");
  const [twAccessSecret, setTwAccessSecret] = useState("");
  const [twConsumerKey, setTwConsumerKey] = useState("");
  const [twConsumerSecret, setTwConsumerSecret] = useState("");

  // Cloudflare
  const [cfApiToken, setCfApiToken] = useState("");
  const [cfZoneId, setCfZoneId] = useState("");

  // Resend
  const [resendKey, setResendKey] = useState("");
  const [emailFrom, setEmailFrom] = useState("");

  // Auto-Artikel
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoCount, setAutoCount] = useState<number>(1);
  const [autoInterval, setAutoInterval] = useState<number>(60);

  // Toggle Global
  const [enableComments, setEnableComments] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // ---------------- Role guard ----------------
  if (sessionStatus !== "loading" && session && userRole !== "SUPER_ADMIN") {
    redirect("/panel/dashboard");
  }

  // ---------------- Load settings ----------------
  const loadAll = useCallback(async () => {
    try {
      const [settingsRes, socialRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/social/settings"),
      ]);

      if (settingsRes.ok) {
        const json = await settingsRes.json();
        const map: SettingsMap = json.data || {};
        setAllSettings(map);
        setSiteName(map.site_name || "");
        setSiteDescription(map.site_description || "");
        setContactEmail(map.contact_email || "");
        setAlamatRedaksi(map.alamat_redaksi || "");
        setWebsiteUrl(map.website_url || "");

        setAnthropicKey(map.anthropic_api_key || "");
        setDeepseekKey(map.deepseek_api_key || "");
        setEnableAi(map.enable_ai !== "false");

        setGoogleCredentials(map.google_credentials_json || "");
        setGoogleIndexingEnabled(map.google_indexing_enabled === "true");
        setGa4PropertyId(map.ga4_property_id || "");
        setGscSiteUrl(map.gsc_site_url || "");

        setTwBearer(map.twitter_bearer_token || "");
        setTwAccessToken(map.twitter_access_token || "");
        setTwAccessSecret(map.twitter_access_secret || "");
        setTwConsumerKey(map.twitter_consumer_key || "");
        setTwConsumerSecret(map.twitter_consumer_secret || "");

        setCfApiToken(map.cloudflare_api_token || "");
        setCfZoneId(map.cloudflare_zone_id || "");

        setResendKey(map.resend_api_key || "");
        setEmailFrom(map.notification_email_from || "");

        setAutoEnabled(map.auto_article_enabled === "true");
        setAutoCount(parseInt(map.auto_article_batch_size || "1") || 1);
        setAutoInterval(parseInt(map.auto_article_interval_minutes || "60") || 60);

        setEnableComments(map.enable_comments !== "false");
        setMaintenanceMode(map.maintenance_mode === "true");
      }

      if (socialRes.ok) {
        const json = await socialRes.json();
        const s = json.data as SocialSettings;
        setSocialSettings(s);
        setIgUserId(s.instagram?.igUserId || "");
        setIgEnabled(Boolean(s.instagram?.enabled));
        setIgHasToken(Boolean(s.instagram?.hasAccessToken));
        setIgAccessToken(""); // never load actual token
        setFbPageId(s.facebook?.pageId || "");
        setFbPostMode(s.facebook?.postMode || "link");
        setFbEnabled(Boolean(s.facebook?.enabled));
        setFbHasToken(Boolean(s.facebook?.hasAccessToken));
        setFbAccessToken("");
      }
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ---------------- Save helpers ----------------
  function markDirty(section: string) {
    setDirty((prev) => ({ ...prev, [section]: true }));
  }

  async function putSetting(key: string, value: string): Promise<boolean> {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menyimpan");
      return true;
    } catch (err) {
      showError(
        `Gagal menyimpan ${key}: ${err instanceof Error ? err.message : "error"}`,
      );
      return false;
    }
  }

  async function saveSection(section: string, fields: Array<[string, string]>) {
    setSaving((p) => ({ ...p, [section]: true }));
    try {
      let allOk = true;
      for (const [key, value] of fields) {
        const prev = allSettings[key] ?? "";
        if (prev === value) continue;
        const ok = await putSetting(key, value);
        if (!ok) allOk = false;
      }
      if (allOk) {
        // Refresh local cache
        const next: SettingsMap = { ...allSettings };
        for (const [k, v] of fields) next[k] = v;
        setAllSettings(next);
        setDirty((p) => ({ ...p, [section]: false }));
        showSuccess("Pengaturan tersimpan.");
      }
    } finally {
      setSaving((p) => ({ ...p, [section]: false }));
    }
  }

  async function saveSocialScope(
    scope: "global" | "instagram" | "facebook",
    data: Record<string, unknown>,
  ) {
    const sectionKey = `social_${scope}`;
    setSaving((p) => ({ ...p, [sectionKey]: true }));
    try {
      const res = await fetch("/api/social/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, data }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menyimpan");
      showSuccess("Pengaturan sosial tersimpan.");
      setDirty((p) => ({ ...p, [sectionKey]: false }));
      // Refresh
      loadAll();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving((p) => ({ ...p, [sectionKey]: false }));
    }
  }

  // ---------------- Test buttons ----------------
  function setTest(key: string, value: TestResult) {
    setTestResults((p) => ({ ...p, [key]: value }));
  }

  async function handleTestAi() {
    setTest("ai", { loading: true });
    try {
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!json.success) {
        setTest("ai", {
          loading: false,
          success: false,
          message: json.error || "Test gagal",
        });
        return;
      }
      const r = json.data?.results;
      if (r) {
        const ant = r.anthropic;
        const ds = r.deepseek;
        const parts: string[] = [];
        parts.push(
          ant?.success
            ? `Anthropic OK (${ant.durationMs}ms)`
            : `Anthropic FAIL: ${ant?.error?.slice(0, 60) || "?"}`,
        );
        parts.push(
          ds?.success
            ? `DeepSeek OK (${ds.durationMs}ms)`
            : `DeepSeek FAIL: ${ds?.error?.slice(0, 60) || "?"}`,
        );
        setTest("ai", {
          loading: false,
          success: ant?.success || ds?.success,
          message: parts.join(" · "),
        });
      } else {
        setTest("ai", {
          loading: false,
          success: json.data?.success,
          message: json.data?.success
            ? `${json.data.provider} OK`
            : json.data?.error,
        });
      }
    } catch (err) {
      setTest("ai", {
        loading: false,
        success: false,
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  async function handleTestGoogle() {
    setTest("google", { loading: true });
    try {
      const res = await fetch("/api/seo/test-credentials", { method: "POST" });
      const json = await res.json();
      const data = json.data || json;
      const ok = json.success && (data?.ok ?? data?.success ?? true);
      setTest("google", {
        loading: false,
        success: ok,
        message: ok
          ? "Kredensial Google valid."
          : data?.error || json.error || "Gagal validasi",
      });
    } catch (err) {
      setTest("google", {
        loading: false,
        success: false,
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  async function handleTestMeta() {
    setTest("meta", { loading: true });
    try {
      const res = await fetch("/api/social/test-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!json.success) {
        setTest("meta", {
          loading: false,
          success: false,
          message: json.error || "Test gagal",
        });
        return;
      }
      const results = json.data?.results;
      const platforms = results
        ? Object.entries(results)
            .map(([p, r]) => {
              const obj = r as { success?: boolean; error?: string };
              return obj.success ? `${p} OK` : `${p} FAIL`;
            })
            .join(" · ")
        : "selesai";
      setTest("meta", {
        loading: false,
        success: true,
        message: platforms,
      });
    } catch (err) {
      setTest("meta", {
        loading: false,
        success: false,
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  async function handleTestCloudflare() {
    setTest("cloudflare", { loading: true });
    try {
      const res = await fetch("/api/cloudflare/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: ["https://kartawarta.com/?test=1"] }),
      });
      const json = await res.json();
      if (!json.success) {
        setTest("cloudflare", {
          loading: false,
          success: false,
          message: json.error || "Test gagal",
        });
        return;
      }
      const ok = json.data?.success ?? true;
      setTest("cloudflare", {
        loading: false,
        success: ok,
        message: ok
          ? "Purge berhasil dikirim ke Cloudflare."
          : json.data?.error || "Purge gagal",
      });
    } catch (err) {
      setTest("cloudflare", {
        loading: false,
        success: false,
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  async function handleTestEmail() {
    setTest("email", { loading: true });
    try {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      const data = json.data || {};
      const ok = json.success && data.success;
      setTest("email", {
        loading: false,
        success: ok,
        message: ok
          ? `Email tes terkirim ke ${data.to}.`
          : data.error || json.error || "Test gagal",
      });
    } catch (err) {
      setTest("email", {
        loading: false,
        success: false,
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  // ---------------- Validation memos ----------------
  const contactEmailErr =
    contactEmail && !isValidEmail(contactEmail) ? "Email tidak valid" : "";
  const websiteUrlErr =
    websiteUrl && !isValidUrl(websiteUrl) ? "URL harus diawali http(s)://" : "";
  const emailFromErr =
    emailFrom &&
    !/^[^<>]+<[^\s@]+@[^\s@]+\.[^\s@]+>$|^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      emailFrom.trim(),
    )
      ? "Format: 'Nama <email@domain>' atau 'email@domain'"
      : "";
  const googleCredentialsValidation = isValidServiceAccountJson(googleCredentials);

  // ---------------- Render ----------------
  if (sessionStatus === "loading" || !loaded) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Settings size={24} className="text-primary" />
          <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">
            Pengaturan Sistem
          </h1>
        </div>
        <p className="mt-1 text-sm text-txt-secondary">
          Kelola integrasi & konfigurasi platform. Field sensitif tersembunyi
          secara default — klik ikon mata untuk menampilkan.
        </p>
      </div>

      <div className="space-y-3">
        {/* ============== 1. Umum ============== */}
        <Section
          icon={<Globe size={18} />}
          title="1. Umum"
          description="Identitas situs, kontak redaksi"
          defaultOpen
        >
          <Field label="Nama Situs">
            <input
              type="text"
              value={siteName}
              onChange={(e) => {
                setSiteName(e.target.value);
                markDirty("umum");
              }}
              className="input"
              placeholder="Kartawarta"
            />
          </Field>
          <Field label="Deskripsi Situs">
            <textarea
              rows={3}
              value={siteDescription}
              onChange={(e) => {
                setSiteDescription(e.target.value);
                markDirty("umum");
              }}
              className="input resize-none"
              placeholder="Portal berita digital Bandung — bisnis, ekonomi, pemerintahan, hukum, dan topik general lain..."
            />
          </Field>
          <Field label="Email Kontak" error={contactEmailErr}>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => {
                setContactEmail(e.target.value);
                markDirty("umum");
              }}
              className="input"
              placeholder="redaksi@kartawarta.com"
            />
          </Field>
          <Field label="Alamat Redaksi">
            <textarea
              rows={2}
              value={alamatRedaksi}
              onChange={(e) => {
                setAlamatRedaksi(e.target.value);
                markDirty("umum");
              }}
              className="input resize-none"
            />
          </Field>
          <Field label="URL Website" error={websiteUrlErr}>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => {
                setWebsiteUrl(e.target.value);
                markDirty("umum");
              }}
              className="input"
              placeholder="https://kartawarta.com"
            />
          </Field>
          <SaveBar
            onSave={() =>
              saveSection("umum", [
                ["site_name", siteName],
                ["site_description", siteDescription],
                ["contact_email", contactEmail],
                ["alamat_redaksi", alamatRedaksi],
                ["website_url", websiteUrl],
              ])
            }
            saving={!!saving.umum}
            dirty={!!dirty.umum && !contactEmailErr && !websiteUrlErr}
          />
        </Section>

        {/* ============== 2. AI ============== */}
        <Section
          icon={<Sparkles size={18} />}
          title="2. AI Providers"
          description="Anthropic Claude (primary) + DeepSeek (fallback)"
        >
          <Field
            label="Anthropic API Key"
            hint={
              <>
                Dapatkan di{" "}
                <a
                  href="https://console.anthropic.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  console.anthropic.com
                </a>
              </>
            }
          >
            <SecretInput
              value={anthropicKey}
              onChange={(v) => {
                setAnthropicKey(v);
                markDirty("ai");
              }}
              placeholder="sk-ant-..."
            />
          </Field>
          <Field
            label="DeepSeek API Key"
            hint={
              <>
                Dapatkan di{" "}
                <a
                  href="https://platform.deepseek.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  platform.deepseek.com
                </a>
              </>
            }
          >
            <SecretInput
              value={deepseekKey}
              onChange={(v) => {
                setDeepseekKey(v);
                markDirty("ai");
              }}
              placeholder="sk-..."
            />
          </Field>
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-secondary px-4 py-3">
            <div>
              <p className="text-sm font-medium text-txt-primary">
                Aktifkan AI
              </p>
              <p className="text-xs text-txt-muted">
                Master switch untuk semua fitur AI (generate, sorotan, dst).
              </p>
            </div>
            <ToggleSwitch
              checked={enableAi}
              onChange={(v) => {
                setEnableAi(v);
                markDirty("ai");
              }}
            />
          </div>
          <SaveBar
            onSave={() =>
              saveSection("ai", [
                ["anthropic_api_key", anthropicKey],
                ["deepseek_api_key", deepseekKey],
                ["enable_ai", enableAi ? "true" : "false"],
              ])
            }
            saving={!!saving.ai}
            dirty={!!dirty.ai}
            testResult={testResults.ai}
            testButton={
              <button
                type="button"
                onClick={handleTestAi}
                disabled={testResults.ai?.loading}
                className="btn-secondary flex items-center gap-2"
              >
                <PlugZap size={14} />
                Test AI
              </button>
            }
          />
        </Section>

        {/* ============== 3. Google ============== */}
        <Section
          icon={<Globe size={18} />}
          title="3. Google Services"
          description="Indexing API + GA4 + Search Console (service account JSON)"
        >
          <Field
            label="Service Account JSON"
            hint="Tempel JSON service account dengan field type='service_account' & private_key. Pastikan service account ditambahkan sebagai Owner di GSC + Viewer di GA4."
            error={
              googleCredentials && !googleCredentialsValidation.ok
                ? googleCredentialsValidation.error
                : ""
            }
          >
            <textarea
              rows={10}
              value={googleCredentials}
              onChange={(e) => {
                setGoogleCredentials(e.target.value);
                markDirty("google");
              }}
              className="input resize-y font-mono text-xs"
              placeholder='{"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...","client_email":"..."}'
            />
          </Field>
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-secondary px-4 py-3">
            <div>
              <p className="text-sm font-medium text-txt-primary">
                Google Indexing API
              </p>
              <p className="text-xs text-txt-muted">
                Aktifkan submit URL otomatis ke Google saat artikel publish.
              </p>
            </div>
            <ToggleSwitch
              checked={googleIndexingEnabled}
              onChange={(v) => {
                setGoogleIndexingEnabled(v);
                markDirty("google");
              }}
            />
          </div>
          <Field
            label="GA4 Property ID"
            hint="Format angka, mis. 123456789. Cek di GA4 → Admin → Property Settings."
          >
            <input
              type="text"
              value={ga4PropertyId}
              onChange={(e) => {
                setGa4PropertyId(e.target.value.replace(/[^0-9]/g, ""));
                markDirty("google");
              }}
              className="input font-mono text-sm"
              placeholder="123456789"
            />
          </Field>
          <Field
            label="GSC Site URL (opsional)"
            hint="Domain property cukup masukkan 'sc-domain:kartawarta.com'. URL property masukkan 'https://kartawarta.com/'."
          >
            <input
              type="text"
              value={gscSiteUrl}
              onChange={(e) => {
                setGscSiteUrl(e.target.value);
                markDirty("google");
              }}
              className="input font-mono text-sm"
              placeholder="sc-domain:kartawarta.com"
            />
          </Field>
          <SaveBar
            onSave={() => {
              if (googleCredentials && !googleCredentialsValidation.ok) {
                showError(
                  googleCredentialsValidation.error ||
                    "JSON kredensial tidak valid",
                );
                return;
              }
              saveSection("google", [
                ["google_credentials_json", googleCredentials],
                [
                  "google_indexing_enabled",
                  googleIndexingEnabled ? "true" : "false",
                ],
                ["ga4_property_id", ga4PropertyId],
                ["gsc_site_url", gscSiteUrl],
              ]);
            }}
            saving={!!saving.google}
            dirty={!!dirty.google}
            testResult={testResults.google}
            testButton={
              <button
                type="button"
                onClick={handleTestGoogle}
                disabled={testResults.google?.loading}
                className="btn-secondary flex items-center gap-2"
              >
                <PlugZap size={14} />
                Test Google
              </button>
            }
          />
        </Section>

        {/* ============== 4. Meta ============== */}
        <Section
          icon={<Instagram size={18} />}
          title="4. Meta (Instagram + Facebook)"
          description="Token Meta Graph API v21 untuk auto-publish"
        >
          {/* Instagram */}
          <div className="rounded-xl border border-border bg-surface-secondary/40 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Instagram size={16} className="text-primary" />
              <h3 className="text-sm font-bold text-txt-primary">Instagram</h3>
              {igHasToken && !igAccessToken && (
                <span className="ml-auto text-[10px] text-txt-muted">
                  (token sudah disimpan — kosongkan untuk pertahankan)
                </span>
              )}
            </div>
            <Field
              label="Instagram Access Token"
              hint="Long-lived token dari Meta Business / Graph Explorer. Berlaku ~60 hari."
            >
              <SecretInput
                value={igAccessToken}
                onChange={(v) => {
                  setIgAccessToken(v);
                  markDirty("social_instagram");
                }}
                placeholder={
                  igHasToken ? "(tetap pakai token tersimpan)" : "EAAB..."
                }
              />
            </Field>
            <Field
              label="IG User ID (Business Account)"
              hint="ID akun bisnis IG, bukan username. Lihat dokumentasi Meta Graph."
            >
              <input
                type="text"
                value={igUserId}
                onChange={(e) => {
                  setIgUserId(e.target.value.trim());
                  markDirty("social_instagram");
                }}
                className="input font-mono text-sm"
                placeholder="17841400000000000"
              />
            </Field>
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
              <p className="text-sm font-medium text-txt-primary">
                Aktifkan Instagram
              </p>
              <ToggleSwitch
                checked={igEnabled}
                onChange={(v) => {
                  setIgEnabled(v);
                  markDirty("social_instagram");
                }}
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() =>
                  saveSocialScope("instagram", {
                    ...(igAccessToken
                      ? { accessToken: igAccessToken }
                      : {}),
                    igUserId: igUserId || null,
                    enabled: igEnabled,
                  })
                }
                disabled={!!saving.social_instagram || !dirty.social_instagram}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {saving.social_instagram ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Simpan Instagram
              </button>
            </div>
          </div>

          {/* Facebook */}
          <div className="rounded-xl border border-border bg-surface-secondary/40 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Facebook size={16} className="text-primary" />
              <h3 className="text-sm font-bold text-txt-primary">Facebook</h3>
              {fbHasToken && !fbAccessToken && (
                <span className="ml-auto text-[10px] text-txt-muted">
                  (token sudah disimpan)
                </span>
              )}
            </div>
            <Field
              label="Facebook Page Access Token"
              hint="Page-level token dari Meta Business / Graph Explorer."
            >
              <SecretInput
                value={fbAccessToken}
                onChange={(v) => {
                  setFbAccessToken(v);
                  markDirty("social_facebook");
                }}
                placeholder={
                  fbHasToken ? "(tetap pakai token tersimpan)" : "EAAB..."
                }
              />
            </Field>
            <Field label="Facebook Page ID">
              <input
                type="text"
                value={fbPageId}
                onChange={(e) => {
                  setFbPageId(e.target.value.trim());
                  markDirty("social_facebook");
                }}
                className="input font-mono text-sm"
                placeholder="100012345678901"
              />
            </Field>
            <Field
              label="Mode Posting"
              hint="link = link share dengan auto-OG; photo = upload foto + caption."
            >
              <select
                value={fbPostMode}
                onChange={(e) => {
                  setFbPostMode(e.target.value as "link" | "photo");
                  markDirty("social_facebook");
                }}
                className="input"
              >
                <option value="link">Link Share</option>
                <option value="photo">Photo Post</option>
              </select>
            </Field>
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
              <p className="text-sm font-medium text-txt-primary">
                Aktifkan Facebook
              </p>
              <ToggleSwitch
                checked={fbEnabled}
                onChange={(v) => {
                  setFbEnabled(v);
                  markDirty("social_facebook");
                }}
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() =>
                  saveSocialScope("facebook", {
                    ...(fbAccessToken
                      ? { accessToken: fbAccessToken }
                      : {}),
                    pageId: fbPageId || null,
                    postMode: fbPostMode,
                    enabled: fbEnabled,
                  })
                }
                disabled={!!saving.social_facebook || !dirty.social_facebook}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {saving.social_facebook ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Simpan Facebook
              </button>
            </div>
          </div>

          {/* Test publish */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
            <div className="text-xs">
              {testResults.meta?.loading && (
                <span className="flex items-center gap-1.5 text-txt-secondary">
                  <Loader2 size={12} className="animate-spin" /> Menguji…
                </span>
              )}
              {testResults.meta &&
                !testResults.meta.loading &&
                testResults.meta.success === true && (
                  <span className="flex items-center gap-1.5 text-green-600">
                    <CheckCircle2 size={12} /> {testResults.meta.message}
                  </span>
                )}
              {testResults.meta &&
                !testResults.meta.loading &&
                testResults.meta.success === false && (
                  <span className="flex items-center gap-1.5 text-red-600">
                    <XCircle size={12} /> {testResults.meta.message}
                  </span>
                )}
            </div>
            <button
              type="button"
              onClick={handleTestMeta}
              disabled={testResults.meta?.loading}
              className="btn-secondary flex items-center gap-2"
            >
              <PlugZap size={14} />
              Test Publish
            </button>
          </div>
          <p className="text-[11px] text-txt-muted flex items-center gap-1">
            <AlertTriangle size={11} className="text-yellow-600" />
            Test publish memakai artikel PUBLISHED terbaru. Hasil masuk DRAFT
            kalau Mode Draft aktif.
          </p>
        </Section>

        {/* ============== 5. Twitter ============== */}
        <Section
          icon={<Twitter size={18} />}
          title="5. Twitter / X"
          description="5 keys untuk Twitter API v2"
        >
          <Field label="Bearer Token">
            <SecretInput
              value={twBearer}
              onChange={(v) => {
                setTwBearer(v);
                markDirty("twitter");
              }}
              placeholder="AAAAA..."
            />
          </Field>
          <Field label="Access Token">
            <SecretInput
              value={twAccessToken}
              onChange={(v) => {
                setTwAccessToken(v);
                markDirty("twitter");
              }}
            />
          </Field>
          <Field label="Access Token Secret">
            <SecretInput
              value={twAccessSecret}
              onChange={(v) => {
                setTwAccessSecret(v);
                markDirty("twitter");
              }}
            />
          </Field>
          <Field label="Consumer Key (API Key)">
            <SecretInput
              value={twConsumerKey}
              onChange={(v) => {
                setTwConsumerKey(v);
                markDirty("twitter");
              }}
            />
          </Field>
          <Field label="Consumer Secret (API Secret)">
            <SecretInput
              value={twConsumerSecret}
              onChange={(v) => {
                setTwConsumerSecret(v);
                markDirty("twitter");
              }}
            />
          </Field>
          <SaveBar
            onSave={() =>
              saveSection("twitter", [
                ["twitter_bearer_token", twBearer],
                ["twitter_access_token", twAccessToken],
                ["twitter_access_secret", twAccessSecret],
                ["twitter_consumer_key", twConsumerKey],
                ["twitter_consumer_secret", twConsumerSecret],
              ])
            }
            saving={!!saving.twitter}
            dirty={!!dirty.twitter}
            testButton={
              <button
                type="button"
                disabled
                className="btn-secondary opacity-50 flex items-center gap-2"
                title="Test Twitter belum tersedia"
              >
                <PlugZap size={14} /> Test (segera)
              </button>
            }
          />
          <p className="text-[11px] text-txt-muted flex items-center gap-1">
            <AlertTriangle size={11} className="text-yellow-600" />
            Test endpoint Twitter belum tersedia. Validasi dengan men-tweet
            manual via Phase 4 publisher saat sudah live.
          </p>
        </Section>

        {/* ============== 6. Cloudflare ============== */}
        <Section
          icon={<Cloud size={18} />}
          title="6. Cloudflare"
          description="API token + Zone ID untuk cache purge"
        >
          <Field
            label="API Token"
            hint="Buat token di Cloudflare → My Profile → API Tokens dengan permission Zone.Cache Purge."
          >
            <SecretInput
              value={cfApiToken}
              onChange={(v) => {
                setCfApiToken(v);
                markDirty("cloudflare");
              }}
              placeholder="cf_token_..."
            />
          </Field>
          <Field
            label="Zone ID"
            hint="Lihat di Cloudflare dashboard → Domain → Overview → API → Zone ID."
          >
            <input
              type="text"
              value={cfZoneId}
              onChange={(e) => {
                setCfZoneId(e.target.value.trim());
                markDirty("cloudflare");
              }}
              className="input font-mono text-sm"
              placeholder="abc123..."
            />
          </Field>
          <SaveBar
            onSave={() =>
              saveSection("cloudflare", [
                ["cloudflare_api_token", cfApiToken],
                ["cloudflare_zone_id", cfZoneId],
              ])
            }
            saving={!!saving.cloudflare}
            dirty={!!dirty.cloudflare}
            testResult={testResults.cloudflare}
            testButton={
              <button
                type="button"
                onClick={handleTestCloudflare}
                disabled={testResults.cloudflare?.loading}
                className="btn-secondary flex items-center gap-2"
              >
                <PlugZap size={14} />
                Test Purge
              </button>
            }
          />
        </Section>

        {/* ============== 7. Resend ============== */}
        <Section
          icon={<Mail size={18} />}
          title="7. Resend (Email)"
          description="API key + alamat pengirim untuk notifikasi email"
        >
          <Field
            label="Resend API Key"
            hint={
              <>
                Dapatkan di{" "}
                <a
                  href="https://resend.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  resend.com/api-keys
                </a>
              </>
            }
          >
            <SecretInput
              value={resendKey}
              onChange={(v) => {
                setResendKey(v);
                markDirty("email");
              }}
              placeholder="re_..."
            />
          </Field>
          <Field
            label="Email Pengirim (From)"
            hint="Format: 'Nama <email@domain>'. Domain harus sudah verified di Resend."
            error={emailFromErr}
          >
            <input
              type="text"
              value={emailFrom}
              onChange={(e) => {
                setEmailFrom(e.target.value);
                markDirty("email");
              }}
              className="input"
              placeholder="Kartawarta <noreply@kartawarta.com>"
            />
          </Field>
          <SaveBar
            onSave={() =>
              saveSection("email", [
                ["resend_api_key", resendKey],
                ["notification_email_from", emailFrom],
              ])
            }
            saving={!!saving.email}
            dirty={!!dirty.email && !emailFromErr}
            testResult={testResults.email}
            testButton={
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={testResults.email?.loading}
                className="btn-secondary flex items-center gap-2"
              >
                <PlugZap size={14} />
                Kirim Email Tes
              </button>
            }
          />
        </Section>

        {/* ============== 8. Auto-Artikel ============== */}
        <Section
          icon={<Bot size={18} />}
          title="8. Auto-Artikel"
          description="Pembuat draf otomatis via cron + AI"
        >
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-secondary px-4 py-3">
            <div>
              <p className="text-sm font-medium text-txt-primary">
                Aktifkan Auto-Artikel
              </p>
              <p className="text-xs text-txt-muted">
                Cron <code className="font-mono">/api/cron/auto-article</code>{" "}
                akan jalan kalau toggle ini aktif.
              </p>
            </div>
            <ToggleSwitch
              checked={autoEnabled}
              onChange={(v) => {
                setAutoEnabled(v);
                markDirty("auto");
              }}
            />
          </div>
          <Field
            label="Jumlah Artikel per Eksekusi"
            hint="Berapa draf yang dibuat tiap kali cron dipanggil. Disarankan 1-3."
          >
            <input
              type="number"
              min={1}
              max={20}
              value={autoCount}
              onChange={(e) => {
                const n = parseInt(e.target.value);
                setAutoCount(Number.isFinite(n) && n > 0 ? n : 1);
                markDirty("auto");
              }}
              className="input w-32"
            />
          </Field>
          <Field
            label="Interval (menit)"
            hint="Sekedar info — interval real diatur di crontab VPS, bukan di sini."
          >
            <input
              type="number"
              min={5}
              max={1440}
              value={autoInterval}
              onChange={(e) => {
                const n = parseInt(e.target.value);
                setAutoInterval(Number.isFinite(n) && n > 0 ? n : 60);
                markDirty("auto");
              }}
              className="input w-32"
            />
          </Field>
          <SaveBar
            onSave={() =>
              saveSection("auto", [
                ["auto_article_enabled", autoEnabled ? "true" : "false"],
                ["auto_article_batch_size", String(autoCount)],
                ["auto_article_interval_minutes", String(autoInterval)],
              ])
            }
            saving={!!saving.auto}
            dirty={!!dirty.auto}
          />
        </Section>

        {/* ============== 9. Toggle Global ============== */}
        <Section
          icon={<ToggleRight size={18} />}
          title="9. Toggle Global"
          description="Switch komentar publik & mode maintenance"
        >
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-secondary px-4 py-3">
            <div>
              <p className="text-sm font-medium text-txt-primary">
                Aktifkan Komentar
              </p>
              <p className="text-xs text-txt-muted">
                Pembaca dapat meninggalkan komentar di artikel.
              </p>
            </div>
            <ToggleSwitch
              checked={enableComments}
              onChange={(v) => {
                setEnableComments(v);
                markDirty("global");
              }}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-yellow-900">
                Mode Maintenance
              </p>
              <p className="text-xs text-yellow-800">
                Tampilkan halaman maintenance ke pengunjung publik (panel
                tetap dapat diakses).
              </p>
            </div>
            <ToggleSwitch
              checked={maintenanceMode}
              onChange={(v) => {
                setMaintenanceMode(v);
                markDirty("global");
              }}
            />
          </div>
          <SaveBar
            onSave={() =>
              saveSection("global", [
                ["enable_comments", enableComments ? "true" : "false"],
                ["maintenance_mode", maintenanceMode ? "true" : "false"],
              ])
            }
            saving={!!saving.global}
            dirty={!!dirty.global}
          />
        </Section>
      </div>
    </div>
  );
}
