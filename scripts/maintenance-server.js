/**
 * Tiny zero-dependency maintenance server.
 *
 * Stands in for the Next.js app on the same port (default 3000) while a deploy
 * rebuilds the app. Every request gets a branded Lensaplus "we're updating"
 * page with HTTP 503 + Retry-After, so visitors (and Cloudflare) see an
 * on-brand page instead of Cloudflare's default "Bad gateway 502".
 *
 * Started and stopped by scripts/deploy-vps.sh around the build step.
 * Pure Node core modules — no npm install required, so it can run even if
 * node_modules is mid-reinstall.
 *
 * Usage:  PORT=3000 node scripts/maintenance-server.js
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.PORT || "3006", 10);
const HOST = process.env.HOST || "0.0.0.0";

let pageHtml;
try {
  pageHtml = fs.readFileSync(path.join(__dirname, "maintenance-page.html"), "utf8");
} catch {
  // Minimal inline fallback if the HTML file is somehow missing.
  pageHtml =
    "<!doctype html><html lang=\"id\"><head><meta charset=\"utf-8\">" +
    "<meta http-equiv=\"refresh\" content=\"15\"><title>Sedang Memperbarui — Lensaplus</title></head>" +
    "<body style=\"font-family:sans-serif;text-align:center;padding:60px;color:#002045\">" +
    "<h1>Lensaplus sedang memperbarui</h1>" +
    "<p>Mohon tunggu sebentar, halaman akan termuat ulang otomatis.</p></body></html>";
}

const server = http.createServer((req, res) => {
  res.writeHead(503, {
    "Content-Type": "text/html; charset=utf-8",
    "Retry-After": "30",
    "Cache-Control": "no-store, no-cache, must-revalidate",
  });
  // HEAD requests (used by the page's own poll) want headers only.
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(pageHtml);
});

// The real app (pm2 `next start`) may not have released port 3000 the instant
// the deploy script launches us — its graceful-shutdown kill_timeout is up to
// 10s. So on EADDRINUSE, keep retrying the bind (up to ~30s) instead of giving
// up; otherwise visitors would briefly see Cloudflare's 502 instead of the
// branded maintenance page during the hand-off.
let bindAttempts = 0;
const MAX_BIND_ATTEMPTS = 30;

server.on("error", (err) => {
  if (err.code === "EADDRINUSE" && bindAttempts < MAX_BIND_ATTEMPTS) {
    bindAttempts++;
    console.error(`port ${PORT} still busy (attempt ${bindAttempts}/${MAX_BIND_ATTEMPTS}) — retrying in 1s`);
    setTimeout(() => server.listen(PORT, HOST), 1000);
    return;
  }
  console.error("maintenance-server error:", err.message);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`maintenance-server listening on ${HOST}:${PORT}`);
});

// Clean shutdown on the signals the deploy script sends.
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
