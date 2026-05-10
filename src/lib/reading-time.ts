/**
 * Estimasi waktu baca berdasarkan word count.
 * Avg reading speed bahasa Indonesia ~ 200 wpm.
 * Accepts HTML or plain text — strips tags before counting.
 *
 * Article model punya field `readTime Int?` yang bisa di-prepopulate
 * via helper ini saat artikel di-create/update.
 */
export function estimateReadingTime(htmlOrText: string): number {
  const plainText = htmlOrText.replace(/<[^>]+>/g, " ").trim();
  const words = plainText.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
