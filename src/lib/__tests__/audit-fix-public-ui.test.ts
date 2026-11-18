import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { safeHref } from "@/components/common/safeHref";
import {
  formatWibDate,
  getWibDateParts,
  wibStartOfDayFromKey,
  wibEndOfDayFromKey,
  wibStartOfWeek,
  wibStartOfMonth,
} from "@/components/common/wib-date";
import { parseSidebarDate } from "@/components/layout/Sidebar";

const ROOT = process.cwd();

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("Audit Fix — safeHref URL sanitization", () => {
  it("allows http and https URLs", () => {
    expect(safeHref("https://lensaplus.com/berita")).toBe("https://lensaplus.com/berita");
    expect(safeHref("http://example.org/doc.pdf")).toBe("http://example.org/doc.pdf");
  });

  it("blocks dangerous or malformed schemes", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("DATA:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeHref("vbscript:msgbox(1)")).toBeNull();
    expect(safeHref("file:///etc/passwd")).toBeNull();
    expect(safeHref("//evil.example/payload")).toBeNull();
    expect(safeHref("https://ok.com/\nnewline")).toBeNull();
    expect(safeHref("")).toBeNull();
    expect(safeHref(null)).toBeNull();
  });

  it("supports safe relative paths only when allowRelative is enabled", () => {
    expect(safeHref("/uploads/reel.mp4")).toBeNull();
    expect(safeHref("/uploads/reel.mp4", { allowRelative: true })).toBe("/uploads/reel.mp4");
    expect(safeHref("//evil.com/reel.mp4", { allowRelative: true })).toBeNull();
  });
});

describe("Audit Fix — WIB (Asia/Jakarta) date helpers & Sidebar DD/MM/YYYY parser", () => {
  it("extracts Asia/Jakarta calendar day across UTC midnight", () => {
    const utcLateEvening = new Date("2026-11-18T18:30:00Z"); // 2026-11-19 01:30 WIB
    const parts = getWibDateParts(utcLateEvening);
    expect(parts).toEqual({ year: 2026, month: 11, day: 19, key: "2026-11-19" });
  });

  it("builds +07:00 start/end boundaries and week/month starts", () => {
    const start = wibStartOfDayFromKey("2026-11-18");
    const end = wibEndOfDayFromKey("2026-11-18");
    expect(start.toISOString()).toBe("2026-11-17T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-18T16:59:59.999Z");

    // 2026-11-18 is Wednesday in WIB -> Monday is 2026-11-16 00:00+07:00
    const wednesday = new Date("2026-11-18T05:00:00Z");
    expect(wibStartOfWeek(wednesday).toISOString()).toBe("2026-11-15T17:00:00.000Z");
    expect(wibStartOfMonth(wednesday).toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(formatWibDate(wednesday)).toContain("2026");
  });

  it("parses DD/MM/YYYY and ISO strings safely in Sidebar without Invalid Date", () => {
    const dmy = parseSidebarDate("18/11/2026");
    expect(dmy).not.toBeNull();
    expect(Number.isNaN(dmy!.getTime())).toBe(false);
    expect(dmy!.toISOString()).toBe("2026-11-17T17:00:00.000Z");

    const iso = parseSidebarDate("2026-11-18T08:00:00.000Z");
    expect(iso).not.toBeNull();
    expect(parseSidebarDate("invalid-date")).toBeNull();
    expect(parseSidebarDate("99/99/2026")).toBeNull();
  });
});

describe("Audit Fix — P1/P2/P3 public-ui regressions", () => {
  it("kontak reads ?subject= in Suspense and provides Laporkan Berita option", () => {
    const src = readSrc("src/app/kontak/page.tsx");
    expect(src).toContain("useSearchParams");
    expect(src).toContain("<Suspense");
    expect(src).toContain('value: "laporan"');
    expect(src).toContain("Laporkan Berita");
    expect(src).toContain('role="alert"');
  });

  it("berita/[slug] checks !session?.sessionInvalid and passes ISO string to sidebar", () => {
    const src = readSrc("src/app/berita/[slug]/page.tsx");
    expect(src).toContain("!session?.sessionInvalid");
    expect(src).not.toContain("formatSidebarDate");
    expect(src).toContain("Asia/Jakarta");
  });

  it("kategori/[slug] preserves articles for <12 items and passes ISO string to sidebar", () => {
    const src = readSrc("src/app/kategori/[slug]/page.tsx");
    expect(src).toContain("gridOffset");
    expect(src).toContain("new Date(a.publishedAt).toISOString()");
  });

  it("SearchableArticleList resets page in handlers instead of inside useMemo", () => {
    const src = readSrc("src/components/artikel/SearchableArticleList.tsx");
    expect(src).toContain("safePage");
    const memoStart = src.indexOf("useMemo(");
    const memoEnd = src.indexOf("[articles, query, sortBy]");
    expect(memoEnd).toBeGreaterThan(memoStart);
    const memoBody = src.slice(memoStart, memoEnd);
    expect(memoBody).not.toContain("setPage(");
  });

  it("kalender-emiten resolves article slug, WIB grouping, and safeHref", () => {
    const src = readSrc("src/app/kalender-emiten/page.tsx");
    expect(src).toContain("slugByArticleId");
    expect(src).toContain("/berita/${articleSlug}");
    expect(src).toContain("getWibDateParts");
    expect(src).toContain("safeHref");
  });

  it("emiten validates sector parameter and uses URLSearchParams", () => {
    const src = readSrc("src/app/emiten/page.tsx");
    expect(src).toContain("URLSearchParams");
    expect(src).toContain("validSectors.includes(rawSector as CompanySector)");
  });

  it("eliminates self-HTTP fetch in pasar/page.tsx and standardizes SITE_URL fallback", () => {
    const pasarSrc = readSrc("src/app/pasar/page.tsx");
    expect(pasarSrc).toContain("./market-data");
    expect(pasarSrc).not.toContain("fetch(`${baseUrl}/api/market`");
    expect(pasarSrc).toContain("text-headline-lg");
    expect(pasarSrc).toContain("text-display-md");
    expect(pasarSrc).not.toContain("<RefreshCw");

    const liveSrc = readSrc("src/app/live/[slug]/page.tsx");
    expect(liveSrc).toContain("process.env.NEXT_PUBLIC_APP_URL ||");
    expect(liveSrc).toContain("process.env.NEXT_PUBLIC_SITE_URL ||");
  });

  it("replaces legacy /iklan page and updates popup-600x400 CTA path", () => {
    const iklanSrc = readSrc("src/app/iklan/page.tsx");
    expect(iklanSrc).toContain('permanentRedirect("/pasang-iklan")');
    expect(iklanSrc).not.toContain("628000000000");

    const svg = readSrc("public/ads/popup-600x400.svg");
    expect(svg).toContain("lensaplus.com/pasang-iklan");
    expect(svg).not.toContain("lensaplus.com/iklan");
  });

  it("uses valid Tailwind design tokens and fonts without goto/surface-lowest/border-default", () => {
    const tw = readSrc("tailwind.config.ts");
    expect(tw).toContain("--font-playfair-display");
    expect(tw).not.toContain("goto:");

    for (const file of [
      "src/app/pasang-iklan/page.tsx",
      "src/app/privasi/page.tsx",
      "src/components/pwa/InstallPrompt.tsx",
      "src/components/pwa/InstallTeaser.tsx",
    ]) {
      const src = readSrc(file);
      expect(src).not.toContain("surface-lowest");
      expect(src).not.toContain("border-border-default");
      expect(src).not.toContain("divide-border-default");
      expect(src).not.toContain("animate-in");
      expect(src).not.toMatch(/\bdark:/);
    }
  });

  it("Turnstile shares singleton script loader and exposes error retry", () => {
    const src = readSrc("src/components/ui/Turnstile.tsx");
    expect(src).toContain("loadTurnstileScript");
    expect(src).toContain("error-callback");
    expect(src).toContain("Muat ulang verifikasi");
  });

  it("sw.js runs cache trimming in event.waitUntil without delaying response", () => {
    const sw = readSrc("public/sw.js");
    expect(sw).toContain("event.waitUntil(persistAndTrim)");
    expect(sw).not.toContain("cacheFirst(request, IMAGE_CACHE).then");
  });

  it("Header mobile button exposes aria-expanded and aria-controls", () => {
    const header = readSrc("src/components/layout/Header.tsx");
    const matches = header.match(/aria-controls="mobile-nav-drawer"/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
