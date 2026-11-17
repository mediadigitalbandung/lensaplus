import type { SettingsMap } from "@/components/panel/settings/SettingsControls";

export type AiProviderSlug =
  | "perplexity"
  | "deepseek"
  | "anthropic"
  | "gemini"
  | "elevenlabs"
  | "local";

export interface AiProviderDefinition {
  slug: AiProviderSlug;
  name: string;
  role: string;
  href: string;
  description: string;
  keySetting: string;
  modelSetting: string;
  defaultModel: string;
}

export const AI_PROVIDERS: AiProviderDefinition[] = [
  {
    slug: "perplexity",
    name: "Perplexity (Sonar)",
    role: "Riset Web & Artikel Otomatis",
    href: "/panel/pengaturan/ai/perplexity",
    description:
      "Riset berita live web bersumber + penulisan draf di Auto-Artikel dan panel Riset & Tulis editor.",
    keySetting: "perplexity_api_key",
    modelSetting: "perplexity_model",
    defaultModel: "sonar",
  },
  {
    slug: "deepseek",
    name: "DeepSeek",
    role: "Penulisan, Parafrase, SEO & Tag",
    href: "/panel/pengaturan/ai/deepseek",
    description:
      "LLM hemat biaya untuk parafrase scraper, AI Tools editor, Sorotan, Bulk SEO/Tags, dan meta artikel.",
    keySetting: "deepseek_api_key",
    modelSetting: "deepseek_model",
    defaultModel: "deepseek-chat",
  },
  {
    slug: "anthropic",
    name: "Anthropic (Claude)",
    role: "LLM Editorial & Analisis",
    href: "/panel/pengaturan/ai/anthropic",
    description:
      "Claude untuk penulisan editorial, Sorotan multi-angle, caption media sosial, dan seleksi klip.",
    keySetting: "anthropic_api_key",
    modelSetting: "anthropic_model",
    defaultModel: "claude-haiku-4-5",
  },
  {
    slug: "gemini",
    name: "Google Gemini",
    role: "Suara Reel (TTS)",
    href: "/panel/pengaturan/ai/gemini",
    description:
      "Voiceover narasi Bahasa Indonesia otomatis untuk produksi video Reel & berita singkat.",
    keySetting: "gemini_api_key",
    modelSetting: "gemini_tts_model",
    defaultModel: "gemini-2.5-flash-preview-tts",
  },
  {
    slug: "elevenlabs",
    name: "ElevenLabs",
    role: "Suara Reel Natural (TTS)",
    href: "/panel/pengaturan/ai/elevenlabs",
    description:
      "Alternatif sintesis suara voiceover multi-bahasa ultra-natural untuk produksi video Reel.",
    keySetting: "elevenlabs_api_key",
    modelSetting: "elevenlabs_model",
    defaultModel: "eleven_multilingual_v2",
  },
  {
    slug: "local",
    name: "Local AI",
    role: "Self-Hosted / Tailscale",
    href: "/panel/pengaturan/ai/local",
    description:
      "Server LLM pribadi (Ollama / LM Studio / vLLM) tanpa biaya token untuk penulisan & AI Tools.",
    keySetting: "localai_enabled",
    modelSetting: "localai_model",
    defaultModel: "(belum diisi)",
  },
];

export function getProviderStatus(
  provider: AiProviderDefinition,
  settings: SettingsMap,
): { configured: boolean; label: string; model: string } {
  if (provider.slug === "local") {
    const enabled = settings.localai_enabled === "true";
    const hasUrl = Boolean((settings.localai_base_url || "").trim());
    const model = (settings.localai_model || "").trim() || provider.defaultModel;
    if (enabled && hasUrl && (settings.localai_model || "").trim()) {
      return { configured: true, label: "Aktif", model };
    }
    return {
      configured: false,
      label: enabled ? "Belum lengkap" : "Nonaktif",
      model,
    };
  }

  const hasKey = Boolean((settings[provider.keySetting] || "").trim());
  const model = (settings[provider.modelSetting] || "").trim() || provider.defaultModel;
  return {
    configured: hasKey,
    label: hasKey ? "Terkonfigurasi" : "Belum diisi",
    model,
  };
}
