const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

function mapErrorCode(code) {
  switch (code) {
    case 190:
      return "Access token expired or invalid (code 190). Regenerate a long-lived token.";
    case 100:
      return "Invalid parameter (code 100). Commonly: image_url not publicly reachable, or malformed caption.";
    case 368:
      return "Temporarily blocked by Meta spam filter (code 368). Reduce posting frequency.";
    case 10:
      return "Application does not have permission (code 10). Check Instagram API permissions.";
    case 200:
      return "Permission denied (code 200). The user/page may have revoked access.";
    default:
      return code ? `Meta Graph error code ${code}` : "Unknown Meta Graph error";
  }
}

async function graphRequest(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = body?.error;
    const prefix = mapErrorCode(err?.code);
    const detail = err?.message || text.slice(0, 200);
    throw new Error(`${prefix} — ${detail}`);
  }
  return body;
}

async function main() {
  console.log("==================================================");
  console.log("  Lensaplus — Pengujian Koneksi Instagram");
  console.log("==================================================");

  // 1. Load settings from database
  const igSettings = await prisma.instagramSettings.findUnique({
    where: { id: "global" },
  });

  if (!igSettings || !igSettings.accessToken || !igSettings.igUserId) {
    console.error("❌ ERROR: Pengaturan Instagram belum dikonfigurasi di database.");
    console.error("Pastikan Anda sudah mengisi Access Token dan IG User ID di panel admin.");
    process.exit(1);
  }

  const { accessToken, igUserId, enabled } = igSettings;
  console.log(`✅ Konfigurasi database ditemukan:`);
  console.log(`   - Status Integrasi: ${enabled ? "AKTIF (Enabled)" : "NON-AKTIF (Disabled)"}`);
  console.log(`   - IG User ID:       ${igUserId}`);
  console.log(`   - Access Token:     ${accessToken.slice(0, 8)}... (masked)`);

  // 2. Info about public URL
  console.log("\n📢 INFO PENTING:");
  console.log("Meta Graph API mewajibkan URL gambar dapat diakses oleh publik.");
  console.log("Jika Anda menjalankan ini secara lokal (localhost), kami akan menggunakan");
  console.log("gambar publik sampel dari Unsplash agar pengujian API tetap berhasil.");

  const testImageUrl = "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1080&q=80";
  const testCaption = "Pengujian posting otomatis Lensaplus ke Instagram Berhasil! ⚖️📰 #lensaplus #testpublish";

  console.log(`\n🚀 Memulai pengujian publikasi ke Instagram...`);
  console.log(`   - URL Gambar Pengujian: ${testImageUrl}`);
  console.log(`   - Caption:              "${testCaption}"`);

  try {
    // Langkah 1: Buat media container
    console.log("\n[1/2] Membuat container media di Meta...");
    const createUrl = `${GRAPH_BASE}/${encodeURIComponent(igUserId)}/media`;
    const createBody = new URLSearchParams({
      image_url: testImageUrl,
      caption: testCaption,
      access_token: accessToken,
    });
    
    const createRes = await graphRequest(createUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: createBody.toString(),
    });

    if (!createRes.id) {
      throw new Error("Langkah 1 gagal: Meta tidak mengembalikan ID Container.");
    }
    console.log(`      Container berhasil dibuat! ID Container: ${createRes.id}`);

    // Langkah 2: Publish media
    console.log("\n[2/2] Mempublikasikan media ke Feed Instagram...");
    const publishUrl = `${GRAPH_BASE}/${encodeURIComponent(igUserId)}/media_publish`;
    const publishBody = new URLSearchParams({
      creation_id: createRes.id,
      access_token: accessToken,
    });

    const publishRes = await graphRequest(publishUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: publishBody.toString(),
    });

    if (!publishRes.id) {
      throw new Error("Langkah 2 gagal: Meta tidak mengembalikan ID Media.");
    }

    console.log("\n==================================================");
    console.log(" 🎉 SELAMAT! PENGUJIAN INSTAGRAM BERHASIL!");
    console.log("==================================================");
    console.log(` ID Media Instagram: ${publishRes.id}`);
    console.log(" Postingan sudah aktif di Feed Instagram Anda.");
    console.log("==================================================");

  } catch (err) {
    console.error("\n❌ PENGUJIAN GAGAL!");
    console.error("==================================================");
    console.error(`Pesan Error: ${err.message}`);
    console.error("==================================================");
    console.error("\nTips Penyelesaian Masalah:");
    console.error("1. Code 190 (Token Expired/Invalid): Hubungkan ulang akun atau generate ulang long-lived token.");
    console.error("2. Code 10 (Permission): Pastikan token Anda memiliki izin 'instagram_basic' dan 'instagram_content_publish'.");
    console.error("3. Pastikan akun Instagram Anda bertipe 'Bisnis' (Bukan Kreator/Pribadi) dan terhubung dengan Facebook Page yang benar.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
