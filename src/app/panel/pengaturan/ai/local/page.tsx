"use client";

import { useEffect, useState } from "react";
import { Loader2, PlugZap } from "lucide-react";
import {
  Field,
  SaveBar,
  SecretInput,
  Section,
  TestStatusInline,
  ToggleSwitch,
  useSystemSettings,
} from "@/components/panel/settings/SettingsControls";
import { AiSettingsShell } from "@/components/panel/ai-settings/AiSettingsShell";

export default function LocalAiSettingsPage() {
  const {
    loaded,
    allSettings,
    dirty,
    markDirty,
    saving,
    saveSection,
    testResults,
    runLocalAiTest,
  } = useSystemSettings();

  const [enabled, setEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [prefer, setPrefer] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [maxTokens, setMaxTokens] = useState("");
  const [temperature, setTemperature] = useState("");

  useEffect(() => {
    if (!loaded) return;
    setEnabled(allSettings.localai_enabled === "true");
    setBaseUrl(allSettings.localai_base_url || "");
    setModel(allSettings.localai_model || "");
    setApiKey(allSettings.localai_api_key || "");
    setPrefer(allSettings.localai_prefer === "true");
    setInstructions(allSettings.localai_instructions || "");
    setMaxTokens(allSettings.localai_max_tokens || "");
    setTemperature(allSettings.localai_temperature || "");
  }, [loaded, allSettings]);

  return (
    <AiSettingsShell
      activeSlug="local"
      title="Pengaturan Local AI (Self-Hosted / Tailscale)"
      description="Server LLM pribadi (Ollama / LM Studio / vLLM) tanpa biaya token per permintaan."
      settings={allSettings}
      dirty={Boolean(dirty.localai)}
      loaded={loaded}
    >
      <Section
        title="Status & Koneksi Server Local AI"
        description="Gunakan server AI lokal/Tailscale sebagai engine penulisan alternatif selain cloud API."
        active
      >
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-secondary px-4 py-3">
          <div>
            <p className="text-sm font-medium text-txt-primary">Aktifkan Local AI</p>
            <p className="text-xs text-txt-muted">
              Gratis (self-hosted), tanpa akses internet/pencarian web langsung (riset web bersumber tetap Perplexity).
            </p>
          </div>
          <ToggleSwitch
            checked={enabled}
            onChange={(v) => {
              setEnabled(v);
              markDirty("localai");
            }}
          />
        </div>

        <Field
          label="Base URL Server (OpenAI-Compatible)"
          hint="Contoh: http://100.81.47.91:11434 (Ollama) atau :1234 (LM Studio). VPS produksi harus terhubung di jaringan/tailnet yang sama agar dapat menjangkaunya."
        >
          <input
            className="input font-mono text-sm"
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              markDirty("localai");
            }}
            placeholder="http://100.81.47.91:11434"
          />
        </Field>

        <Field
          label="Nama Model di Server Local AI"
          hint="Masukkan nama model persis seperti di server Ollama/LM Studio, mis. hermes3, llama3.1:8b, atau qwen2.5."
        >
          <input
            className="input font-mono text-sm"
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              markDirty("localai");
            }}
            placeholder="hermes3"
          />
        </Field>

        <Field
          label="API Key / Bearer Token (opsional)"
          hint="Kosongkan bila server lokal Anda tidak memakai autentikasi token."
        >
          <SecretInput
            value={apiKey}
            onChange={(v) => {
              setApiKey(v);
              markDirty("localai");
            }}
            placeholder="(opsional)"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={runLocalAiTest}
            disabled={testResults.localai?.loading}
            className="btn-secondary flex items-center gap-2 text-xs"
          >
            {testResults.localai?.loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <PlugZap size={14} />
            )}
            Tes Koneksi Local AI
          </button>
          <TestStatusInline result={testResults.localai} />
        </div>
        <p className="text-[10px] text-txt-muted">
          Simpan konfigurasi dulu sebelum menjalankan tes koneksi.
        </p>
      </Section>

      <Section
        title="Arahan Penulis, Prioritas & Parameter Local AI"
        description="Sesuaikan gaya bahasa, batas token, temperatur, serta prioritas terhadap provider cloud."
        active
      >
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-secondary px-4 py-3">
          <div>
            <p className="text-sm font-medium text-txt-primary">Utamakan Local AI</p>
            <p className="text-xs text-txt-muted">
              Pakai Local AI lebih dulu daripada Perplexity saat menjalankan AI Tools editor dan AI Sources metadata.
            </p>
          </div>
          <ToggleSwitch
            checked={prefer}
            onChange={(v) => {
              setPrefer(v);
              markDirty("localai");
            }}
          />
        </div>

        <Field
          label="Arahan Penulis Local AI (opsional)"
          hint="Instruksi gaya bahasa khusus model lokal. Jika dikosongkan, sistem menggunakan arahan default/bersama saat memanggil editor AI Tools."
        >
          <textarea
            rows={4}
            value={instructions}
            onChange={(e) => {
              setInstructions(e.target.value);
              markDirty("localai");
            }}
            className="input resize-none"
            placeholder="Contoh: Tulis artikel berita Bahasa Indonesia yang faktual, kalimat pendek, dan langsung menjawab inti peristiwa."
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Batas Token Output Local AI"
            hint="Kosong/0 = ikuti bawaan tiap fitur (maks 1600 untuk artikel penuh)."
          >
            <input
              type="number"
              min={0}
              step={100}
              value={maxTokens}
              onChange={(e) => {
                setMaxTokens(e.target.value);
                markDirty("localai");
              }}
              className="input"
              placeholder="mis. 1600"
            />
          </Field>

          <Field
            label="Temperatur / Kreativitas"
            hint="Rentang 0.0 (stabil) sampai 1.2 (variatif)."
          >
            <select
              value={temperature}
              onChange={(e) => {
                setTemperature(e.target.value);
                markDirty("localai");
              }}
              className="input"
            >
              <option value="">Default (0.4)</option>
              <option value="0.2">0.2 — Ketat &amp; Fokus</option>
              <option value="0.4">0.4 — Seimbang (disarankan)</option>
              <option value="0.7">0.7 — Kreatif</option>
              <option value="1">1.0 — Variatif</option>
            </select>
          </Field>
        </div>

        <SaveBar
          onSave={() =>
            saveSection("localai", [
              ["localai_enabled", enabled ? "true" : "false"],
              ["localai_base_url", baseUrl],
              ["localai_model", model],
              ["localai_api_key", apiKey],
              ["localai_prefer", prefer ? "true" : "false"],
              ["localai_instructions", instructions],
              ["localai_max_tokens", maxTokens],
              ["localai_temperature", temperature],
            ])
          }
          saving={Boolean(saving.localai)}
          dirty={Boolean(dirty.localai)}
        />
      </Section>
    </AiSettingsShell>
  );
}
