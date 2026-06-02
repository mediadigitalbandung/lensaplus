/**
 * Preset writing personas for the Perplexity research-and-draft feature.
 *
 * Pure constants (no server deps) so both the client editor pages and the
 * server route can import them. The selected persona's `instruction` is added
 * to the system prompt on top of the editor's custom `perplexity_instructions`.
 */

export interface PerplexityPersona {
  key: string;
  label: string;
  instruction: string;
}

export const PERPLEXITY_PERSONAS: PerplexityPersona[] = [
  {
    key: "",
    label: "Default (gaya Kartawarta)",
    instruction: "",
  },
  {
    key: "hard_news",
    label: "Hard News (berita lugas)",
    instruction:
      "Tulis sebagai HARD NEWS: lugas, padat, objektif. Buka dengan lead 5W1H yang kuat di paragraf pertama, lalu susun dengan pola piramida terbalik (info terpenting di atas). Kalimat aktif dan pendek. Tanpa opini, tanpa bahasa promosi.",
  },
  {
    key: "feature",
    label: "Feature / Human Interest",
    instruction:
      "Tulis sebagai FEATURE / human interest: buka dengan anekdot atau adegan yang menarik, gaya naratif yang mengalir dan menyentuh, tetap berbasis fakta. Tonjolkan sisi manusia dan konteks, bukan sekadar kronologi.",
  },
  {
    key: "analysis",
    label: "Analisis / Mendalam",
    instruction:
      "Tulis sebagai ANALISIS mendalam: jelaskan latar belakang, sebab-akibat, dan implikasi. Kaitkan beberapa sumber/fakta menjadi satu gambaran utuh, sertakan konteks data dan sudut pandang ahli bila ada. Tetap berimbang dan berbasis bukti.",
  },
  {
    key: "explainer",
    label: "Explainer (mudah dipahami)",
    instruction:
      "Tulis sebagai EXPLAINER: bantu pembaca awam memahami isu. Pakai sub-judul tanya-jawab atau langkah, definisikan istilah teknis dengan bahasa sederhana, beri contoh konkret. Hindari jargon tanpa penjelasan.",
  },
  {
    key: "listicle",
    label: "Ringkas / Poin-poin",
    instruction:
      "Tulis RINGKAS dan SCANNABLE: paragraf pembuka singkat lalu sajikan inti dalam poin-poin (<ul>/<li>) atau sub-judul pendek. Setiap poin padat dan langsung ke intinya. Cocok untuk pembaca mobile.",
  },
];

/** Resolve a persona key to its instruction text ("" for default/unknown). */
export function getPersonaInstruction(key?: string | null): string {
  if (!key) return "";
  return PERPLEXITY_PERSONAS.find((p) => p.key === key)?.instruction ?? "";
}
