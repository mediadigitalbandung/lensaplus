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

export default function GeminiSettingsPage() {
  const {
    loaded,
    allSettings,
    dirty,
    markDirty,
    saving,
    saveSection,
    testResults,
    runTtsTest,
  } = useSystemSettings();

  const [apiKey, setApiKey] = useState("");
  const [ttsModel, setTtsModel] = useState("");
  const [ttsVoice, setTtsVoice] = useState("");
  const [ttsProvider, setTtsProvider] = useState("auto");

  useEffect(() => {
    if (!loaded) return;
    setApiKey(allSettings.gemini_api_key || "");
    setTtsModel(allSettings.gemini_tts_model || "");
    setTtsVoice(allSettings.gemini_tts_voice || "");
    setTtsProvider(allSettings.tts_provider || "auto");
  }, [loaded, allSettings]);

  return (
    <AiSettingsShell
      activeSlug="gemini"
      title="Pengaturan Google Gemini (Suara Reel / TTS)"
      description="Voiceover Bahasa Indonesia untuk video Reel menggunakan Google Gemini AI Studio."
      settings={allSettings}
      dirty={Boolean(dirty.gemini)}
      loaded={loaded}
    >
      <Section
        title="Kredensial & Koneksi Gemini"
        description="API Key dari Google AI Studio dan uji konektivitas tanpa biaya sintesis."
        active
      >
        <Field
          label="Gemini API Key (suara Reel / TTS)"
          hint={
            <>
              Untuk voiceover Bahasa Indonesia pada Reel. Dapatkan di{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                aistudio.google.com
              </a>
              . Kosongkan = Gemini TTS nonaktif.
            </>
          }
        >
          <SecretInput
            value={apiKey}
            onChange={(v) => {
              setApiKey(v);
              markDirty("gemini");
            }}
            placeholder="AIza..."
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => runTtsTest("gemini")}
              disabled={testResults.gemini?.loading}
              className="btn-secondary flex items-center gap-2 text-xs"
            >
              {testResults.gemini?.loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <PlugZap size={14} />
              )}
              Tes Koneksi Gemini
            </button>
            <TestStatusInline result={testResults.gemini} />
          </div>
          <p className="mt-1 text-[10px] text-txt-muted">
            Simpan key terlebih dahulu sebelum menguji koneksi.
          </p>
        </Field>
      </Section>

      <Section
        title="Model & Karakter Suara Gemini TTS"
        description="Pemilihan model audio Gemini dan karakter suara narator."
        active
      >
        <Field
          label="Model Gemini TTS"
          hint="Flash lebih cepat dan hemat untuk produksi Reel harian; Pro menawarkan intonasi lebih ekspresif."
        >
          <select
            value={ttsModel}
            onChange={(e) => {
              setTtsModel(e.target.value);
              markDirty("gemini");
            }}
            className="input"
          >
            <option value="">Default (gemini-2.5-flash-preview-tts)</option>
            <option value="gemini-2.5-flash-preview-tts">
              gemini-2.5-flash-preview-tts — Cepat &amp; Hemat
            </option>
            <option value="gemini-2.5-pro-preview-tts">
              gemini-2.5-pro-preview-tts — Kualitas Suara Pro
            </option>
          </select>
        </Field>

        <Field
          label="Suara Narator Gemini (Prebuilt Voice)"
          hint="Iapetus = jernih dan netral untuk berita. Anda juga dapat memilih suara lain sesuai karakter konten."
        >
          <select
            value={ttsVoice}
            onChange={(e) => {
              setTtsVoice(e.target.value);
              markDirty("gemini");
            }}
            className="input"
          >
            <option value="">Default (Iapetus — Netral &amp; Jelas)</option>
            <option value="Iapetus">Iapetus — Netral &amp; Jelas (berita)</option>
            <option value="Kore">Kore — Tegas &amp; Informatif</option>
            <option value="Aoede">Aoede — Hangat &amp; Ringan</option>
            <option value="Puck">Puck — Dinamis</option>
            <option value="Charon">Charon — Berat &amp; Berwibawa</option>
            <option value="Fenrir">Fenrir — Ekspresif</option>
          </select>
        </Field>

        <Field
          label="Penyedia Suara Reel Aktif (TTS)"
          hint="Otomatis = pakai ElevenLabs bila key terisi, jika tidak pakai Gemini."
        >
          <select
            value={ttsProvider}
            onChange={(e) => {
              setTtsProvider(e.target.value);
              markDirty("gemini");
            }}
            className="input"
          >
            <option value="auto">Otomatis (ElevenLabs → Gemini)</option>
            <option value="gemini">Gemini</option>
            <option value="elevenlabs">ElevenLabs</option>
            <option value="off">Nonaktif (tanpa suara)</option>
          </select>
        </Field>

        <SaveBar
          onSave={() =>
            saveSection("gemini", [
              ["gemini_api_key", apiKey],
              ["gemini_tts_model", ttsModel],
              ["gemini_tts_voice", ttsVoice],
              ["tts_provider", ttsProvider],
            ])
          }
          saving={Boolean(saving.gemini)}
          dirty={Boolean(dirty.gemini)}
        />
      </Section>
    </AiSettingsShell>
  );
}
