// Seed self-promotional ads for Lensaplus
// Run: node scripts/seed-ads.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const now = new Date();
const endDate = new Date(now.getFullYear() + 1, 11, 31);

const ads = [
  // HEADER — Leaderboard 728x90
  {
    name: "Lensaplus — Pasang Iklan Header",
    type: "HTML",
    slot: "HEADER",
    htmlCode: `<div style="width:100%;max-width:728px;height:90px;margin:0 auto;background:linear-gradient(135deg,#002045,#1a3a5c);border-radius:6px;display:flex;align-items:center;justify-content:space-between;padding:0 32px;font-family:system-ui,sans-serif;overflow:hidden;position:relative">
      <div style="position:absolute;right:-20px;top:-20px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,0.03)"></div>
      <div style="z-index:1">
        <div style="color:#fff;font-size:18px;font-weight:800;letter-spacing:-0.5px">Iklan Anda Bisa Tampil di Sini</div>
        <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:2px">Jangkau ribuan pembaca Lensaplus setiap hari</div>
      </div>
      <div style="background:#fff;color:#002045;font-size:13px;font-weight:700;padding:8px 20px;border-radius:4px;z-index:1">Pasang Iklan →</div>
    </div>`,
    targetUrl: "/kontak",
    priority: 10,
  },

  // SIDEBAR — Rectangle 300x250
  {
    name: "Lensaplus — Newsletter Sidebar",
    type: "HTML",
    slot: "SIDEBAR",
    htmlCode: `<div style="width:100%;max-width:300px;height:250px;background:linear-gradient(135deg,#002045 0%,#1a3a5c 100%);border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif;text-align:center;position:relative;overflow:hidden">
      <div style="position:absolute;left:-30px;bottom:-30px;width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,0.04)"></div>
      <div style="font-size:32px;margin-bottom:12px">📰</div>
      <div style="color:#fff;font-size:16px;font-weight:800;line-height:1.3">Dapatkan Berita<br>Terbaru Setiap Hari</div>
      <div style="color:rgba(255,255,255,0.5);font-size:11px;margin-top:8px;line-height:1.4">Langganan newsletter Lensaplus<br>dan jangan lewatkan berita penting</div>
      <div style="background:#fff;color:#002045;font-size:12px;font-weight:700;padding:8px 24px;border-radius:4px;margin-top:16px">Langganan Gratis</div>
    </div>`,
    targetUrl: "/kontak",
    priority: 10,
  },

  // SIDEBAR — 2nd ad
  {
    name: "Lensaplus — Pasang Iklan Sidebar",
    type: "HTML",
    slot: "SIDEBAR",
    htmlCode: `<div style="width:100%;max-width:300px;height:250px;background:#f0f4f8;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif;text-align:center;position:relative;overflow:hidden">
      <div style="position:absolute;right:-20px;top:-20px;width:80px;height:80px;border-radius:50%;background:rgba(0,32,69,0.04)"></div>
      <div style="width:48px;height:48px;border-radius:8px;background:#002045;display:flex;align-items:center;justify-content:center;margin-bottom:14px">
        <span style="color:#fff;font-size:22px;font-weight:900">K</span>
      </div>
      <div style="color:#002045;font-size:15px;font-weight:800;line-height:1.3">Ruang Iklan<br>Premium</div>
      <div style="color:#44474e;font-size:11px;margin-top:6px;line-height:1.4">300 × 250 pixel<br>Tampil di sidebar homepage</div>
      <div style="background:#002045;color:#fff;font-size:11px;font-weight:700;padding:7px 20px;border-radius:4px;margin-top:14px">Hubungi Kami</div>
    </div>`,
    targetUrl: "/kontak",
    priority: 5,
  },

  // BETWEEN_SECTIONS — Full-width Banner
  {
    name: "Lensaplus — Banner Promo",
    type: "HTML",
    slot: "BETWEEN_SECTIONS",
    htmlCode: `<div style="width:100%;height:90px;background:linear-gradient(90deg,#002045 0%,#1a3a5c 50%,#002045 100%);border-radius:6px;display:flex;align-items:center;justify-content:center;gap:40px;padding:0 40px;font-family:system-ui,sans-serif;position:relative;overflow:hidden">
      <div style="position:absolute;left:10%;top:50%;transform:translateY(-50%);width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,0.02)"></div>
      <div style="display:flex;align-items:center;gap:12px;z-index:1">
        <div style="width:36px;height:36px;border-radius:6px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center">
          <span style="color:#fff;font-size:18px;font-weight:900">K</span>
        </div>
        <div>
          <div style="color:#fff;font-size:15px;font-weight:700">Lensaplus — Media Digital Terpercaya</div>
          <div style="color:rgba(255,255,255,0.4);font-size:11px">Berita terkini dari berbagai kategori pilihan</div>
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.15);color:#fff;font-size:12px;font-weight:600;padding:8px 20px;border-radius:4px;z-index:1;white-space:nowrap">Jelajahi Berita →</div>
    </div>`,
    targetUrl: "/berita",
    priority: 10,
  },

  // BETWEEN_SECTIONS — 2nd banner
  {
    name: "Lensaplus — Iklan Banner Space",
    type: "HTML",
    slot: "BETWEEN_SECTIONS",
    htmlCode: `<div style="width:100%;height:90px;background:#f0f4f8;border-radius:6px;display:flex;align-items:center;justify-content:center;gap:24px;padding:0 32px;font-family:system-ui,sans-serif">
      <div style="display:flex;align-items:center;gap:16px">
        <div style="color:#002045;font-size:14px;font-weight:800">Pasang Iklan Banner di Lensaplus</div>
        <div style="color:#44474e;font-size:12px">Responsive × 90px &middot; Tampil di antara section berita</div>
      </div>
      <div style="background:#002045;color:#fff;font-size:11px;font-weight:700;padding:7px 18px;border-radius:4px;white-space:nowrap">Info Iklan</div>
    </div>`,
    targetUrl: "/kontak",
    priority: 5,
  },

  // IN_ARTICLE — Inline ad
  {
    name: "Lensaplus — Inline Promo",
    type: "HTML",
    slot: "IN_ARTICLE",
    htmlCode: `<div style="width:100%;padding:20px 24px;background:linear-gradient(135deg,#002045,#1a3a5c);border-radius:6px;display:flex;align-items:center;justify-content:space-between;font-family:system-ui,sans-serif;position:relative;overflow:hidden">
      <div style="position:absolute;right:60px;top:-40px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,0.03)"></div>
      <div style="z-index:1">
        <div style="color:rgba(255,255,255,0.4);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px">Sponsored</div>
        <div style="color:#fff;font-size:15px;font-weight:700;margin-top:4px">Berita terpercaya, langsung ke inbox Anda</div>
        <div style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:2px">Bergabung dengan 10.000+ pembaca Lensaplus</div>
      </div>
      <div style="background:#fff;color:#002045;font-size:12px;font-weight:700;padding:8px 20px;border-radius:4px;z-index:1;white-space:nowrap">Subscribe →</div>
    </div>`,
    targetUrl: "/kontak",
    priority: 10,
  },

  // IN_ARTICLE — 2nd inline
  {
    name: "Lensaplus — Kategori Promo",
    type: "HTML",
    slot: "IN_ARTICLE",
    htmlCode: `<div style="width:100%;padding:16px 24px;background:#f0f4f8;border-radius:6px;display:flex;align-items:center;justify-content:space-between;font-family:system-ui,sans-serif">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="display:flex;gap:4px">
          <span style="background:#002045;color:#fff;font-size:10px;font-weight:700;padding:4px 8px;border-radius:3px">HUKUM</span>
          <span style="background:#002045;color:#fff;font-size:10px;font-weight:700;padding:4px 8px;border-radius:3px">BISNIS</span>
          <span style="background:#002045;color:#fff;font-size:10px;font-weight:700;padding:4px 8px;border-radius:3px">OLAHRAGA</span>
          <span style="background:#002045;color:#fff;font-size:10px;font-weight:700;padding:4px 8px;border-radius:3px">TECH</span>
        </div>
        <div style="color:#44474e;font-size:12px;font-weight:500">12 kategori berita terlengkap</div>
      </div>
      <div style="color:#002045;font-size:12px;font-weight:700">Jelajahi →</div>
    </div>`,
    targetUrl: "/berita",
    priority: 5,
  },

  // FOOTER — Leaderboard
  {
    name: "Lensaplus — Footer CTA",
    type: "HTML",
    slot: "FOOTER",
    htmlCode: `<div style="width:100%;max-width:728px;height:90px;margin:0 auto;background:linear-gradient(135deg,#002045 0%,#1a3a5c 50%,#371800 100%);border-radius:6px;display:flex;align-items:center;justify-content:space-between;padding:0 32px;font-family:system-ui,sans-serif;position:relative;overflow:hidden">
      <div style="position:absolute;right:100px;top:-60px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,0.02)"></div>
      <div style="z-index:1">
        <div style="color:#fff;font-size:17px;font-weight:800">Jadikan Lensaplus Sumber Berita Utama Anda</div>
        <div style="color:rgba(255,255,255,0.45);font-size:11px;margin-top:3px">Berita akurat, terverifikasi, dari sumber terpercaya</div>
      </div>
      <div style="background:#fff;color:#002045;font-size:12px;font-weight:700;padding:8px 20px;border-radius:4px;z-index:1;white-space:nowrap">Baca Sekarang →</div>
    </div>`,
    targetUrl: "/berita",
    priority: 10,
  },

  // POPUP — Promo popup
  {
    name: "Lensaplus — Popup Newsletter",
    type: "HTML",
    slot: "POPUP",
    htmlCode: `<div style="width:100%;max-width:500px;background:#fff;border-radius:12px;padding:40px;font-family:system-ui,sans-serif;text-align:center;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#002045,#1a3a5c,#371800)"></div>
      <div style="font-size:40px;margin-bottom:16px">🗞️</div>
      <div style="color:#002045;font-size:22px;font-weight:800">Jangan Lewatkan Berita Penting</div>
      <div style="color:#44474e;font-size:13px;margin-top:8px;line-height:1.5">Dapatkan ringkasan berita terbaik dari 12 kategori langsung ke email Anda setiap pagi.</div>
      <div style="background:#002045;color:#fff;font-size:14px;font-weight:700;padding:12px 32px;border-radius:6px;margin-top:20px;display:inline-block">Langganan Newsletter Gratis</div>
      <div style="color:#74777f;font-size:11px;margin-top:12px">Gratis, tanpa spam, bisa berhenti kapan saja</div>
    </div>`,
    targetUrl: "/kontak",
    priority: 10,
  },

  // FLOATING_BOTTOM — Sticky bar
  {
    name: "Lensaplus — Floating Bar",
    type: "HTML",
    slot: "FLOATING_BOTTOM",
    htmlCode: `<div style="width:100%;padding:10px 20px;background:linear-gradient(90deg,#002045,#1a3a5c);display:flex;align-items:center;justify-content:center;gap:16px;font-family:system-ui,sans-serif">
      <div style="color:#fff;font-size:13px;font-weight:600">📰 Baca berita terbaru dari Lensaplus</div>
      <div style="background:rgba(255,255,255,0.15);color:#fff;font-size:11px;font-weight:600;padding:6px 16px;border-radius:4px">Lihat Berita →</div>
    </div>`,
    targetUrl: "/berita",
    priority: 10,
  },
];

async function main() {
  console.log("=== Seeding Lensaplus Ads ===\n");

  let created = 0;

  for (const ad of ads) {
    // Check if ad with same name exists
    const existing = await prisma.ad.findFirst({ where: { name: ad.name } });
    if (existing) {
      console.log(`  ⏭ Already exists: ${ad.name}`);
      continue;
    }

    await prisma.ad.create({
      data: {
        name: ad.name,
        type: ad.type,
        slot: ad.slot,
        htmlCode: ad.htmlCode || null,
        imageUrl: ad.imageUrl || null,
        targetUrl: ad.targetUrl || null,
        startDate: now,
        endDate: endDate,
        isActive: true,
        priority: ad.priority || 0,
        impressions: 0,
        clicks: 0,
      },
    });

    created++;
    console.log(`  ✓ ${ad.name} (${ad.slot})`);
  }

  console.log(`\n=== Done! Created ${created} ads ===`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
