"use client";

const COOKIE_NAME = "kw_reading";
const MAX_ENTRIES = 30;
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export interface ReadEntry {
  s: string; // article slug
  c: string; // category slug
  t: number; // timestamp (ms epoch)
}

/**
 * Read history dari cookie. Empty array kalau belum ada.
 */
export function getReadHistory(): ReadEntry[] {
  if (typeof document === "undefined") return [];
  const match = document.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return [];
  try {
    const decoded = decodeURIComponent(match[1]);
    const parsed = JSON.parse(decoded);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Track artikel yang user baca. Append ke cookie dengan dedup.
 * Cap MAX_ENTRIES, oldest dropped.
 */
export function trackRead(slug: string, categorySlug: string): void {
  if (typeof document === "undefined") return;
  const history = getReadHistory();
  // Dedup: hapus entry yang sama kalau sudah ada
  const filtered = history.filter((e) => e.s !== slug);
  // Push baru di awal (most recent first)
  filtered.unshift({ s: slug, c: categorySlug, t: Date.now() });
  // Cap
  const capped = filtered.slice(0, MAX_ENTRIES);
  // Save back to cookie
  const encoded = encodeURIComponent(JSON.stringify(capped));
  document.cookie = `${COOKIE_NAME}=${encoded}; max-age=${COOKIE_MAX_AGE}; path=/; samesite=lax`;
}

/**
 * Compute category preference dari history.
 * Returns: { categorySlug: weight }
 *
 * Weighted by recency: read 1 jam lalu = 1.0, read 1 hari lalu = 0.5,
 * read 7 hari lalu = 0.1, read 30 hari lalu = 0.01
 */
export function computeCategoryWeights(
  history: ReadEntry[]
): Record<string, number> {
  const now = Date.now();
  const weights: Record<string, number> = {};
  for (const entry of history) {
    const ageHours = (now - entry.t) / (60 * 60 * 1000);
    const weight = Math.exp(-ageHours / 48); // half-life ~ 33 jam
    weights[entry.c] = (weights[entry.c] || 0) + weight;
  }
  return weights;
}

/**
 * Top N category slugs sorted by weight descending.
 */
export function topCategories(
  history: ReadEntry[],
  n: number = 5
): string[] {
  const weights = computeCategoryWeights(history);
  return Object.entries(weights)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([slug]) => slug);
}
