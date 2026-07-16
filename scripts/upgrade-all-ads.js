const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const LOGO = `<img src="/lensaplus-icon.png" alt="Lensaplus" style="width:48px;height:48px;object-fit:contain;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.25)">`;
const LOGO_SM = `<img src="/lensaplus-icon.png" alt="K" style="width:36px;height:36px;object-fit:contain;border-radius:10px;box-shadow:0 3px 12px rgba(0,0,0,0.2)">`;
const LOGO_LG = `<img src="/lensaplus-icon.png" alt="Lensaplus" style="width:60px;height:60px;object-fit:contain;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,0.25)">`;

const updates = {

// ═══════════════════════════════════════════════════
// BANNER PROMO — Brand awareness with animations
// ═══════════════════════════════════════════════════
"Lensaplus — Banner Promo": `<div style="width:100%;min-height:200px;padding:clamp(28px,4vw,44px) clamp(28px,5vw,56px);background:linear-gradient(135deg,#0f172a 0%,#1a2744 40%,#1e3a5f 70%,#172042 100%);border-radius:14px;display:flex;align-items:center;justify-content:space-between;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;position:relative;overflow:hidden;gap:24px">
  <style>
    @keyframes bpLine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes bpGlow{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:.7;transform:scale(1.12)}}
    @keyframes bpFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    @keyframes bpShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
    @keyframes bpTextGlow{0%,100%{text-shadow:0 0 20px rgba(59,130,246,0)}50%{text-shadow:0 0 20px rgba(59,130,246,0.3)}}
    @keyframes bpDot{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.5);opacity:1}}
    @keyframes bpBadge{0%,100%{border-color:rgba(34,197,94,0.3)}50%{border-color:rgba(34,197,94,0.7)}}
  </style>
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#22c55e,#3b82f6,#8b5cf6,#22c55e);background-size:200% 100%;animation:bpLine 4s linear infinite"></div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)"></div>
  <div style="position:absolute;right:8%;top:50%;transform:translateY(-50%);width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.08),transparent 70%);animation:bpGlow 5s ease-in-out infinite"></div>
  <div style="position:absolute;left:20%;bottom:-80px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(139,92,246,0.06),transparent 70%);animation:bpGlow 6s ease-in-out infinite 1.5s"></div>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.025),transparent);animation:bpShimmer 6s ease-in-out infinite"></div></div>
  <div style="display:flex;align-items:center;gap:clamp(18px,3vw,28px);z-index:1;min-width:0">
    <div style="position:relative;flex-shrink:0;animation:bpFloat 5s ease-in-out infinite">
      ${LOGO}
      <div style="position:absolute;bottom:-2px;right:-2px;width:16px;height:16px;border-radius:50%;background:#22c55e;border:2.5px solid #0f172a;animation:bpDot 2s ease-in-out infinite"></div>
    </div>
    <div style="min-width:0">
      <div style="display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(34,197,94,0.3);padding:4px 14px;border-radius:20px;margin-bottom:10px;animation:bpBadge 3s ease-in-out infinite">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#22c55e;animation:bpDot 2s ease-in-out infinite"></span>
        <span style="color:#4ade80;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Media Terpercaya</span>
      </div>
      <div style="color:#fff;font-size:clamp(20px,2.8vw,28px);font-weight:800;line-height:1.15;letter-spacing:-0.5px;animation:bpTextGlow 4s ease-in-out infinite">Lensaplus — Berita Akurat<br>& Terverifikasi</div>
      <div style="display:flex;align-items:center;gap:14px;margin-top:12px;flex-wrap:wrap">
        <span style="display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,0.5);font-size:12px;font-weight:500">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          12 Kategori
        </span>
        <span style="display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,0.5);font-size:12px;font-weight:500">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Update 24/7
        </span>
        <span style="display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,0.5);font-size:12px;font-weight:500">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Terverifikasi
        </span>
      </div>
    </div>
  </div>
  <div style="z-index:1;flex-shrink:0;text-align:center">
    <div style="background:rgba(255,255,255,0.07);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.12);color:#fff;font-size:clamp(13px,1.4vw,16px);font-weight:700;padding:16px clamp(24px,3vw,36px);border-radius:12px;white-space:nowrap;transition:all 0.3s">Jelajahi Berita →</div>
    <div style="color:rgba(255,255,255,0.3);font-size:10px;margin-top:6px">lensaplus.com</div>
  </div>
</div>`,

// ═══════════════════════════════════════════════════
// IKLAN BANNER SPACE — For advertisers (light theme)
// ═══════════════════════════════════════════════════
"Lensaplus — Iklan Banner Space": `<div style="width:100%;min-height:180px;padding:clamp(24px,3.5vw,40px) clamp(28px,5vw,56px);background:linear-gradient(135deg,#fefefe,#f8fafc,#f1f5f9);border-radius:14px;display:flex;align-items:center;justify-content:space-between;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;gap:24px;position:relative;overflow:hidden;border:1px solid #e2e8f0">
  <style>
    @keyframes ibsGlow{0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,0.1)}50%{box-shadow:0 0 0 12px rgba(59,130,246,0)}}
    @keyframes ibsFloat{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-5px) rotate(2deg)}}
    @keyframes ibsShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
    @keyframes ibsTextSlide{0%,100%{opacity:1;transform:translateY(0)}50%{opacity:.85;transform:translateY(-1px)}}
    @keyframes ibsBorder{0%,100%{border-color:#cbd5e1}50%{border-color:#93c5fd}}
    @keyframes ibsBadgePop{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
  </style>
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6,#6366f1,#ec4899);animation:ibsBorder 4s ease-in-out infinite"></div>
  <div style="position:absolute;top:0;right:0;width:250px;height:250px;background:radial-gradient(circle at top right,rgba(59,130,246,0.06),transparent 70%)"></div>
  <div style="position:absolute;bottom:0;left:0;width:200px;height:200px;background:radial-gradient(circle at bottom left,rgba(99,102,241,0.04),transparent 70%)"></div>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:30%;height:100%;background:linear-gradient(90deg,transparent,rgba(59,130,246,0.03),transparent);animation:ibsShimmer 7s ease-in-out infinite"></div></div>
  <div style="display:flex;align-items:center;gap:clamp(16px,2.5vw,24px);z-index:1">
    <div style="width:60px;height:60px;border-radius:16px;background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(0,0,0,0.06);animation:ibsFloat 5s ease-in-out infinite">
      ${LOGO_SM}
    </div>
    <div>
      <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
        <span style="background:linear-gradient(135deg,#eff6ff,#dbeafe);color:#2563eb;font-size:10px;font-weight:700;padding:4px 12px;border-radius:20px;border:1px solid #bfdbfe;animation:ibsBadgePop 3s ease-in-out infinite">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px;margin-right:3px"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
          Responsive
        </span>
        <span style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);color:#16a34a;font-size:10px;font-weight:700;padding:4px 12px;border-radius:20px;border:1px solid #bbf7d0;animation:ibsBadgePop 3s ease-in-out infinite .5s">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px;margin-right:3px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Targeting
        </span>
        <span style="background:linear-gradient(135deg,#fefce8,#fef9c3);color:#ca8a04;font-size:10px;font-weight:700;padding:4px 12px;border-radius:20px;border:1px solid #fde68a;animation:ibsBadgePop 3s ease-in-out infinite 1s">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px;margin-right:3px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          Analytics
        </span>
      </div>
      <div style="color:#0f172a;font-size:clamp(18px,2.5vw,24px);font-weight:800;letter-spacing:-0.5px;line-height:1.15">Iklan Anda Bisa Tampil di Sini</div>
      <div style="color:#64748b;font-size:clamp(12px,1.3vw,14px);margin-top:5px;line-height:1.4">Dilihat <strong style="color:#334155">ribuan pembaca aktif</strong> setiap hari — banner responsif dengan analytics lengkap</div>
    </div>
  </div>
  <div style="z-index:1;flex-shrink:0;text-align:center">
    <div style="background:linear-gradient(135deg,#1e293b,#0f172a);color:#fff;font-size:clamp(13px,1.4vw,15px);font-weight:700;padding:14px clamp(24px,3vw,36px);border-radius:12px;white-space:nowrap;box-shadow:0 4px 16px rgba(15,23,42,0.2);animation:ibsGlow 3s ease-in-out infinite">Hubungi Kami →</div>
    <div style="color:#94a3b8;font-size:10px;margin-top:6px">Mulai Rp 500rb/bulan</div>
  </div>
</div>`,

// ═══════════════════════════════════════════════════
// INLINE PROMO — Newsletter CTA
// ═══════════════════════════════════════════════════
"Lensaplus — Inline Promo": `<div style="width:100%;min-height:180px;padding:clamp(28px,4vw,40px) clamp(28px,5vw,56px);background:linear-gradient(135deg,#0f172a 0%,#1a2744 50%,#312e81 100%);border-radius:14px;display:flex;align-items:center;justify-content:space-between;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;position:relative;overflow:hidden;gap:24px">
  <style>
    @keyframes ipLine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes ipGlow{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:.6;transform:scale(1.1)}}
    @keyframes ipFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
    @keyframes ipPulse{0%,100%{box-shadow:0 4px 14px rgba(99,102,241,0.3)}50%{box-shadow:0 8px 30px rgba(99,102,241,0.5)}}
    @keyframes ipShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
    @keyframes ipCount{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
    @keyframes ipTextGlow{0%,100%{text-shadow:0 0 30px rgba(129,140,248,0)}50%{text-shadow:0 0 30px rgba(129,140,248,0.25)}}
  </style>
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#6366f1,#a78bfa,#c084fc,#6366f1);background-size:200% 100%;animation:ipLine 4s linear infinite"></div>
  <div style="position:absolute;right:12%;top:-40px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,0.1),transparent 70%);animation:ipGlow 5s ease-in-out infinite"></div>
  <div style="position:absolute;left:30%;bottom:-60px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(192,132,252,0.06),transparent 70%);animation:ipGlow 6s ease-in-out infinite 2s"></div>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:35%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.02),transparent);animation:ipShimmer 6s ease-in-out infinite"></div></div>
  <div style="display:flex;align-items:center;gap:clamp(16px,2.5vw,24px);z-index:1;min-width:0">
    <div style="animation:ipFloat 4s ease-in-out infinite;flex-shrink:0">
      ${LOGO}
    </div>
    <div style="min-width:0">
      <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.2);padding:4px 14px;border-radius:20px;margin-bottom:10px">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        <span style="color:#a5b4fc;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Newsletter</span>
      </div>
      <div style="color:#fff;font-size:clamp(18px,2.5vw,26px);font-weight:800;line-height:1.15;letter-spacing:-0.5px;animation:ipTextGlow 4s ease-in-out infinite">Berita Terpercaya<br>Langsung ke Inbox Anda</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
        <div style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.06);padding:5px 12px;border-radius:20px;animation:ipCount 3s ease-in-out infinite">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span style="color:rgba(255,255,255,0.6);font-size:12px;font-weight:600"><strong style="color:#4ade80">10.000+</strong> pembaca</span>
        </div>
      </div>
    </div>
  </div>
  <div style="z-index:1;flex-shrink:0;text-align:center">
    <div style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;font-size:clamp(13px,1.4vw,16px);font-weight:700;padding:16px clamp(24px,3vw,36px);border-radius:12px;white-space:nowrap;animation:ipPulse 3s ease-in-out infinite">Subscribe Gratis →</div>
    <div style="color:rgba(255,255,255,0.3);font-size:10px;margin-top:6px">Tanpa spam · Berhenti kapan saja</div>
  </div>
</div>`,

// ═══════════════════════════════════════════════════
// KATEGORI PROMO — Light theme, colorful
// ═══════════════════════════════════════════════════
"Lensaplus — Kategori Promo": `<div style="width:100%;min-height:170px;padding:clamp(24px,3.5vw,36px) clamp(28px,5vw,56px);background:linear-gradient(135deg,#fefefe,#f8fafc);border-radius:14px;display:flex;align-items:center;justify-content:space-between;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;gap:24px;position:relative;overflow:hidden;border:1px solid #e2e8f0">
  <style>
    @keyframes kpLine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes kpBadge{0%{transform:translateY(0)}100%{transform:translateY(-2px)}}
    @keyframes kpFloat{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-4px) rotate(1deg)}}
    @keyframes kpShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
    @keyframes kpBtn{0%,100%{box-shadow:0 4px 12px rgba(15,23,42,0.12)}50%{box-shadow:0 6px 20px rgba(15,23,42,0.2)}}
  </style>
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#ef4444,#f59e0b,#22c55e,#3b82f6,#8b5cf6);background-size:200% 100%;animation:kpLine 5s linear infinite"></div>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:30%;height:100%;background:linear-gradient(90deg,transparent,rgba(59,130,246,0.02),transparent);animation:kpShimmer 8s ease-in-out infinite"></div></div>
  <div style="display:flex;align-items:center;gap:clamp(16px,2.5vw,24px);z-index:1;min-width:0">
    <div style="animation:kpFloat 5s ease-in-out infinite;flex-shrink:0">
      ${LOGO_SM}
    </div>
    <div style="min-width:0">
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px">
        <span style="background:linear-gradient(135deg,#1e293b,#334155);color:#fff;font-size:10px;font-weight:700;padding:5px 12px;border-radius:6px;animation:kpBadge 2s ease-in-out infinite alternate">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px;margin-right:2px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          HUKUM</span>
        <span style="background:linear-gradient(135deg,#1e40af,#2563eb);color:#fff;font-size:10px;font-weight:700;padding:5px 12px;border-radius:6px;animation:kpBadge 2s ease-in-out infinite alternate .15s">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px;margin-right:2px"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          BISNIS</span>
        <span style="background:linear-gradient(135deg,#15803d,#16a34a);color:#fff;font-size:10px;font-weight:700;padding:5px 12px;border-radius:6px;animation:kpBadge 2s ease-in-out infinite alternate .3s">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px;margin-right:2px"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
          OLAHRAGA</span>
        <span style="background:linear-gradient(135deg,#b91c1c,#dc2626);color:#fff;font-size:10px;font-weight:700;padding:5px 12px;border-radius:6px;animation:kpBadge 2s ease-in-out infinite alternate .45s">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px;margin-right:2px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          HIBURAN</span>
        <span style="background:linear-gradient(135deg,#7c3aed,#8b5cf6);color:#fff;font-size:10px;font-weight:700;padding:5px 12px;border-radius:6px;animation:kpBadge 2s ease-in-out infinite alternate .6s">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px;margin-right:2px"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          TECH</span>
        <span style="background:#f1f5f9;color:#475569;font-size:10px;font-weight:700;padding:5px 12px;border-radius:6px;border:1px solid #e2e8f0">+7 lainnya</span>
      </div>
      <div style="color:#0f172a;font-size:clamp(17px,2.2vw,22px);font-weight:800;letter-spacing:-0.3px">12 Kategori Berita Terlengkap</div>
      <div style="color:#64748b;font-size:clamp(12px,1.3vw,14px);margin-top:4px">Hukum, Bisnis, Olahraga, Hiburan, Kesehatan, Teknologi & lainnya</div>
    </div>
  </div>
  <div style="z-index:1;flex-shrink:0">
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;font-size:clamp(13px,1.4vw,15px);font-weight:700;padding:14px clamp(24px,3vw,36px);border-radius:12px;flex-shrink:0;white-space:nowrap;animation:kpBtn 3s ease-in-out infinite">Jelajahi →</div>
  </div>
</div>`,

// ═══════════════════════════════════════════════════
// FOOTER CTA — Premium gradient
// ═══════════════════════════════════════════════════
"Lensaplus — Footer CTA": `<div style="width:100%;min-height:200px;padding:clamp(28px,4vw,44px) clamp(28px,5vw,56px);background:linear-gradient(135deg,#0f172a 0%,#1e293b 30%,#312e81 70%,#1e1b4b 100%);border-radius:14px;display:flex;align-items:center;justify-content:space-between;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;position:relative;overflow:hidden;gap:24px">
  <style>
    @keyframes fcLine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes fcGlow{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:.6;transform:scale(1.1)}}
    @keyframes fcFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
    @keyframes fcPulse{0%,100%{box-shadow:0 4px 14px rgba(139,92,246,0.3)}50%{box-shadow:0 8px 30px rgba(139,92,246,0.5)}}
    @keyframes fcShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
    @keyframes fcTextGlow{0%,100%{text-shadow:0 0 30px rgba(167,139,250,0)}50%{text-shadow:0 0 30px rgba(167,139,250,0.3)}}
    @keyframes fcStar{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}
  </style>
  <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#ec4899,#f59e0b);background-size:200% 100%;animation:fcLine 4s linear infinite"></div>
  <div style="position:absolute;right:8%;top:-50px;width:250px;height:250px;border-radius:50%;background:radial-gradient(circle,rgba(139,92,246,0.1),transparent 70%);animation:fcGlow 5s ease-in-out infinite"></div>
  <div style="position:absolute;left:10%;bottom:-60px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.07),transparent 70%);animation:fcGlow 6s ease-in-out infinite 2s"></div>
  <div style="position:absolute;top:20%;left:5%;width:4px;height:4px;border-radius:50%;background:rgba(251,191,36,0.5);animation:fcStar 3s ease-in-out infinite"></div>
  <div style="position:absolute;top:65%;right:25%;width:3px;height:3px;border-radius:50%;background:rgba(167,139,250,0.5);animation:fcStar 4s ease-in-out infinite 1s"></div>
  <div style="position:absolute;bottom:25%;left:35%;width:3px;height:3px;border-radius:50%;background:rgba(96,165,250,0.4);animation:fcStar 3.5s ease-in-out infinite 2s"></div>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.02),transparent);animation:fcShimmer 6s ease-in-out infinite"></div></div>
  <div style="display:flex;align-items:center;gap:clamp(18px,3vw,28px);z-index:1;min-width:0">
    <div style="animation:fcFloat 4.5s ease-in-out infinite;flex-shrink:0">
      ${LOGO}
    </div>
    <div style="min-width:0">
      <div style="display:inline-flex;align-items:center;gap:6px;margin-bottom:10px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#a78bfa" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <span style="color:#a78bfa;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Lensaplus</span>
      </div>
      <div style="color:#fff;font-size:clamp(20px,2.8vw,28px);font-weight:800;line-height:1.15;letter-spacing:-0.5px;animation:fcTextGlow 4s ease-in-out infinite">Jadikan Lensaplus<br>Sumber Berita Utama Anda</div>
      <div style="color:rgba(255,255,255,0.4);font-size:clamp(12px,1.3vw,15px);margin-top:8px;line-height:1.4">Berita akurat, terverifikasi, dari sumber terpercaya Indonesia</div>
    </div>
  </div>
  <div style="z-index:1;flex-shrink:0;text-align:center">
    <div style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;font-size:clamp(14px,1.5vw,17px);font-weight:700;padding:16px clamp(28px,3.5vw,44px);border-radius:12px;white-space:nowrap;animation:fcPulse 3s ease-in-out infinite">Baca Sekarang →</div>
    <div style="color:rgba(255,255,255,0.3);font-size:10px;margin-top:6px">lensaplus.com</div>
  </div>
</div>`,

// ═══════════════════════════════════════════════════
// SIDEBAR — Newsletter
// ═══════════════════════════════════════════════════
"Lensaplus — Newsletter Sidebar": `<div style="width:100%;aspect-ratio:6/5;background:linear-gradient(160deg,#0f172a 0%,#1a2744 40%,#312e81 100%);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(20px,3vw,28px);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;text-align:center;position:relative;overflow:hidden">
  <style>
    @keyframes nsLine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes nsGlow{0%,100%{opacity:.3}50%{opacity:.6}}
    @keyframes nsFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
    @keyframes nsPulse{0%,100%{box-shadow:0 4px 14px rgba(59,130,246,0.3)}50%{box-shadow:0 6px 24px rgba(59,130,246,0.5)}}
    @keyframes nsDot{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.5);opacity:1}}
    @keyframes nsTextGlow{0%,100%{text-shadow:0 0 20px rgba(96,165,250,0)}50%{text-shadow:0 0 20px rgba(96,165,250,0.2)}}
  </style>
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#ec4899);background-size:200% 100%;animation:nsLine 4s linear infinite"></div>
  <div style="position:absolute;top:-30px;right:-30px;width:100px;height:100px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,0.12),transparent 70%);animation:nsGlow 4s ease-in-out infinite"></div>
  <div style="position:absolute;bottom:-20px;left:-20px;width:80px;height:80px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.08),transparent 70%);animation:nsGlow 5s ease-in-out infinite 1.5s"></div>
  <div style="animation:nsFloat 4s ease-in-out infinite">
    ${LOGO}
  </div>
  <div style="color:#fff;font-size:clamp(17px,2.2vw,22px);font-weight:800;line-height:1.25;margin-top:16px;letter-spacing:-0.3px;animation:nsTextGlow 4s ease-in-out infinite">Berita Terbaru<br>Setiap Hari</div>
  <div style="color:rgba(255,255,255,0.4);font-size:clamp(11px,1.2vw,12px);margin-top:8px;line-height:1.5">Langganan newsletter Lensaplus<br>dan jangan lewatkan berita penting</div>
  <div style="display:flex;align-items:center;gap:6px;margin-top:10px">
    <span style="width:7px;height:7px;border-radius:50%;background:#22c55e;animation:nsDot 2s ease-in-out infinite"></span>
    <span style="color:rgba(255,255,255,0.5);font-size:10px;font-weight:600">10.000+ pembaca aktif</span>
  </div>
  <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-size:clamp(12px,1.3vw,13px);font-weight:700;padding:11px clamp(22px,3vw,30px);border-radius:10px;margin-top:16px;animation:nsPulse 3s ease-in-out infinite">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-2px;margin-right:4px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
    Langganan Gratis
  </div>
</div>`,

// ═══════════════════════════════════════════════════
// SIDEBAR — Pasang Iklan
// ═══════════════════════════════════════════════════
"Lensaplus — Pasang Iklan Sidebar": `<div style="width:100%;aspect-ratio:6/5;background:#fff;border:1px solid #e2e8f0;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(20px,3vw,28px);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;text-align:center;position:relative;overflow:hidden">
  <style>
    @keyframes psBorder{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes psFloat{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-4px) rotate(2deg)}}
    @keyframes psGlow{0%,100%{box-shadow:0 4px 12px rgba(15,23,42,0.1)}50%{box-shadow:0 6px 20px rgba(15,23,42,0.2)}}
    @keyframes psBadge{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
    @keyframes psShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
  </style>
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6,#6366f1,#ec4899,#3b82f6);background-size:200% 100%;animation:psBorder 4s linear infinite"></div>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(59,130,246,0.03),transparent);animation:psShimmer 7s ease-in-out infinite"></div></div>
  <div style="width:60px;height:60px;border-radius:16px;background:linear-gradient(135deg,#f8fafc,#eff6ff);display:flex;align-items:center;justify-content:center;border:1px solid #dbeafe;animation:psFloat 5s ease-in-out infinite">
    ${LOGO_SM}
  </div>
  <div style="color:#0f172a;font-size:clamp(17px,2.2vw,20px);font-weight:800;line-height:1.25;margin-top:14px;letter-spacing:-0.3px">Ruang Iklan<br>Premium</div>
  <div style="color:#64748b;font-size:clamp(11px,1.2vw,12px);margin-top:6px;line-height:1.4">300 × 250 pixel · Sidebar homepage</div>
  <div style="display:flex;gap:5px;margin-top:10px;flex-wrap:wrap;justify-content:center">
    <span style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);color:#16a34a;font-size:9px;font-weight:700;padding:4px 10px;border-radius:14px;border:1px solid #bbf7d0;animation:psBadge 3s ease-in-out infinite">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px;margin-right:2px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      Targeting</span>
    <span style="background:linear-gradient(135deg,#eff6ff,#dbeafe);color:#2563eb;font-size:9px;font-weight:700;padding:4px 10px;border-radius:14px;border:1px solid #bfdbfe;animation:psBadge 3s ease-in-out infinite .5s">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px;margin-right:2px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      Analytics</span>
  </div>
  <div style="background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;font-size:clamp(11px,1.2vw,12px);font-weight:700;padding:10px clamp(20px,2.5vw,26px);border-radius:10px;margin-top:14px;animation:psGlow 3s ease-in-out infinite">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px;margin-right:3px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
    Hubungi Kami
  </div>
</div>`,

// ═══════════════════════════════════════════════════
// POPUP — Newsletter
// ═══════════════════════════════════════════════════
"Lensaplus — Popup Newsletter": `<div style="width:100%;max-width:480px;background:#fff;border-radius:20px;padding:clamp(36px,5vw,52px) clamp(32px,4vw,48px);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;text-align:center;position:relative;overflow:hidden">
  <style>
    @keyframes ppLine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes ppFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    @keyframes ppPulse{0%,100%{box-shadow:0 4px 16px rgba(59,130,246,0.25)}50%{box-shadow:0 8px 32px rgba(59,130,246,0.4)}}
    @keyframes ppCheck{0%,100%{color:#22c55e}50%{color:#16a34a;transform:scale(1.2)}}
    @keyframes ppShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
    @keyframes ppGlow{0%,100%{opacity:0}50%{opacity:1}}
  </style>
  <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#ec4899,#f59e0b,#3b82f6);background-size:200% 100%;animation:ppLine 4s linear infinite"></div>
  <div style="position:absolute;top:-60px;right:-60px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.06),transparent 70%)"></div>
  <div style="position:absolute;bottom:-40px;left:-40px;width:140px;height:140px;border-radius:50%;background:radial-gradient(circle,rgba(139,92,246,0.05),transparent 70%)"></div>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:30%;height:100%;background:linear-gradient(90deg,transparent,rgba(59,130,246,0.02),transparent);animation:ppShimmer 7s ease-in-out infinite"></div></div>
  <div style="animation:ppFloat 4s ease-in-out infinite;display:inline-block">
    ${LOGO_LG}
  </div>
  <div style="color:#0f172a;font-size:clamp(22px,3.5vw,30px);font-weight:800;margin-top:22px;letter-spacing:-0.5px;line-height:1.15">Jangan Lewatkan<br>Berita Penting</div>
  <div style="color:#64748b;font-size:clamp(13px,1.5vw,15px);margin-top:12px;line-height:1.6">Dapatkan ringkasan berita terbaik dari <strong style="color:#1e293b">12 kategori</strong> langsung ke email Anda setiap pagi</div>
  <div style="display:flex;align-items:center;justify-content:center;gap:20px;margin-top:18px;flex-wrap:wrap">
    <span style="display:inline-flex;align-items:center;gap:5px;color:#475569;font-size:13px;font-weight:500">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" style="animation:ppCheck 3s ease-in-out infinite"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      Gratis
    </span>
    <span style="display:inline-flex;align-items:center;gap:5px;color:#475569;font-size:13px;font-weight:500">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" style="animation:ppCheck 3s ease-in-out infinite .5s"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      Tanpa spam
    </span>
    <span style="display:inline-flex;align-items:center;gap:5px;color:#475569;font-size:13px;font-weight:500">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" style="animation:ppCheck 3s ease-in-out infinite 1s"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      Berhenti kapan saja
    </span>
  </div>
  <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-size:clamp(14px,1.6vw,17px);font-weight:700;padding:16px 40px;border-radius:14px;margin-top:26px;display:inline-block;animation:ppPulse 3s ease-in-out infinite">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-2px;margin-right:6px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
    Langganan Newsletter Gratis
  </div>
  <div style="color:#94a3b8;font-size:12px;margin-top:14px">Bergabung dengan <strong style="color:#64748b">10.000+</strong> pembaca Lensaplus</div>
</div>`,

// ═══════════════════════════════════════════════════
// FLOATING BAR — Bottom sticky
// ═══════════════════════════════════════════════════
"Lensaplus — Floating Bar": `<div style="width:100%;padding:14px clamp(18px,3vw,28px);background:linear-gradient(135deg,#0f172a,#1e293b);display:flex;align-items:center;justify-content:center;gap:clamp(14px,2.5vw,24px);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;position:relative;overflow:hidden">
  <style>
    @keyframes fbLine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes fbPulse{0%,100%{box-shadow:0 2px 10px rgba(59,130,246,0.25)}50%{box-shadow:0 4px 18px rgba(59,130,246,0.45)}}
    @keyframes fbDot{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.4);opacity:1}}
    @keyframes fbShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
  </style>
  <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#ec4899,#3b82f6);background-size:200% 100%;animation:fbLine 4s linear infinite"></div>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:30%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.02),transparent);animation:fbShimmer 5s ease-in-out infinite"></div></div>
  <div style="display:flex;align-items:center;gap:10px;z-index:1">
    <img src="/lensaplus-icon.png" alt="K" style="width:28px;height:28px;object-fit:contain;border-radius:7px;box-shadow:0 2px 8px rgba(0,0,0,0.2)">
    <span style="display:inline-flex;align-items:center;gap:6px;color:#fff;font-size:clamp(12px,1.3vw,14px);font-weight:600">
      <span style="width:7px;height:7px;border-radius:50%;background:#22c55e;animation:fbDot 2s ease-in-out infinite"></span>
      Baca berita terbaru dari <strong>Lensaplus</strong>
    </span>
  </div>
  <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-size:clamp(11px,1.2vw,13px);font-weight:700;padding:9px clamp(16px,2vw,22px);border-radius:8px;white-space:nowrap;animation:fbPulse 3s ease-in-out infinite;z-index:1">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px;margin-right:3px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
    Lihat Berita →
  </div>
</div>`,

};

async function main() {
  console.log("=== Upgrading All Ads (Premium Icons + Text Effects) ===\n");
  let updated = 0;
  for (const [name, htmlCode] of Object.entries(updates)) {
    const result = await prisma.ad.updateMany({ where: { name }, data: { htmlCode } });
    if (result.count > 0) { updated++; console.log("  ✓", name); }
    else console.log("  ⏭ Not found:", name);
  }
  console.log(`\n=== Done! Updated ${updated} ads ===`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
