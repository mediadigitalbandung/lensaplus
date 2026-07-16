const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// All ads with fixed responsive layout
const LOGO = `<img src="/kartawarta-icon.png" alt="Kartawarta" style="width:40px;height:40px;object-fit:contain;border-radius:10px">`;
const LOGO_SM = `<img src="/kartawarta-icon.png" alt="K" style="width:32px;height:32px;object-fit:contain;border-radius:8px">`;

const updates = {

// ═══ HEADER — fixed 728x90 ratio (8:1), responsive ═══
"Kartawarta — Pasang Iklan Header": `<div style="width:100%;aspect-ratio:728/120;max-height:160px;background:linear-gradient(135deg,#001530 0%,#002045 40%,#1a3a5c 70%,#002045 100%);border-radius:12px;display:flex;align-items:center;justify-content:space-between;padding:16px clamp(16px,4vw,40px);font-family:'Segoe UI',system-ui,sans-serif;overflow:hidden;position:relative;gap:16px">
  <style>
    @keyframes adLine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes adShine{0%{background-position:200% center}100%{background-position:-200% center}}
    @keyframes adPulse{0%,100%{box-shadow:0 2px 10px rgba(183,16,42,0.2)}50%{box-shadow:0 4px 20px rgba(183,16,42,0.4)}}
    @keyframes adFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
    @keyframes adShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
  </style>
  <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#b7102a,#d4364d,#1a3a5c,#b7102a);background-size:200% 100%;animation:adLine 4s linear infinite"></div>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.02),transparent);animation:adShimmer 5s ease-in-out infinite"></div></div>
  <div style="display:flex;align-items:center;gap:clamp(10px,2vw,20px);z-index:1;min-width:0;flex:1">
    <div style="animation:adFloat 4s ease-in-out infinite;flex-shrink:0">${LOGO}</div>
    <div style="min-width:0">
      <div style="font-size:clamp(14px,2.5vw,22px);font-weight:800;letter-spacing:-0.3px;line-height:1.15;background:linear-gradient(90deg,#fff 0%,#fff 30%,#e8edf3 48%,#d4364d 52%,#fff 70%,#fff 100%);background-size:300% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:adShine 5s linear infinite">Tampilkan Brand Anda di Kartawarta</div>
      <div style="color:rgba(255,255,255,0.4);font-size:clamp(10px,1.2vw,13px);margin-top:4px;line-height:1.4">Jangkau audiens yang tepat di media digital terpercaya Indonesia</div>
    </div>
  </div>
  <div style="z-index:1;flex-shrink:0"><div style="background:linear-gradient(135deg,#b7102a,#8f0c20);color:#fff;font-size:clamp(11px,1.3vw,14px);font-weight:700;padding:clamp(8px,1.5vw,14px) clamp(14px,2.5vw,28px);border-radius:8px;white-space:nowrap;animation:adPulse 3s ease-in-out infinite">Pasang Iklan →</div></div>
</div>`,

// ═══ BETWEEN SECTIONS — Banner Promo (fixed ratio) ═══
"Kartawarta — Banner Promo": `<div style="width:100%;aspect-ratio:728/100;max-height:140px;background:linear-gradient(135deg,#001530 0%,#002045 40%,#1a3a5c 70%,#002045 100%);border-radius:12px;display:flex;align-items:center;justify-content:space-between;padding:16px clamp(16px,4vw,40px);font-family:'Segoe UI',system-ui,sans-serif;overflow:hidden;position:relative;gap:16px">
  <style>@keyframes bp2Line{0%{background-position:0% 50%}100%{background-position:200% 50%}}@keyframes bp2Shine{0%{background-position:200% center}100%{background-position:-200% center}}@keyframes bp2Shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}</style>
  <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#b7102a,#d4364d,#1a3a5c,#b7102a);background-size:200% 100%;animation:bp2Line 4s linear infinite"></div>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.02),transparent);animation:bp2Shimmer 6s ease-in-out infinite"></div></div>
  <div style="display:flex;align-items:center;gap:clamp(10px,2vw,20px);z-index:1;min-width:0;flex:1">
    <div style="flex-shrink:0">${LOGO_SM}</div>
    <div style="min-width:0">
      <div style="color:rgba(183,16,42,0.8);font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:3px">Media Terpercaya</div>
      <div style="font-size:clamp(13px,2vw,20px);font-weight:800;line-height:1.15;letter-spacing:-0.3px;background:linear-gradient(90deg,#fff 0%,#fff 30%,#e8edf3 48%,#d4364d 52%,#fff 70%,#fff 100%);background-size:300% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:bp2Shine 5s linear infinite">Kartawarta — Berita Akurat & Terverifikasi</div>
    </div>
  </div>
  <div style="z-index:1;flex-shrink:0"><div style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:clamp(11px,1.2vw,14px);font-weight:600;padding:clamp(8px,1.5vw,12px) clamp(14px,2vw,24px);border-radius:8px;white-space:nowrap">Jelajahi Berita →</div></div>
</div>`,

// ═══ BETWEEN SECTIONS — Iklan Banner Space (light, fixed ratio) ═══
"Kartawarta — Iklan Banner Space": `<div style="width:100%;aspect-ratio:728/100;max-height:140px;background:linear-gradient(135deg,#fff,#f0f4f8,#e8edf3);border-radius:12px;display:flex;align-items:center;justify-content:space-between;padding:16px clamp(16px,4vw,40px);font-family:'Segoe UI',system-ui,sans-serif;overflow:hidden;position:relative;gap:16px;border:1px solid #e8edf3">
  <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#002045,#1a3a5c,#b7102a,#002045);background-size:200% 100%;animation:bp2Line 4s linear infinite"></div>
  <div style="display:flex;align-items:center;gap:clamp(10px,2vw,20px);z-index:1;min-width:0;flex:1">
    <div style="flex-shrink:0">${LOGO_SM}</div>
    <div style="min-width:0">
      <div style="color:#002045;font-size:clamp(13px,2vw,20px);font-weight:800;letter-spacing:-0.3px">Iklan Anda Bisa Tampil di Sini</div>
      <div style="color:#44474e;font-size:clamp(10px,1.2vw,13px);margin-top:3px">Dilihat audiens yang tepat setiap hari — banner responsif dengan analytics</div>
    </div>
  </div>
  <div style="z-index:1;flex-shrink:0"><div style="background:linear-gradient(135deg,#002045,#001530);color:#fff;font-size:clamp(11px,1.2vw,14px);font-weight:700;padding:clamp(8px,1.5vw,12px) clamp(14px,2vw,24px);border-radius:8px;white-space:nowrap">Hubungi Kami →</div></div>
</div>`,

// ═══ INLINE — Newsletter (fixed ratio) ═══
"Kartawarta — Inline Promo": `<div style="width:100%;aspect-ratio:728/100;max-height:140px;background:linear-gradient(135deg,#001530 0%,#002045 50%,#1a3a5c 100%);border-radius:12px;display:flex;align-items:center;justify-content:space-between;padding:16px clamp(16px,4vw,40px);font-family:'Segoe UI',system-ui,sans-serif;overflow:hidden;position:relative;gap:16px">
  <style>@keyframes ip2Line{0%{background-position:0% 50%}100%{background-position:200% 50%}}@keyframes ip2Shine{0%{background-position:200% center}100%{background-position:-200% center}}@keyframes ip2Pulse{0%,100%{box-shadow:0 2px 10px rgba(183,16,42,0.2)}50%{box-shadow:0 4px 20px rgba(183,16,42,0.4)}}</style>
  <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#b7102a,#d4364d,#002045,#1a3a5c,#b7102a);background-size:200% 100%;animation:ip2Line 4s linear infinite"></div>
  <div style="display:flex;align-items:center;gap:clamp(10px,2vw,20px);z-index:1;min-width:0;flex:1">
    <div style="flex-shrink:0">${LOGO_SM}</div>
    <div style="min-width:0">
      <div style="color:#d4364d;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:3px">Newsletter</div>
      <div style="font-size:clamp(13px,2vw,20px);font-weight:800;line-height:1.15;letter-spacing:-0.3px;background:linear-gradient(90deg,#fff 0%,#fff 30%,#e8edf3 48%,#d4364d 52%,#fff 70%,#fff 100%);background-size:300% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:ip2Shine 5s linear infinite">Berita Terpercaya ke Inbox Anda</div>
      <div style="color:rgba(255,255,255,0.35);font-size:clamp(9px,1vw,11px);margin-top:2px">Gratis · Tanpa spam · Berhenti kapan saja</div>
    </div>
  </div>
  <div style="z-index:1;flex-shrink:0"><div style="background:linear-gradient(135deg,#b7102a,#8f0c20);color:#fff;font-size:clamp(11px,1.2vw,14px);font-weight:700;padding:clamp(8px,1.5vw,12px) clamp(14px,2vw,24px);border-radius:8px;white-space:nowrap;animation:ip2Pulse 3s ease-in-out infinite">Subscribe →</div></div>
</div>`,

// ═══ KATEGORI (fixed ratio) ═══
"Kartawarta — Kategori Promo": `<div style="width:100%;aspect-ratio:728/100;max-height:130px;background:linear-gradient(135deg,#fff,#f0f4f8);border-radius:12px;display:flex;align-items:center;justify-content:space-between;padding:14px clamp(16px,4vw,40px);font-family:'Segoe UI',system-ui,sans-serif;overflow:hidden;position:relative;gap:16px;border:1px solid #e8edf3">
  <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#002045,#1a3a5c,#b7102a,#d4364d,#002045);background-size:200% 100%;animation:bp2Line 5s linear infinite"></div>
  <div style="display:flex;align-items:center;gap:clamp(10px,2vw,16px);z-index:1;min-width:0;flex:1">
    <div style="flex-shrink:0">${LOGO_SM}</div>
    <div style="min-width:0">
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">
        <span style="background:#002045;color:#fff;font-size:9px;font-weight:700;padding:3px 8px;border-radius:4px">HUKUM</span>
        <span style="background:#1a3a5c;color:#fff;font-size:9px;font-weight:700;padding:3px 8px;border-radius:4px">BISNIS</span>
        <span style="background:#b7102a;color:#fff;font-size:9px;font-weight:700;padding:3px 8px;border-radius:4px">OLAHRAGA</span>
        <span style="background:#d4364d;color:#fff;font-size:9px;font-weight:700;padding:3px 8px;border-radius:4px">TECH</span>
        <span style="background:#e8edf3;color:#002045;font-size:9px;font-weight:700;padding:3px 8px;border-radius:4px">+8</span>
      </div>
      <div style="color:#002045;font-size:clamp(12px,1.8vw,17px);font-weight:800;letter-spacing:-0.3px">12 Kategori Berita Terlengkap</div>
    </div>
  </div>
  <div style="z-index:1;flex-shrink:0"><div style="background:#002045;color:#fff;font-size:clamp(11px,1.2vw,14px);font-weight:700;padding:clamp(8px,1.5vw,12px) clamp(14px,2vw,24px);border-radius:8px;white-space:nowrap">Jelajahi →</div></div>
</div>`,

// ═══ FOOTER (fixed ratio) ═══
"Kartawarta — Footer CTA": `<div style="width:100%;aspect-ratio:728/120;max-height:160px;background:linear-gradient(135deg,#001530 0%,#002045 30%,#1a3a5c 60%,#371800 100%);border-radius:12px;display:flex;align-items:center;justify-content:space-between;padding:16px clamp(16px,4vw,40px);font-family:'Segoe UI',system-ui,sans-serif;overflow:hidden;position:relative;gap:16px">
  <style>@keyframes fc2Shine{0%{background-position:200% center}100%{background-position:-200% center}}@keyframes fc2Pulse{0%,100%{box-shadow:0 2px 10px rgba(183,16,42,0.2)}50%{box-shadow:0 4px 20px rgba(183,16,42,0.4)}}</style>
  <div style="position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#b7102a,#d4364d,#1a3a5c,#002045);background-size:200% 100%;animation:bp2Line 4s linear infinite"></div>
  <div style="display:flex;align-items:center;gap:clamp(10px,2vw,20px);z-index:1;min-width:0;flex:1">
    <div style="flex-shrink:0">${LOGO}</div>
    <div style="min-width:0">
      <div style="color:#d4364d;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:3px">Kartawarta</div>
      <div style="font-size:clamp(13px,2.5vw,22px);font-weight:800;line-height:1.15;letter-spacing:-0.3px;background:linear-gradient(90deg,#fff 0%,#fff 30%,#e8edf3 48%,#d4364d 52%,#fff 70%,#fff 100%);background-size:300% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:fc2Shine 5s linear infinite">Jadikan Kartawarta Sumber Berita Utama</div>
      <div style="color:rgba(255,255,255,0.35);font-size:clamp(9px,1vw,12px);margin-top:3px">Berita akurat, terverifikasi, dari sumber terpercaya Indonesia</div>
    </div>
  </div>
  <div style="z-index:1;flex-shrink:0"><div style="background:linear-gradient(135deg,#b7102a,#8f0c20);color:#fff;font-size:clamp(11px,1.3vw,15px);font-weight:700;padding:clamp(8px,1.5vw,14px) clamp(14px,2.5vw,28px);border-radius:8px;white-space:nowrap;animation:fc2Pulse 3s ease-in-out infinite">Baca Sekarang →</div></div>
</div>`,

// ═══ FLOATING BAR (fixed height) ═══
"Kartawarta — Floating Bar": `<div style="width:100%;height:48px;background:linear-gradient(135deg,#001530,#002045);display:flex;align-items:center;justify-content:center;gap:clamp(10px,2vw,20px);padding:0 16px;font-family:'Segoe UI',system-ui,sans-serif;position:relative">
  <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#b7102a,#d4364d,#1a3a5c,#b7102a);background-size:200% 100%;animation:adLine 4s linear infinite"></div>
  <div style="display:flex;align-items:center;gap:8px;z-index:1">
    <img src="/kartawarta-icon.png" alt="K" style="width:24px;height:24px;object-fit:contain;border-radius:6px">
    <span style="color:#fff;font-size:clamp(11px,1.2vw,13px);font-weight:600">Baca berita terbaru dari <strong>Kartawarta</strong></span>
  </div>
  <div style="background:linear-gradient(135deg,#b7102a,#8f0c20);color:#fff;font-size:clamp(10px,1.1vw,12px);font-weight:700;padding:6px clamp(12px,1.5vw,18px);border-radius:6px;white-space:nowrap;z-index:1">Lihat Berita →</div>
</div>`,

};

async function main() {
  console.log("=== Fixing Ad Responsive Layout ===\n");
  let updated = 0;
  for (const [name, htmlCode] of Object.entries(updates)) {
    const result = await prisma.ad.updateMany({ where: { name }, data: { htmlCode } });
    if (result.count > 0) { updated++; console.log("  ✓", name); }
    else console.log("  ⏭ Not found:", name);
  }
  console.log(`\n=== Done! Updated ${updated} ads ===`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
