/**
 * Publish-time quality gate — AdSense "thin / low-value content" compliance.
 *
 * Google flags a publisher network for thin content when low-substance pages
 * go live. This gate is the single objective chokepoint every publish path
 * (admin approve, admin publish, scheduled cron) runs through: an article may
 * only become APPROVED/PUBLISHED when it has enough real body text AND a lead
 * image. Auto-generated drafts (scrape-paraphrase / Perplexity) target
 * 500-800 words, so genuine ones pass; sub-threshold thin drafts are blocked.
 *
 * Tune MIN_PUBLISH_WORDS here — it is the only knob.
 */

export const MIN_PUBLISH_WORDS = 300;

/**
 * Count words in an HTML body by stripping tags + entities, then splitting on
 * whitespace. Deliberately simple & dependency-free (runs in edge/node cron).
 */
export function countContentWords(html: string | null | undefined): number {
  if (!html) return 0;
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#?[a-z0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return 0;
  return text.split(" ").filter(Boolean).length;
}

export interface QualityResult {
  ok: boolean;
  words: number;
  hasImage: boolean;
  /** Human-readable reason (Indonesian) when ok === false. */
  reason?: string;
}

/**
 * Returns whether an article is substantial enough to be published.
 * Pass the effective content + featuredImage (prefer the incoming edit over
 * the stored value when publishing in the same request).
 */
export function checkArticleQuality(
  content: string | null | undefined,
  featuredImage: string | null | undefined,
): QualityResult {
  const words = countContentWords(content);
  const hasImage = !!(featuredImage && featuredImage.trim());

  if (words < MIN_PUBLISH_WORDS) {
    return {
      ok: false,
      words,
      hasImage,
      reason: `Artikel terlalu pendek untuk dipublikasikan (±${words} kata, minimal ${MIN_PUBLISH_WORDS}). Tambahkan isi yang orisinal & bermanfaat sebelum menerbitkan.`,
    };
  }
  if (!hasImage) {
    return {
      ok: false,
      words,
      hasImage,
      reason:
        "Artikel wajib memiliki gambar utama (featured image) sebelum dipublikasikan.",
    };
  }
  return { ok: true, words, hasImage };
}
