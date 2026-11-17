/**
 * Language detection & Indonesian label utilities for news scraping, preview
 * translation, and concept-level paraphrasing.
 */

const LANG_LABELS_ID: Record<string, string> = {
  id: "Indonesia",
  en: "Inggris",
  zh: "Mandarin / Tionghoa",
  ja: "Jepang",
  ko: "Korea",
  ar: "Arab",
  ms: "Melayu",
  fr: "Prancis",
  de: "Jerman",
  es: "Spanyol",
  pt: "Portugis",
  nl: "Belanda",
  it: "Italia",
  ru: "Rusia",
  th: "Thailand",
  vi: "Vietnam",
  tr: "Turki",
  hi: "Hindi",
};

const ID_WORDS_RE =
  /\b(yang|dan|dengan|untuk|tidak|dari|telah|akan|adalah|pada|atau|juga|sudah|oleh|dalam|bagi|agar|karena|bahwa|tersebut|sebagai|namun|hingga|terhadap|secara|saat|sementara|masih|bisa|dapat|harus|lebih)\b/g;

const EN_WORDS_RE =
  /\b(the|and|that|with|this|have|has|had|from|will|been|were|was|are|their|which|would|could|about|into|after|said|says|against|between|over|amid|through|for|of)\b/g;

const FR_WORDS_RE =
  /\b(les|des|une|dans|pour|avec|est|sont|qui|sur|par|cette|nous|vous|mais|plus|elle|aux)\b/g;

const ES_WORDS_RE =
  /\b(los|las|una|unos|para|con|por|que|del|como|pero|más|esta|este|sobre|entre|sus)\b/g;

const DE_WORDS_RE =
  /\b(der|die|das|und|den|dem|ein|eine|mit|für|auf|nicht|sich|ist|sind|von|auch|nach)\b/g;

const PT_WORDS_RE =
  /\b(não|para|com|uma|dos|das|por|que|como|mais|pelo|pela|sobre|entre|após|aos)\b/g;

const NL_WORDS_RE =
  /\b(het|een|van|met|voor|zijn|niet|aan|ook|door|wordt|werden|naar|maar|bij|uit)\b/g;

const MS_DISTINCT_RE =
  /\b(kerana|baharu|ringgit|berkenaan|tiada|sehingga|kerajaan|putrajaya|perdana|malaysia)\b/g;

const ID_GEO_RE =
  /\b(jakarta|bandung|surabaya|indonesia|rupiah|jawa|sumatera|kalimantan|sulawesi|bumn|pemda|polri|dpr|kpk)\b/g;

/** Normalize a BCP-47 tag (e.g. "en-US", "zh_CN", "id-ID") to a 2-letter ISO code. */
export function normalizeLangCode(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().toLowerCase().replace(/_/g, "-");
  if (!cleaned) return undefined;
  const base = cleaned.split("-")[0];
  if (base === "in") return "id";
  if (base === "iw") return "he";
  if (/^[a-z]{2,3}$/.test(base)) return base;
  return undefined;
}

/**
 * Detect primary language code from scraped article/listing text plus optional
 * HTML `lang` / `og:locale` hint.
 *
 * Notice text signals override stale `<html lang="en">` tags often left behind
 * on Indonesian templates.
 */
export function detectLanguage(
  text: string,
  htmlLangHint?: string | null,
): string | undefined {
  const sampleRaw = (text || "").slice(0, 4_000);
  const hint = normalizeLangCode(htmlLangHint);

  // 1. Non-Latin script detection (order matters: Kana distinguishes ja vs zh).
  const kanaCount = (sampleRaw.match(/[\u3040-\u30ff]/g) || []).length;
  if (kanaCount >= 4) return "ja";

  const hangulCount = (sampleRaw.match(/[\uac00-\ud7af\u1100-\u11ff]/g) || []).length;
  if (hangulCount >= 4) return "ko";

  const cjkCount = (sampleRaw.match(/[\u4e00-\u9fff]/g) || []).length;
  if (cjkCount >= 5) return "zh";

  const arabicCount = (sampleRaw.match(/[\u0600-\u06ff]/g) || []).length;
  if (arabicCount >= 5) return "ar";

  const cyrillicCount = (sampleRaw.match(/[\u0400-\u04ff]/g) || []).length;
  if (cyrillicCount >= 5) return "ru";

  const thaiCount = (sampleRaw.match(/[\u0e00-\u0e7f]/g) || []).length;
  if (thaiCount >= 5) return "th";

  const devanagariCount = (sampleRaw.match(/[\u0900-\u097f]/g) || []).length;
  if (devanagariCount >= 5) return "hi";

  // 2. Latin-script stopword scoring
  const sample = sampleRaw.toLowerCase();
  const idHits = (sample.match(ID_WORDS_RE) || []).length;
  const enHits = (sample.match(EN_WORDS_RE) || []).length;
  const frHits = (sample.match(FR_WORDS_RE) || []).length;
  const esHits = (sample.match(ES_WORDS_RE) || []).length;
  const deHits = (sample.match(DE_WORDS_RE) || []).length;
  const ptHits = (sample.match(PT_WORDS_RE) || []).length;
  const nlHits = (sample.match(NL_WORDS_RE) || []).length;
  const msHits = (sample.match(MS_DISTINCT_RE) || []).length;
  const idGeoHits = (sample.match(ID_GEO_RE) || []).length;

  // Explicit Malay disambiguation (shares common root words with Indonesian)
  if ((hint === "ms" && idGeoHits <= msHits) || (msHits >= 2 && msHits > idGeoHits)) {
    return "ms";
  }

  const foreignLatinScores: Array<[string, number]> = [
    ["en", enHits],
    ["fr", frHits],
    ["es", esHits],
    ["de", deHits],
    ["pt", ptHits],
    ["nl", nlHits],
  ];
  foreignLatinScores.sort((a, b) => b[1] - a[1]);
  const [topForeignLang, topForeignHits] = foreignLatinScores[0];

  // Strong Indonesian content beats stale template `<html lang="en">`
  if (idHits >= 3 && idHits > topForeignHits) {
    return "id";
  }

  // Clear foreign Latin language beats everything
  if (topForeignHits >= 2 && topForeignHits > idHits) {
    // If htmlLangHint names another European language with comparable signal, prefer hint
    if (hint && hint !== "id" && hint !== "en") {
      const hintScore = foreignLatinScores.find(([code]) => code === hint)?.[1] ?? 0;
      if (hintScore >= 1) return hint;
    }
    return topForeignLang;
  }

  // Ambiguous short text (e.g. a few headlines): use HTML hint if provided
  if (hint) {
    // Only trust `hint === "id"` if English didn't clearly win
    if (hint === "id" && topForeignLang === "en" && topForeignHits > idHits + 1) {
      return "en";
    }
    if (hint === "en" && idHits >= 2 && idHits > enHits) {
      return "id";
    }
    return hint;
  }

  if (idHits >= 1 && topForeignHits === 0) return "id";
  if (topForeignHits >= 1 && idHits === 0) return topForeignLang;
  return undefined;
}

export function isForeignLanguage(lang?: string | null): boolean {
  return Boolean(lang && lang.toLowerCase() !== "id");
}

export function languageLabelId(lang?: string | null): string {
  const code = normalizeLangCode(lang);
  if (!code) return "Bahasa Asing";
  return LANG_LABELS_ID[code] ?? `Bahasa ${code.toUpperCase()}`;
}
