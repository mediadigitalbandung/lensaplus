/**
 * Tiny zero-dependency maintenance server.
 *
 * Stands in for the Next.js app on the same port (default 3000) while a deploy
 * rebuilds the app. Every request gets a branded Kartawarta "we're updating"
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

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

let pageHtml;
try {
  pageHtml = fs.readFileSync(path.join(__dirname, "maintenance-page.html"), "utf8");
} catch {
  // Minimal inline fallback if the HTML file is somehow missing.
  pageHtml =
    "<!doctype html><html lang=\"id\"><head><meta charset=\"utf-8\">" +
    "<meta http-equiv=\"refresh\" content=\"15\"><title>Sedang Memperbarui — Kartawarta</title></head>" +
    "<body style=\"font-family:sans-serif;text-align:center;padding:60px;color:#002045\">" +
    "<h1>Kartawarta sedang memperbarui</h1>" +
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

server.on("error", (err) => {
  // Most likely EADDRINUSE if the real app hasn't released the port yet.
  // Exit non-zero so the deploy script's launcher notices.
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
