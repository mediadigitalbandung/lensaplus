#!/usr/bin/env node
/**
 * Generate Google Play Store assets dari logo + brand colors.
 *
 * Outputs to /twa/playstore-assets/:
 *   icon-512.png            512×512 — required oleh Play Store (high-res icon)
 *   feature-graphic.png     1024×500 — required (banner di store listing)
 *   phone-screenshot-1.png  1080×1920 — placeholder (Anda ganti dengan screenshot asli)
 *   phone-screenshot-2.png  1080×1920 — placeholder
 *
 * Untuk screenshot, jangan pakai placeholder produksi — bikin actual
 * screenshot dari device atau Chrome DevTools mobile mode (lebih bagus
 * dari yang AI-generated).
 */

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOGO = join(ROOT, "public", "lensaplus-icon.png");
const OUT = join(ROOT, "twa", "playstore-assets");
const NAVY = "#002045";
const NAVY_DARK = "#001530";

await mkdir(OUT, { recursive: true });

// ── 1. High-res icon 512×512 (required) ────────────────────────────────────
const iconBuf = await sharp(LOGO)
  .resize(Math.round(512 * 0.78), Math.round(512 * 0.78), {
    fit: "contain",
    background: { r: 255, g: 255, b: 255, alpha: 0 },
  })
  .toBuffer();
const iconOffset = Math.round((512 - Math.round(512 * 0.78)) / 2);
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#ffffff" },
})
  .composite([{ input: iconBuf, top: iconOffset, left: iconOffset }])
  .png({ compressionLevel: 9 })
  .toFile(join(OUT, "icon-512.png"));
console.log(`✓ ${join(OUT, "icon-512.png")}`);

// ── 2. Feature graphic 1024×500 (required) ─────────────────────────────────
// Strategy: navy gradient background + logo on left + tagline text on right.
// Pakai SVG composite biar text crisp.
const tagline = `
  <svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${NAVY}" />
        <stop offset="100%" stop-color="${NAVY_DARK}" />
      </linearGradient>
    </defs>
    <rect width="1024" height="500" fill="url(#g)" />
    <text x="380" y="200" font-family="Georgia, serif" font-size="64" font-weight="800" fill="#ffffff">
      Lensaplus
    </text>
    <text x="380" y="260" font-family="Arial, sans-serif" font-size="22" font-weight="500" fill="#c9d3e6" letter-spacing="1.5">
      MEDIA BERITA DIGITAL BANDUNG
    </text>
    <text x="380" y="330" font-family="Arial, sans-serif" font-size="18" fill="#94a8c4">
      Bisnis · Ekonomi · Hukum · Politik · Olahraga
    </text>
    <text x="380" y="360" font-family="Arial, sans-serif" font-size="18" fill="#94a8c4">
      Hiburan · Teknologi · Kesehatan · Pendidikan
    </text>
    <text x="380" y="430" font-family="Arial, sans-serif" font-size="14" fill="#5a7099" letter-spacing="2">
      TERVERIFIKASI DEWAN PERS
    </text>
  </svg>
`;
const logoCircle = await sharp(LOGO)
  .resize(220, 220, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
  .toBuffer();
await sharp(Buffer.from(tagline))
  .composite([{ input: logoCircle, top: 140, left: 110 }])
  .png({ compressionLevel: 9 })
  .toFile(join(OUT, "feature-graphic.png"));
console.log(`✓ ${join(OUT, "feature-graphic.png")}`);

// ── 3. Placeholder screenshot 1080×1920 portrait (you should replace) ────
for (let i = 1; i <= 2; i++) {
  const placeholder = `
    <svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
      <rect width="1080" height="1920" fill="#f8f9fa" />
      <rect width="1080" height="120" fill="${NAVY}" />
      <text x="540" y="80" text-anchor="middle" font-family="Georgia, serif" font-size="42" font-weight="800" fill="#ffffff">
        Lensaplus
      </text>
      <text x="540" y="960" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="#74777f">
        Screenshot Placeholder ${i}
      </text>
      <text x="540" y="1010" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#94a8c4">
        Ganti dengan screenshot asli dari device
      </text>
    </svg>
  `;
  await sharp(Buffer.from(placeholder))
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, `phone-screenshot-${i}.png`));
  console.log(`✓ ${join(OUT, `phone-screenshot-${i}.png`)} (placeholder)`);
}

console.log("\nDone. Required Play Store assets generated.");
console.log("\nNext: Replace phone-screenshot-*.png dengan screenshot asli dari device.");
console.log("Cara: Buka lensaplus.com di Chrome mobile, screenshot, save 1080×1920.");
