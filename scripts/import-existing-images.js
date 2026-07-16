/**
 * One-time script: register all images already in use on lensaplus.com
 * (article featured images, images embedded in article content, ad creatives,
 * poll covers, redaksi photos, user avatars) into the Media library so
 * they appear in the in-editor image picker gallery.
 *
 * Run on VPS: cd /var/www/lensaplus && node scripts/import-existing-images.js
 * Safe to run multiple times — skips URLs that are already registered.
 */
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

function extractImgSrcs(html) {
  if (!html) return [];
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

function filenameFromUrl(url) {
  try {
    const parsed = new URL(url, "https://lensaplus.com");
    const base = path.basename(parsed.pathname) || "image";
    return decodeURIComponent(base);
  } catch {
    return path.basename(url) || "image";
  }
}

async function statLocal(url) {
  if (!url.startsWith("/")) return 0;
  const full = path.join(process.cwd(), "public", url);
  try {
    const s = await fs.promises.stat(full);
    return s.size;
  } catch {
    return 0;
  }
}

function guessMime(url) {
  const low = url.toLowerCase().split("?")[0];
  if (low.endsWith(".png")) return "image/png";
  if (low.endsWith(".webp")) return "image/webp";
  if (low.endsWith(".gif")) return "image/gif";
  if (low.endsWith(".svg")) return "image/svg+xml";
  if (low.endsWith(".jpg") || low.endsWith(".jpeg")) return "image/jpeg";
  return "image/jpeg";
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
    select: { id: true, name: true },
  });
  if (!admin) {
    console.error("No SUPER_ADMIN user found. Aborting.");
    process.exit(1);
  }
  console.log(`Uploader for imported media: ${admin.name} (${admin.id})`);

  const urls = new Set();

  // Articles
  const articles = await prisma.article.findMany({
    select: { id: true, featuredImage: true, content: true },
  });
  for (const a of articles) {
    if (a.featuredImage && a.featuredImage.trim()) urls.add(a.featuredImage.trim());
    for (const src of extractImgSrcs(a.content)) {
      if (src.trim()) urls.add(src.trim());
    }
  }
  console.log(`Scanned ${articles.length} articles`);

  // Ads
  const ads = await prisma.ad.findMany({ select: { imageUrl: true, htmlCode: true } });
  for (const ad of ads) {
    if (ad.imageUrl && ad.imageUrl.trim()) urls.add(ad.imageUrl.trim());
    if (ad.htmlCode) for (const src of extractImgSrcs(ad.htmlCode)) urls.add(src.trim());
  }
  console.log(`Scanned ${ads.length} ads`);

  // Polls
  const polls = await prisma.poll.findMany({ select: { image: true } });
  for (const p of polls) if (p.image && p.image.trim()) urls.add(p.image.trim());
  console.log(`Scanned ${polls.length} polls`);

  // Redaksi
  const redaksi = await prisma.redaksiMember.findMany({ select: { photo: true } });
  for (const r of redaksi) if (r.photo && r.photo.trim()) urls.add(r.photo.trim());
  console.log(`Scanned ${redaksi.length} redaksi members`);

  // Users
  const users = await prisma.user.findMany({ select: { avatar: true } });
  for (const u of users) if (u.avatar && u.avatar.trim()) urls.add(u.avatar.trim());
  console.log(`Scanned ${users.length} users`);

  // Filter out data URIs and javascript: / clearly invalid
  const safe = [...urls].filter((u) => {
    if (!u) return false;
    if (u.startsWith("data:")) return false;
    if (u.startsWith("javascript:")) return false;
    return true;
  });
  console.log(`Total unique image URLs found: ${safe.length}`);

  // Existing Media URLs (dedup)
  const existing = await prisma.media.findMany({ select: { url: true } });
  const existingSet = new Set(existing.map((m) => m.url));
  console.log(`Already in Media table: ${existingSet.size}`);

  const toInsert = safe.filter((u) => !existingSet.has(u));
  console.log(`To import: ${toInsert.length}`);

  let ok = 0;
  let fail = 0;
  for (const url of toInsert) {
    const filename = filenameFromUrl(url);
    const size = await statLocal(url);
    const type = guessMime(url);
    try {
      await prisma.media.create({
        data: {
          filename,
          url,
          type,
          size,
          uploadedBy: admin.id,
          uploaderName: admin.name,
        },
      });
      ok++;
    } catch (e) {
      fail++;
      console.warn(`  ! ${url.slice(0, 80)}: ${e.message.split("\n")[0]}`);
    }
  }

  console.log(`\nDone. Imported ${ok} new media entries${fail ? ` (${fail} failed)` : ""}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
