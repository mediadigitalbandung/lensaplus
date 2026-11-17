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

export default function DeepSeekSettingsPage() {
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
  const [comboEnabled, setComboEnabled] = useState(false);
  const [researchModel, setResearchModel] = useState("");
  const [maxTokens, setMaxTokens] = useState("");
  const [temperature, setTemperature] = useState("");
  const [topP, setTopP] = useState("");
  const [frequencyPenalty, setFrequencyPenalty] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [preferEditor, setPreferEditor] = useState(false);
  const [smallFieldsDeepseek, setSmallFieldsDeepseek] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    setApiKey(allSettings.deepseek_api_key || "");
    setInstructions(allSettings.deepseek_instructions || "");
    setModel(allSettings.deepseek_model || "");
    setComboEnabled(allSettings.deepseek_combo_enabled === "true");
    setResearchModel(allSettings.deepseek_research_model || "");
    setMaxTokens(allSettings.deepseek_max_tokens || "");
    setTemperature(allSettings.deepseek_temperature || "");
    setTopP(allSettings.deepseek_top_p || "");
    setFrequencyPenalty(allSettings.deepseek_frequency_penalty || "");
    setIsPrimary(allSettings.ai_primary_provider === "deepseek");
    setPreferEditor(allSettings.ai_editor_provider === "deepseek");
    setSmallFieldsDeepseek(allSettings.perplexity_small_fields_deepseek === "true");
  }, [loaded, allSettings]);

  const isReasonerSelected = model === "deepseek-reasoner";

  return (
    <AiSettingsShell
      activeSlug="deepseek"
      title="Pengaturan DeepSeek"
      description="Konfigurasi model, arahan penulisan, kontrol biaya & sampling, serta prioritas DeepSeek di seluruh panel redaksi."
      settings={allSettings}
      dirty={Boolean(dirty.deepseek)}
      loaded={loaded}
    >
      <Section
        title="Kredensial & Koneksi DeepSeek"
        description="API Key dari platform.deepseek.com dan tombol uji koneksi langsung."
        active
      >
        <Field
          label="DeepSeek API Key"
          hint={
            <>
              Dapatkan API Key dan isi saldo kredit di{" "}
              <a
                href="https://platform.deepseek.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                platform.deepseek.com
              </a>
              . Digunakan untuk parafrase sumber berita, Sorotan, AI Tools editor, Bulk SEO/Tags, dan caption media sosial.
            </>
          }
        >
          <SecretInput
            value={apiKey}
            onChange={(v) => {
              setApiKey(v);
              markDirty("deepseek");
            }}
            placeholder="sk-..."
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => runSingleAiTest("deepseek")}
              disabled={testResults.deepseek?.loading}
              className="btn-secondary flex items-center gap-2 text-xs"
            >
              {testResults.deepseek?.loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <PlugZap size={14} />
              )}
              Tes Koneksi DeepSeek
            </button>
            <TestStatusInline result={testResults.deepseek} />
          </div>
          <p className="mt-1 text-[10px] text-txt-muted">
            Simpan pengaturan terlebih dahulu sebelum menguji koneksi.
          </p>
        </Field>
      </Section>

      <Section
        title="Arahan Penulis & Karakter"
        description="Gaya bahasa, struktur berita, dan aturan redaksi khusus yang diikuti DeepSeek."
        active
      >
        <Field
          label="Arahan Penulis DeepSeek (gaya & karakter)"
          hint="Dipakai saat DeepSeek menulis atau memparafrase artikel scraper, membuat Sorotan, mengisi AI Tools editor, dan membuat SEO/tag. Kosongkan untuk gaya standar redaksi Lensaplus."
        >
          <textarea
            rows={5}
            value={instructions}
            onChange={(e) => {
              setInstructions(e.target.value);
              markDirty("deepseek");
            }}
            className="input resize-none"
            placeholder="Contoh: Gunakan Bahasa Indonesia jurnalistik yang lugas, kalimat aktif, akurat sesuai PUEBI/EYD. Buka dengan lead 5W+1H di paragraf pertama. Hindari clickbait, sensasionalisme, dan pengulangan kalimat."
          />
        </Field>
      </Section>

      <Section
        title="Model AI & Pengaturan Generasi DeepSeek"
        description="Pilih model DeepSeek, mode kombinasi 2-tahap, batas token output, serta kontrol kreativitas (temperature)."
        active
      >
        <Field
          label="Model DeepSeek yang Dipakai"
          hint="deepseek-chat (V3) sangat cepat dan hemat biaya (~$0.27/1M input) — ideal untuk berita harian, parafrase, & SEO. Pilih deepseek-reasoner (R1) hanya bila butuh penalaran mendalam (lebih lambat & ~2× lebih mahal)."
        >
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              markDirty("deepseek");
            }}
            className="input"
          >
            <option value="">Default (deepseek-chat — Cepat &amp; Hemat)</option>
            <option value="deepseek-chat">
              deepseek-chat (DeepSeek V3) — Cepat &amp; hemat token (disarankan)
            </option>
            <option value="deepseek-reasoner">
              deepseek-reasoner (DeepSeek R1) — Penalaran mendalam (~2× biaya)
            </option>
          </select>
        </Field>

        <Field
          label="Mode Kombinasi 2-Tahap (analisis terstruktur → tulis hemat)"
          hint="Saat AKTIF: untuk pembuatan artikel penuh (parafrase scraper, Sorotan, Tulis Artikel/Ide Konten), tahap-1 menyusun kerangka analisis memakai Model Tahap-1, lalu tahap-2 menulis hasil akhir memakai model utama yang hemat. Tugas pendek (SEO title/tags/meta) tetap 1 panggilan cepat."
        >
          <label className="flex items-center gap-2 text-sm text-txt-secondary">
            <input
              type="checkbox"
              checked={comboEnabled}
              onChange={(e) => {
                setComboEnabled(e.target.checked);
                markDirty("deepseek");
              }}
              className="h-4 w-4 accent-primary"
            />
            Aktifkan kombinasi 2-tahap DeepSeek (analisis + penulisan)
          </label>
          {comboEnabled && (
            <select
              value={researchModel}
              onChange={(e) => {
                setResearchModel(e.target.value);
                markDirty("deepseek");
              }}
              className="input mt-3"
            >
              <option value="">Model Tahap-1: Default (deepseek-reasoner)</option>
              <option value="deepseek-reasoner">
                Model Tahap-1: deepseek-reasoner (DeepSeek R1 — disarankan)
              </option>
              <option value="deepseek-chat">
                Model Tahap-1: deepseek-chat (DeepSeek V3 — lebih cepat)
              </option>
            </select>
          )}
        </Field>

        <Field
          label="Batas Token Output DeepSeek"
          hint="Batas maksimum token jawaban per permintaan untuk mengontrol panjang teks dan biaya. Mis. isi 2000 untuk draf artikel lengkap & ringkas. Kosong/0 = pakai batas bawaan tiap fitur."
        >
          <input
            type="number"
            min={0}
            step={100}
            value={maxTokens}
            onChange={(e) => {
              setMaxTokens(e.target.value);
              markDirty("deepseek");
            }}
            className="input"
            placeholder="mis. 2000"
          />
        </Field>

        <Field
          label="Temperatur / Gaya Kreativitas"
          hint={
            isReasonerSelected
              ? "Catatan: Parameter temperature, top_p, dan frequency_penalty otomatis diabaikan ketika model disetel ke deepseek-reasoner."
              : "Mengatur seberapa konsisten vs kreatif pilihan kata DeepSeek. Untuk berita faktual & JSON scraper, disarankan 0.3 atau Default."
          }
        >
          <select
            value={temperature}
            onChange={(e) => {
              setTemperature(e.target.value);
              markDirty("deepseek");
            }}
            disabled={isReasonerSelected}
            className="input disabled:opacity-60"
          >
            <option value="">Default bawaan tiap fitur (0.4 – 0.8)</option>
            <option value="0">0.0 — Sangat Faktual &amp; Konsisten (ketat)</option>
            <option value="0.3">0.3 — Jurnalistik Fokus &amp; Lugas (disarankan)</option>
            <option value="0.6">0.6 — Seimbang</option>
            <option value="0.9">0.9 — Kreatif (ide konten &amp; variasi judul)</option>
            <option value="1.2">1.2 — Sangat Eksploratif</option>
          </select>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Top-P (Nucleus Sampling)"
            hint="Membatasi kandidat kosakata paling relevan. Kosongkan = default API (1.0)."
          >
            <select
              value={topP}
              onChange={(e) => {
                setTopP(e.target.value);
                markDirty("deepseek");
              }}
              disabled={isReasonerSelected}
              className="input disabled:opacity-60"
            >
              <option value="">Default API (1.0)</option>
              <option value="0.8">0.8 — Lebih fokus</option>
              <option value="0.9">0.9 — Terarah</option>
              <option value="0.95">0.95 — Sedikit bervariasi</option>
              <option value="1">1.0 — Penuh</option>
            </select>
          </Field>

          <Field
            label="Anti-Pengulangan (Frequency Penalty)"
            hint="Mengurangi pengulangan frasa/kata yang sama di artikel panjang. Kosongkan = default (0)."
          >
            <select
              value={frequencyPenalty}
              onChange={(e) => {
                setFrequencyPenalty(e.target.value);
                markDirty("deepseek");
              }}
              disabled={isReasonerSelected}
              className="input disabled:opacity-60"
            >
              <option value="">Default API (0)</option>
              <option value="0.2">0.2 — Ringan (disarankan)</option>
              <option value="0.5">0.5 — Sedang</option>
              <option value="0.8">0.8 — Kuat anti-repetisi</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section
        title="Prioritas & Integrasi DeepSeek di Lensaplus"
        description="Aktifkan agar DeepSeek benar-benar diprioritaskan di seluruh fitur AI panel redaksi."
        active
      >
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-secondary px-4 py-3">
          <div>
            <p className="text-sm font-medium text-txt-primary">
              Jadikan DeepSeek sebagai Engine Utama AI
            </p>
            <p className="text-xs text-txt-muted">
              Saat AKTIF: parafrase scraper Sumber Berita, pembuatan Sorotan, caption sosial media, dan metadata Sumber Berita akan memakai DeepSeek lebih dulu dibanding Anthropic Claude.
            </p>
          </div>
          <ToggleSwitch
            checked={isPrimary}
            onChange={(v) => {
              setIsPrimary(v);
              markDirty("deepseek");
            }}
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-secondary px-4 py-3">
          <div>
            <p className="text-sm font-medium text-txt-primary">
              Utamakan DeepSeek pada AI Tools Editor
            </p>
            <p className="text-xs text-txt-muted">
              Saat AKTIF: tombol AI Tools di editor artikel (Generate SEO Title, Meta Description, Tags, Ringkasan, Buat Ide Konten, Tulis Artikel Lengkap, High CTR Meta) langsung memakai DeepSeek dengan arahan di atas.
            </p>
          </div>
          <ToggleSwitch
            checked={preferEditor}
            onChange={(v) => {
              setPreferEditor(v);
              markDirty("deepseek");
            }}
          />
        </div>

        <Field
          label="Tangani Field Kecil Artikel Perplexity via DeepSeek"
          hint="Sinkron dengan pengaturan Perplexity: ringkasan, tag, judul SEO, dan meta description hasil Riset & Tulis / Auto-Artikel dibuat memakai DeepSeek agar biaya jauh lebih hemat."
        >
          <label className="flex items-center gap-2 text-sm text-txt-secondary">
            <input
              type="checkbox"
              checked={smallFieldsDeepseek}
              onChange={(e) => {
                setSmallFieldsDeepseek(e.target.checked);
                markDirty("deepseek");
              }}
              className="h-4 w-4 accent-primary"
            />
            Aktifkan offload ringkasan, tag, SEO title &amp; meta description ke DeepSeek
          </label>
        </Field>

        <SaveBar
          onSave={() =>
            saveSection("deepseek", [
              ["deepseek_api_key", apiKey],
              ["deepseek_instructions", instructions],
              ["deepseek_model", model],
              ["deepseek_combo_enabled", comboEnabled ? "true" : "false"],
              ["deepseek_research_model", researchModel],
              ["deepseek_max_tokens", maxTokens],
              ["deepseek_temperature", temperature],
              ["deepseek_top_p", topP],
              ["deepseek_frequency_penalty", frequencyPenalty],
              [
                "ai_primary_provider",
                isPrimary
                  ? "deepseek"
                  : allSettings.ai_primary_provider === "deepseek"
                    ? "anthropic"
                    : allSettings.ai_primary_provider || "anthropic",
              ],
              [
                "ai_editor_provider",
                preferEditor
                  ? "deepseek"
                  : allSettings.ai_editor_provider === "deepseek"
                    ? "auto"
                    : allSettings.ai_editor_provider || "auto",
              ],
              ["perplexity_small_fields_deepseek", smallFieldsDeepseek ? "true" : "false"],
            ])
          }
          saving={Boolean(saving.deepseek)}
          dirty={Boolean(dirty.deepseek)}
        />
      </Section>
    </AiSettingsShell>
  );
}
