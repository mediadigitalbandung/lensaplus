const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

async function generateMasterIcon() {
  console.log("🎨 Generating Master Lensaplus Icon Assets...");

  // SVG representation of the sleek black circle camera lens emblem
  const svgBuffer = Buffer.from(`
    <svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Background Black Circle -->
      <circle cx="256" cy="256" r="240" fill="#0A0A0A" />
      <circle cx="256" cy="256" r="239" stroke="#262626" stroke-width="2" />
      
      <!-- Outer Camera Lens Ring -->
      <circle cx="256" cy="256" r="180" stroke="#FFFFFF" stroke-width="28" stroke-opacity="0.95" />
      
      <!-- Inner Lens Aperture Ring -->
      <circle cx="256" cy="256" r="95" fill="#FFFFFF" fill-opacity="0.2" stroke="#FFFFFF" stroke-width="20" />
      
      <!-- Center Plus / Crosshair Core -->
      <path d="M256 180 V332 M180 256 H332" stroke="#FFFFFF" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `);

  const publicDir = path.join(__dirname, "..", "public");

  // Output targets
  const targets = [
    { name: "lensaplus-icon.png", size: 512 },
    { name: "lensaplus-icon-512.png", size: 512 },
    { name: "lensaplus-icon-192.png", size: 192 },
    { name: "lensaplus-icon-96.png", size: 96 },
    { name: "apple-touch-icon.png", size: 180 },
    { name: "favicon-32x32.png", size: 32 },
    { name: "favicon-16x16.png", size: 16 },
  ];

  for (const t of targets) {
    const filePath = path.join(publicDir, t.name);
    await sharp(svgBuffer)
      .resize(t.size, t.size)
      .png()
      .toFile(filePath);
    console.log(`  ✓ Created ${t.name} (${t.size}x${t.size})`);
  }

  // Also copy to favicon.ico if needed
  await sharp(svgBuffer).resize(48, 48).toFile(path.join(publicDir, "favicon.ico"));
  console.log("  ✓ Created favicon.ico (48x48)");

  console.log("✨ All master logo icon PNG assets generated successfully!");
}

generateMasterIcon().catch(console.error);
