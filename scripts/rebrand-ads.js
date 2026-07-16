const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Brand colors from tailwind.config.ts
// Primary: #002045 (navy), #001530 (dark), #1a3a5c (container), #e8edf3 (light), #f0f4f8 (50)
// Secondary: #b7102a (red), #8f0c20 (dark), #d4364d (container), #fce8eb (light)
// Tertiary: #371800 (warm dark)

const LOGO = `<img src="/lensaplus-icon.png" alt="Lensaplus" style="width:48px;height:48px;object-fit:contain;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.25)">`;
const LOGO_SM = `<img src="/lensaplus-icon.png" alt="K" style="width:36px;height:36px;object-fit:contain;border-radius:10px;box-shadow:0 3px 12px rgba(0,0,0,0.2)">`;
const LOGO_LG = `<img src="/lensaplus-icon.png" alt="Lensaplus" style="width:60px;height:60px;object-fit:contain;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,0.25)">`;

const updates = {

// ═══ HEADER AD ═══
"Lensaplus — Pasang Iklan Header": `<div style="width:100%;min-height:220px;background:linear-gradient(135deg,#001530 0%,#002045 40%,#1a3a5c 70%,#002045 100%);border-radius:14px;display:flex;align-items:center;justify-content:space-between;padding:clamp(28px,4vw,44px) clamp(28px,5vw,56px);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;overflow:hidden;position:relative;gap:24px">
  <style>
    @keyframes htLine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes htGlow{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:.8;transform:scale(1.15)}}
    @keyframes htFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    @keyframes htPulse{0%,100%{box-shadow:0 4px 14px rgba(183,16,42,0.3)}50%{box-shadow:0 6px 28px rgba(183,16,42,0.5)}}
    @keyframes htShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
    @keyframes htShine{0%{background-position:200% center}100%{background-position:-200% center}}
    @keyframes htBadge{0%,100%{background:rgba(183,16,42,0.2)}50%{background:rgba(183,16,42,0.35)}}
    @keyframes htSubPulse{0%,100%{opacity:.45;transform:translateY(0)}50%{opacity:.7;transform:translateY(-1px)}}
    @keyframes htTagFloat{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-3px);opacity:.8}}
    @keyframes htDotPing{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(183,16,42,0.3)}50%{transform:scale(1.4);box-shadow:0 0 0 3px rgba(183,16,42,0)}}
    @keyframes htP1{0%{transform:translate(0,0);opacity:.15}50%{transform:translate(30px,-25px);opacity:.3}100%{transform:translate(0,0);opacity:.15}}
    @keyframes htP2{0%{transform:translate(0,0);opacity:.1}50%{transform:translate(-20px,15px);opacity:.25}100%{transform:translate(0,0);opacity:.1}}
  </style>
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#b7102a,#d4364d,#002045,#1a3a5c,#b7102a);background-size:200% 100%;animation:htLine 4s linear infinite"></div>
  <div style="position:absolute;top:-40px;right:10%;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(183,16,42,0.1),transparent 70%);animation:htGlow 4s ease-in-out infinite"></div>
  <div style="position:absolute;bottom:-60px;left:15%;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(26,58,92,0.15),transparent 70%);animation:htGlow 5s ease-in-out infinite 1s"></div>
  <div style="position:absolute;top:25%;left:8%;width:6px;height:6px;border-radius:50%;background:rgba(183,16,42,0.3);animation:htP1 8s ease-in-out infinite"></div>
  <div style="position:absolute;top:60%;right:15%;width:4px;height:4px;border-radius:50%;background:rgba(26,58,92,0.4);animation:htP2 10s ease-in-out infinite 1s"></div>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:50%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent);animation:htShimmer 5s ease-in-out infinite"></div></div>
  <div style="display:flex;align-items:center;gap:clamp(18px,3vw,28px);z-index:1">
    <div style="animation:htFloat 4s ease-in-out infinite;flex-shrink:0">${LOGO}</div>
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><span style="color:#d4364d;font-size:11px;font-weight:700;padding:4px 14px;border-radius:20px;letter-spacing:1.5px;text-transform:uppercase;animation:htBadge 3s ease-in-out infinite">⚡ Ruang Iklan Premium</span></div>
      <div style="font-size:clamp(22px,3vw,32px);font-weight:800;letter-spacing:-0.5px;line-height:1.15;background:linear-gradient(90deg,#fff 0%,#fff 30%,#e8edf3 48%,#d4364d 52%,#fff 70%,#fff 100%);background-size:300% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:htShine 5s linear infinite">Tampilkan Brand Anda<br>di Lensaplus</div>
      <div style="color:rgba(255,255,255,0.45);font-size:clamp(13px,1.5vw,16px);margin-top:8px;line-height:1.5;animation:htSubPulse 5s ease-in-out infinite">Jangkau <strong style="color:rgba(255,255,255,0.75)">audiens yang tepat</strong> setiap hari<br>di media digital terpercaya Indonesia</div>
      <div style="display:flex;align-items:center;gap:16px;margin-top:14px;flex-wrap:wrap">
        <span style="display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,0.5);font-size:12px;animation:htTagFloat 3s ease-in-out infinite"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#b7102a;animation:htDotPing 2s ease-in-out infinite"></span> 12 Kategori</span>
        <span style="display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,0.5);font-size:12px;animation:htTagFloat 3s ease-in-out infinite .4s"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#1a3a5c;animation:htDotPing 2s ease-in-out infinite .4s"></span> Update 24/7</span>
        <span style="display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,0.5);font-size:12px;animation:htTagFloat 3s ease-in-out infinite .8s"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#d4364d;animation:htDotPing 2s ease-in-out infinite .8s"></span> Targeted</span>
      </div>
    </div>
  </div>
  <div style="z-index:1;flex-shrink:0;text-align:center"><div style="background:linear-gradient(135deg,#b7102a,#8f0c20);color:#fff;font-size:clamp(14px,1.5vw,17px);font-weight:700;padding:16px clamp(28px,3.5vw,44px);border-radius:12px;white-space:nowrap;animation:htPulse 3s ease-in-out infinite;cursor:pointer">Pasang Iklan →</div></div>
</div>`,

// ═══ BANNER PROMO ═══
"Lensaplus — Banner Promo": `<div style="width:100%;min-height:200px;padding:clamp(28px,4vw,44px) clamp(28px,5vw,56px);background:linear-gradient(135deg,#001530 0%,#002045 40%,#1a3a5c 70%,#002045 100%);border-radius:14px;display:flex;align-items:center;justify-content:space-between;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;position:relative;overflow:hidden;gap:24px">
  <style>
    @keyframes bpLine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes bpGlow{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:.7;transform:scale(1.12)}}
    @keyframes bpFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    @keyframes bpShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
    @keyframes bpShine{0%{background-position:200% center}100%{background-position:-200% center}}
    @keyframes bpDot{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(183,16,42,0.3)}50%{transform:scale(1.4);box-shadow:0 0 0 3px rgba(183,16,42,0)}}
    @keyframes bpBadge{0%,100%{border-color:rgba(183,16,42,0.2)}50%{border-color:rgba(183,16,42,0.5)}}
  </style>
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#b7102a,#d4364d,#1a3a5c,#b7102a);background-size:200% 100%;animation:bpLine 4s linear infinite"></div>
  <div style="position:absolute;right:8%;top:50%;transform:translateY(-50%);width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(183,16,42,0.07),transparent 70%);animation:bpGlow 5s ease-in-out infinite"></div>
  <div style="position:absolute;left:20%;bottom:-80px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(26,58,92,0.1),transparent 70%);animation:bpGlow 6s ease-in-out infinite 1.5s"></div>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.025),transparent);animation:bpShimmer 6s ease-in-out infinite"></div></div>
  <div style="display:flex;align-items:center;gap:clamp(18px,3vw,28px);z-index:1;min-width:0">
    <div style="position:relative;flex-shrink:0;animation:bpFloat 5s ease-in-out infinite">${LOGO}<div style="position:absolute;bottom:-2px;right:-2px;width:16px;height:16px;border-radius:50%;background:#b7102a;border:2.5px solid #001530;animation:bpDot 2s ease-in-out infinite"></div></div>
    <div style="min-width:0">
      <div style="display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(183,16,42,0.2);padding:4px 14px;border-radius:20px;margin-bottom:10px;animation:bpBadge 3s ease-in-out infinite"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#b7102a;animation:bpDot 2s ease-in-out infinite"></span><span style="color:#d4364d;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Media Terpercaya</span></div>
      <div style="font-size:clamp(20px,2.8vw,28px);font-weight:800;line-height:1.15;letter-spacing:-0.5px;background:linear-gradient(90deg,#fff 0%,#fff 30%,#e8edf3 48%,#d4364d 52%,#fff 70%,#fff 100%);background-size:300% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:bpShine 5s linear infinite">Lensaplus — Berita Akurat<br>& Terverifikasi</div>
      <div style="display:flex;align-items:center;gap:14px;margin-top:12px;flex-wrap:wrap">
        <span style="display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,0.5);font-size:12px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b7102a" stroke-width="2.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg> 12 Kategori</span>
        <span style="display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,0.5);font-size:12px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a3a5c" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Update 24/7</span>
        <span style="display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,0.5);font-size:12px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4364d" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Terverifikasi</span>
      </div>
    </div>
  </div>
  <div style="z-index:1;flex-shrink:0"><div style="background:rgba(255,255,255,0.07);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.12);color:#fff;font-size:clamp(13px,1.4vw,16px);font-weight:700;padding:16px clamp(24px,3vw,36px);border-radius:12px;white-space:nowrap">Jelajahi Berita →</div></div>
</div>`,

// ═══ IKLAN BANNER SPACE (light) ═══
"Lensaplus — Iklan Banner Space": `<div style="width:100%;min-height:180px;padding:clamp(24px,3.5vw,40px) clamp(28px,5vw,56px);background:linear-gradient(135deg,#fff,#f0f4f8,#e8edf3);border-radius:14px;display:flex;align-items:center;justify-content:space-between;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;gap:24px;position:relative;overflow:hidden;border:1px solid #e8edf3">
  <style>
    @keyframes ibsFloat{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-5px) rotate(2deg)}}
    @keyframes ibsGlow{0%,100%{box-shadow:0 0 0 0 rgba(0,32,69,0.08)}50%{box-shadow:0 0 0 12px rgba(0,32,69,0)}}
    @keyframes ibsShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
    @keyframes ibsBadge{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
  </style>
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#002045,#1a3a5c,#b7102a,#002045);background-size:200% 100%;animation:ibsFloat 4s ease-in-out infinite"></div>
  <div style="position:absolute;top:0;right:0;width:250px;height:250px;background:radial-gradient(circle at top right,rgba(0,32,69,0.04),transparent 70%)"></div>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:30%;height:100%;background:linear-gradient(90deg,transparent,rgba(0,32,69,0.02),transparent);animation:ibsShimmer 7s ease-in-out infinite"></div></div>
  <div style="display:flex;align-items:center;gap:clamp(16px,2.5vw,24px);z-index:1">
    <div style="width:60px;height:60px;border-radius:16px;background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #e8edf3;box-shadow:0 4px 16px rgba(0,32,69,0.06);animation:ibsFloat 5s ease-in-out infinite">${LOGO_SM}</div>
    <div>
      <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
        <span style="background:#e8edf3;color:#002045;font-size:10px;font-weight:700;padding:4px 12px;border-radius:20px;border:1px solid rgba(0,32,69,0.08);animation:ibsBadge 3s ease-in-out infinite"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px;margin-right:3px"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>Responsive</span>
        <span style="background:#fce8eb;color:#b7102a;font-size:10px;font-weight:700;padding:4px 12px;border-radius:20px;border:1px solid rgba(183,16,42,0.1);animation:ibsBadge 3s ease-in-out infinite .4s"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px;margin-right:3px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Targeting</span>
        <span style="background:#e8edf3;color:#1a3a5c;font-size:10px;font-weight:700;padding:4px 12px;border-radius:20px;border:1px solid rgba(26,58,92,0.1);animation:ibsBadge 3s ease-in-out infinite .8s"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px;margin-right:3px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>Analytics</span>
      </div>
      <div style="color:#002045;font-size:clamp(18px,2.5vw,24px);font-weight:800;letter-spacing:-0.5px;line-height:1.15">Iklan Anda Bisa Tampil di Sini</div>
      <div style="color:#44474e;font-size:clamp(12px,1.3vw,14px);margin-top:5px">Dilihat <strong style="color:#002045">audiens yang tepat</strong> setiap hari — banner responsif dengan analytics</div>
    </div>
  </div>
  <div style="z-index:1;flex-shrink:0"><div style="background:linear-gradient(135deg,#002045,#001530);color:#fff;font-size:clamp(13px,1.4vw,15px);font-weight:700;padding:14px clamp(24px,3vw,36px);border-radius:12px;white-space:nowrap;box-shadow:0 4px 16px rgba(0,32,69,0.2);animation:ibsGlow 3s ease-in-out infinite">Hubungi Kami →</div></div>
</div>`,

// ═══ INLINE PROMO ═══
"Lensaplus — Inline Promo": `<div style="width:100%;min-height:180px;padding:clamp(28px,4vw,40px) clamp(28px,5vw,56px);background:linear-gradient(135deg,#001530 0%,#002045 50%,#1a3a5c 100%);border-radius:14px;display:flex;align-items:center;justify-content:space-between;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;position:relative;overflow:hidden;gap:24px">
  <style>
    @keyframes ipLine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes ipFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
    @keyframes ipPulse{0%,100%{box-shadow:0 4px 14px rgba(183,16,42,0.25)}50%{box-shadow:0 8px 30px rgba(183,16,42,0.4)}}
    @keyframes ipShine{0%{background-position:200% center}100%{background-position:-200% center}}
    @keyframes ipGlow{0%,100%{opacity:.3}50%{opacity:.6}}
    @keyframes ipShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
  </style>
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#b7102a,#d4364d,#002045,#1a3a5c,#b7102a);background-size:200% 100%;animation:ipLine 4s linear infinite"></div>
  <div style="position:absolute;right:12%;top:-40px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(183,16,42,0.08),transparent 70%);animation:ipGlow 5s ease-in-out infinite"></div>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:35%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.02),transparent);animation:ipShimmer 6s ease-in-out infinite"></div></div>
  <div style="display:flex;align-items:center;gap:clamp(16px,2.5vw,24px);z-index:1;min-width:0">
    <div style="animation:ipFloat 4s ease-in-out infinite;flex-shrink:0">${LOGO}</div>
    <div style="min-width:0">
      <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(183,16,42,0.12);border:1px solid rgba(183,16,42,0.2);padding:4px 14px;border-radius:20px;margin-bottom:10px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4364d" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><span style="color:#d4364d;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Newsletter</span></div>
      <div style="font-size:clamp(18px,2.5vw,26px);font-weight:800;line-height:1.15;letter-spacing:-0.5px;background:linear-gradient(90deg,#fff 0%,#fff 30%,#e8edf3 48%,#d4364d 52%,#fff 70%,#fff 100%);background-size:300% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:ipShine 5s linear infinite">Berita Terpercaya<br>Langsung ke Inbox Anda</div>
      <div style="color:rgba(255,255,255,0.4);font-size:clamp(11px,1.2vw,13px);margin-top:6px">Gratis · Tanpa spam · Berhenti kapan saja</div>
    </div>
  </div>
  <div style="z-index:1;flex-shrink:0"><div style="background:linear-gradient(135deg,#b7102a,#8f0c20);color:#fff;font-size:clamp(13px,1.4vw,16px);font-weight:700;padding:16px clamp(24px,3vw,36px);border-radius:12px;white-space:nowrap;animation:ipPulse 3s ease-in-out infinite">Subscribe Gratis →</div></div>
</div>`,

// ═══ KATEGORI PROMO ═══
"Lensaplus — Kategori Promo": `<div style="width:100%;min-height:170px;padding:clamp(24px,3.5vw,36px) clamp(28px,5vw,56px);background:linear-gradient(135deg,#fff,#f0f4f8);border-radius:14px;display:flex;align-items:center;justify-content:space-between;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;gap:24px;position:relative;overflow:hidden;border:1px solid #e8edf3">
  <style>
    @keyframes kpLine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes kpBadge{0%{transform:translateY(0)}100%{transform:translateY(-2px)}}
    @keyframes kpFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
    @keyframes kpShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
    @keyframes kpBtn{0%,100%{box-shadow:0 4px 12px rgba(0,32,69,0.1)}50%{box-shadow:0 6px 20px rgba(0,32,69,0.2)}}
  </style>
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#002045,#1a3a5c,#b7102a,#d4364d,#002045);background-size:200% 100%;animation:kpLine 5s linear infinite"></div>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:30%;height:100%;background:linear-gradient(90deg,transparent,rgba(0,32,69,0.02),transparent);animation:kpShimmer 8s ease-in-out infinite"></div></div>
  <div style="display:flex;align-items:center;gap:clamp(16px,2.5vw,24px);z-index:1;min-width:0">
    <div style="animation:kpFloat 5s ease-in-out infinite;flex-shrink:0">${LOGO_SM}</div>
    <div style="min-width:0">
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px">
        <span style="background:#002045;color:#fff;font-size:10px;font-weight:700;padding:5px 12px;border-radius:6px;animation:kpBadge 2s ease-in-out infinite alternate">HUKUM</span>
        <span style="background:#1a3a5c;color:#fff;font-size:10px;font-weight:700;padding:5px 12px;border-radius:6px;animation:kpBadge 2s ease-in-out infinite alternate .15s">BISNIS</span>
        <span style="background:#b7102a;color:#fff;font-size:10px;font-weight:700;padding:5px 12px;border-radius:6px;animation:kpBadge 2s ease-in-out infinite alternate .3s">OLAHRAGA</span>
        <span style="background:#d4364d;color:#fff;font-size:10px;font-weight:700;padding:5px 12px;border-radius:6px;animation:kpBadge 2s ease-in-out infinite alternate .45s">HIBURAN</span>
        <span style="background:#371800;color:#fff;font-size:10px;font-weight:700;padding:5px 12px;border-radius:6px;animation:kpBadge 2s ease-in-out infinite alternate .6s">TECH</span>
        <span style="background:#e8edf3;color:#002045;font-size:10px;font-weight:700;padding:5px 12px;border-radius:6px;border:1px solid rgba(0,32,69,0.06)">+7 lainnya</span>
      </div>
      <div style="color:#002045;font-size:clamp(17px,2.2vw,22px);font-weight:800;letter-spacing:-0.3px">12 Kategori Berita Terlengkap</div>
      <div style="color:#44474e;font-size:clamp(12px,1.3vw,14px);margin-top:4px">Hukum, Bisnis, Olahraga, Hiburan, Kesehatan, Teknologi & lainnya</div>
    </div>
  </div>
  <div style="z-index:1;flex-shrink:0"><div style="background:linear-gradient(135deg,#002045,#001530);color:#fff;font-size:clamp(13px,1.4vw,15px);font-weight:700;padding:14px clamp(24px,3vw,36px);border-radius:12px;white-space:nowrap;animation:kpBtn 3s ease-in-out infinite">Jelajahi →</div></div>
</div>`,

// ═══ FOOTER CTA ═══
"Lensaplus — Footer CTA": `<div style="width:100%;min-height:200px;padding:clamp(28px,4vw,44px) clamp(28px,5vw,56px);background:linear-gradient(135deg,#001530 0%,#002045 30%,#1a3a5c 60%,#371800 100%);border-radius:14px;display:flex;align-items:center;justify-content:space-between;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;position:relative;overflow:hidden;gap:24px">
  <style>
    @keyframes fcLine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes fcGlow{0%,100%{opacity:.3}50%{opacity:.6}}
    @keyframes fcFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
    @keyframes fcPulse{0%,100%{box-shadow:0 4px 14px rgba(183,16,42,0.3)}50%{box-shadow:0 8px 30px rgba(183,16,42,0.5)}}
    @keyframes fcShine{0%{background-position:200% center}100%{background-position:-200% center}}
    @keyframes fcShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
    @keyframes fcStar{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:.8;transform:scale(1.3)}}
  </style>
  <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#b7102a,#d4364d,#1a3a5c,#002045;background-size:200% 100%;animation:fcLine 4s linear infinite"></div>
  <div style="position:absolute;right:8%;top:-50px;width:250px;height:250px;border-radius:50%;background:radial-gradient(circle,rgba(183,16,42,0.08),transparent 70%);animation:fcGlow 5s ease-in-out infinite"></div>
  <div style="position:absolute;left:10%;bottom:-60px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(26,58,92,0.1),transparent 70%);animation:fcGlow 6s ease-in-out infinite 2s"></div>
  <div style="position:absolute;top:20%;left:5%;width:4px;height:4px;border-radius:50%;background:rgba(212,54,77,0.5);animation:fcStar 3s ease-in-out infinite"></div>
  <div style="position:absolute;top:65%;right:25%;width:3px;height:3px;border-radius:50%;background:rgba(26,58,92,0.5);animation:fcStar 4s ease-in-out infinite 1s"></div>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.02),transparent);animation:fcShimmer 6s ease-in-out infinite"></div></div>
  <div style="display:flex;align-items:center;gap:clamp(18px,3vw,28px);z-index:1;min-width:0">
    <div style="animation:fcFloat 4.5s ease-in-out infinite;flex-shrink:0">${LOGO}</div>
    <div style="min-width:0">
      <div style="display:inline-flex;align-items:center;gap:6px;margin-bottom:10px"><svg width="14" height="14" viewBox="0 0 24 24" fill="#d4364d" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><span style="color:#d4364d;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Lensaplus</span></div>
      <div style="font-size:clamp(20px,2.8vw,28px);font-weight:800;line-height:1.15;letter-spacing:-0.5px;background:linear-gradient(90deg,#fff 0%,#fff 30%,#e8edf3 48%,#d4364d 52%,#fff 70%,#fff 100%);background-size:300% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:fcShine 5s linear infinite">Jadikan Lensaplus<br>Sumber Berita Utama Anda</div>
      <div style="color:rgba(255,255,255,0.4);font-size:clamp(12px,1.3vw,15px);margin-top:8px">Berita akurat, terverifikasi, dari sumber terpercaya Indonesia</div>
    </div>
  </div>
  <div style="z-index:1;flex-shrink:0"><div style="background:linear-gradient(135deg,#b7102a,#8f0c20);color:#fff;font-size:clamp(14px,1.5vw,17px);font-weight:700;padding:16px clamp(28px,3.5vw,44px);border-radius:12px;white-space:nowrap;animation:fcPulse 3s ease-in-out infinite">Baca Sekarang →</div></div>
</div>`,

// ═══ SIDEBAR — Newsletter ═══
"Lensaplus — Newsletter Sidebar": `<div style="width:100%;aspect-ratio:6/5;background:linear-gradient(160deg,#001530 0%,#002045 30%,#1a3a5c 60%,#002045 100%);border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(24px,3.5vw,32px);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;text-align:center;position:relative;overflow:hidden">
  <style>
    @keyframes ns2Line{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes ns2Float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    @keyframes ns2Pulse{0%,100%{box-shadow:0 0 20px rgba(183,16,42,0.15),0 4px 14px rgba(183,16,42,0.2)}50%{box-shadow:0 0 30px rgba(183,16,42,0.25),0 6px 24px rgba(183,16,42,0.35)}}
    @keyframes ns2Shine{0%{background-position:200% center}100%{background-position:-200% center}}
    @keyframes ns2Ring{0%,100%{opacity:.06}50%{opacity:.12}}
    @keyframes ns2Orb{0%,100%{opacity:.08}50%{opacity:.15}}
    @keyframes ns2Shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
  </style>
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#b7102a,#d4364d,#1a3a5c,#b7102a);background-size:200% 100%;animation:ns2Line 3.5s linear infinite"></div>
  <div style="position:absolute;top:-40px;right:-40px;width:140px;height:140px;border-radius:50%;border:1px solid rgba(183,16,42,0.06);animation:ns2Ring 4s ease-in-out infinite"></div>
  <div style="position:absolute;bottom:-30px;left:-30px;width:120px;height:120px;border-radius:50%;border:1px solid rgba(26,58,92,0.08);animation:ns2Ring 5s ease-in-out infinite .5s"></div>
  <div style="position:absolute;top:15%;right:10%;width:80px;height:80px;border-radius:50%;background:radial-gradient(circle,rgba(183,16,42,0.1),transparent 70%);animation:ns2Orb 6s ease-in-out infinite;filter:blur(20px)"></div>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.02),transparent);animation:ns2Shimmer 6s ease-in-out infinite"></div></div>
  <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center">
    <div style="animation:ns2Float 4s ease-in-out infinite;margin-bottom:18px"><div style="position:relative"><img src="/lensaplus-icon.png" alt="Lensaplus" style="width:52px;height:52px;object-fit:contain;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,0.3),0 0 0 1px rgba(255,255,255,0.06)"><div style="position:absolute;inset:-3px;border-radius:17px;border:1px solid rgba(255,255,255,0.08)"></div></div></div>
    <div style="font-size:clamp(18px,2.5vw,22px);font-weight:800;line-height:1.2;letter-spacing:-0.3px;background:linear-gradient(90deg,#fff 0%,#fff 30%,#e8edf3 48%,#d4364d 52%,#fff 70%,#fff 100%);background-size:300% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:ns2Shine 5s linear infinite">Berita Terbaru<br>Setiap Hari</div>
    <div style="margin-top:10px;padding:6px 16px;border-radius:20px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06)"><span style="color:rgba(255,255,255,0.4);font-size:11px;font-weight:500">Newsletter Lensaplus — berita penting ke inbox</span></div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:12px">
      <span style="display:flex;align-items:center;gap:3px;color:rgba(255,255,255,0.25);font-size:9px"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Gratis</span>
      <span style="color:rgba(255,255,255,0.1)">·</span>
      <span style="display:flex;align-items:center;gap:3px;color:rgba(255,255,255,0.25);font-size:9px"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Tanpa spam</span>
      <span style="color:rgba(255,255,255,0.1)">·</span>
      <span style="display:flex;align-items:center;gap:3px;color:rgba(255,255,255,0.25);font-size:9px"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Kapan saja</span>
    </div>
    <div style="margin-top:16px;animation:ns2Pulse 3s ease-in-out infinite"><div style="background:linear-gradient(135deg,#b7102a,#8f0c20);color:#fff;font-size:13px;font-weight:700;padding:11px 28px;border-radius:12px;display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Langganan Gratis</div></div>
  </div>
</div>`,

// ═══ SIDEBAR — Pasang Iklan ═══
"Lensaplus — Pasang Iklan Sidebar": `<div style="width:100%;aspect-ratio:6/5;background:linear-gradient(160deg,#fff 0%,#f0f4f8 40%,#e8edf3 100%);border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(24px,3.5vw,32px);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;text-align:center;position:relative;overflow:hidden;border:1px solid rgba(0,32,69,0.04)">
  <style>
    @keyframes ps2Line{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes ps2Float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
    @keyframes ps2Glow{0%,100%{box-shadow:0 4px 16px rgba(0,32,69,0.08)}50%{box-shadow:0 8px 28px rgba(0,32,69,0.15)}}
    @keyframes ps2Badge{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
    @keyframes ps2Shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
    @keyframes ps2Shine{0%{background-position:200% center}100%{background-position:-200% center}}
    @keyframes ps2Ring{0%,100%{opacity:.04}50%{opacity:.08}}
  </style>
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#002045,#1a3a5c,#b7102a,#002045);background-size:200% 100%;animation:ps2Line 4s linear infinite"></div>
  <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;border-radius:50%;border:1px solid rgba(0,32,69,0.04);animation:ps2Ring 4s ease-in-out infinite"></div>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:35%;height:100%;background:linear-gradient(90deg,transparent,rgba(0,32,69,0.015),transparent);animation:ps2Shimmer 7s ease-in-out infinite"></div></div>
  <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center">
    <div style="animation:ps2Float 5s ease-in-out infinite;margin-bottom:16px"><div style="width:60px;height:60px;border-radius:18px;background:linear-gradient(145deg,#fff,#f0f4f8);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,32,69,0.06),0 0 0 1px rgba(0,32,69,0.03)"><img src="/lensaplus-icon.png" alt="K" style="width:38px;height:38px;object-fit:contain;border-radius:10px"></div></div>
    <div style="font-size:clamp(18px,2.5vw,22px);font-weight:800;line-height:1.2;letter-spacing:-0.3px;background:linear-gradient(90deg,#002045 0%,#002045 30%,#1a3a5c 48%,#b7102a 52%,#002045 70%,#002045 100%);background-size:300% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:ps2Shine 5s linear infinite">Ruang Iklan<br>Premium</div>
    <div style="margin-top:8px;padding:5px 14px;border-radius:20px;background:rgba(0,32,69,0.03);border:1px solid rgba(0,32,69,0.04)"><span style="color:#44474e;font-size:11px;font-weight:500">300 × 250 · Sidebar homepage</span></div>
    <div style="display:flex;gap:6px;margin-top:14px;flex-wrap:wrap;justify-content:center">
      <span style="display:flex;align-items:center;gap:4px;background:#e8edf3;color:#002045;font-size:10px;font-weight:700;padding:5px 12px;border-radius:20px;border:1px solid rgba(0,32,69,0.06);animation:ps2Badge 3s ease-in-out infinite"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Targeting</span>
      <span style="display:flex;align-items:center;gap:4px;background:#fce8eb;color:#b7102a;font-size:10px;font-weight:700;padding:5px 12px;border-radius:20px;border:1px solid rgba(183,16,42,0.1);animation:ps2Badge 3s ease-in-out infinite .4s"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Analytics</span>
      <span style="display:flex;align-items:center;gap:4px;background:#e8edf3;color:#1a3a5c;font-size:10px;font-weight:700;padding:5px 12px;border-radius:20px;border:1px solid rgba(26,58,92,0.08);animation:ps2Badge 3s ease-in-out infinite .8s"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> Audience</span>
    </div>
    <div style="margin-top:18px;animation:ps2Glow 3s ease-in-out infinite"><div style="background:linear-gradient(135deg,#002045,#001530);color:#fff;font-size:13px;font-weight:700;padding:11px 28px;border-radius:12px;display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Hubungi Kami</div></div>
    <div style="display:flex;align-items:center;gap:4px;margin-top:10px"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#74777f" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span style="color:#74777f;font-size:9px;font-weight:500">Dipercaya ratusan brand</span></div>
  </div>
</div>`,

// ═══ POPUP ═══
"Lensaplus — Popup Newsletter": `<div style="width:100%;max-width:480px;background:#fff;border-radius:20px;padding:clamp(36px,5vw,52px) clamp(32px,4vw,48px);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;text-align:center;position:relative;overflow:hidden">
  <style>
    @keyframes ppLine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes ppFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    @keyframes ppPulse{0%,100%{box-shadow:0 4px 16px rgba(183,16,42,0.2)}50%{box-shadow:0 8px 32px rgba(183,16,42,0.35)}}
    @keyframes ppCheck{0%,100%{color:#002045}50%{color:#1a3a5c;transform:scale(1.2)}}
  </style>
  <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#002045,#1a3a5c,#b7102a,#d4364d,#002045);background-size:200% 100%;animation:ppLine 4s linear infinite"></div>
  <div style="position:absolute;top:-60px;right:-60px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(0,32,69,0.04),transparent 70%)"></div>
  <div style="animation:ppFloat 4s ease-in-out infinite;display:inline-block">${LOGO_LG}</div>
  <div style="color:#002045;font-size:clamp(22px,3.5vw,30px);font-weight:800;margin-top:22px;letter-spacing:-0.5px;line-height:1.15">Jangan Lewatkan<br>Berita Penting</div>
  <div style="color:#44474e;font-size:clamp(13px,1.5vw,15px);margin-top:12px;line-height:1.6">Dapatkan ringkasan berita terbaik dari <strong style="color:#002045">12 kategori</strong> langsung ke email Anda setiap pagi</div>
  <div style="display:flex;align-items:center;justify-content:center;gap:20px;margin-top:18px;flex-wrap:wrap">
    <span style="display:inline-flex;align-items:center;gap:5px;color:#44474e;font-size:13px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#002045" stroke-width="2.5" style="animation:ppCheck 3s ease-in-out infinite"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Gratis</span>
    <span style="display:inline-flex;align-items:center;gap:5px;color:#44474e;font-size:13px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#002045" stroke-width="2.5" style="animation:ppCheck 3s ease-in-out infinite .5s"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Tanpa spam</span>
    <span style="display:inline-flex;align-items:center;gap:5px;color:#44474e;font-size:13px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#002045" stroke-width="2.5" style="animation:ppCheck 3s ease-in-out infinite 1s"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Berhenti kapan saja</span>
  </div>
  <div style="background:linear-gradient(135deg,#b7102a,#8f0c20);color:#fff;font-size:clamp(14px,1.6vw,17px);font-weight:700;padding:16px 40px;border-radius:14px;margin-top:26px;display:inline-block;animation:ppPulse 3s ease-in-out infinite"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-2px;margin-right:6px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Langganan Newsletter Gratis</div>
</div>`,

// ═══ FLOATING BAR ═══
"Lensaplus — Floating Bar": `<div style="width:100%;padding:14px clamp(18px,3vw,28px);background:linear-gradient(135deg,#001530,#002045);display:flex;align-items:center;justify-content:center;gap:clamp(14px,2.5vw,24px);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;position:relative;overflow:hidden">
  <style>
    @keyframes fbLine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes fbPulse{0%,100%{box-shadow:0 2px 10px rgba(183,16,42,0.2)}50%{box-shadow:0 4px 18px rgba(183,16,42,0.4)}}
    @keyframes fbDot{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(183,16,42,0.3)}50%{transform:scale(1.4);box-shadow:0 0 0 3px rgba(183,16,42,0)}}
    @keyframes fbShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
  </style>
  <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#b7102a,#d4364d,#1a3a5c,#b7102a);background-size:200% 100%;animation:fbLine 4s linear infinite"></div>
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:30%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.02),transparent);animation:fbShimmer 5s ease-in-out infinite"></div></div>
  <div style="display:flex;align-items:center;gap:10px;z-index:1">
    <img src="/lensaplus-icon.png" alt="K" style="width:28px;height:28px;object-fit:contain;border-radius:7px;box-shadow:0 2px 8px rgba(0,0,0,0.2)">
    <span style="display:inline-flex;align-items:center;gap:6px;color:#fff;font-size:clamp(12px,1.3vw,14px);font-weight:600"><span style="width:7px;height:7px;border-radius:50%;background:#b7102a;animation:fbDot 2s ease-in-out infinite"></span> Baca berita terbaru dari <strong>Lensaplus</strong></span>
  </div>
  <div style="background:linear-gradient(135deg,#b7102a,#8f0c20);color:#fff;font-size:clamp(11px,1.2vw,13px);font-weight:700;padding:9px clamp(16px,2vw,22px);border-radius:8px;white-space:nowrap;animation:fbPulse 3s ease-in-out infinite;z-index:1"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px;margin-right:3px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Lihat Berita →</div>
</div>`,

};

async function main() {
  console.log("=== Rebranding All Ads to Lensaplus Colors ===\n");
  let updated = 0;
  for (const [name, htmlCode] of Object.entries(updates)) {
    const result = await prisma.ad.updateMany({ where: { name }, data: { htmlCode } });
    if (result.count > 0) { updated++; console.log("  ✓", name); }
    else console.log("  ⏭ Not found:", name);
  }
  console.log(`\n=== Done! Updated ${updated} ads ===`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
