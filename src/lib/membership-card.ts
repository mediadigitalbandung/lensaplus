/**
 * Membership card (KTA) image renderer.
 *
 * Composes a credit-card-ratio PNG (1012×638 ≈ standard ID 85.6×54mm @ ~300dpi)
 * with sharp + an SVG overlay: photo, QR verification code, KARTAWARTA branding,
 * member number, validity dates, status, and the two officials' signatures.
 * Mirrors the approach of the social story-card / reel-frame renderers.
 *
 * jspdf is used elsewhere only on the client; here we return the PNG buffer and
 * let the PDF route wrap it (jspdf works in Node too via the same API).
 */

import sharp from "sharp";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { roleLabelsMap } from "@/lib/roles";
import { effectiveStatus } from "@/lib/membership";

const W = 1012;
const H = 638;
const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";

const ALLOWED_IMG_HOSTS = new Set([
  (() => {
    try {
      return new URL(SITE).hostname;
    } catch {
      return "kartawarta.com";
    }
  })(),
  "kartawarta.com",
  "www.kartawarta.com",
  "images.unsplash.com",
  "145.79.15.99",
]);

function isAllowedHost(rawUrl: string): boolean {
  try {
    const h = new URL(rawUrl).hostname.toLowerCase();
    return ALLOWED_IMG_HOSTS.has(h) || h.endsWith(".kartawarta.com");
  } catch {
    return false;
  }
}

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Code 128 module-width patterns (index 0..106). Each entry is a string of
 * bar/space widths, alternating starting with a BAR. Indices 0–102 are data,
 * 104 = Start Code B, 106 = Stop. Standard canonical table.
 */
const CODE128_PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112",
];

/** Code 128-B value sequence (start + data + checksum + stop) for a string. */
function code128BValues(data: string): number[] {
  const START_B = 104, STOP = 106;
  const clean = data.replace(/[^\x20-\x7E]/g, "");
  const values = [START_B];
  let sum = START_B;
  for (let i = 0; i < clean.length; i++) {
    const v = clean.charCodeAt(i) - 32;
    values.push(v);
    sum += v * (i + 1);
  }
  values.push(sum % 103); // checksum
  values.push(STOP);
  return values;
}

/** Build SVG <rect> bars for a Code 128-B barcode fitted into the given box. */
function barcodeBars(data: string, x: number, y: number, totalWidth: number, height: number): string {
  const values = code128BValues(data);
  let totalModules = 0;
  for (const v of values) for (const ch of CODE128_PATTERNS[v]) totalModules += Number(ch);
  const mw = totalWidth / totalModules;
  let cursor = x;
  let rects = "";
  for (const v of values) {
    const pattern = CODE128_PATTERNS[v];
    for (let i = 0; i < pattern.length; i++) {
      const w = Number(pattern[i]) * mw;
      if (i % 2 === 0) {
        rects += `<rect x="${cursor.toFixed(2)}" y="${y}" width="${w.toFixed(2)}" height="${height}" fill="#001530"/>`;
      }
      cursor += w;
    }
  }
  return rects;
}

/** Greedy word-wrap into lines of at most maxChars characters. */
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (!line) line = w;
    else if ((line + " " + w).length <= maxChars) line += " " + w;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Load a local (/uploads or public) or allowlisted-remote image → resized Buffer.
 * fit "contain" pads to EXACTLY w×h with transparent margins so a non-square
 * logo ends up centred inside its badge (avoids the off-centre look). */
async function loadImage(src: string | null | undefined, w: number, h: number, fit: "cover" | "inside" | "contain" = "cover"): Promise<Buffer | null> {
  if (!src) return null;
  try {
    let buf: Buffer | null = null;
    if (/^https?:\/\//i.test(src)) {
      if (!isAllowedHost(src)) {
        // Still allow same-origin /uploads served via the canonical domain.
        if (!src.startsWith(SITE)) return null;
      }
      const res = await fetch(src, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return null;
      buf = Buffer.from(await res.arrayBuffer());
    } else {
      const { default: fs } = await import("fs/promises");
      const { default: path } = await import("path");
      const rel = src.replace(/^\/+/, "");
      const local = rel.startsWith("public/") ? path.join(process.cwd(), rel) : path.join(process.cwd(), "public", rel);
      buf = await fs.readFile(local);
    }
    if (!buf) return null;
    return await sharp(buf)
      .resize(w, h, { fit, position: "centre", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

function fmtDate(d: Date | null): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(d);
}

export interface CardRenderInput {
  number: string;
  holderName: string;
  role: string; // human label, e.g. "Jurnalis"
  status: string; // effective status
  issuedAt: Date | null;
  expiresAt: Date | null;
  photoUrl: string | null;
  // org/branding (from settings)
  directorName: string;
  directorSignature: string | null;
  pwiChairmanName: string;
  pwiChairmanSignature: string | null;
  cardLogo: string | null;
  /** Dewan Pers verification certificate number (printed on the card). */
  dewanPersNumber?: string;
  /** Dewan Pers logo image URL (optional — shown next to the verification text). */
  dewanPersLogo?: string | null;
  /** Blood type (golongan darah) — printed on the front when set. */
  bloodType?: string | null;
  /** Place of issue, e.g. "Bandung" — printed as "Diterbitkan di …". */
  issuePlace?: string;
  verifyUrl: string; // encoded into the QR
}

/** Kartawarta's Dewan Pers verification number (matches the site footer). */
const DEFAULT_DEWAN_PERS = "608/DP-Verifikasi/K/XI/2020";
/** Fallback logo so the card always shows branding even before an admin uploads one. */
const DEFAULT_LOGO = "/kartawarta-icon.png";
/** Press designation printed on every card — uniform "Jurnalis" regardless of the
 * holder's internal system role (a press card shouldn't read "Super Admin"). */
const CARD_DESIGNATION = "Jurnalis";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "#1a7f37",
  PENDING: "#9a6700",
  DRAFT: "#57606a",
  SUSPENDED: "#b7102a",
  REVOKED: "#b7102a",
  EXPIRED: "#b7102a",
};

const STATUS_TEXT: Record<string, string> = {
  ACTIVE: "AKTIF",
  PENDING: "MENUNGGU VERIFIKASI",
  DRAFT: "BELUM TERBIT",
  SUSPENDED: "DITANGGUHKAN",
  REVOKED: "DICABUT",
  EXPIRED: "KEDALUWARSA",
};

/** Render the front of the card as a PNG buffer. */
export async function renderMembershipCard(input: CardRenderInput): Promise<Buffer> {
  const [photo, qrBuf, logo, dirSig, pwiSig] = await Promise.all([
    loadImage(input.photoUrl, 260, 320, "cover"),
    QRCode.toBuffer(input.verifyUrl, { width: 200, margin: 1, errorCorrectionLevel: "M" }).catch(() => null),
    loadImage(input.cardLogo, 78, 78, "contain"),
    loadImage(input.directorSignature, 190, 80, "inside"),
    loadImage(input.pwiChairmanSignature, 190, 80, "inside"),
  ]);

  const statusColor = STATUS_COLOR[input.status] || "#57606a";
  const statusText = STATUS_TEXT[input.status] || input.status;
  const issuePlace = input.issuePlace || "Bandung";

  // Layout regions. Images and text occupy DISJOINT areas, so we can draw the
  // SVG (background + frames + all text) first and composite the photo/QR/logo/
  // signatures on top without hiding any text. The QR sits in the far-right
  // column; the two signatures share the middle-bottom band to its left so they
  // never overlap.
  const PHOTO_X = 56, PHOTO_Y = 168, PHOTO_W = 260, PHOTO_H = 320;
  const QR = 156, QR_X = W - QR - 50, QR_Y = H - QR - 66;
  const SIG_X1 = PHOTO_X + 300, SIG_X2 = SIG_X1 + 220, SIG_W = 190, SIG_Y = H - 150;
  const qr = qrBuf ? await sharp(qrBuf).resize(QR, QR).png().toBuffer() : null;

  const fields = [
    { label: "Nama", value: input.holderName || "-" },
    { label: "Jabatan", value: CARD_DESIGNATION },
    { label: "No. Anggota", value: input.number },
    { label: "Berlaku", value: `${fmtDate(input.issuedAt)} s/d ${fmtDate(input.expiresAt)}` },
    ...(input.bloodType ? [{ label: "Gol. Darah", value: input.bloodType }] : []),
  ];
  const FIELD_X = PHOTO_X + 300;
  let fy = 210;
  const fieldSvg = fields
    .map((f) => {
      const block = `
        <text x="${FIELD_X}" y="${fy}" font-family="'Work Sans','Helvetica',sans-serif" font-size="18" fill="#5d6066" letter-spacing="1">${escapeXml(f.label.toUpperCase())}</text>
        <text x="${FIELD_X}" y="${fy + 30}" font-family="'Newsreader','Georgia',serif" font-size="28" font-weight="700" fill="#001530">${escapeXml(f.value)}</text>`;
      fy += 72;
      return block;
    })
    .join("");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#eef2f7"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" rx="28" fill="url(#bg)"/>
  <rect x="0" y="0" width="${W}" height="${H}" rx="28" fill="none" stroke="#c4c6d0" stroke-width="2"/>
  <!-- Header bar -->
  <path d="M0,28 Q0,0 28,0 L${W - 28},0 Q${W},0 ${W},28 L${W},132 L0,132 Z" fill="#001530"/>
  <!-- White badge so a coloured logo stays visible on the navy header -->
  ${logo ? `<rect x="40" y="18" width="98" height="98" rx="16" fill="#ffffff"/>` : ""}
  <text x="180" y="58" font-family="'Newsreader','Georgia',serif" font-size="40" font-weight="800" fill="#ffffff" letter-spacing="1">KARTAWARTA</text>
  <text x="182" y="92" font-family="'Work Sans','Helvetica',sans-serif" font-size="19" fill="#9fb2c9" letter-spacing="3">KARTU TANDA ANGGOTA PERS</text>
  <rect x="40" y="158" width="6" height="${H - 230}" fill="#b7102a"/>
  <!-- Photo frame -->
  <rect x="${PHOTO_X - 4}" y="${PHOTO_Y - 4}" width="${PHOTO_W + 8}" height="${PHOTO_H + 8}" rx="8" fill="none" stroke="#c4c6d0" stroke-width="2"/>
  ${!photo ? `<rect x="${PHOTO_X}" y="${PHOTO_Y}" width="${PHOTO_W}" height="${PHOTO_H}" rx="6" fill="#e8eaeb"/><text x="${PHOTO_X + PHOTO_W / 2}" y="${PHOTO_Y + PHOTO_H / 2}" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#9aa0a6">FOTO</text>` : ""}
  <!-- Issue place & date (under the photo, once the card is issued) -->
  ${input.issuedAt ? `<text x="${PHOTO_X + PHOTO_W / 2}" y="536" text-anchor="middle" font-family="'Work Sans','Helvetica',sans-serif" font-size="14" fill="#5d6066">Diterbitkan di ${escapeXml(issuePlace)},</text><text x="${PHOTO_X + PHOTO_W / 2}" y="560" text-anchor="middle" font-family="'Work Sans','Helvetica',sans-serif" font-size="15" font-weight="700" fill="#001530">${escapeXml(fmtDate(input.issuedAt))}</text>` : ""}
  <!-- Status pill -->
  <rect x="${FIELD_X}" y="150" rx="6" width="${statusText.length * 11 + 40}" height="34" fill="${statusColor}"/>
  <text x="${FIELD_X + 16}" y="173" font-family="'Work Sans','Helvetica',sans-serif" font-size="18" font-weight="700" fill="#ffffff" letter-spacing="1">${escapeXml(statusText)}</text>
  ${fieldSvg}
  <!-- Signature labels (two columns to the left of the QR) -->
  <line x1="${SIG_X1}" y1="${H - 56}" x2="${SIG_X1 + SIG_W}" y2="${H - 56}" stroke="#c4c6d0" stroke-width="1.5"/>
  <text x="${SIG_X1}" y="${H - 34}" font-family="'Work Sans','Helvetica',sans-serif" font-size="14" fill="#5d6066">Ketua Umum PWI Pusat</text>
  <text x="${SIG_X1}" y="${H - 13}" font-family="'Work Sans','Helvetica',sans-serif" font-size="16" font-weight="700" fill="#001530">${escapeXml(input.pwiChairmanName || "-")}</text>
  <line x1="${SIG_X2}" y1="${H - 56}" x2="${SIG_X2 + SIG_W}" y2="${H - 56}" stroke="#c4c6d0" stroke-width="1.5"/>
  <text x="${SIG_X2}" y="${H - 34}" font-family="'Work Sans','Helvetica',sans-serif" font-size="14" fill="#5d6066">Direktur Kartawarta</text>
  <text x="${SIG_X2}" y="${H - 13}" font-family="'Work Sans','Helvetica',sans-serif" font-size="16" font-weight="700" fill="#001530">${escapeXml(input.directorName || "-")}</text>
  <!-- QR caption -->
  <text x="${QR_X + QR / 2}" y="${QR_Y + QR + 22}" text-anchor="middle" font-family="'Work Sans','Helvetica',sans-serif" font-size="13" fill="#5d6066">Pindai untuk verifikasi</text>
</svg>`;

  const overlays: sharp.OverlayOptions[] = [
    { input: Buffer.from(svg), left: 0, top: 0 }, // background + frames + all text
  ];
  if (photo) overlays.push({ input: photo, left: PHOTO_X, top: PHOTO_Y });
  if (qr) overlays.push({ input: qr, left: QR_X, top: QR_Y });
  if (logo) overlays.push({ input: logo, left: 50, top: 28 });
  if (pwiSig) overlays.push({ input: pwiSig, left: SIG_X1, top: SIG_Y });
  if (dirSig) overlays.push({ input: dirSig, left: SIG_X2, top: SIG_Y });

  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite(overlays)
    .png()
    .toBuffer();
}

/** Cardholder terms printed on the back of the KTA. */
const CARD_TERMS = [
  "Kartu ini merupakan identitas resmi pemegangnya sebagai anggota pers (jurnalis) Kartawarta.",
  "Pemegang menjalankan tugas jurnalistik sesuai UU No. 40 Tahun 1999 tentang Pers dan Kode Etik Jurnalistik.",
  "Kartu ini tidak dapat dipindahtangankan dan hanya berlaku bagi pemegang yang namanya tertera.",
  "Kartu berlaku sampai tanggal yang tertera pada sisi depan dan dapat diperpanjang.",
  "Bila masa berlaku berakhir atau keanggotaan dicabut, kartu wajib dikembalikan kepada Redaksi.",
];

const RETURN_EMAIL = "admin@kartawarta.com";

/** Render the BACK of the card (terms + return notice + Code 128 barcode) as a PNG buffer. */
export async function renderMembershipCardBack(input: CardRenderInput): Promise<Buffer> {
  const logo = await loadImage(input.cardLogo, 68, 68, "contain");
  const dewanPers = input.dewanPersNumber || DEFAULT_DEWAN_PERS;

  const PAD = 64;
  const TXT_X = PAD + 34;
  const MAXC = 86;

  // Numbered terms (word-wrapped).
  let y = 190;
  const termSvg = CARD_TERMS.map((t, i) => {
    const lines = wrapText(t, MAXC);
    let block = `<text x="${PAD}" y="${y}" font-family="'Newsreader','Georgia',serif" font-size="20" font-weight="800" fill="#b7102a">${i + 1}.</text>`;
    for (const ln of lines) {
      block += `<text x="${TXT_X}" y="${y}" font-family="'Work Sans','Helvetica',sans-serif" font-size="18" fill="#33373d">${escapeXml(ln)}</text>`;
      y += 26;
    }
    y += 10;
    return block;
  }).join("");

  // Barcode (bottom-left) + caption.
  const BAR_W = 360, BAR_H = 64, BAR_X = PAD, BAR_Y = H - 132;
  const bars = barcodeBars(input.number, BAR_X, BAR_Y, BAR_W, BAR_H);
  const siteHost = (() => {
    try { return new URL(SITE).hostname.replace(/^www\./, ""); } catch { return "kartawarta.com"; }
  })();

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bgb" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#eef2f7"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" rx="28" fill="url(#bgb)"/>
  <rect x="0" y="0" width="${W}" height="${H}" rx="28" fill="none" stroke="#c4c6d0" stroke-width="2"/>
  <!-- Header bar -->
  <path d="M0,28 Q0,0 28,0 L${W - 28},0 Q${W},0 ${W},28 L${W},120 L0,120 Z" fill="#001530"/>
  ${logo ? `<rect x="52" y="12" width="84" height="84" rx="12" fill="#ffffff"/>` : ""}
  <text x="${logo ? 160 : PAD}" y="52" font-family="'Newsreader','Georgia',serif" font-size="34" font-weight="800" fill="#ffffff" letter-spacing="1">KARTAWARTA</text>
  <text x="${logo ? 162 : PAD + 2}" y="84" font-family="'Work Sans','Helvetica',sans-serif" font-size="17" fill="#9fb2c9" letter-spacing="2">SYARAT &amp; KETENTUAN PEMEGANG KARTU</text>
  <text x="${W - PAD}" y="60" text-anchor="end" font-family="'Work Sans','Helvetica',sans-serif" font-size="22" font-weight="700" fill="#ffffff" letter-spacing="1">${escapeXml(input.number)}</text>
  <text x="${W - PAD}" y="86" text-anchor="end" font-family="'Work Sans','Helvetica',sans-serif" font-size="14" fill="#9fb2c9">No. Anggota</text>
  <rect x="${PAD - 24}" y="146" width="6" height="${H - 280}" fill="#b7102a"/>
  ${termSvg}
  <!-- Return notice + contact (right) -->
  <line x1="${PAD}" y1="${H - 158}" x2="${W - PAD}" y2="${H - 158}" stroke="#dfe1e6" stroke-width="1.5"/>
  <text x="${W - PAD}" y="${H - 126}" text-anchor="end" font-family="'Work Sans','Helvetica',sans-serif" font-size="15" fill="#5d6066">Jika ditemukan, mohon kembalikan ke Redaksi Kartawarta:</text>
  <text x="${W - PAD}" y="${H - 102}" text-anchor="end" font-family="'Work Sans','Helvetica',sans-serif" font-size="17" font-weight="700" fill="#001530">${RETURN_EMAIL} &#8226; ${escapeXml(siteHost)}</text>
  <text x="${W - PAD}" y="${H - 60}" text-anchor="end" font-family="'Work Sans','Helvetica',sans-serif" font-size="14" fill="#74777f">Verifikasi keaslian: ${escapeXml(siteHost)}/verifikasi/${escapeXml(input.number)}</text>
  <text x="${W - PAD}" y="${H - 36}" text-anchor="end" font-family="'Work Sans','Helvetica',sans-serif" font-size="14" font-weight="700" fill="#001530">Terverifikasi Dewan Pers &#183; No. ${escapeXml(dewanPers)}</text>
  <!-- Barcode -->
  ${bars}
  <text x="${BAR_X + BAR_W / 2}" y="${BAR_Y + BAR_H + 22}" text-anchor="middle" font-family="'Work Sans','Helvetica',sans-serif" font-size="16" font-weight="600" letter-spacing="2" fill="#001530">${escapeXml(input.number)}</text>
</svg>`;

  const overlays: sharp.OverlayOptions[] = [{ input: Buffer.from(svg), left: 0, top: 0 }];
  if (logo) overlays.push({ input: logo, left: 60, top: 20 });

  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite(overlays)
    .png()
    .toBuffer();
}

export const CARD_WIDTH = W;
export const CARD_HEIGHT = H;

// ── Lanyard (portrait ID card for a neck strap) ───────────────────────────
const LW = 648;
const LH = 1024;
export const LANYARD_WIDTH = LW;
export const LANYARD_HEIGHT = LH;

/** Render the FRONT of the portrait lanyard card as a PNG buffer. */
export async function renderLanyardFront(input: CardRenderInput): Promise<Buffer> {
  const [photo, qrBuf, logo, dpLogo] = await Promise.all([
    loadImage(input.photoUrl, 300, 330, "cover"),
    QRCode.toBuffer(input.verifyUrl, { width: 220, margin: 1, errorCorrectionLevel: "M" }).catch(() => null),
    loadImage(input.cardLogo, 84, 84, "contain"),
    loadImage(input.dewanPersLogo, 60, 60, "contain"),
  ]);
  const statusColor = STATUS_COLOR[input.status] || "#57606a";
  const statusText = STATUS_TEXT[input.status] || input.status;
  const dewanPers = input.dewanPersNumber || DEFAULT_DEWAN_PERS;
  const cx = LW / 2;

  const PHOTO_W = 300, PHOTO_H = 330, PHOTO_X = (LW - PHOTO_W) / 2, PHOTO_Y = 258;
  const QRS = 120, QR_X = Math.round((LW - QRS) / 2), QR_Y = 782;
  const qr = qrBuf ? await sharp(qrBuf).resize(QRS, QRS).png().toBuffer() : null;
  const pillW = statusText.length * 11 + 40;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${LW}" height="${LH}" viewBox="0 0 ${LW} ${LH}">
  <defs><linearGradient id="lf" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#eef2f7"/></linearGradient></defs>
  <rect x="0" y="0" width="${LW}" height="${LH}" rx="28" fill="url(#lf)"/>
  <rect x="0" y="0" width="${LW}" height="${LH}" rx="28" fill="none" stroke="#c4c6d0" stroke-width="2"/>
  <path d="M0,28 Q0,0 28,0 L${LW - 28},0 Q${LW},0 ${LW},28 L${LW},222 L0,222 Z" fill="#001530"/>
  <rect x="${cx - 70}" y="30" width="140" height="16" rx="8" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.5"/>
  ${logo ? `<rect x="${cx - 46}" y="62" width="92" height="92" rx="16" fill="#ffffff"/>` : ""}
  ${dpLogo ? `<rect x="${LW - 100}" y="50" width="80" height="80" rx="12" fill="#ffffff"/>` : ""}
  <text x="${cx}" y="190" text-anchor="middle" font-family="'Newsreader','Georgia',serif" font-size="32" font-weight="800" fill="#ffffff" letter-spacing="1">KARTAWARTA</text>
  <text x="${cx}" y="214" text-anchor="middle" font-family="'Work Sans','Helvetica',sans-serif" font-size="13" fill="#9fb2c9" letter-spacing="2">KARTU TANDA ANGGOTA PERS</text>
  <rect x="${PHOTO_X - 4}" y="${PHOTO_Y - 4}" width="${PHOTO_W + 8}" height="${PHOTO_H + 8}" rx="10" fill="none" stroke="#c4c6d0" stroke-width="2"/>
  ${!photo ? `<rect x="${PHOTO_X}" y="${PHOTO_Y}" width="${PHOTO_W}" height="${PHOTO_H}" rx="8" fill="#e8eaeb"/><text x="${cx}" y="${PHOTO_Y + PHOTO_H / 2}" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#9aa0a6">FOTO</text>` : ""}
  <rect x="${cx - pillW / 2}" y="604" width="${pillW}" height="34" rx="17" fill="${statusColor}"/>
  <text x="${cx}" y="627" text-anchor="middle" font-family="'Work Sans','Helvetica',sans-serif" font-size="17" font-weight="700" fill="#ffffff" letter-spacing="1">${escapeXml(statusText)}</text>
  <text x="${cx}" y="678" text-anchor="middle" font-family="'Newsreader','Georgia',serif" font-size="32" font-weight="800" fill="#001530">${escapeXml(input.holderName || "-")}</text>
  <text x="${cx}" y="708" text-anchor="middle" font-family="'Work Sans','Helvetica',sans-serif" font-size="20" fill="#44474e">${escapeXml(CARD_DESIGNATION)}</text>
  <text x="${cx}" y="736" text-anchor="middle" font-family="'Work Sans','Helvetica',sans-serif" font-size="17" font-weight="700" fill="#001530" letter-spacing="1">${escapeXml(input.number)}</text>
  <text x="${cx}" y="762" text-anchor="middle" font-family="'Work Sans','Helvetica',sans-serif" font-size="14" fill="#5d6066">Berlaku s/d ${escapeXml(fmtDate(input.expiresAt))}</text>
  <text x="${cx}" y="${QR_Y + QRS + 24}" text-anchor="middle" font-family="'Work Sans','Helvetica',sans-serif" font-size="14" fill="#5d6066">Pindai untuk verifikasi</text>
  <path d="M0,940 L${LW},940 L${LW},${LH - 28} Q${LW},${LH} ${LW - 28},${LH} L28,${LH} Q0,${LH} 0,${LH - 28} Z" fill="#001530"/>
  <text x="${cx}" y="972" text-anchor="middle" font-family="'Work Sans','Helvetica',sans-serif" font-size="16" font-weight="700" fill="#ffffff" letter-spacing="0.5">TERVERIFIKASI DEWAN PERS</text>
  <text x="${cx}" y="996" text-anchor="middle" font-family="'Work Sans','Helvetica',sans-serif" font-size="13" fill="#9fb2c9">No. ${escapeXml(dewanPers)}</text>
</svg>`;

  const overlays: sharp.OverlayOptions[] = [{ input: Buffer.from(svg), left: 0, top: 0 }];
  if (photo) overlays.push({ input: photo, left: PHOTO_X, top: PHOTO_Y });
  if (qr) overlays.push({ input: qr, left: QR_X, top: QR_Y });
  if (logo) overlays.push({ input: logo, left: cx - 42, top: 66 });
  if (dpLogo) overlays.push({ input: dpLogo, left: LW - 90, top: 60 });

  return sharp({ create: { width: LW, height: LH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite(overlays).png().toBuffer();
}

/** Render the BACK of the portrait lanyard card as a PNG buffer. */
export async function renderLanyardBack(input: CardRenderInput): Promise<Buffer> {
  const logo = await loadImage(input.cardLogo, 64, 64, "contain");
  const dewanPers = input.dewanPersNumber || DEFAULT_DEWAN_PERS;
  const siteHost = (() => {
    try { return new URL(SITE).hostname.replace(/^www\./, ""); } catch { return "kartawarta.com"; }
  })();

  // Terms (word-wrapped, narrower than the landscape card).
  let y = 226;
  const termSvg = CARD_TERMS.map((t, i) => {
    const lines = wrapText(t, 52);
    let block = `<text x="36" y="${y}" font-family="'Newsreader','Georgia',serif" font-size="18" font-weight="800" fill="#b7102a">${i + 1}.</text>`;
    for (const ln of lines) {
      block += `<text x="66" y="${y}" font-family="'Work Sans','Helvetica',sans-serif" font-size="16" fill="#33373d">${escapeXml(ln)}</text>`;
      y += 24;
    }
    y += 10;
    return block;
  }).join("");

  const BAR_W = 380, BAR_H = 60, BAR_X = (LW - BAR_W) / 2, BAR_Y = LH - 130;
  const bars = barcodeBars(input.number, BAR_X, BAR_Y, BAR_W, BAR_H);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${LW}" height="${LH}" viewBox="0 0 ${LW} ${LH}">
  <defs><linearGradient id="lb" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#eef2f7"/></linearGradient></defs>
  <rect x="0" y="0" width="${LW}" height="${LH}" rx="28" fill="url(#lb)"/>
  <rect x="0" y="0" width="${LW}" height="${LH}" rx="28" fill="none" stroke="#c4c6d0" stroke-width="2"/>
  <path d="M0,28 Q0,0 28,0 L${LW - 28},0 Q${LW},0 ${LW},28 L${LW},156 L0,156 Z" fill="#001530"/>
  <rect x="${LW / 2 - 70}" y="26" width="140" height="14" rx="7" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.5"/>
  ${logo ? `<rect x="32" y="58" width="72" height="72" rx="12" fill="#ffffff"/>` : ""}
  <text x="${logo ? 122 : 36}" y="92" font-family="'Newsreader','Georgia',serif" font-size="28" font-weight="800" fill="#ffffff" letter-spacing="1">KARTAWARTA</text>
  <text x="${logo ? 124 : 38}" y="120" font-family="'Work Sans','Helvetica',sans-serif" font-size="12" fill="#9fb2c9" letter-spacing="1">SYARAT &amp; KETENTUAN PEMEGANG KARTU</text>
  <text x="${LW - 32}" y="92" text-anchor="end" font-family="'Work Sans','Helvetica',sans-serif" font-size="18" font-weight="700" fill="#ffffff">${escapeXml(input.number)}</text>
  <rect x="16" y="180" width="6" height="${y - 180}" fill="#b7102a"/>
  ${termSvg}
  <line x1="36" y1="${y + 8}" x2="${LW - 36}" y2="${y + 8}" stroke="#dfe1e6" stroke-width="1.5"/>
  <text x="36" y="${y + 40}" font-family="'Work Sans','Helvetica',sans-serif" font-size="14" fill="#5d6066">Jika ditemukan, kembalikan ke Redaksi Kartawarta:</text>
  <text x="36" y="${y + 66}" font-family="'Work Sans','Helvetica',sans-serif" font-size="16" font-weight="700" fill="#001530">${RETURN_EMAIL} &#8226; ${escapeXml(siteHost)}</text>
  <text x="36" y="${y + 96}" font-family="'Work Sans','Helvetica',sans-serif" font-size="14" font-weight="700" fill="#001530">Terverifikasi Dewan Pers &#183; No. ${escapeXml(dewanPers)}</text>
  <text x="36" y="${y + 120}" font-family="'Work Sans','Helvetica',sans-serif" font-size="13" fill="#74777f">Verifikasi: ${escapeXml(siteHost)}/verifikasi/${escapeXml(input.number)}</text>
  ${bars}
  <text x="${BAR_X + BAR_W / 2}" y="${BAR_Y + BAR_H + 22}" text-anchor="middle" font-family="'Work Sans','Helvetica',sans-serif" font-size="16" font-weight="600" letter-spacing="2" fill="#001530">${escapeXml(input.number)}</text>
</svg>`;

  const overlays: sharp.OverlayOptions[] = [{ input: Buffer.from(svg), left: 0, top: 0 }];
  if (logo) overlays.push({ input: logo, left: 36, top: 62 });

  return sharp({ create: { width: LW, height: LH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite(overlays).png().toBuffer();
}

/**
 * Assemble CardRenderInput for a user's card by joining the card row, the user,
 * and the org settings (director/PWI names + signatures + logo). Returns null if
 * the user has no card. Used by the render/PDF/verify routes.
 */
export async function loadCardRenderInput(userId: string): Promise<CardRenderInput | null> {
  const card = await prisma.membershipCard.findUnique({
    where: { userId },
    include: { user: { select: { name: true, role: true, avatar: true } } },
  });
  if (!card) return null;

  const keys = [
    "kta_director_name",
    "kta_director_signature",
    "kta_pwi_chairman_name",
    "kta_pwi_chairman_signature",
    "kta_card_logo",
    "kta_dewan_pers_number",
    "kta_dewan_pers_logo",
    "kta_issue_place",
  ];
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: keys } } });
  const s: Record<string, string> = {};
  for (const r of rows) s[r.key] = r.value;

  return {
    number: card.number,
    holderName: card.holderName || card.user.name,
    role: roleLabelsMap[card.user.role] || card.user.role,
    status: effectiveStatus(card),
    issuedAt: card.issuedAt,
    expiresAt: card.expiresAt,
    photoUrl: card.holderPhoto || card.user.avatar,
    directorName: s.kta_director_name || "",
    directorSignature: s.kta_director_signature || null,
    pwiChairmanName: s.kta_pwi_chairman_name || "",
    pwiChairmanSignature: s.kta_pwi_chairman_signature || null,
    cardLogo: s.kta_card_logo || DEFAULT_LOGO,
    dewanPersNumber: s.kta_dewan_pers_number || DEFAULT_DEWAN_PERS,
    dewanPersLogo: s.kta_dewan_pers_logo || null,
    bloodType: card.bloodType || null,
    issuePlace: s.kta_issue_place || "Bandung",
    verifyUrl: `${SITE.replace(/\/+$/, "")}/verifikasi/${encodeURIComponent(card.number)}`,
  };
}
