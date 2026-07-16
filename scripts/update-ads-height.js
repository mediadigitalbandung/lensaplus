const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const updates = {
  "Lensaplus — Pasang Iklan Header": `<div style="width:100%;min-height:160px;background:linear-gradient(135deg,#002045,#1a3a5c);border-radius:8px;display:flex;align-items:center;justify-content:space-between;padding:clamp(24px,4vw,40px) clamp(24px,5vw,48px);font-family:system-ui,sans-serif;overflow:hidden;position:relative">
  <div style="position:absolute;right:-40px;top:-40px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,0.03)"></div>
  <div style="position:absolute;left:30%;bottom:-60px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,0.02)"></div>
  <div style="z-index:1">
    <div style="color:rgba(255,255,255,0.4);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Iklan</div>
    <div style="color:#fff;font-size:clamp(20px,3vw,28px);font-weight:800;letter-spacing:-0.5px;line-height:1.2">Iklan Anda Bisa Tampil di Sini</div>
    <div style="color:rgba(255,255,255,0.45);font-size:clamp(12px,1.5vw,15px);margin-top:6px">Jangkau ribuan pembaca Lensaplus setiap hari</div>
  </div>
  <div style="background:#fff;color:#002045;font-size:clamp(13px,1.5vw,15px);font-weight:700;padding:12px clamp(20px,3vw,32px);border-radius:6px;z-index:1;white-space:nowrap;flex-shrink:0">Pasang Iklan →</div>
</div>`,

  "Lensaplus — Banner Promo": `<div style="width:100%;min-height:160px;padding:clamp(24px,4vw,40px) clamp(24px,5vw,48px);background:linear-gradient(90deg,#002045 0%,#1a3a5c 50%,#002045 100%);border-radius:8px;display:flex;align-items:center;justify-content:space-between;font-family:system-ui,sans-serif;position:relative;overflow:hidden">
  <div style="position:absolute;left:10%;top:50%;transform:translateY(-50%);width:300px;height:300px;border-radius:50%;background:rgba(255,255,255,0.02)"></div>
  <div style="display:flex;align-items:center;gap:clamp(12px,2vw,20px);z-index:1;min-width:0">
    <div style="width:56px;height:56px;border-radius:12px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <span style="color:#fff;font-size:26px;font-weight:900">K</span>
    </div>
    <div style="min-width:0">
      <div style="color:rgba(255,255,255,0.4);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px">Sponsored</div>
      <div style="color:#fff;font-size:clamp(18px,2.5vw,24px);font-weight:800;line-height:1.2">Lensaplus — Media Digital Terpercaya</div>
      <div style="color:rgba(255,255,255,0.4);font-size:clamp(12px,1.3vw,14px);margin-top:4px">Berita terkini dari berbagai kategori pilihan</div>
    </div>
  </div>
  <div style="background:rgba(255,255,255,0.15);color:#fff;font-size:clamp(13px,1.5vw,15px);font-weight:600;padding:12px clamp(20px,3vw,28px);border-radius:6px;z-index:1;white-space:nowrap;flex-shrink:0;margin-left:16px">Jelajahi →</div>
</div>`,

  "Lensaplus — Iklan Banner Space": `<div style="width:100%;min-height:160px;padding:clamp(24px,4vw,40px) clamp(24px,5vw,48px);background:#f0f4f8;border-radius:8px;display:flex;align-items:center;justify-content:space-between;font-family:system-ui,sans-serif;gap:16px;position:relative;overflow:hidden">
  <div style="position:absolute;right:-30px;bottom:-30px;width:160px;height:160px;border-radius:50%;background:rgba(0,32,69,0.03)"></div>
  <div style="z-index:1">
    <div style="color:#74777f;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Ruang Iklan</div>
    <div style="color:#002045;font-size:clamp(18px,2.5vw,24px);font-weight:800">Pasang Iklan Banner di Lensaplus</div>
    <div style="color:#44474e;font-size:clamp(12px,1.3vw,14px);margin-top:4px">Tampil di antara section berita • Dilihat ribuan pembaca</div>
  </div>
  <div style="background:#002045;color:#fff;font-size:clamp(13px,1.5vw,15px);font-weight:700;padding:12px clamp(20px,3vw,28px);border-radius:6px;white-space:nowrap;flex-shrink:0;z-index:1">Info Iklan →</div>
</div>`,

  "Lensaplus — Inline Promo": `<div style="width:100%;min-height:160px;padding:clamp(24px,4vw,40px) clamp(24px,5vw,48px);background:linear-gradient(135deg,#002045,#1a3a5c);border-radius:8px;display:flex;align-items:center;justify-content:space-between;font-family:system-ui,sans-serif;position:relative;overflow:hidden;gap:16px">
  <div style="position:absolute;right:80px;top:-60px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,0.03)"></div>
  <div style="z-index:1;min-width:0">
    <div style="color:rgba(255,255,255,0.4);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Sponsored</div>
    <div style="color:#fff;font-size:clamp(18px,2.5vw,24px);font-weight:800;line-height:1.2">Berita Terpercaya, Langsung ke Inbox Anda</div>
    <div style="color:rgba(255,255,255,0.4);font-size:clamp(12px,1.3vw,14px);margin-top:6px">Bergabung dengan 10.000+ pembaca Lensaplus</div>
  </div>
  <div style="background:#fff;color:#002045;font-size:clamp(13px,1.5vw,15px);font-weight:700;padding:12px clamp(20px,3vw,28px);border-radius:6px;z-index:1;white-space:nowrap;flex-shrink:0">Subscribe →</div>
</div>`,

  "Lensaplus — Kategori Promo": `<div style="width:100%;min-height:140px;padding:clamp(20px,3vw,32px) clamp(24px,5vw,48px);background:#f0f4f8;border-radius:8px;display:flex;align-items:center;justify-content:space-between;font-family:system-ui,sans-serif;gap:16px;flex-wrap:wrap;position:relative;overflow:hidden">
  <div style="z-index:1">
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
      <span style="background:#002045;color:#fff;font-size:11px;font-weight:700;padding:5px 12px;border-radius:4px">HUKUM</span>
      <span style="background:#002045;color:#fff;font-size:11px;font-weight:700;padding:5px 12px;border-radius:4px">BISNIS</span>
      <span style="background:#002045;color:#fff;font-size:11px;font-weight:700;padding:5px 12px;border-radius:4px">OLAHRAGA</span>
      <span style="background:#002045;color:#fff;font-size:11px;font-weight:700;padding:5px 12px;border-radius:4px">HIBURAN</span>
      <span style="background:#002045;color:#fff;font-size:11px;font-weight:700;padding:5px 12px;border-radius:4px">TECH</span>
      <span style="background:rgba(0,32,69,0.1);color:#002045;font-size:11px;font-weight:700;padding:5px 12px;border-radius:4px">+7 lainnya</span>
    </div>
    <div style="color:#002045;font-size:clamp(16px,2vw,20px);font-weight:800">12 Kategori Berita Terlengkap</div>
    <div style="color:#44474e;font-size:clamp(11px,1.2vw,13px);margin-top:4px">Hukum, Bisnis, Olahraga, Hiburan, Kesehatan, Teknologi & lainnya</div>
  </div>
  <div style="color:#002045;font-size:clamp(13px,1.5vw,15px);font-weight:700;white-space:nowrap;z-index:1;background:#002045;color:#fff;padding:12px 24px;border-radius:6px;flex-shrink:0">Jelajahi →</div>
</div>`,

  "Lensaplus — Footer CTA": `<div style="width:100%;min-height:160px;padding:clamp(24px,4vw,40px) clamp(24px,5vw,48px);background:linear-gradient(135deg,#002045 0%,#1a3a5c 50%,#371800 100%);border-radius:8px;display:flex;align-items:center;justify-content:space-between;font-family:system-ui,sans-serif;position:relative;overflow:hidden;gap:16px">
  <div style="position:absolute;right:100px;top:-80px;width:240px;height:240px;border-radius:50%;background:rgba(255,255,255,0.02)"></div>
  <div style="z-index:1;min-width:0">
    <div style="color:rgba(255,255,255,0.4);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Lensaplus</div>
    <div style="color:#fff;font-size:clamp(20px,3vw,28px);font-weight:800;line-height:1.2">Jadikan Lensaplus Sumber Berita Utama Anda</div>
    <div style="color:rgba(255,255,255,0.4);font-size:clamp(12px,1.3vw,14px);margin-top:6px">Berita akurat, terverifikasi, dari sumber terpercaya</div>
  </div>
  <div style="background:#fff;color:#002045;font-size:clamp(13px,1.5vw,15px);font-weight:700;padding:12px clamp(20px,3vw,28px);border-radius:6px;z-index:1;white-space:nowrap;flex-shrink:0">Baca Sekarang →</div>
</div>`,
};

async function main() {
  console.log("=== Updating Ad Heights to 2x ===\n");
  let updated = 0;
  for (const [name, htmlCode] of Object.entries(updates)) {
    const result = await prisma.ad.updateMany({ where: { name }, data: { htmlCode } });
    if (result.count > 0) { updated++; console.log("  ✓", name); }
    else console.log("  ⏭ Not found:", name);
  }
  console.log(`\n=== Done! Updated ${updated} ads ===`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
