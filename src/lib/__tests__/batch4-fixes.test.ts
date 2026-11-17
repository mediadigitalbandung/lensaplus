import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = process.cwd();

function readProjectFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("Batch 4 Deploy Port Alignment & Brand Hygiene", () => {
  it("aligns VPS deploy, maintenance, PM2, and worker defaults on port 3002", () => {
    const ecosystem = readProjectFile("ecosystem.config.js");
    const deployRoot = readProjectFile("deploy-vps.sh");
    const deployScript = readProjectFile("scripts/deploy-vps.sh");
    const maintServer = readProjectFile("scripts/maintenance-server.js");
    const maintHtml = readProjectFile("scripts/maintenance-page.html");
    const ytWorker = readProjectFile("tools/youtube-clip-worker.mjs");

    expect(ecosystem).toContain("start --port 3002");
    expect(ecosystem).toContain('APP_URL: "http://127.0.0.1:3002"');

    expect(deployRoot).toContain("PORT=3002");
    expect(deployRoot).toContain("http://127.0.0.1:3002");
    expect(deployRoot).not.toContain("3006");

    expect(deployScript).toContain("PORT=3002");
    expect(deployScript).not.toContain("PORT=3006");

    expect(maintServer).toContain('"3002"');
    expect(maintServer).not.toContain('"3006"');

    expect(maintHtml).toContain("3002");
    expect(maintHtml).toContain("Lensa<span>plus</span>");
    expect(maintHtml).not.toMatch(/karta|warta/i);

    expect(ytWorker).toContain("http://127.0.0.1:3002");
    expect(ytWorker).not.toContain("3006");
  });

  it("removes legacy brand leaks from public security.txt, package manifests, and public assets", () => {
    const securityTxt = readProjectFile("public/.well-known/security.txt");
    expect(securityTxt).toContain("security@lensaplus.com");
    expect(securityTxt).toContain("https://lensaplus.com/.well-known/security.txt");
    expect(securityTxt).not.toMatch(/kartawarta/i);

    expect(fs.existsSync(path.join(ROOT, "public/kartawarta-icon.png"))).toBe(false);

    const pkg = JSON.parse(readProjectFile("package.json"));
    expect(pkg.name).toBe("lensaplus");

    const pkgLockHead = readProjectFile("package-lock.json").slice(0, 300);
    expect(pkgLockHead).toContain('"name": "lensaplus"');
    expect(pkgLockHead).not.toContain("kartawarta");
  });

  it("enforces least-privilege Lensaplus database grants and non-zero failure exits", () => {
    const restoreScript = readProjectFile("scripts/restore-latest-snapshot.js");
    const grantScript = readProjectFile("scripts/grant-db-access.js");
    const auditScript = readProjectFile("scripts/audit-data-isolation.js");
    const recheckScript = readProjectFile("scripts/recheck-databases.js");
    const updateAdmin = readProjectFile("scripts/update-admin-email.js");

    expect(restoreScript).not.toContain("TO kartawarta");
    expect(restoreScript).toContain('"lensaplus"');
    expect(restoreScript).toContain("process.exitCode = 1");

    expect(grantScript).not.toContain("TO PUBLIC");
    expect(grantScript).toContain('"lensaplus"');
    expect(grantScript).toContain("process.exitCode = 1");

    expect(auditScript).toContain("process.exitCode = 1");
    expect(recheckScript).toContain("process.exitCode = 1");

    expect(updateAdmin).toContain("process.env.NEW_ADMIN_PASSWORD");
    expect(updateAdmin).not.toContain("Owen@lensaplus2026!");
  });

  it("uses Lensaplus branding and monograms across ad and image-healing scripts", () => {
    const scriptFiles = [
      "scripts/auto-heal-broken-images.js",
      "scripts/fix-ad-responsive.js",
      "scripts/rebrand-ads.js",
      "scripts/redesign-ads.js",
      "scripts/seed-ads.js",
      "scripts/update-ads.js",
      "scripts/update-ads-height.js",
      "scripts/upgrade-all-ads.js",
      "scripts/upgrade-sidebar-ads.js",
    ];

    for (const rel of scriptFiles) {
      const content = readProjectFile(rel);
      expect(content).not.toContain('alt="K"');
      expect(content).not.toContain(">K<");
    }
  });
});
