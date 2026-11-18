import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = process.cwd();

function readProjectFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function collectTsxFiles(dirRel: string): string[] {
  const dirAbs = path.join(ROOT, dirRel);
  if (!fs.existsSync(dirAbs)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    const rel = path.join(dirRel, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsxFiles(rel));
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      results.push(rel);
    }
  }
  return results;
}

describe("Phase 2 Panel, Editor & Dashboard UI Audit Fixes", () => {
  it("RichTextEditor adds Figure/Figcaption extensions, word/char counter, and React modals without window.prompt/alert", () => {
    const editor = readProjectFile("src/components/editor/RichTextEditor.tsx");

    expect(editor).toContain("Figure");
    expect(editor).toContain("Figcaption");
    expect(editor).toContain("computeEditorCounts");
    expect(editor).not.toMatch(/\bwindow\.(prompt|alert)\b/);
  });

  it("PerplexityResearchPanel escapes HTML attributes/text and validates URLs before insertion", () => {
    const panel = readProjectFile("src/components/editor/PerplexityResearchPanel.tsx");

    expect(panel).toContain("escapeHtml");
    expect(panel).toContain("isSafeHttpOrRelativeUrl");
  });

  it("panel/iklan removes image/gif & GIF labels, fixes brand/IP leaks, and secures AdPreviewOverlay accessibility", () => {
    const constants = readProjectFile("src/app/panel/iklan/_components/ad-constants.ts");
    const baru = readProjectFile("src/app/panel/iklan/baru/page.tsx");
    const edit = readProjectFile("src/app/panel/iklan/[id]/edit/page.tsx");
    const wireframe = readProjectFile("src/app/panel/iklan/_components/SlotWireframe.tsx");
    const overlay = readProjectFile("src/app/panel/iklan/_components/AdPreviewOverlay.tsx");

    expect(constants).not.toContain("image/gif");
    expect(baru).not.toContain("image/gif");
    expect(edit).not.toContain("image/gif");
    expect(wireframe).not.toContain("145.79.15.99.nip.io");
    expect(wireframe).not.toContain("Bandung");
    expect(wireframe).not.toContain("Jadwal Sidang");
    expect(wireframe).not.toMatch(/\bGIF\b/);
    expect(overlay).toContain('aria-hidden="true"');
  });

  it("artikel/baru & artikel/[id]/edit mount featuredImage upload/picker UI and fix role/autosave guards", () => {
    const baru = readProjectFile("src/app/panel/artikel/baru/page.tsx");
    const edit = readProjectFile("src/app/panel/artikel/[id]/edit/page.tsx");

    expect(baru).toContain("ImageUploader");
    expect(baru).toContain("ImagePickerModal");
    expect(baru).toContain("featuredImage");

    expect(edit).toContain("ImageUploader");
    expect(edit).toContain("ImagePickerModal");
    expect(edit).toContain("featuredImage");
    expect(edit).toContain("showAutosaveBanner");
    expect(edit).toContain("loadAutosaveDraft");
    expect(edit).not.toContain('viewMode === "editor"');
    expect(edit).toContain("authorId");
  });

  it("panel/tags safely handles HTTP 204 No Content without calling res.json()", () => {
    const tags = readProjectFile("src/app/panel/tags/page.tsx");
    expect(tags).toContain("res.status === 204");
  });

  it("panel/artikel handles ?flag=ai -> origin=auto and PowerWidgets surfaces error UI instead of null", () => {
    const artikel = readProjectFile("src/app/panel/artikel/page.tsx");
    const widgets = readProjectFile("src/components/dashboard/PowerWidgets.tsx");

    expect(artikel).toContain('"auto"');
    expect(artikel).toContain('initialFlagParam === "ai"');
    expect(widgets).toContain("Ringkasan dashboard gagal dimuat:");
  });

  it("live-blogs sanitizes entry HTML with DOMPurify, enforces EDITOR_ROLES, and sets scheduledAt client-side", () => {
    const detail = readProjectFile("src/app/panel/live-blogs/[id]/page.tsx");
    const baru = readProjectFile("src/app/panel/live-blogs/baru/page.tsx");

    expect(detail).toContain("DOMPurify.sanitize");
    expect(detail).toContain("EDITOR_ROLES");
    expect(baru).toContain("EDITOR_ROLES");
    expect(baru).toMatch(/useEffect\([\s\S]*scheduledAt:\s*toLocalInput\(\)/);
  });

  it("panel/media, kategori, profil, polling, pengaturan, social, statistik, and login include critical P1/P2 fixes", () => {
    const media = readProjectFile("src/app/panel/media/page.tsx");
    const kategori = readProjectFile("src/app/panel/kategori/page.tsx");
    const profil = readProjectFile("src/app/panel/profil/page.tsx");
    const polling = readProjectFile("src/app/panel/polling/page.tsx");
    const pengaturan = readProjectFile("src/app/panel/pengaturan/page.tsx");
    const social = readProjectFile("src/app/panel/social/page.tsx");
    const statistik = readProjectFile("src/app/panel/statistik/page.tsx");
    const login = readProjectFile("src/app/login/page.tsx");

    expect(media).toContain("knownUploaders");
    expect(kategori).toContain("catSlugManual");
    expect(kategori).toContain("tagSlugManual");
    expect(profil).toContain("fetchedRef");
    expect(profil).toContain("update");
    expect(polling).toContain("!res.ok");
    expect(pengaturan).toContain("if (settingsLoaded)");
    expect(social).not.toContain("Jurnalishukum Bandung");
    expect(statistik).toContain("Asia/Jakarta");
    expect(login).toContain("aria-label=");
    expect(login).toMatch(/try\s*\{[\s\S]*\/api\/auth\/logout/);
  });

  it("no client component under src/app/panel or src/components/panel calls redirect() during render", () => {
    const files = [
      ...collectTsxFiles("src/app/panel"),
      ...collectTsxFiles("src/components/panel"),
    ];
    for (const rel of files) {
      const content = readProjectFile(rel);
      if (content.startsWith('"use client"') || content.startsWith("'use client'")) {
        expect(content, `${rel} should use router.replace instead of redirect()`).not.toMatch(
          /\bredirect\s*\(/,
        );
      }
    }
  });
});
