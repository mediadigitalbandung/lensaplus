const { PrismaClient } = require("@prisma/client");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const prisma = new PrismaClient();

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const request = (u, redirects = 0) => {
      if (redirects > 5) return reject(new Error("Too many redirects"));
      https.get(u, (res) => {
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
  const poll = await prisma.poll.findFirst({
    where: { question: { contains: "Platform mana yang paling sering" } },
    select: { id: true, image: true },
  });
  if (!poll) { console.log("Not found"); return; }
  if (poll.image) { console.log("Already has image"); return; }

  const url = "https://images.unsplash.com/photo-1586339949916-3e9457bef6d3?w=800&q=80";
  const buf = await downloadImage(url);
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
  const filename = `poll-${crypto.randomBytes(6).toString("hex")}.jpg`;
  fs.writeFileSync(path.join(uploadDir, filename), buf);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";
  await prisma.poll.update({ where: { id: poll.id }, data: { image: `${appUrl}/uploads/${filename}` } });
  console.log("✓ Fixed: Platform poll image");
}

main().catch(console.error).finally(() => prisma.$disconnect());
