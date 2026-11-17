import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = process.cwd();

function readProjectFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("Homepage stability, layout & widget fixes", () => {
  it("eliminates unused imports, any[] casts, invalid Tailwind tokens, and duplicate sections in page.tsx & Footer", () => {
    const home = readProjectFile("src/app/page.tsx");
    const footer = readProjectFile("src/components/layout/Footer.tsx");

    expect(home).not.toContain('import NewsTicker from "@/components/layout/NewsTicker"');
    expect(home).not.toMatch(/:\s*any\[\]/);
    expect(home).toContain("where: { article: { status: \"PUBLISHED\" } }");
    expect(home).toContain("dedupedArticles.slice(7, 18)");
    expect(home).toContain("timeZone: \"Asia/Jakarta\"");
    expect(home).not.toContain("bg-white/10 sm:grid-cols-3");

    expect(footer).not.toContain("border-stone-850");
    expect(footer).toContain("border-stone-800");
  });

  it("sizes PollingCarousel cards cleanly for sidebar and shows fallback/errors", () => {
    const polling = readProjectFile("src/components/slider/PollingCarousel.tsx");

    expect(polling).not.toContain("lg:w-[calc(25%-12px)]");
    expect(polling).toContain("md:w-full");
    expect(polling).toContain("Belum ada polling aktif saat ini.");
    expect(polling).toContain('role="alert"');
  });

  it("prevents BannerAd / SidebarAd duplicate ad renders, unsafe targetUrl, and fetch races", () => {
    const bannerAd = readProjectFile("src/components/ads/BannerAd.tsx");

    expect(bannerAd).toContain("if (index >= ads.length) return;");
    expect(bannerAd).toContain("isSafeAdTargetUrl");
    expect(bannerAd).toContain("cancelled = true");
    expect(bannerAd).not.toContain("ads[index % ads.length]");
  });

  it("hardens NewsTicker, InstallPrompt, and ClientDate against NaN, private-mode storage errors, and unstable Dates", () => {
    const ticker = readProjectFile("src/components/layout/NewsTicker.tsx");
    const prompt = readProjectFile("src/components/pwa/InstallPrompt.tsx");
    const clientDate = readProjectFile("src/components/ClientDate.tsx");
    const header = readProjectFile("src/components/layout/Header.tsx");

    expect(ticker).toContain("Number.isFinite");
    expect(ticker).not.toContain("fmtChange");
    expect(ticker).not.toContain("lastUpdate");
    expect(ticker).toContain('aria-hidden="true"');

    expect(prompt).toContain("localStorage.setItem");
    expect(prompt).toContain("catch");

    expect(clientDate).toContain("Number.isNaN");
    expect(header).toContain('<ClientDate format="weekday-long" live={false} />');
  });
});
