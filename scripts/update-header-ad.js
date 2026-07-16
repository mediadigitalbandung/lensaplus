const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const headerAd = `<div style="width:100%;min-height:220px;background:linear-gradient(135deg,#0a1628 0%,#162a4a 40%,#1e3a5f 70%,#0d2240 100%);border-radius:14px;display:flex;align-items:center;justify-content:space-between;padding:clamp(28px,4vw,44px) clamp(28px,5vw,56px);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;overflow:hidden;position:relative;gap:24px">

  <style>
    @keyframes headerShimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(200%); }
    }
    @keyframes headerGlow {
      0%, 100% { opacity: 0.4; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.15); }
    }
    @keyframes headerFloat {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-8px); }
    }
    @keyframes headerPulse {
      0%, 100% { box-shadow: 0 4px 14px rgba(59,130,246,0.3); }
      50% { box-shadow: 0 6px 28px rgba(59,130,246,0.5); }
    }
    @keyframes headerGradient {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes headerParticle1 {
      0% { transform: translate(0,0) scale(1); opacity: 0.15; }
      25% { transform: translate(30px,-20px) scale(1.2); opacity: 0.25; }
      50% { transform: translate(10px,-40px) scale(0.8); opacity: 0.1; }
      75% { transform: translate(-20px,-20px) scale(1.1); opacity: 0.2; }
      100% { transform: translate(0,0) scale(1); opacity: 0.15; }
    }
    @keyframes headerParticle2 {
      0% { transform: translate(0,0) scale(1); opacity: 0.1; }
      33% { transform: translate(-25px,15px) scale(1.3); opacity: 0.2; }
      66% { transform: translate(15px,30px) scale(0.9); opacity: 0.08; }
      100% { transform: translate(0,0) scale(1); opacity: 0.1; }
    }
    @keyframes headerTopLine {
      0% { background-position: 0% 50%; }
      100% { background-position: 200% 50%; }
    }
    @keyframes headerBadgePulse {
      0%, 100% { background: rgba(59,130,246,0.2); }
      50% { background: rgba(59,130,246,0.35); }
    }
  </style>

  <!-- Animated top accent line -->
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#ec4899,#f59e0b,#3b82f6);background-size:200% 100%;animation:headerTopLine 4s linear infinite"></div>

  <!-- Floating glow orbs -->
  <div style="position:absolute;top:-40px;right:10%;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.12),transparent 70%);animation:headerGlow 4s ease-in-out infinite"></div>
  <div style="position:absolute;bottom:-60px;left:15%;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(139,92,246,0.08),transparent 70%);animation:headerGlow 5s ease-in-out infinite 1s"></div>
  <div style="position:absolute;top:20%;right:30%;width:100px;height:100px;border-radius:50%;background:radial-gradient(circle,rgba(236,72,153,0.06),transparent 70%);animation:headerGlow 3.5s ease-in-out infinite 0.5s"></div>

  <!-- Floating particles -->
  <div style="position:absolute;top:25%;left:8%;width:6px;height:6px;border-radius:50%;background:rgba(59,130,246,0.3);animation:headerParticle1 8s ease-in-out infinite"></div>
  <div style="position:absolute;top:60%;right:15%;width:4px;height:4px;border-radius:50%;background:rgba(139,92,246,0.3);animation:headerParticle2 10s ease-in-out infinite 1s"></div>
  <div style="position:absolute;bottom:30%;left:40%;width:5px;height:5px;border-radius:50%;background:rgba(236,72,153,0.2);animation:headerParticle1 12s ease-in-out infinite 2s"></div>
  <div style="position:absolute;top:15%;right:45%;width:3px;height:3px;border-radius:50%;background:rgba(245,158,11,0.25);animation:headerParticle2 9s ease-in-out infinite 3s"></div>

  <!-- Shimmer sweep effect -->
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none">
    <div style="position:absolute;top:0;left:0;width:50%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent);animation:headerShimmer 5s ease-in-out infinite"></div>
  </div>

  <!-- Logo + text -->
  <div style="display:flex;align-items:center;gap:clamp(18px,3vw,28px);z-index:1">
    <div style="animation:headerFloat 4s ease-in-out infinite;flex-shrink:0">
      <img src="/lensaplus-icon.png" alt="Lensaplus" style="width:64px;height:64px;object-fit:contain;border-radius:14px;box-shadow:0 4px 20px rgba(0,0,0,0.3)">
    </div>
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
        <span style="color:#60a5fa;font-size:11px;font-weight:700;padding:4px 14px;border-radius:20px;letter-spacing:1.5px;text-transform:uppercase;animation:headerBadgePulse 3s ease-in-out infinite">⚡ Ruang Iklan Premium</span>
      </div>
      <div style="color:#fff;font-size:clamp(22px,3vw,32px);font-weight:800;letter-spacing:-0.5px;line-height:1.15">Tampilkan Brand Anda<br>di Lensaplus</div>
      <div style="color:rgba(255,255,255,0.45);font-size:clamp(13px,1.5vw,16px);margin-top:8px;line-height:1.5">Jangkau <strong style="color:rgba(255,255,255,0.75)">ribuan pembaca aktif</strong> setiap hari<br>di media digital terpercaya Indonesia</div>
      <div style="display:flex;align-items:center;gap:16px;margin-top:14px;flex-wrap:wrap">
        <span style="display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,0.5);font-size:12px">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#22c55e"></span> 12 Kategori
        </span>
        <span style="display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,0.5);font-size:12px">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#3b82f6"></span> Update 24/7
        </span>
        <span style="display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,0.5);font-size:12px">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#f59e0b"></span> Targeted
        </span>
      </div>
    </div>
  </div>

  <!-- CTA button -->
  <div style="z-index:1;flex-shrink:0;text-align:center">
    <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);background-size:200% 200%;color:#fff;font-size:clamp(14px,1.5vw,17px);font-weight:700;padding:16px clamp(28px,3.5vw,44px);border-radius:12px;white-space:nowrap;animation:headerPulse 3s ease-in-out infinite;cursor:pointer">Pasang Iklan →</div>
    <div style="color:rgba(255,255,255,0.35);font-size:11px;margin-top:8px">Mulai dari Rp 500.000/bulan</div>
  </div>
</div>`;

async function main() {
  console.log("=== Updating Header Ad (Animated) ===\n");
  const result = await prisma.ad.updateMany({
    where: { name: "Lensaplus — Pasang Iklan Header" },
    data: { htmlCode: headerAd },
  });
  if (result.count > 0) console.log("  ✓ Header ad updated with animations");
  else console.log("  ⏭ Not found");
  console.log("\n=== Done! ===");
}

main().catch(console.error).finally(() => prisma.$disconnect());
