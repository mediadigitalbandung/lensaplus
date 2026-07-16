const { PrismaClient } = require("@prisma/client");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const prisma = new PrismaClient();

// Map poll questions to Unsplash image URLs (free to use)
const pollImages = [
  { q: "isu apa yang paling mendesak", url: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&q=80" },
  { q: "Platform mana yang paling sering", url: "https://images.unsplash.com/photo-1504711434969-e33886168d6c?w=800&q=80" },
  { q: "kinerja Timnas Indonesia", url: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80" },
  { q: "Sektor ekonomi mana", url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80" },
  { q: "tantangan terbesar dalam sistem pendidikan", url: "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?w=800&q=80" },
  { q: "mengatasi kemacetan", url: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80" },
  { q: "Genre film Indonesia", url: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80" },
  { q: "Isu lingkungan", url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80" },
  { q: "penerapan AI", url: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80" },
  { q: "Komoditas pertanian", url: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&q=80" },
];

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const request = (u, redirects = 0) => {
      if (redirects > 5) return reject(new Error("Too many redirects"));
      client.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return request(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }).on("error", reject);
    };
    request(url);
  });
}

async function main() {
  console.log("=== Adding Images to Polls ===\n");

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  fs.mkdirSync(uploadDir, { recursive: true });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com";

  let updated = 0;
  for (const { q, url } of pollImages) {
    const poll = await prisma.poll.findFirst({
      where: { question: { contains: q } },
      select: { id: true, question: true, image: true },
    });

    if (!poll) { console.log(`  ⏭ Not found: ${q}`); continue; }
    if (poll.image) { console.log(`  ⏭ Already has image: ${q.substring(0, 40)}...`); continue; }

    try {
      const buf = await downloadImage(url);
      const filename = `poll-${crypto.randomBytes(6).toString("hex")}.jpg`;
      fs.writeFileSync(path.join(uploadDir, filename), buf);
      const imageUrl = `${appUrl}/uploads/${filename}`;

      await prisma.poll.update({
        where: { id: poll.id },
        data: { image: imageUrl },
      });

      updated++;
      console.log(`  ✓ ${poll.question.substring(0, 50)}...`);
    } catch (err) {
      console.log(`  ✗ Failed: ${q} — ${err.message}`);
    }
  }

  console.log(`\n=== Done! Updated ${updated} polls with images ===`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
