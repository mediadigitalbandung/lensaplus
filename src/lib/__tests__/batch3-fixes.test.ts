import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = process.cwd();

function readProjectFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("Batch 3 PWA, Route Integrity & Accessibility", () => {
  it("consolidates offline caching and Web Push into /sw.js without conflicting SW scopes", () => {
    const sw = readProjectFile("public/sw.js");
    const pushSw = readProjectFile("public/push-sw.js");
    const pushBtn = readProjectFile("src/components/push/PushSubscribeButton.tsx");

    expect(sw).toContain("addEventListener('push'");
    expect(sw).toContain("addEventListener('notificationclick'");
    expect(sw).toContain("resolveNotificationUrl");

    expect(pushSw).toContain('importScripts("/sw.js")');
    expect(pushBtn).toContain('register("/sw.js")');
    expect(pushBtn).not.toContain("/push-sw.js");
    expect(pushBtn).not.toMatch(/\balert\s*\(/);
  });

  it("ensures every sw.js precache asset and manifest.json icon exists on disk", () => {
    const sw = readProjectFile("public/sw.js");
    const precacheMatch = sw.match(/PRECACHE_ASSETS\s*=\s*\[([\s\S]*?)\]/);
    expect(precacheMatch).not.toBeNull();

    for (const m of precacheMatch![1].matchAll(/'([^']+)'/g)) {
      const asset = m[1];
      if (asset === "/offline") {
        expect(fs.existsSync(path.join(ROOT, "src/app/offline/page.tsx"))).toBe(true);
      } else {
        expect(fs.existsSync(path.join(ROOT, "public", asset.replace(/^\//, "")))).toBe(true);
      }
    }

    const manifest = JSON.parse(readProjectFile("public/manifest.json"));
    for (const icon of manifest.icons ?? []) {
      expect(fs.existsSync(path.join(ROOT, "public", icon.src.replace(/^\//, "")))).toBe(true);
    }
    for (const shortcut of manifest.shortcuts ?? []) {
      for (const icon of shortcut.icons ?? []) {
        expect(fs.existsSync(path.join(ROOT, "public", icon.src.replace(/^\//, "")))).toBe(true);
      }
    }
    expect(manifest.screenshots ?? []).toEqual([]);
  });

  it("eliminates broken public /artikel, /jadwal-sidang, and missing asset links", () => {
    const routeFiles = [
      "src/app/emiten/[ticker]/page.tsx",
      "src/app/pejabat/[slug]/page.tsx",
      "src/app/regulasi/[id]/page.tsx",
      "src/app/live/[slug]/page.tsx",
      "src/app/page.tsx",
      "src/app/unduh/page.tsx",
    ];

    for (const rel of routeFiles) {
      const content = readProjectFile(rel);
      expect(content).not.toMatch(/href=\{?`?\/artikel\//);
      expect(content).not.toContain("/jadwal-sidang");
      expect(content).not.toContain("/twa/playstore-assets/");
    }

    expect(readProjectFile("src/app/live/[slug]/page.tsx")).toContain("/berita/${linkedArticle.slug}");
    expect(readProjectFile("src/app/unduh/page.tsx")).toContain("fs.existsSync");
  });

  it("eliminates invalid Tailwind utility classes in public header, homepage, and panel", () => {
    expect(readProjectFile("src/app/page.tsx")).not.toContain("bg-stone-150");
    expect(readProjectFile("src/components/layout/Header.tsx")).not.toContain("stone-250");
    expect(readProjectFile("src/app/panel/artikel/[id]/edit/page.tsx")).not.toContain("text-gold");
    expect(readProjectFile("src/app/panel/dashboard/page.tsx")).not.toContain("text-gold");
  });

  it("enforces role=dialog, aria-modal=true, and Escape support on public and editorial modals", () => {
    const dialogComponents = [
      "src/components/slider/VideoStory.tsx",
      "src/components/video/ReelGallery.tsx",
      "src/components/editor/ImageCropModal.tsx",
      "src/components/editor/ImagePickerModal.tsx",
      "src/components/panel/UserCardManager.tsx",
      "src/components/layout/Header.tsx",
      "src/components/ui/ConfirmDialog.tsx",
    ];

    for (const rel of dialogComponents) {
      const src = readProjectFile(rel);
      expect(src).toContain('role="dialog"');
      expect(src).toContain('aria-modal="true"');
      expect(src).toContain("Escape");
    }
  });
});
