"use client";

import { useEffect, useState } from "react";
import { Loader2, PlugZap } from "lucide-react";
import {
  Field,
  SaveBar,
  SecretInput,
  Section,
  TestStatusInline,
  useSystemSettings,
} from "@/components/panel/settings/SettingsControls";
import { AiSettingsShell } from "@/components/panel/ai-settings/AiSettingsShell";

export default function PerplexitySettingsPage() {
  const {
    loaded,
    allSettings,
    dirty,
    markDirty,
    saving,
    saveSection,
    testResults,
    runPerplexityTest,
  } = useSystemSettings();

  const [apiKey, setApiKey] = useState("");
  const [instructions, setInstructions] = useState("");
  const [model, setModel] = useState("");
  const [maxTokens, setMaxTokens] = useState("");
  const [searchContext, setSearchContext] = useState("");
  const [comboEnabled, setComboEnabled] = useState(false);
  const [researchModel, setResearchModel] = useState("");
  const [smallFieldsDeepseek, setSmallFieldsDeepseek] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    setApiKey(allSettings.perplexity_api_key || "");
    setInstructions(allSettings.perplexity_instructions || "");
    setModel(allSettings.perplexity_model || "");
    setMaxTokens(allSettings.perplexity_max_tokens || "");
    setSearchContext(allSettings.perplexity_search_context || "");
    setComboEnabled(allSettings.perplexity_combo_enabled === "true");
    setResearchModel(allSettings.perplexity_research_model || "");
    setSmallFieldsDeepseek(allSettings.perplexity_small_fields_deepseek === "true");
  }, [loaded, allSettings]);

  return (
    <AiSettingsShell
      activeSlug="perplexity"
      title="Pengaturan Perplexity (Sonar)"
      description="Riset berita web real-time bersumber & penulisan draf otomatis (Riset & Tulis + Auto-Artikel)."
      settings={allSettings}
      dirty={Boolean(dirty.perplexity)}
      loaded={loaded}
    >
      <Section
        title="Kredensial & Koneksi Perplexity"
        description="API Key Perplexity untuk pencarian web real-time dan verifikasi koneksi."
        active
      >
        <Field
          label="Perplexity API Key (riset & tulis artikel)"
          hint={
            <>
              Untuk riset web real-time + draf artikel bersumber di editor. Dapatkan di{" "}
              <a
                href="https://www.perplexity.ai/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                perplexity.ai/settings/api
              </a>{" "}
              (perlu kredit). Kosongkan = fitur Perplexity nonaktif.
            </>
          }
        >
          <SecretInput
            value={apiKey}
            onChange={(v) => {
              setApiKey(v);
              markDirty("perplexity");
            }}
            placeholder="pplx-..."
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={runPerplexityTest}
              disabled={testResults.perplexity?.loading}
              className="btn-secondary flex items-center gap-2 text-xs"
            >
              {testResults.perplexity?.loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <PlugZap size={14} />
              )}
              Tes Koneksi Perplexity
            </button>
            <TestStatusInline result={testResults.perplexity} />
          </div>
          <p className="mt-1 text-[10px] text-txt-muted">
            Simpan key dulu sebelum tes (tes memakai key yang tersimpan).
          </p>
        </Field>
      </Section>

      <Section
        title="Arahan Penulis & Karakter"
        description="Instruksi gaya bahasa dan sudut pandang redaksi untuk agent Perplexity."
        active
      >
        <Field
          label="Arahan Penulis Perplexity (gaya & karakter)"
          hint="Arahan untuk agent Perplexity saat meriset & menulis: gaya bahasa, sudut pandang, panjang, hal yang harus/dihindari. Dipakai di setiap 'Riset & Tulis' dan Auto-Artikel. Kosongkan untuk gaya default Lensaplus."
        >
          <textarea
            rows={5}
            value={instructions}
            onChange={(e) => {
              setInstructions(e.target.value);
              markDirty("perplexity");
            }}
            className="input resize-none"
            placeholder="Contoh: Tulis dengan gaya jurnalistik ringkas dan tegas. Gunakan kalimat aktif, hindari jargon. Sertakan konteks lokal bila relevan. Buka dengan lead yang kuat (5W1H) di paragraf pertama. Hindari bahasa promosi/clickbait."
          />
        </Field>
      </Section>

      <Section
        title="Model, Kontrol Biaya & Riset Web"
        description="Pemilihan model Sonar, mode kombinasi 2-tahap, batas token, dan kedalaman pencarian."
        active
      >
        <Field
          label="Model Perplexity (hemat token)"
          hint="Default sonar = paling hemat: token output ~15× lebih murah dari sonar-pro, dan cukup untuk draf berita. Naikkan ke sonar-pro hanya bila butuh riset lebih dalam."
        >
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              markDirty("perplexity");
            }}
            className="input"
          >
            <option value="">Default (sonar — Hemat)</option>
            <option value="sonar">sonar — Hemat (disarankan)</option>
            <option value="sonar-pro">sonar-pro — Kualitas tinggi (boros)</option>
            <option value="sonar-reasoning">sonar-reasoning — Penalaran (lebih boros)</option>
            <option value="sonar-reasoning-pro">sonar-reasoning-pro — Paling boros</option>
          </select>
        </Field>

        <Field
          label="Mode Kombinasi (riset bagus → tulis hemat)"
          hint="Saat AKTIF: tahap-1 RISET pakai 'Model Riset' (sumber lebih berkualitas, output pendek = murah), tahap-2 MENULIS pakai model di atas yang hemat. Hanya berlaku untuk pembuatan artikel penuh (Riset & Tulis mode draf + Auto-Artikel)."
        >
          <label className="flex items-center gap-2 text-sm text-txt-secondary">
            <input
              type="checkbox"
              checked={comboEnabled}
              onChange={(e) => {
                setComboEnabled(e.target.checked);
                markDirty("perplexity");
              }}
              className="h-4 w-4 accent-primary"
            />
            Aktifkan kombinasi 2-tahap (riset + tulis pakai 2 model)
          </label>
          {comboEnabled && (
            <select
              value={researchModel}
              onChange={(e) => {
                setResearchModel(e.target.value);
                markDirty("perplexity");
              }}
              className="input mt-3"
            >
              <option value="">Model Riset: Default (sonar-pro)</option>
              <option value="sonar-pro">Model Riset: sonar-pro (disarankan)</option>
              <option value="sonar-reasoning">Model Riset: sonar-reasoning</option>
              <option value="sonar-reasoning-pro">Model Riset: sonar-reasoning-pro</option>
            </select>
          )}
        </Field>

        <Field
          label="Batas Token Output Perplexity"
          hint="Batas maksimum panjang jawaban — token output adalah biaya terbesar. Mis. isi 1500 untuk draf ringkas & hemat. Kosong/0 = tanpa batas tambahan."
        >
          <input
            type="number"
            min={0}
            step={100}
            value={maxTokens}
            onChange={(e) => {
              setMaxTokens(e.target.value);
              markDirty("perplexity");
            }}
            className="input"
            placeholder="mis. 1500"
          />
        </Field>

        <Field
          label="Kedalaman Pencarian Web Perplexity"
          hint="low = paling hemat (biaya pencarian kecil), high = sumber lebih kaya tapi lebih mahal. Kosongkan = high (default)."
        >
          <select
            value={searchContext}
            onChange={(e) => {
              setSearchContext(e.target.value);
              markDirty("perplexity");
            }}
            className="input"
          >
            <option value="">Default (high)</option>
            <option value="low">low — Hemat</option>
            <option value="medium">medium — Seimbang</option>
            <option value="high">high — Kaya sumber (boros)</option>
          </select>
        </Field>

        <Field
          label="Field kecil (meta/SEO/tag) via DeepSeek"
          hint="Saat AKTIF: ringkasan, tag, judul SEO, dan meta description diturunkan dari isi artikel oleh DeepSeek yang JAUH lebih murah. Butuh DeepSeek API Key terisi; bila gagal, otomatis pakai field bawaan Perplexity."
        >
          <label className="flex items-center gap-2 text-sm text-txt-secondary">
            <input
              type="checkbox"
              checked={smallFieldsDeepseek}
              onChange={(e) => {
                setSmallFieldsDeepseek(e.target.checked);
                markDirty("perplexity");
              }}
              className="h-4 w-4 accent-primary"
            />
            Pakai DeepSeek untuk ringkasan, tag, SEO title &amp; meta description
          </label>
        </Field>

        <SaveBar
          onSave={() =>
            saveSection("perplexity", [
              ["perplexity_api_key", apiKey],
              ["perplexity_instructions", instructions],
              ["perplexity_model", model],
              ["perplexity_max_tokens", maxTokens],
              ["perplexity_search_context", searchContext],
              ["perplexity_combo_enabled", comboEnabled ? "true" : "false"],
              ["perplexity_research_model", researchModel],
              ["perplexity_small_fields_deepseek", smallFieldsDeepseek ? "true" : "false"],
            ])
          }
          saving={Boolean(saving.perplexity)}
          dirty={Boolean(dirty.perplexity)}
        />
      </Section>
    </AiSettingsShell>
  );
}
