"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, PlugZap } from "lucide-react";
import {
  Field,
  SaveBar,
  Section,
  ToggleSwitch,
  type SettingsMap,
  type TestResult,
} from "@/components/panel/settings/SettingsControls";
import { AI_PROVIDERS, getProviderStatus } from "./AiProviderMeta";

export function AiProvidersOverview({
  settings,
  dirty,
  saving,
  testResult,
  markDirty,
  saveSection,
  onTestAllAi,
}: {
  settings: SettingsMap;
  dirty: boolean;
  saving: boolean;
  testResult?: TestResult;
  markDirty: () => void;
  saveSection: (fields: Array<[string, string]>) => Promise<unknown>;
  onTestAllAi: () => void;
}) {
  const [enableAi, setEnableAi] = useState(true);
  const [primaryProvider, setPrimaryProvider] = useState("anthropic");
  const [editorProvider, setEditorProvider] = useState("auto");
  const [usdIdrRate, setUsdIdrRate] = useState("");

  useEffect(() => {
    setEnableAi(settings.enable_ai !== "false");
    setPrimaryProvider(settings.ai_primary_provider || "anthropic");
    setEditorProvider(settings.ai_editor_provider || "auto");
    setUsdIdrRate(settings.usd_idr_rate || "");
  }, [settings]);

  return (
    <div className="space-y-4">
      {/* 1. Dedicated pages grid for each AI Provider */}
      <Section
        title="Halaman Konfigurasi Masing-Masing AI"
        description="Setiap penyedia AI memiliki halaman pengaturan khusus (API key, model, arahan penulisan, batas token, dan tes koneksi)."
        active
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AI_PROVIDERS.map((p) => {
            const st = getProviderStatus(p, settings);
            const isPrimaryLlm =
              (p.slug === "deepseek" && primaryProvider === "deepseek") ||
              (p.slug === "anthropic" && primaryProvider !== "deepseek");

            return (
              <div
                key={p.slug}
                className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-txt-muted">
                      {p.role}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${
                        st.configured ? "text-emerald-700" : "text-txt-muted"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          st.configured ? "bg-emerald-600" : "bg-stone-300"
                        }`}
                      />
                      {st.label}
                    </span>
                  </div>

                  <h3 className="mt-1.5 font-serif text-lg font-bold text-txt-primary">
                    {p.name}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-txt-secondary">
                    {p.description}
                  </p>

                  <div className="mt-3 space-y-0.5 border-t border-border pt-2.5 text-xs text-txt-muted">
                    <div>
                      Model:{" "}
                      <span className="font-mono font-medium text-txt-primary">
                        {st.model}
                      </span>
                    </div>
                    {(p.slug === "deepseek" || p.slug === "anthropic") && (
                      <div>
                        Prioritas Utama:{" "}
                        <span className="font-semibold text-primary">
                          {isPrimaryLlm ? "Provider Utama" : "Cadangan (Fallback)"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-2 border-t border-border">
                  <Link
                    href={p.href}
                    className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary hover:underline"
                  >
                    Buka Halaman {p.name}
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* 2. Global AI Switch & Provider Routing */}
      <Section
        title="Pengaturan Global & Prioritas Routing AI"
        description="Kontrol utama aktif/nonaktif AI serta urutan penyedia LLM yang dipakai di seluruh fitur Lensaplus."
        active
      >
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-secondary px-4 py-3">
          <div>
            <p className="text-sm font-medium text-txt-primary">Aktifkan AI</p>
            <p className="text-xs text-txt-muted">
              Master switch untuk semua fitur AI (parafrase, editor AI Tools, Sorotan, riset, dll).
            </p>
          </div>
          <ToggleSwitch
            checked={enableAi}
            onChange={(v) => {
              setEnableAi(v);
              markDirty();
            }}
          />
        </div>

        <Field
          label="Provider Utama LLM (callAI)"
          hint="Menentukan apakah parafrase scraper, Sorotan, AI meta Sumber Berita, dan caption sosmed memakai DeepSeek atau Anthropic Claude lebih dulu. Yang kedua tetap menjadi cadangan otomatis."
        >
          <select
            value={primaryProvider}
            onChange={(e) => {
              setPrimaryProvider(e.target.value);
              markDirty();
            }}
            className="input"
          >
            <option value="anthropic">
              Anthropic Claude dulu → DeepSeek fallback (default)
            </option>
            <option value="deepseek">
              DeepSeek dulu → Anthropic Claude fallback
            </option>
          </select>
        </Field>

        <Field
          label="Prioritas Engine AI Tools di Editor Artikel"
          hint="Menentukan AI yang dipanggil pertama kali saat menekan menu AI Tools di editor (SEO Title, Meta Description, Tags, Ringkasan, Ide Konten, Tulis Artikel)."
        >
          <select
            value={editorProvider}
            onChange={(e) => {
              setEditorProvider(e.target.value);
              markDirty();
            }}
            className="input"
          >
            <option value="auto">
              Otomatis (Local AI jika diutamakan → Perplexity → Local AI → Provider Utama)
            </option>
            <option value="deepseek">
              Utamakan DeepSeek (pakai model &amp; arahan DeepSeek lebih dulu)
            </option>
            <option value="perplexity">
              Utamakan Perplexity (riset web dulu, lalu fallback)
            </option>
            <option value="anthropic">
              Utamakan Anthropic Claude (pakai model &amp; arahan Claude lebih dulu)
            </option>
          </select>
        </Field>

        <Field
          label="Kurs USD → IDR Laporan Biaya AI (opsional)"
          hint="Dipakai oleh dashboard Statistik AI untuk konversi Rupiah. Kosongkan untuk kurs otomatis."
        >
          <input
            type="number"
            min={0}
            step={100}
            value={usdIdrRate}
            onChange={(e) => {
              setUsdIdrRate(e.target.value);
              markDirty();
            }}
            className="input"
            placeholder="mis. 16500 (kosongkan = otomatis)"
          />
        </Field>

        <SaveBar
          onSave={() =>
            saveSection([
              ["enable_ai", enableAi ? "true" : "false"],
              ["ai_primary_provider", primaryProvider],
              ["ai_editor_provider", editorProvider],
              ["usd_idr_rate", usdIdrRate.trim()],
            ])
          }
          saving={saving}
          dirty={dirty}
          testResult={testResult}
          testButton={
            <button
              type="button"
              onClick={onTestAllAi}
              disabled={testResult?.loading}
              className="btn-secondary flex items-center gap-2"
            >
              <PlugZap size={14} />
              Test AI (Claude &amp; DeepSeek)
            </button>
          }
        />
      </Section>
    </div>
  );
}
