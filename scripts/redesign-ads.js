const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Logo as img tag (served from same domain)
const LOGO = `<img src="/lensaplus-icon.png" alt="Lensaplus" style="width:44px;height:44px;object-fit:contain;border-radius:10px">`;
const LOGO_SM = `<img src="/lensaplus-icon.png" alt="K" style="width:32px;height:32px;object-fit:contain;border-radius:8px">`;
const LOGO_LG = `<img src="/lensaplus-icon.png" alt="Lensaplus" style="width:56px;height:56px;object-fit:contain;border-radius:12px">`;

const updates = {
  // ═══════════════════════════════════════════════════
  // HEADER — Leaderboard (full-width, prominent)
  // ═══════════════════════════════════════════════════
  "Lensaplus — Pasang Iklan Header": `<div style="width:100%;min-height:160px;background:linear-gradient(135deg,#0a1628 0%,#162a4a 40%,#1e3a5f 70%,#0d2240 100%);border-radius:12px;display:flex;align-items:center;justify-content:space-between;padding:clamp(20px,3vw,36px) clamp(24px,4vw,48px);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;overflow:hidden;position:relative;gap:20px">
  <div style="position:absolute;top:-80px;right:-40px;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.08),transparent 70%)"></div>
  <div style="position:absolute;bottom:-60px;left:20%;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,0.03),transparent 70%)"></div>
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6,#60a5fa,#3b82f6)"></div>
  <div style="display:flex;align-items:center;gap:clamp(16px,2.5vw,24px);z-index:1">
    ${LOGO}
    <div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="background:rgba(59,130,246,0.2);color:#60a5fa;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:1.5px;text-transform:uppercase">Ruang Iklan</span>
      </div>
      <div style="color:#fff;font-size:clamp(18px,2.5vw,26px);font-weight:800;letter-spacing:-0.5px;line-height:1.2">Tampilkan Brand Anda di Sini</div>
      <div style="color:rgba(255,255,255,0.45);font-size:clamp(12px,1.3vw,14px);margin-top:5px;line-height:1.4">Jangkau <strong style="color:rgba(255,255,255,0.7)">ribuan pembaca</strong> Lensaplus setiap hari</div>
    </div>
  </div>
  <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-size:clamp(13px,1.3vw,15px);font-weight:700;padding:14px clamp(24px,3vw,36px);border-radius:10px;z-index:1;white-space:nowrap;flex-shrink:0;box-shadow:0 4px 14px rgba(59,130,246,0.3);transition:transform 0.2s">Pasang Iklan →</div>
</div>`,

  // ═══════════════════════════════════════════════════
  // BETWEEN_SECTIONS — Banner Promo (brand awareness)
  // ═══════════════════════════════════════════════════
  "Lensaplus — Banner Promo": `<div style="width:100%;min-height:160px;padding:clamp(24px,3.5vw,40px) clamp(24px,4vw,48px);background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%);border-radius:12px;display:flex;align-items:center;justify-content:space-between;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;position:relative;overflow:hidden;gap:20px">
  <div style="position:absolute;top:0;left:0;bottom:0;width:4px;background:linear-gradient(180deg,#3b82f6,#8b5cf6,#ec4899)"></div>
  <div style="position:absolute;right:5%;top:50%;transform:translateY(-50%);width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.06),transparent 70%)"></div>
  <div style="display:flex;align-items:center;gap:clamp(16px,2.5vw,24px);z-index:1;min-width:0;padding-left:12px">
    <div style="position:relative;flex-shrink:0">
      ${LOGO}
      <div style="position:absolute;-bottom:2px;right:-2px;width:14px;height:14px;border-radius:50%;background:#22c55e;border:2px solid #0f172a"></div>
    </div>
    <div style="min-width:0">
      <div style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">Media Digital Terpercaya</div>
      <div style="color:#fff;font-size:clamp(18px,2.5vw,24px);font-weight:800;line-height:1.2;letter-spacing:-0.3px">Lensaplus — Berita Akurat & Terverifikasi</div>
      <div style="display:flex;align-items:center;gap:12px;margin-top:8px;flex-wrap:wrap">
        <span style="display:inline-flex;align-items:center;gap:4px;color:rgba(255,255,255,0.5);font-size:12px">
          <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#22c55e"></span> 12 Kategori
        </span>
        <span style="display:inline-flex;align-items:center;gap:4px;color:rgba(255,255,255,0.5);font-size:12px">
          <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#3b82f6"></span> Update 24/7
        </span>
        <span style="display:inline-flex;align-items:center;gap:4px;color:rgba(255,255,255,0.5);font-size:12px">
          <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#f59e0b"></span> Terpercaya
        </span>
      </div>
    </div>
  </div>
  <div style="background:rgba(255,255,255,0.08);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:clamp(13px,1.3vw,15px);font-weight:600;padding:14px clamp(24px,3vw,32px);border-radius:10px;z-index:1;white-space:nowrap;flex-shrink:0">Jelajahi Berita →</div>
</div>`,

  // ═══════════════════════════════════════════════════
  // BETWEEN_SECTIONS — Iklan Banner Space (CTA for advertisers)
  // ═══════════════════════════════════════════════════
  "Lensaplus — Iklan Banner Space": `<div style="width:100%;min-height:140px;padding:clamp(20px,3vw,32px) clamp(24px,4vw,48px);background:#fff;border:2px dashed #cbd5e1;border-radius:12px;display:flex;align-items:center;justify-content:space-between;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;gap:20px;position:relative;overflow:hidden">
  <div style="position:absolute;top:0;right:0;width:200px;height:200px;background:radial-gradient(circle at top right,rgba(59,130,246,0.05),transparent 70%)"></div>
  <div style="display:flex;align-items:center;gap:clamp(14px,2vw,20px);z-index:1">
    <div style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#eff6ff,#dbeafe);display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #bfdbfe">
      ${LOGO_SM}
    </div>
    <div>
      <div style="color:#1e293b;font-size:clamp(16px,2vw,20px);font-weight:800;letter-spacing:-0.3px">Iklan Anda di Sini?</div>
      <div style="color:#64748b;font-size:clamp(12px,1.3vw,14px);margin-top:3px;line-height:1.4">Tampil di antara section berita — dilihat ribuan pembaca aktif</div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
        <span style="background:#f0fdf4;color:#16a34a;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid #bbf7d0">Responsive</span>
        <span style="background:#eff6ff;color:#2563eb;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid #bfdbfe">Targeting</span>
        <span style="background:#fefce8;color:#ca8a04;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid #fde68a">Analytics</span>
      </div>
    </div>
  </div>
  <div style="background:#1e293b;color:#fff;font-size:clamp(12px,1.3vw,14px);font-weight:700;padding:12px clamp(20px,2.5vw,28px);border-radius:10px;white-space:nowrap;flex-shrink:0;z-index:1;box-shadow:0 2px 8px rgba(30,41,59,0.2)">Hubungi Kami →</div>
</div>`,

  // ═══════════════════════════════════════════════════
  // IN_ARTICLE — Inline Promo (newsletter subscribe)
  // ═══════════════════════════════════════════════════
  "Lensaplus — Inline Promo": `<div style="width:100%;min-height:140px;padding:clamp(24px,3.5vw,36px) clamp(24px,4vw,48px);background:linear-gradient(135deg,#0f172a 0%,#1a2744 60%,#1e3a5f 100%);border-radius:12px;display:flex;align-items:center;justify-content:space-between;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;position:relative;overflow:hidden;gap:20px">
  <div style="position:absolute;right:15%;top:-40px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,0.1),transparent 70%)"></div>
  <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#6366f1,transparent)"></div>
  <div style="display:flex;align-items:center;gap:clamp(14px,2vw,20px);z-index:1;min-width:0">
    ${LOGO_SM}
    <div style="min-width:0">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span style="background:rgba(99,102,241,0.2);color:#a5b4fc;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:1px;text-transform:uppercase">Newsletter</span>
      </div>
      <div style="color:#fff;font-size:clamp(16px,2vw,20px);font-weight:800;line-height:1.2;letter-spacing:-0.3px">Berita Terpercaya ke Inbox Anda</div>
      <div style="color:rgba(255,255,255,0.4);font-size:clamp(11px,1.2vw,13px);margin-top:4px">Bergabung dengan <strong style="color:rgba(255,255,255,0.65)">10.000+ pembaca</strong> Lensaplus</div>
    </div>
  </div>
  <div style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;font-size:clamp(12px,1.3vw,14px);font-weight:700;padding:12px clamp(20px,2.5vw,28px);border-radius:10px;z-index:1;white-space:nowrap;flex-shrink:0;box-shadow:0 4px 14px rgba(99,102,241,0.3)">Subscribe Gratis →</div>
</div>`,

  // ═══════════════════════════════════════════════════
  // IN_ARTICLE — Kategori Promo
  // ═══════════════════════════════════════════════════
  "Lensaplus — Kategori Promo": `<div style="width:100%;min-height:130px;padding:clamp(20px,3vw,28px) clamp(24px,4vw,48px);background:linear-gradient(135deg,#fafafa,#f1f5f9);border-radius:12px;display:flex;align-items:center;justify-content:space-between;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;gap:20px;position:relative;overflow:hidden;border:1px solid #e2e8f0">
  <div style="display:flex;align-items:center;gap:clamp(14px,2vw,20px);z-index:1;min-width:0">
    ${LOGO_SM}
    <div style="min-width:0">
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">
        <span style="background:#1e293b;color:#fff;font-size:10px;font-weight:700;padding:4px 10px;border-radius:6px">HUKUM</span>
        <span style="background:#1e40af;color:#fff;font-size:10px;font-weight:700;padding:4px 10px;border-radius:6px">BISNIS</span>
        <span style="background:#15803d;color:#fff;font-size:10px;font-weight:700;padding:4px 10px;border-radius:6px">OLAHRAGA</span>
        <span style="background:#b91c1c;color:#fff;font-size:10px;font-weight:700;padding:4px 10px;border-radius:6px">HIBURAN</span>
        <span style="background:#7c3aed;color:#fff;font-size:10px;font-weight:700;padding:4px 10px;border-radius:6px">TECH</span>
        <span style="background:#e2e8f0;color:#475569;font-size:10px;font-weight:700;padding:4px 10px;border-radius:6px">+7 lainnya</span>
      </div>
      <div style="color:#1e293b;font-size:clamp(15px,1.8vw,18px);font-weight:800;letter-spacing:-0.3px">12 Kategori Berita Terlengkap</div>
      <div style="color:#64748b;font-size:clamp(11px,1.2vw,13px);margin-top:3px">Hukum, Bisnis, Olahraga, Hiburan, Kesehatan, Teknologi & lainnya</div>
    </div>
  </div>
  <div style="background:#1e293b;color:#fff;font-size:clamp(12px,1.3vw,14px);font-weight:700;padding:12px clamp(20px,2.5vw,28px);border-radius:10px;flex-shrink:0;z-index:1;box-shadow:0 2px 8px rgba(30,41,59,0.15)">Jelajahi →</div>
</div>`,

  // ═══════════════════════════════════════════════════
  // FOOTER — Footer CTA
  // ═══════════════════════════════════════════════════
  "Lensaplus — Footer CTA": `<div style="width:100%;min-height:160px;padding:clamp(28px,4vw,44px) clamp(24px,4vw,48px);background:linear-gradient(135deg,#0f172a 0%,#1e293b 40%,#312e81 100%);border-radius:12px;display:flex;align-items:center;justify-content:space-between;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;position:relative;overflow:hidden;gap:20px">
  <div style="position:absolute;right:10%;top:-60px;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,rgba(139,92,246,0.08),transparent 70%)"></div>
  <div style="position:absolute;left:5%;bottom:-80px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.06),transparent 70%)"></div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#ec4899)"></div>
  <div style="display:flex;align-items:center;gap:clamp(16px,2.5vw,24px);z-index:1;min-width:0">
    ${LOGO}
    <div style="min-width:0">
      <div style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">Lensaplus</div>
      <div style="color:#fff;font-size:clamp(18px,2.5vw,26px);font-weight:800;line-height:1.2;letter-spacing:-0.3px">Jadikan Lensaplus Sumber Berita Utama Anda</div>
      <div style="color:rgba(255,255,255,0.4);font-size:clamp(12px,1.3vw,14px);margin-top:6px">Berita akurat, terverifikasi, dari sumber terpercaya Indonesia</div>
    </div>
  </div>
  <div style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;font-size:clamp(13px,1.3vw,15px);font-weight:700;padding:14px clamp(24px,3vw,36px);border-radius:10px;z-index:1;white-space:nowrap;flex-shrink:0;box-shadow:0 4px 14px rgba(139,92,246,0.3)">Baca Sekarang →</div>
</div>`,

  // ═══════════════════════════════════════════════════
  // SIDEBAR — Newsletter
  // ═══════════════════════════════════════════════════
  "Lensaplus — Newsletter Sidebar": `<div style="width:100%;aspect-ratio:6/5;background:linear-gradient(160deg,#0f172a 0%,#1e293b 50%,#1a2744 100%);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(20px,3vw,28px);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;text-align:center;position:relative;overflow:hidden">
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6,#8b5cf6)"></div>
  <div style="position:absolute;top:-40px;right:-40px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.1),transparent 70%)"></div>
  ${LOGO}
  <div style="color:#fff;font-size:clamp(16px,2vw,20px);font-weight:800;line-height:1.3;margin-top:14px;letter-spacing:-0.3px">Berita Terbaru<br>Setiap Hari</div>
  <div style="color:rgba(255,255,255,0.4);font-size:clamp(11px,1.2vw,12px);margin-top:8px;line-height:1.5">Langganan newsletter Lensaplus<br>dan jangan lewatkan berita penting</div>
  <div style="display:flex;align-items:center;gap:6px;margin-top:10px">
    <span style="width:6px;height:6px;border-radius:50%;background:#22c55e"></span>
    <span style="color:rgba(255,255,255,0.5);font-size:10px;font-weight:600">10.000+ pembaca aktif</span>
  </div>
  <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-size:clamp(12px,1.3vw,13px);font-weight:700;padding:10px clamp(20px,3vw,28px);border-radius:8px;margin-top:16px;box-shadow:0 4px 12px rgba(59,130,246,0.3)">Langganan Gratis</div>
</div>`,

  // ═══════════════════════════════════════════════════
  // SIDEBAR — Pasang Iklan
  // ═══════════════════════════════════════════════════
  "Lensaplus — Pasang Iklan Sidebar": `<div style="width:100%;aspect-ratio:6/5;background:#fff;border:2px dashed #cbd5e1;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(20px,3vw,28px);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;text-align:center;position:relative;overflow:hidden">
  <div style="position:absolute;top:0;right:0;width:100px;height:100px;background:radial-gradient(circle at top right,rgba(59,130,246,0.06),transparent 70%)"></div>
  <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#eff6ff,#dbeafe);display:flex;align-items:center;justify-content:center;border:1px solid #bfdbfe">
    ${LOGO_SM}
  </div>
  <div style="color:#1e293b;font-size:clamp(16px,2vw,18px);font-weight:800;line-height:1.3;margin-top:14px;letter-spacing:-0.3px">Ruang Iklan<br>Premium</div>
  <div style="color:#64748b;font-size:clamp(11px,1.2vw,12px);margin-top:6px;line-height:1.4">300 × 250 pixel<br>Tampil di sidebar homepage</div>
  <div style="display:flex;gap:4px;margin-top:10px">
    <span style="background:#f0fdf4;color:#16a34a;font-size:9px;font-weight:700;padding:3px 8px;border-radius:12px;border:1px solid #bbf7d0">Targeting</span>
    <span style="background:#eff6ff;color:#2563eb;font-size:9px;font-weight:700;padding:3px 8px;border-radius:12px;border:1px solid #bfdbfe">Analytics</span>
  </div>
  <div style="background:#1e293b;color:#fff;font-size:clamp(11px,1.2vw,12px);font-weight:700;padding:9px clamp(18px,2.5vw,24px);border-radius:8px;margin-top:14px;box-shadow:0 2px 8px rgba(30,41,59,0.15)">Hubungi Kami</div>
</div>`,

  // ═══════════════════════════════════════════════════
  // POPUP — Newsletter popup
  // ═══════════════════════════════════════════════════
  "Lensaplus — Popup Newsletter": `<div style="width:100%;max-width:480px;background:#fff;border-radius:16px;padding:clamp(32px,4vw,48px);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;text-align:center;position:relative;overflow:hidden">
  <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#ec4899)"></div>
  <div style="position:absolute;top:-60px;right:-60px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.05),transparent 70%)"></div>
  ${LOGO_LG}
  <div style="color:#1e293b;font-size:clamp(20px,3vw,26px);font-weight:800;margin-top:20px;letter-spacing:-0.5px;line-height:1.2">Jangan Lewatkan<br>Berita Penting</div>
  <div style="color:#64748b;font-size:clamp(12px,1.3vw,14px);margin-top:10px;line-height:1.6">Dapatkan ringkasan berita terbaik dari <strong style="color:#1e293b">12 kategori</strong> langsung ke email Anda setiap pagi</div>
  <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-top:16px;flex-wrap:wrap">
    <span style="display:inline-flex;align-items:center;gap:5px;color:#64748b;font-size:12px">
      <span style="color:#22c55e">✓</span> Gratis
    </span>
    <span style="display:inline-flex;align-items:center;gap:5px;color:#64748b;font-size:12px">
      <span style="color:#22c55e">✓</span> Tanpa spam
    </span>
    <span style="display:inline-flex;align-items:center;gap:5px;color:#64748b;font-size:12px">
      <span style="color:#22c55e">✓</span> Berhenti kapan saja
    </span>
  </div>
  <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-size:clamp(14px,1.5vw,16px);font-weight:700;padding:14px 36px;border-radius:12px;margin-top:24px;display:inline-block;box-shadow:0 4px 14px rgba(59,130,246,0.3)">Langganan Newsletter Gratis</div>
  <div style="color:#94a3b8;font-size:11px;margin-top:12px">Bergabung dengan 10.000+ pembaca Lensaplus</div>
</div>`,

  // ═══════════════════════════════════════════════════
  // FLOATING_BOTTOM — Sticky bar
  // ═══════════════════════════════════════════════════
  "Lensaplus — Floating Bar": `<div style="width:100%;padding:12px clamp(16px,3vw,24px);background:linear-gradient(135deg,#0f172a,#1e293b);display:flex;align-items:center;justify-content:center;gap:clamp(12px,2vw,20px);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;position:relative">
  <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#ec4899)"></div>
  <div style="display:flex;align-items:center;gap:10px">
    <img src="/lensaplus-icon.png" alt="K" style="width:24px;height:24px;object-fit:contain;border-radius:6px">
    <span style="color:#fff;font-size:clamp(12px,1.2vw,14px);font-weight:600">Baca berita terbaru dari <strong>Lensaplus</strong></span>
  </div>
  <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-size:clamp(11px,1.1vw,13px);font-weight:700;padding:8px clamp(14px,2vw,20px);border-radius:8px;white-space:nowrap;box-shadow:0 2px 8px rgba(59,130,246,0.3)">Lihat Berita →</div>
</div>`,
};

async function main() {
  console.log("=== Redesigning Lensaplus Ads ===\n");
  let updated = 0;
  for (const [name, htmlCode] of Object.entries(updates)) {
    const result = await prisma.ad.updateMany({ where: { name }, data: { htmlCode } });
    if (result.count > 0) { updated++; console.log("  ✓", name); }
    else console.log("  ⏭ Not found:", name);
  }
  console.log(`\n=== Done! Updated ${updated} ads ===`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
