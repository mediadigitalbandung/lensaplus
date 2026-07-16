const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const updates = {

// ═══════════════════════════════════════════════════
// SIDEBAR — Newsletter (dark premium glassmorphism)
// ═══════════════════════════════════════════════════
"Lensaplus — Newsletter Sidebar": `<div style="width:100%;aspect-ratio:6/5;background:linear-gradient(160deg,#080e1a 0%,#0f1d36 30%,#162a4a 60%,#1a2040 100%);border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(24px,3.5vw,32px);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;text-align:center;position:relative;overflow:hidden">
  <style>
    @keyframes nsOrb1{0%,100%{transform:translate(0,0) scale(1);opacity:.12}50%{transform:translate(15px,-20px) scale(1.2);opacity:.2}}
    @keyframes nsOrb2{0%,100%{transform:translate(0,0) scale(1);opacity:.08}50%{transform:translate(-20px,15px) scale(1.15);opacity:.15}}
    @keyframes nsLine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes nsFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    @keyframes nsPulse{0%,100%{box-shadow:0 0 20px rgba(59,130,246,0.15),0 4px 14px rgba(59,130,246,0.2)}50%{box-shadow:0 0 30px rgba(59,130,246,0.25),0 6px 24px rgba(59,130,246,0.35)}}
    @keyframes nsShine{0%{background-position:200% center}100%{background-position:-200% center}}
    @keyframes nsDot{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(34,197,94,0.4)}50%{transform:scale(1.3);box-shadow:0 0 0 4px rgba(34,197,94,0)}}
    @keyframes nsShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
    @keyframes nsRing{0%,100%{opacity:.06}50%{opacity:.12}}
  </style>

  <!-- Animated top line -->
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#ec4899,#f59e0b,#3b82f6);background-size:200% 100%;animation:nsLine 3.5s linear infinite"></div>

  <!-- Decorative rings -->
  <div style="position:absolute;top:-40px;right:-40px;width:140px;height:140px;border-radius:50%;border:1px solid rgba(99,102,241,0.08);animation:nsRing 4s ease-in-out infinite"></div>
  <div style="position:absolute;top:-20px;right:-20px;width:100px;height:100px;border-radius:50%;border:1px solid rgba(59,130,246,0.06);animation:nsRing 5s ease-in-out infinite 1s"></div>
  <div style="position:absolute;bottom:-30px;left:-30px;width:120px;height:120px;border-radius:50%;border:1px solid rgba(139,92,246,0.06);animation:nsRing 4.5s ease-in-out infinite .5s"></div>

  <!-- Floating orbs -->
  <div style="position:absolute;top:15%;right:10%;width:80px;height:80px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.15),transparent 70%);animation:nsOrb1 6s ease-in-out infinite;filter:blur(20px)"></div>
  <div style="position:absolute;bottom:15%;left:10%;width:100px;height:100px;border-radius:50%;background:radial-gradient(circle,rgba(139,92,246,0.1),transparent 70%);animation:nsOrb2 8s ease-in-out infinite;filter:blur(25px)"></div>

  <!-- Shimmer -->
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.02),transparent);animation:nsShimmer 6s ease-in-out infinite"></div></div>

  <!-- Glass card inner -->
  <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center">

    <!-- Logo -->
    <div style="animation:nsFloat 4s ease-in-out infinite;margin-bottom:18px">
      <div style="position:relative">
        <img src="/lensaplus-icon.png" alt="Lensaplus" style="width:52px;height:52px;object-fit:contain;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,0.3),0 0 0 1px rgba(255,255,255,0.06)">
        <div style="position:absolute;inset:-3px;border-radius:17px;border:1px solid rgba(255,255,255,0.08);pointer-events:none"></div>
      </div>
    </div>

    <!-- Headline: shine effect -->
    <div style="font-size:clamp(18px,2.5vw,22px);font-weight:800;line-height:1.2;letter-spacing:-0.3px;background:linear-gradient(90deg,#fff 0%,#fff 30%,#93c5fd 48%,#c4b5fd 52%,#fff 70%,#fff 100%);background-size:300% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:nsShine 5s linear infinite">Berita Terbaru<br>Setiap Hari</div>

    <!-- Subtitle with glass pill -->
    <div style="margin-top:10px;padding:6px 16px;border-radius:20px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06)">
      <span style="color:rgba(255,255,255,0.4);font-size:11px;line-height:1.5;font-weight:500">Newsletter Lensaplus — berita penting langsung ke inbox</span>
    </div>

    <!-- Stats -->
    <div style="display:flex;align-items:center;gap:8px;margin-top:14px">
      <div style="display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:14px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.12)">
        <span style="width:7px;height:7px;border-radius:50%;background:#22c55e;animation:nsDot 2s ease-in-out infinite"></span>
        <span style="color:#4ade80;font-size:10px;font-weight:700">10.000+</span>
      </div>
      <span style="color:rgba(255,255,255,0.3);font-size:10px;font-weight:500">pembaca aktif</span>
    </div>

    <!-- CTA Button -->
    <div style="margin-top:18px;animation:nsPulse 3s ease-in-out infinite">
      <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-size:13px;font-weight:700;padding:11px 28px;border-radius:12px;display:flex;align-items:center;gap:6px;letter-spacing:0.3px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        Langganan Gratis
      </div>
    </div>

    <!-- Trust badges -->
    <div style="display:flex;align-items:center;gap:10px;margin-top:12px">
      <span style="display:flex;align-items:center;gap:3px;color:rgba(255,255,255,0.25);font-size:9px;font-weight:500">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        Gratis
      </span>
      <span style="color:rgba(255,255,255,0.1)">·</span>
      <span style="display:flex;align-items:center;gap:3px;color:rgba(255,255,255,0.25);font-size:9px;font-weight:500">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Tanpa spam
      </span>
      <span style="color:rgba(255,255,255,0.1)">·</span>
      <span style="display:flex;align-items:center;gap:3px;color:rgba(255,255,255,0.25);font-size:9px;font-weight:500">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Kapan saja
      </span>
    </div>
  </div>
</div>`,

// ═══════════════════════════════════════════════════
// SIDEBAR — Pasang Iklan (light premium glassmorphism)
// ═══════════════════════════════════════════════════
"Lensaplus — Pasang Iklan Sidebar": `<div style="width:100%;aspect-ratio:6/5;background:linear-gradient(160deg,#fcfdfe 0%,#f4f7fb 30%,#eef2f8 60%,#f8fafD 100%);border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(24px,3.5vw,32px);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;text-align:center;position:relative;overflow:hidden;border:1px solid rgba(0,0,0,0.04)">
  <style>
    @keyframes psOrb1{0%,100%{transform:translate(0,0);opacity:.04}50%{transform:translate(10px,-15px);opacity:.08}}
    @keyframes psOrb2{0%,100%{transform:translate(0,0);opacity:.03}50%{transform:translate(-12px,10px);opacity:.06}}
    @keyframes psLine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes psFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
    @keyframes psGlow{0%,100%{box-shadow:0 4px 16px rgba(15,23,42,0.08),0 0 0 1px rgba(15,23,42,0.04)}50%{box-shadow:0 8px 28px rgba(15,23,42,0.14),0 0 0 1px rgba(15,23,42,0.06)}}
    @keyframes psShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
    @keyframes psBadge{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
    @keyframes psRing{0%,100%{opacity:.04}50%{opacity:.08}}
    @keyframes psShine{0%{background-position:200% center}100%{background-position:-200% center}}
  </style>

  <!-- Animated top line -->
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6,#6366f1,#ec4899,#f59e0b,#3b82f6);background-size:200% 100%;animation:psLine 3.5s linear infinite"></div>

  <!-- Decorative rings -->
  <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;border-radius:50%;border:1px solid rgba(59,130,246,0.06);animation:psRing 4s ease-in-out infinite"></div>
  <div style="position:absolute;bottom:-25px;left:-25px;width:100px;height:100px;border-radius:50%;border:1px solid rgba(99,102,241,0.04);animation:psRing 5s ease-in-out infinite 1s"></div>

  <!-- Orbs -->
  <div style="position:absolute;top:20%;right:10%;width:80px;height:80px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.06),transparent 70%);animation:psOrb1 7s ease-in-out infinite;filter:blur(15px)"></div>
  <div style="position:absolute;bottom:20%;left:10%;width:90px;height:90px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,0.05),transparent 70%);animation:psOrb2 9s ease-in-out infinite;filter:blur(18px)"></div>

  <!-- Shimmer -->
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none"><div style="position:absolute;top:0;left:0;width:35%;height:100%;background:linear-gradient(90deg,transparent,rgba(59,130,246,0.02),transparent);animation:psShimmer 7s ease-in-out infinite"></div></div>

  <!-- Content -->
  <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center">

    <!-- Logo in glass container -->
    <div style="animation:psFloat 5s ease-in-out infinite;margin-bottom:16px">
      <div style="position:relative;width:60px;height:60px;border-radius:18px;background:linear-gradient(145deg,#fff,#f1f5f9);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,0.06),0 0 0 1px rgba(0,0,0,0.03)">
        <img src="/lensaplus-icon.png" alt="K" style="width:38px;height:38px;object-fit:contain;border-radius:10px">
        <div style="position:absolute;inset:-2px;border-radius:20px;border:1px solid rgba(59,130,246,0.08);pointer-events:none"></div>
      </div>
    </div>

    <!-- Headline: shine on dark text -->
    <div style="font-size:clamp(18px,2.5vw,22px);font-weight:800;line-height:1.2;letter-spacing:-0.3px;background:linear-gradient(90deg,#0f172a 0%,#0f172a 30%,#3b82f6 48%,#6366f1 52%,#0f172a 70%,#0f172a 100%);background-size:300% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:psShine 5s linear infinite">Ruang Iklan<br>Premium</div>

    <!-- Subtitle glass pill -->
    <div style="margin-top:8px;padding:5px 14px;border-radius:20px;background:rgba(15,23,42,0.03);border:1px solid rgba(15,23,42,0.04)">
      <span style="color:#64748b;font-size:11px;font-weight:500">300 × 250 · Sidebar homepage</span>
    </div>

    <!-- Feature badges -->
    <div style="display:flex;gap:6px;margin-top:14px;flex-wrap:wrap;justify-content:center">
      <span style="display:flex;align-items:center;gap:4px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);color:#15803d;font-size:10px;font-weight:700;padding:5px 12px;border-radius:20px;border:1px solid rgba(34,197,94,0.15);animation:psBadge 3s ease-in-out infinite;box-shadow:0 2px 8px rgba(34,197,94,0.06)">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        Targeting
      </span>
      <span style="display:flex;align-items:center;gap:4px;background:linear-gradient(135deg,#eff6ff,#dbeafe);color:#1d4ed8;font-size:10px;font-weight:700;padding:5px 12px;border-radius:20px;border:1px solid rgba(59,130,246,0.15);animation:psBadge 3s ease-in-out infinite .4s;box-shadow:0 2px 8px rgba(59,130,246,0.06)">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        Analytics
      </span>
      <span style="display:flex;align-items:center;gap:4px;background:linear-gradient(135deg,#fdf4ff,#f3e8ff);color:#7c3aed;font-size:10px;font-weight:700;padding:5px 12px;border-radius:20px;border:1px solid rgba(139,92,246,0.15);animation:psBadge 3s ease-in-out infinite .8s;box-shadow:0 2px 8px rgba(139,92,246,0.06)">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Audience
      </span>
    </div>

    <!-- CTA Button -->
    <div style="margin-top:18px;animation:psGlow 3s ease-in-out infinite">
      <div style="background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;font-size:13px;font-weight:700;padding:11px 28px;border-radius:12px;display:flex;align-items:center;gap:6px;letter-spacing:0.3px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        Hubungi Kami
      </div>
    </div>

    <!-- Bottom trust line -->
    <div style="display:flex;align-items:center;gap:4px;margin-top:10px">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      <span style="color:#94a3b8;font-size:9px;font-weight:500">Dipercaya ratusan brand</span>
    </div>
  </div>
</div>`,

};

async function main() {
  console.log("=== Upgrading Sidebar Ads (Premium) ===\n");
  let updated = 0;
  for (const [name, htmlCode] of Object.entries(updates)) {
    const result = await prisma.ad.updateMany({ where: { name }, data: { htmlCode } });
    if (result.count > 0) { updated++; console.log("  ✓", name); }
    else console.log("  ⏭ Not found:", name);
  }
  console.log(`\n=== Done! Updated ${updated} ads ===`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
