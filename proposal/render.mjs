import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(dir, "proposal-lensaplus.html");
let pdfPath = path.join(dir, "Proposal-Lensaplus-Celiol.pdf");
// If the file is locked (e.g. open in a PDF viewer), fall back to an alternate
// name so the render still succeeds.
try { if (fs.existsSync(pdfPath)) fs.closeSync(fs.openSync(pdfPath, "r+")); }
catch (e) { if (e.code === "EBUSY" || e.code === "EPERM") pdfPath = path.join(dir, "Proposal-Lensaplus-Celiol-2.pdf"); }

const candidates = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];
const exe = candidates.find((p) => fs.existsSync(p));

const launchOpts = exe ? { executablePath: exe } : { channel: "chrome" };
const browser = await chromium.launch(launchOpts);
const page = await browser.newPage();
const url = "file:///" + htmlPath.replace(/\\/g, "/");
await page.goto(url, { waitUntil: "networkidle" });
await page.pdf({
  path: pdfPath,
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  // Page numbers + brand. Gray text is near-invisible over the navy cover/back
  // pages and clearly legible on white content pages.
  footerTemplate:
    '<div style="width:100%;font-size:9px;color:#74777f;padding:0 15mm;font-family:\'Segoe UI\',Arial,sans-serif;display:flex;justify-content:space-between;align-items:center;">' +
    "<span>Celiol &middot; PT Digyata Graha Utama</span>" +
    '<span>Halaman <span class="pageNumber"></span> / <span class="totalPages"></span></span>' +
    "</div>",
});
await browser.close();

const kb = (fs.statSync(pdfPath).size / 1024).toFixed(0);
console.log(`PDF written: ${pdfPath} (${kb} KB)`);
