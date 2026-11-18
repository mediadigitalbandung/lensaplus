"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Save,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export type SettingsMap = Record<string, string>;

export interface TestResult {
  loading: boolean;
  success?: boolean;
  message?: string;
}

export function Section({
  icon: _icon,
  title,
  description,
  defaultOpen = false,
  active,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  void _icon;
  const tabbed = active !== undefined;
  const [open, setOpen] = useState(defaultOpen);

  if (tabbed && !active) return null;
  const isOpen = tabbed ? true : open;

  return (
    <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
      {tabbed ? (
        <div className="px-5 py-4">
          <div className="min-w-0 border-l-4 border-primary pl-3">
            <h2 className="text-base font-bold text-txt-primary">{title}</h2>
            {description && (
              <p className="text-xs text-txt-secondary">{description}</p>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-surface-secondary/40 transition-colors text-left"
        >
          <div className="min-w-0 border-l-4 border-primary pl-3">
            <h2 className="text-base font-bold text-txt-primary">{title}</h2>
            {description && (
              <p className="text-xs text-txt-secondary truncate">{description}</p>
            )}
          </div>
          {open ? (
            <ChevronDown size={18} className="text-txt-muted shrink-0" />
          ) : (
            <ChevronRight size={18} className="text-txt-muted shrink-0" />
          )}
        </button>
      )}
      {isOpen && (
        <div className="border-t border-border px-5 py-5 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

export function Field({
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

export function SecretInput({
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

export function ToggleSwitch({
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

export function SaveBar({
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
          type="button"
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

export function TestStatusInline({ result }: { result?: TestResult }) {
  if (!result || result.loading) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        result.success ? "text-green-600" : "text-red-600"
      }`}
    >
      {result.success ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {result.message}
    </span>
  );
}

/**
 * Shared loader, saver, and role guard hook for /panel/pengaturan and all
 * dedicated /panel/pengaturan/ai/* pages.
 */
export function useSystemSettings() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const userRole = session?.user?.role || "";
  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const { success: showSuccess, error: showError } = useToast();

  const [loaded, setLoaded] = useState(false);
  const [allSettings, setAllSettings] = useState<SettingsMap>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  useEffect(() => {
    if (sessionStatus !== "loading" && session && !isSuperAdmin) {
      router.replace("/panel/dashboard");
    }
  }, [sessionStatus, session, isSuperAdmin, router]);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const json = await res.json();
        const map: SettingsMap = json.data || {};
        setAllSettings(map);
        return map;
      }
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
    return null;
  }, []);

  useEffect(() => {
    if (sessionStatus !== "loading" && isSuperAdmin) {
      reload();
    }
  }, [sessionStatus, isSuperAdmin, reload]);

  function markDirty(section: string) {
    setDirty((prev) => ({ ...prev, [section]: true }));
  }

  function setTest(key: string, value: TestResult) {
    setTestResults((p) => ({ ...p, [key]: value }));
  }

  async function putSetting(
    key: string,
    value: string,
  ): Promise<{ ok: boolean; savedValue?: string }> {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menyimpan");
      return {
        ok: true,
        savedValue:
          typeof json.data?.value === "string" ? json.data.value : value,
      };
    } catch (err) {
      showError(
        `Gagal menyimpan ${key}: ${err instanceof Error ? err.message : "error"}`,
      );
      return { ok: false };
    }
  }

  async function saveSection(
    section: string,
    fields: Array<[string, string]>,
  ): Promise<SettingsMap | null> {
    setSaving((p) => ({ ...p, [section]: true }));
    try {
      let allOk = true;
      const savedMap: SettingsMap = { ...allSettings };
      for (const [key, value] of fields) {
        const prev = allSettings[key] ?? "";
        if (prev === value) continue;
        const res = await putSetting(key, value);
        if (!res.ok) {
          allOk = false;
        } else if (res.savedValue !== undefined) {
          savedMap[key] = res.savedValue;
        }
      }
      if (allOk) {
        setAllSettings(savedMap);
        setDirty((p) => ({ ...p, [section]: false }));
        showSuccess("Pengaturan tersimpan.");
        return savedMap;
      }
      return null;
    } finally {
      setSaving((p) => ({ ...p, [section]: false }));
    }
  }

  async function runSingleAiTest(provider: "anthropic" | "deepseek") {
    setTest(provider, { loading: true });
    try {
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = await res.json();
      const d = json.data;
      const label = provider === "anthropic" ? "Anthropic" : "DeepSeek";
      if (json.success && d?.success) {
        const modelTag = d.model ? `${d.model} · ` : "";
        setTest(provider, {
          loading: false,
          success: true,
          message: `${label} OK (${modelTag}${d.durationMs ?? 0}ms)`,
        });
      } else {
        setTest(provider, {
          loading: false,
          success: false,
          message: d?.error || json.error || `${label} gagal dihubungi`,
        });
      }
    } catch (err) {
      setTest(provider, {
        loading: false,
        success: false,
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  async function runAllAiTest() {
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
        const parts: string[] = [
          ant?.success
            ? `Anthropic OK (${ant.model ? `${ant.model} · ` : ""}${ant.durationMs}ms)`
            : `Anthropic FAIL: ${ant?.error?.slice(0, 60) || "?"}`,
          ds?.success
            ? `DeepSeek OK (${ds.model ? `${ds.model} · ` : ""}${ds.durationMs}ms)`
            : `DeepSeek FAIL: ${ds?.error?.slice(0, 60) || "?"}`,
        ];
        setTest("ai", {
          loading: false,
          success: Boolean(ant?.success || ds?.success),
          message: parts.join(" · "),
        });
      } else {
        setTest("ai", {
          loading: false,
          success: Boolean(json.data?.success),
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

  async function runPerplexityTest() {
    setTest("perplexity", { loading: true });
    try {
      const res = await fetch("/api/ai/test-perplexity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      const d = json.data;
      setTest("perplexity", {
        loading: false,
        success: !!(json.success && d?.success),
        message: d?.message || json.error || "Test gagal",
      });
    } catch (err) {
      setTest("perplexity", {
        loading: false,
        success: false,
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  async function runLocalAiTest() {
    setTest("localai", { loading: true });
    try {
      const res = await fetch("/api/ai/test-localai", { method: "POST" });
      const json = await res.json();
      const d = json.data;
      setTest("localai", {
        loading: false,
        success: !!(json.success && d?.success),
        message: d?.message || json.error || "Test gagal",
      });
    } catch (err) {
      setTest("localai", {
        loading: false,
        success: false,
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  async function runTtsTest(provider: "gemini" | "elevenlabs") {
    setTest(provider, { loading: true });
    try {
      const res = await fetch("/api/ai/test-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = await res.json();
      const d = json.data;
      setTest(provider, {
        loading: false,
        success: !!(json.success && d?.success),
        message: d?.message || json.error || "Test gagal",
      });
    } catch (err) {
      setTest(provider, {
        loading: false,
        success: false,
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  return {
    sessionStatus,
    loaded,
    allSettings,
    setAllSettings,
    reload,
    dirty,
    setDirty,
    markDirty,
    saving,
    setSaving,
    saveSection,
    testResults,
    setTest,
    runSingleAiTest,
    runAllAiTest,
    runPerplexityTest,
    runLocalAiTest,
    runTtsTest,
    showSuccess,
    showError,
  };
}
