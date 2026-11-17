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

export default function AnthropicSettingsPage() {
  const {
    loaded,
    allSettings,
    dirty,
    markDirty,
    saving,
    saveSection,
    testResults,
    runSingleAiTest,
  } = useSystemSettings();

  const [apiKey, setApiKey] = useState("");
  const [instructions, setInstructions] = useState("");
  const [model, setModel] = useState("");
  const [maxTokens, setMaxTokens] = useState("");
  const [temperature, setTemperature] = useState("");
  const [isPrimary, setIsPrimary] = useState(true);

  useEffect(() => {
    if (!loaded) return;
    setApiKey(allSettings.anthropic_api_key || "");
    setInstructions(allSettings.anthropic_instructions || "");
    setModel(allSettings.anthropic_model || "");
    setMaxTokens(allSettings.anthropic_max_tokens || "");
    setTemperature(allSettings.anthropic_temperature || "");
    setIsPrimary(allSettings.ai_primary_provider !== "deepseek");
  }, [loaded, allSettings]);

  return (
    <AiSettingsShell
      activeSlug="anthropic"
      title="Pengaturan Anthropic (Claude)"
      description="Konfigurasi model Claude, arahan penulisan editorial, batas token, dan prioritas provider."
      settings={allSettings}
      dirty={Boolean(dirty.anthropic)}
      loaded={loaded}
    >
      <Section
        title="Kredensial & Koneksi Anthropic Claude"
        description="API Key dari console.anthropic.com dan verifikasi koneksi."
        active
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
            value={apiKey}
            onChange={(v) => {
              setApiKey(v);
              markDirty("anthropic");
            }}
            placeholder="sk-ant-..."
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => runSingleAiTest("anthropic")}
              disabled={testResults.anthropic?.loading}
              className="btn-secondary flex items-center gap-2 text-xs"
            >
              {testResults.anthropic?.loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <PlugZap size={14} />
              )}
              Tes Koneksi Anthropic
            </button>
            <TestStatusInline result={testResults.anthropic} />
          </div>
          <p className="mt-1 text-[10px] text-txt-muted">
            Simpan pengaturan dulu sebelum tes koneksi.
          </p>
        </Field>
      </Section>

      <Section
        title="Arahan Penulis & Model Claude"
        description="Instruksi gaya editorial serta pemilihan varian model Claude."
        active
      >
        <Field
          label="Arahan Penulis Claude (gaya & karakter)"
          hint="Arahan gaya penulisan yang diikuti Claude saat menulis Sorotan, parafrase, caption media sosial, atau AI Tools. Kosongkan untuk gaya default Lensaplus."
        >
          <textarea
            rows={5}
            value={instructions}
            onChange={(e) => {
              setInstructions(e.target.value);
              markDirty("anthropic");
            }}
            className="input resize-none"
            placeholder="Contoh: Gunakan gaya analisis berita tajam namun netral dan objektif sesuai Kode Etik Jurnalistik."
          />
        </Field>

        <Field
          label="Model Claude yang Dipakai"
          hint="claude-haiku-4-5 cepat & hemat; claude-sonnet-4-6 kualitas penulisan lebih tinggi namun biaya lebih besar."
        >
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              markDirty("anthropic");
            }}
            className="input"
          >
            <option value="">Default (claude-haiku-4-5 — Cepat &amp; Hemat)</option>
            <option value="claude-haiku-4-5">
              claude-haiku-4-5 — Cepat &amp; hemat token (disarankan)
            </option>
            <option value="claude-sonnet-4-6">
              claude-sonnet-4-6 — Kualitas editorial tinggi
            </option>
            <option value="claude-sonnet-4-5">
              claude-sonnet-4-5 — Sonnet 4.5
            </option>
            <option value="claude-opus-4-6">
              claude-opus-4-6 — Penalaran tertinggi (paling mahal)
            </option>
          </select>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Batas Token Output Claude"
            hint="Kosong/0 = ikuti bawaan tiap fitur."
          >
            <input
              type="number"
              min={0}
              step={100}
              value={maxTokens}
              onChange={(e) => {
                setMaxTokens(e.target.value);
                markDirty("anthropic");
              }}
              className="input"
              placeholder="mis. 2000"
            />
          </Field>

          <Field
            label="Temperatur / Kreativitas"
            hint="Rentang 0.0 (faktual ketat) hingga 1.0 (lebih kreatif)."
          >
            <select
              value={temperature}
              onChange={(e) => {
                setTemperature(e.target.value);
                markDirty("anthropic");
              }}
              className="input"
            >
              <option value="">Default bawaan tiap fitur</option>
              <option value="0">0.0 — Sangat Faktual &amp; Konsisten</option>
              <option value="0.3">0.3 — Jurnalistik Fokus</option>
              <option value="0.6">0.6 — Seimbang</option>
              <option value="0.9">0.9 — Kreatif</option>
            </select>
          </Field>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-secondary px-4 py-3">
          <div>
            <p className="text-sm font-medium text-txt-primary">
              Jadikan Anthropic Claude sebagai Engine Utama AI
            </p>
            <p className="text-xs text-txt-muted">
              Aktif = Claude dipanggil lebih dulu, DeepSeek jadi cadangan. Mati = DeepSeek dipanggil lebih dulu.
            </p>
          </div>
          <ToggleSwitch
            checked={isPrimary}
            onChange={(v) => {
              setIsPrimary(v);
              markDirty("anthropic");
            }}
          />
        </div>

        <SaveBar
          onSave={() =>
            saveSection("anthropic", [
              ["anthropic_api_key", apiKey],
              ["anthropic_instructions", instructions],
              ["anthropic_model", model],
              ["anthropic_max_tokens", maxTokens],
              ["anthropic_temperature", temperature],
              ["ai_primary_provider", isPrimary ? "anthropic" : "deepseek"],
            ])
          }
          saving={Boolean(saving.anthropic)}
          dirty={Boolean(dirty.anthropic)}
        />
      </Section>
    </AiSettingsShell>
  );
}
