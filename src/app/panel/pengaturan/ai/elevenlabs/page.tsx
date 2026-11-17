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

export default function ElevenLabsSettingsPage() {
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
  const [voiceId, setVoiceId] = useState("");
  const [model, setModel] = useState("");
  const [ttsProvider, setTtsProvider] = useState("auto");

  useEffect(() => {
    if (!loaded) return;
    setApiKey(allSettings.elevenlabs_api_key || "");
    setVoiceId(allSettings.elevenlabs_voice_id || "");
    setModel(allSettings.elevenlabs_model || "");
    setTtsProvider(allSettings.tts_provider || "auto");
  }, [loaded, allSettings]);

  return (
    <AiSettingsShell
      activeSlug="elevenlabs"
      title="Pengaturan ElevenLabs (Suara Reel / TTS)"
      description="Voiceover ultra-natural multi-bahasa untuk produksi video Reel & audio pendek."
      settings={allSettings}
      dirty={Boolean(dirty.elevenlabs)}
      loaded={loaded}
    >
      <Section
        title="Kredensial & Koneksi ElevenLabs"
        description="API Key dari elevenlabs.io serta cek sisa kuota karakter akun Anda."
        active
      >
        <Field
          label="ElevenLabs API Key (suara Reel)"
          hint={
            <>
              Suara TTS sangat natural. Dapatkan di{" "}
              <a
                href="https://elevenlabs.io/app/settings/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                elevenlabs.io/app/settings/api-keys
              </a>
              .
            </>
          }
        >
          <SecretInput
            value={apiKey}
            onChange={(v) => {
              setApiKey(v);
              markDirty("elevenlabs");
            }}
            placeholder="sk_..."
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => runTtsTest("elevenlabs")}
              disabled={testResults.elevenlabs?.loading}
              className="btn-secondary flex items-center gap-2 text-xs"
            >
              {testResults.elevenlabs?.loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <PlugZap size={14} />
              )}
              Tes Koneksi ElevenLabs
            </button>
            <TestStatusInline result={testResults.elevenlabs} />
          </div>
          <p className="mt-1 text-[10px] text-txt-muted">
            Simpan key terlebih dahulu sebelum menguji koneksi.
          </p>
        </Field>
      </Section>

      <Section
        title="Model, Voice ID & Prioritas TTS"
        description="Pemilihan model sintesis, ID suara khusus, dan aturan penyedia suara Reel."
        active
      >
        <Field
          label="ElevenLabs Voice ID (opsional)"
          hint="Kosongkan = suara default (Rachel). Salin Voice ID dari halaman Voices di dashboard ElevenLabs."
        >
          <input
            type="text"
            value={voiceId}
            onChange={(e) => {
              setVoiceId(e.target.value);
              markDirty("elevenlabs");
            }}
            className="input font-mono text-sm"
            placeholder="21m00Tcm4TlvDq8ikWAM"
          />
        </Field>

        <Field
          label="Model ElevenLabs"
          hint="eleven_multilingual_v2 paling natural untuk Bahasa Indonesia; eleven_flash_v2_5 lebih cepat & hemat kredit."
        >
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              markDirty("elevenlabs");
            }}
            className="input"
          >
            <option value="">Default (eleven_multilingual_v2 — Natural)</option>
            <option value="eleven_multilingual_v2">
              eleven_multilingual_v2 — Kualitas Bahasa Indonesia Terbaik
            </option>
            <option value="eleven_flash_v2_5">
              eleven_flash_v2_5 — Cepat &amp; Hemat Kuota (~50% kredit)
            </option>
            <option value="eleven_turbo_v2_5">
              eleven_turbo_v2_5 — Latensi Rendah
            </option>
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
              markDirty("elevenlabs");
            }}
            className="input"
          >
            <option value="auto">Otomatis (ElevenLabs → Gemini)</option>
            <option value="elevenlabs">ElevenLabs</option>
            <option value="gemini">Gemini</option>
            <option value="off">Nonaktif (tanpa suara)</option>
          </select>
        </Field>

        <SaveBar
          onSave={() =>
            saveSection("elevenlabs", [
              ["elevenlabs_api_key", apiKey],
              ["elevenlabs_voice_id", voiceId],
              ["elevenlabs_model", model],
              ["tts_provider", ttsProvider],
            ])
          }
          saving={Boolean(saving.elevenlabs)}
          dirty={Boolean(dirty.elevenlabs)}
        />
      </Section>
    </AiSettingsShell>
  );
}
