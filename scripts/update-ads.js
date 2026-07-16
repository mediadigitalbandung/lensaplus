// Update ad HTML to be 100% width and proportional
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const updates = {
  "Lensaplus — Pasang Iklan Header": `<div style="width:100%;height:80px;background:linear-gradient(135deg,#002045,#1a3a5c);border-radius:6px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(16px,4vw,32px);font-family:system-ui,sans-serif;overflow:hidden;position:relative">
  <div style="position:absolute;right:-20px;top:-20px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,0.03)"></div>
  <div style="z-index:1">
    <div style="color:#fff;font-size:clamp(14px,2vw,18px);font-weight:800;letter-spacing:-0.3px">Iklan Anda Bisa Tampil di Sini</div>
    <div style="color:rgba(255,255,255,0.45);font-size:clamp(10px,1.2vw,12px);margin-top:2px">Jangkau ribuan pembaca Lensaplus setiap hari</div>
  </div>
  <div style="background:#fff;color:#002045;font-size:clamp(11px,1.2vw,13px);font-weight:700;padding:8px clamp(12px,2vw,20px);border-radius:4px;z-index:1;white-space:nowrap;flex-shrink:0">Pasang Iklan →</div>
</div>`,

  "Lensaplus — Newsletter Sidebar": `<div style="width:100%;aspect-ratio:6/5;background:linear-gradient(135deg,#002045 0%,#1a3a5c 100%);border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(16px,3vw,24px);font-family:system-ui,sans-serif;text-align:center;position:relative;overflow:hidden">
  <div style="position:absolute;left:-30px;bottom:-30px;width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,0.04)"></div>
  <div style="font-size:28px;margin-bottom:10px">📰</div>
  <div style="color:#fff;font-size:clamp(14px,1.6vw,16px);font-weight:800;line-height:1.3">Dapatkan Berita<br>Terbaru Setiap Hari</div>
  <div style="color:rgba(255,255,255,0.45);font-size:clamp(10px,1.1vw,11px);margin-top:6px;line-height:1.4">Langganan newsletter Lensaplus</div>
  <div style="background:#fff;color:#002045;font-size:12px;font-weight:700;padding:8px 20px;border-radius:4px;margin-top:14px">Langganan Gratis</div>
</div>`,

  "Lensaplus — Pasang Iklan Sidebar": `<div style="width:100%;aspect-ratio:6/5;background:#f0f4f8;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(16px,3vw,24px);font-family:system-ui,sans-serif;text-align:center;position:relative;overflow:hidden">
  <div style="width:44px;height:44px;border-radius:8px;background:#002045;display:flex;align-items:center;justify-content:center;margin-bottom:12px">
    <span style="color:#fff;font-size:20px;font-weight:900">K</span>
  </div>
  <div style="color:#002045;font-size:clamp(13px,1.5vw,15px);font-weight:800;line-height:1.3">Ruang Iklan Premium</div>
  <div style="color:#44474e;font-size:11px;margin-top:4px;line-height:1.4">Tampil di sidebar homepage</div>
  <div style="background:#002045;color:#fff;font-size:11px;font-weight:700;padding:7px 20px;border-radius:4px;margin-top:12px">Hubungi Kami</div>
</div>`,

  "Lensaplus — Banner Promo": `<div style="width:100%;padding:clamp(14px,2vw,20px) clamp(16px,3vw,32px);background:linear-gradient(90deg,#002045 0%,#1a3a5c 50%,#002045 100%);border-radius:6px;display:flex;align-items:center;justify-content:space-between;font-family:system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;left:10%;top:50%;transform:translateY(-50%);width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,0.02)"></div>
  <div style="display:flex;align-items:center;gap:clamp(8px,1.5vw,12px);z-index:1;min-width:0">
    <div style="width:36px;height:36px;border-radius:6px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <span style="color:#fff;font-size:18px;font-weight:900">K</span>
    </div>
    <div style="min-width:0">
      <div style="color:#fff;font-size:clamp(13px,1.5vw,15px);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Lensaplus — Media Digital Terpercaya</div>
      <div style="color:rgba(255,255,255,0.4);font-size:clamp(10px,1vw,11px)">Berita terkini dari berbagai kategori</div>
    </div>
  </div>
  <div style="background:rgba(255,255,255,0.15);color:#fff;font-size:12px;font-weight:600;padding:8px 16px;border-radius:4px;z-index:1;white-space:nowrap;flex-shrink:0;margin-left:12px">Jelajahi →</div>
</div>`,

  "Lensaplus — Iklan Banner Space": `<div style="width:100%;padding:clamp(14px,2vw,20px) clamp(16px,3vw,32px);background:#f0f4f8;border-radius:6px;display:flex;align-items:center;justify-content:space-between;font-family:system-ui,sans-serif;gap:12px">
  <div style="display:flex;align-items:center;gap:clamp(8px,2vw,16px);min-width:0">
    <div style="color:#002045;font-size:clamp(12px,1.4vw,14px);font-weight:800;white-space:nowrap">Pasang Iklan Banner</div>
    <div style="color:#44474e;font-size:clamp(10px,1.1vw,12px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Tampil di antara section berita</div>
  </div>
  <div style="background:#002045;color:#fff;font-size:11px;font-weight:700;padding:7px 16px;border-radius:4px;white-space:nowrap;flex-shrink:0">Info Iklan</div>
</div>`,

  "Lensaplus — Inline Promo": `<div style="width:100%;padding:clamp(16px,2.5vw,24px);background:linear-gradient(135deg,#002045,#1a3a5c);border-radius:6px;display:flex;align-items:center;justify-content:space-between;font-family:system-ui,sans-serif;position:relative;overflow:hidden;gap:12px">
  <div style="position:absolute;right:60px;top:-40px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,0.03)"></div>
  <div style="z-index:1;min-width:0">
    <div style="color:rgba(255,255,255,0.4);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px">Sponsored</div>
    <div style="color:#fff;font-size:clamp(13px,1.5vw,15px);font-weight:700;margin-top:4px">Berita terpercaya, langsung ke inbox Anda</div>
    <div style="color:rgba(255,255,255,0.4);font-size:clamp(10px,1vw,11px);margin-top:2px">Bergabung dengan 10.000+ pembaca Lensaplus</div>
  </div>
  <div style="background:#fff;color:#002045;font-size:12px;font-weight:700;padding:8px 16px;border-radius:4px;z-index:1;white-space:nowrap;flex-shrink:0">Subscribe →</div>
</div>`,

  "Lensaplus — Kategori Promo": `<div style="width:100%;padding:clamp(12px,2vw,16px) clamp(16px,3vw,24px);background:#f0f4f8;border-radius:6px;display:flex;align-items:center;justify-content:space-between;font-family:system-ui,sans-serif;gap:12px;flex-wrap:wrap">
  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
    <div style="display:flex;gap:4px;flex-wrap:wrap">
      <span style="background:#002045;color:#fff;font-size:10px;font-weight:700;padding:4px 8px;border-radius:3px">HUKUM</span>
      <span style="background:#002045;color:#fff;font-size:10px;font-weight:700;padding:4px 8px;border-radius:3px">BISNIS</span>
      <span style="background:#002045;color:#fff;font-size:10px;font-weight:700;padding:4px 8px;border-radius:3px">SPORT</span>
      <span style="background:#002045;color:#fff;font-size:10px;font-weight:700;padding:4px 8px;border-radius:3px">TECH</span>
      <span style="background:#002045;color:#fff;font-size:10px;font-weight:700;padding:4px 8px;border-radius:3px">+8</span>
    </div>
    <div style="color:#44474e;font-size:12px;font-weight:500">12 kategori berita</div>
  </div>
  <div style="color:#002045;font-size:12px;font-weight:700;white-space:nowrap">Jelajahi →</div>
</div>`,

  "Lensaplus — Footer CTA": `<div style="width:100%;padding:clamp(16px,2.5vw,24px) clamp(16px,3vw,32px);background:linear-gradient(135deg,#002045 0%,#1a3a5c 50%,#371800 100%);border-radius:6px;display:flex;align-items:center;justify-content:space-between;font-family:system-ui,sans-serif;position:relative;overflow:hidden;gap:12px">
  <div style="position:absolute;right:80px;top:-60px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,0.02)"></div>
  <div style="z-index:1;min-width:0">
    <div style="color:#fff;font-size:clamp(14px,1.8vw,17px);font-weight:800">Jadikan Lensaplus Sumber Berita Utama Anda</div>
    <div style="color:rgba(255,255,255,0.4);font-size:clamp(10px,1vw,11px);margin-top:3px">Berita akurat, terverifikasi, dari sumber terpercaya</div>
  </div>
  <div style="background:#fff;color:#002045;font-size:12px;font-weight:700;padding:8px 16px;border-radius:4px;z-index:1;white-space:nowrap;flex-shrink:0">Baca Sekarang →</div>
</div>`,
};

async function main() {
  console.log("=== Updating Ad HTML for Proportional Sizing ===\n");
  let updated = 0;

  for (const [name, htmlCode] of Object.entries(updates)) {
    const result = await prisma.ad.updateMany({
      where: { name },
      data: { htmlCode },
    });
    if (result.count > 0) {
      updated++;
      console.log(`  ✓ ${name}`);
    } else {
      console.log(`  ⏭ Not found: ${name}`);
    }
  }

  console.log(`\n=== Done! Updated ${updated} ads ===`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
