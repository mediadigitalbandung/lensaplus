const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const LOGO = `<img src="/kartawarta-icon.png" alt="Kartawarta" style="width:64px;height:64px;object-fit:contain;border-radius:14px;box-shadow:0 4px 20px rgba(0,0,0,0.3)">`;

const headerAd = `<div style="width:100%;min-height:220px;background:linear-gradient(135deg,#0a1628 0%,#162a4a 40%,#1e3a5f 70%,#0d2240 100%);border-radius:14px;display:flex;align-items:center;justify-content:space-between;padding:clamp(28px,4vw,44px) clamp(28px,5vw,56px);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;overflow:hidden;position:relative;gap:24px">

  <style>
    @keyframes htShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
    @keyframes htGlow{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:.8;transform:scale(1.15)}}
    @keyframes htFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    @keyframes htPulse{0%,100%{box-shadow:0 4px 14px rgba(59,130,246,0.3)}50%{box-shadow:0 6px 28px rgba(59,130,246,0.5)}}
    @keyframes htTopLine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes htBadgePulse{0%,100%{background:rgba(59,130,246,0.2)}50%{background:rgba(59,130,246,0.35)}}
    @keyframes htParticle1{0%{transform:translate(0,0);opacity:.15}50%{transform:translate(30px,-25px);opacity:.3}100%{transform:translate(0,0);opacity:.15}}
    @keyframes htParticle2{0%{transform:translate(0,0);opacity:.1}50%{transform:translate(-20px,15px);opacity:.25}100%{transform:translate(0,0);opacity:.1}}
    @keyframes htShine{0%{background-position:200% center}100%{background-position:-200% center}}
    @keyframes htSubPulse{0%,100%{opacity:.45;transform:translateY(0)}50%{opacity:.75;transform:translateY(-1px)}}
    @keyframes htTagFloat1{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-3px);opacity:.8}}
    @keyframes htTagFloat2{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-3px);opacity:.8}}
    @keyframes htTagFloat3{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-3px);opacity:.8}}
    @keyframes htDotPing{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.6);opacity:1}}
  </style>

  <!-- Animated top accent line -->
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#ec4899,#f59e0b,#3b82f6);background-size:200% 100%;animation:htTopLine 4s linear infinite"></div>

  <!-- Glow orbs -->
  <div style="position:absolute;top:-40px;right:10%;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.12),transparent 70%);animation:htGlow 4s ease-in-out infinite"></div>
  <div style="position:absolute;bottom:-60px;left:15%;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(139,92,246,0.08),transparent 70%);animation:htGlow 5s ease-in-out infinite 1s"></div>

  <!-- Particles -->
  <div style="position:absolute;top:25%;left:8%;width:6px;height:6px;border-radius:50%;background:rgba(59,130,246,0.3);animation:htParticle1 8s ease-in-out infinite"></div>
  <div style="position:absolute;top:60%;right:15%;width:4px;height:4px;border-radius:50%;background:rgba(139,92,246,0.3);animation:htParticle2 10s ease-in-out infinite 1s"></div>
  <div style="position:absolute;bottom:30%;left:40%;width:5px;height:5px;border-radius:50%;background:rgba(236,72,153,0.2);animation:htParticle1 12s ease-in-out infinite 2s"></div>

  <!-- Shimmer -->
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none">
    <div style="position:absolute;top:0;left:0;width:50%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent);animation:htShimmer 5s ease-in-out infinite"></div>
  </div>

  <!-- Logo + Text -->
  <div style="display:flex;align-items:center;gap:clamp(18px,3vw,28px);z-index:1">
    <div style="animation:htFloat 4s ease-in-out infinite;flex-shrink:0">
      ${LOGO}
    </div>
    <div>
      <!-- Badge -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
        <span style="color:#60a5fa;font-size:11px;font-weight:700;padding:4px 14px;border-radius:20px;letter-spacing:1.5px;text-transform:uppercase;animation:htBadgePulse 3s ease-in-out infinite">⚡ Ruang Iklan Premium</span>
      </div>

      <!-- HEADLINE: Shining gradient text sweep -->
      <div style="font-size:clamp(22px,3vw,32px);font-weight:800;letter-spacing:-0.5px;line-height:1.15;background:linear-gradient(90deg,#fff 0%,#fff 30%,#93c5fd 45%,#c4b5fd 55%,#fff 70%,#fff 100%);background-size:300% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:htShine 5s linear infinite">Tampilkan Brand Anda<br>di Kartawarta</div>

      <!-- SUBTITLE: Gentle pulse -->
      <div style="color:rgba(255,255,255,0.45);font-size:clamp(13px,1.5vw,16px);margin-top:8px;line-height:1.5;animation:htSubPulse 5s ease-in-out infinite">Jangkau <strong style="color:rgba(255,255,255,0.75)">ribuan pembaca aktif</strong> setiap hari<br>di media digital terpercaya Indonesia</div>

      <!-- INFO TAGS: Floating with stagger -->
      <div style="display:flex;align-items:center;gap:16px;margin-top:14px;flex-wrap:wrap">
        <span style="display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,0.5);font-size:12px;animation:htTagFloat1 3s ease-in-out infinite">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#22c55e;animation:htDotPing 2s ease-in-out infinite"></span> 12 Kategori
        </span>
        <span style="display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,0.5);font-size:12px;animation:htTagFloat2 3s ease-in-out infinite 0.4s">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#3b82f6;animation:htDotPing 2s ease-in-out infinite 0.4s"></span> Update 24/7
        </span>
        <span style="display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,0.5);font-size:12px;animation:htTagFloat3 3s ease-in-out infinite 0.8s">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#f59e0b;animation:htDotPing 2s ease-in-out infinite 0.8s"></span> Targeted
        </span>
      </div>
    </div>
  </div>

  <!-- CTA -->
  <div style="z-index:1;flex-shrink:0;text-align:center">
    <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-size:clamp(14px,1.5vw,17px);font-weight:700;padding:16px clamp(28px,3.5vw,44px);border-radius:12px;white-space:nowrap;animation:htPulse 3s ease-in-out infinite;cursor:pointer">Pasang Iklan →</div>
  </div>
</div>`;

async function main() {
  const result = await prisma.ad.updateMany({
    where: { name: "Kartawarta — Pasang Iklan Header" },
    data: { htmlCode: headerAd },
  });
  console.log(result.count > 0 ? "✓ Header ad updated with animated text" : "⏭ Not found");
}

main().catch(console.error).finally(() => prisma.$disconnect());
