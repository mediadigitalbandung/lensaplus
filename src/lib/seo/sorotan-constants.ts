/**
 * Client- and server-safe constants for Sorotan SEO angles.
 *
 * Kept separate from `sorotan-generator.ts` (which imports Prisma and AI clients)
 * so client components like `/panel/sorotan` can import angle lists and labels
 * without pulling server modules into the browser bundle.
 */

export const ACTIVE_SOROTAN_ANGLES = [
  "KRONOLOGI",
  "ANALISIS",
  "DAMPAK",
  "LATAR_BELAKANG",
  "PROFIL",
  "REAKSI",
  "HUKUM",
  "EKONOMI",
  "PROYEKSI",
] as const;

export type ActiveSorotanAngle = (typeof ACTIVE_SOROTAN_ANGLES)[number];

export const SOROTAN_ANGLE_COUNT = ACTIVE_SOROTAN_ANGLES.length;

export const SOROTAN_ANGLE_LABEL: Record<string, string> = {
  KRONOLOGI: "Kronologi",
  ANALISIS: "Analisis",
  DAMPAK: "Dampak",
  LATAR_BELAKANG: "Latar Belakang",
  PROFIL: "Profil Tokoh",
  REAKSI: "Reaksi",
  HUKUM: "Sudut Hukum",
  EKONOMI: "Sudut Ekonomi",
  PROYEKSI: "Proyeksi",
  FAQ: "Tanya Jawab",
};
