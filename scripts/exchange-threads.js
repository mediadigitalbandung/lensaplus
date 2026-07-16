/**
 * Threads API Exchange Utility Script.
 * 
 * Usage:
 *   1. Visit the authorization URL to grant permissions.
 *   2. Copy the 'code' parameter from the redirect URL.
 *   3. Run: node scripts/exchange-threads.js <code>
 */

const { PrismaClient } = require("@prisma/client");

const fs = require("fs");
const path = require("path");

// Load .env file manually
try {
  const envPath = path.join(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || "";
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    });
  }
} catch (e) {
  console.warn("Could not load .env file:", e);
}

const CLIENT_ID = process.env.THREADS_APP_ID || "4402452543382960";
const CLIENT_SECRET = process.env.THREADS_APP_SECRET || "8c98020e4904e3feae5fb9f0427123dd";
const REDIRECT_URI = "https://lensaplus.com/";

const prisma = new PrismaClient();

async function main() {
  const code = process.argv[2];

  if (!code) {
    console.log("\n=======================================================");
    console.log("             THREADS API CONNECTION HELPER");
    console.log("=======================================================\n");
    console.log("Langkah 1: Silakan buka URL berikut di browser Anda untuk otorisasi:\n");
    console.log(`https://threads.net/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=threads_basic,threads_content_publish&response_type=code\n`);
    console.log("Langkah 2: Setelah disetujui, Anda akan diarahkan ke halaman utama.");
    console.log("Salin nilai kode di parameter URL (?code=...) dan jalankan perintah:\n");
    console.log("  node scripts/exchange-threads.js <KODE_OTORISASI_ANDA>\n");
    process.exit(0);
  }

  console.log(`\n[1/3] Menukarkan kode otorisasi dengan short-lived token...`);
  try {
    const exchangeRes = await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
        code: code.trim(),
      }).toString(),
    });

    const exchangeJson = await exchangeRes.json();
    if (!exchangeRes.ok) {
      throw new Error(exchangeJson.error?.message || JSON.stringify(exchangeJson));
    }

    const shortLivedToken = exchangeJson.access_token;
    const threadsUserId = exchangeJson.user_id;

    console.log(`[2/3] Menukarkan dengan long-lived token (60 hari)...`);
    const longLivedUrl = `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${CLIENT_SECRET}&access_token=${shortLivedToken}`;
    const longLivedRes = await fetch(longLivedUrl, { method: "GET" });
    const longLivedJson = await longLivedRes.json();

    if (!longLivedRes.ok) {
      throw new Error(longLivedJson.error?.message || JSON.stringify(longLivedJson));
    }

    const longLivedToken = longLivedJson.access_token;
    const expiresInSeconds = longLivedJson.expires_in || 5184000; // default 60 days
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    console.log(`[3/3] Menyimpan kredensial Threads ke database...`);
    
    // Save to ThreadsSettings
    const updatedSettings = await prisma.threadsSettings.upsert({
      where: { id: "global" },
      update: {
        accessToken: longLivedToken,
        threadsUserId: String(threadsUserId),
        enabled: true,
        tokenExpiresAt: expiresAt,
      },
      create: {
        id: "global",
        accessToken: longLivedToken,
        threadsUserId: String(threadsUserId),
        enabled: true,
        tokenExpiresAt: expiresAt,
      },
    });

    // Also enable autoPublishThreads in global SocialMediaSettings
    await prisma.socialMediaSettings.upsert({
      where: { id: "global" },
      update: { autoPublishThreads: true },
      create: { id: "global", autoPublishThreads: true },
    });

    console.log("\n=======================================================");
    console.log("🚩 KONEKSI THREADS BERHASIL!");
    console.log("=======================================================");
    console.log(`- Threads User ID : ${updatedSettings.threadsUserId}`);
    console.log(`- Status Aktivasi : AKTIF & ENABLED`);
    console.log(`- Auto-Publish    : AKTIF`);
    console.log(`- Token Berlaku s/d: ${expiresAt.toLocaleString("id-ID")}`);
    console.log("=======================================================\n");

  } catch (err) {
    console.error("\n❌ Gagal menghubungkan Threads:", err.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
