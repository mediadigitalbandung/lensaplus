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

  it("includes thumbnails in Terhangat, removes Jelajahi Kategori Berita, keeps Header height stable on scroll, and aligns NewsletterBox with DESIGN_SOP", () => {
    const home = readProjectFile("src/app/page.tsx");
    const header = readProjectFile("src/components/layout/Header.tsx");
    const newsletter = readProjectFile("src/components/common/NewsletterBox.tsx");
    const layout = readProjectFile("src/app/layout.tsx");

    // Terhangat column has thumbnails & Category Grid Footer is removed
    const terhangatSection = home.slice(home.indexOf("Column 3: Fresh News / Terhangat"));
    expect(terhangatSection).toContain("resolveArticleImage");
    expect(home).not.toContain("Jelajahi Kategori Berita");
    expect(home).not.toContain("home:categories");

    // Header must not collapse height on scroll
    expect(header).not.toContain("h-0 overflow-hidden");
    expect(layout).toContain("overflow-x-clip");
    expect(layout).not.toContain("overflow-x-hidden");
    expect(layout).toContain("https://www.googletagmanager.com/gtm.js?id=GTM-N9S7N99M");

    // NewsletterBox obeys DESIGN_SOP (semantic tokens, light card surface, no hardcoded #002a5c, no amber, no blur orbs)
    expect(newsletter).not.toContain("#002a5c");
    expect(newsletter).not.toContain("amber-");
    expect(newsletter).not.toContain("blur-3xl");
    expect(newsletter).not.toContain("bg-primary");
    expect(newsletter).toContain("bg-white");
    expect(newsletter).toContain("border-l-4 border-secondary");
  });

  it("keeps news placements compact on mobile and narrow viewports without single-story oversized blocks", () => {
    const home = readProjectFile("src/app/page.tsx");
    const untukAnda = readProjectFile("src/app/untuk-anda/UntukAndaClient.tsx");
    const bookmark = readProjectFile("src/app/bookmark/page.tsx");
    const rangkuman = readProjectFile("src/app/rangkuman/page.tsx");
    const rangkumanHarianDetail = readProjectFile("src/app/rangkuman/harian/[slug]/page.tsx");
    const live = readProjectFile("src/app/live/page.tsx");
    const kategori = readProjectFile("src/app/kategori/[slug]/page.tsx");

    // Pilihan Redaksi & Terhangat use compact horizontal split rows on mobile and 3-col grids on sm..md
    expect(home).toContain("sm:grid sm:grid-cols-3 sm:gap-4 lg:flex lg:flex-col");
    expect(home).toContain("flex-row-reverse sm:flex-col");
    expect(home).toContain("flex-row sm:flex-col");
    // Trending, Sorotan, Rangkuman Pintar, and odd Category sections use horizontal snap strips or multi-up sizing on mobile
    expect(home).toContain("w-[46vw] min-w-[162px]");
    expect(home).toContain("snap-x snap-mandatory");
    // Berita Terkini + Sidebar split moves to lg: so md tablet columns aren't crushed
    expect(home).toContain("grid-cols-1 lg:grid-cols-12");

    // Listing pages use horizontal compact rows or 2-up grids on mobile instead of giant full-width single cards
    expect(untukAnda).toContain("flex-row sm:flex-col");
    expect(bookmark).toContain("flex-row sm:flex-col");
    expect(rangkuman).toContain("flex-row sm:flex-col");
    expect(rangkumanHarianDetail).toContain("grid-cols-2 gap-3");
    expect(live).toContain("flex gap-3 sm:block");
    expect(kategori).toContain("grid-cols-1 gap-8 lg:grid-cols-3");
  });

  it("renders HeadlineSlider + SubHeadlineSlider in both Hero and Berita Terkini following DESIGN_SOP", () => {
    const home = readProjectFile("src/app/page.tsx");
    const headlineSlider = readProjectFile("src/components/slider/HeadlineSlider.tsx");
    const subHeadlineSlider = readProjectFile("src/components/slider/SubHeadlineSlider.tsx");

    expect(home).toContain('badgeLabel="Terhangat Hari Ini"');
    expect(home).toContain('badgeLabel="Berita Terbaru"');
    expect((home.match(/<HeadlineSlider/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((home.match(/<SubHeadlineSlider/g) || []).length).toBeGreaterThanOrEqual(2);

    // DESIGN_SOP compliance: zero circular arrow boxes, serif titles
    expect(headlineSlider).toContain("font-serif");
    expect(headlineSlider).not.toContain("rounded-full bg-black");
    expect(subHeadlineSlider).toContain("font-serif");
    expect(subHeadlineSlider).toContain("grid-cols-2");
    expect(subHeadlineSlider).not.toContain("rounded-full bg-black");

    // Sorotan section on homepage follows light-surface DESIGN_SOP (no full-bleed bg-primary) and strips HTML tags
    const sorotanSection = home.slice(
      home.indexOf("SOROTAN & ANALISIS SUDUT PANDANG"),
      home.indexOf("TERKINI + SIDEBAR POLLING"),
    );
    expect(sorotanSection).not.toContain("bg-primary");
    expect(sorotanSection).not.toContain("bg-white/5");
    expect(sorotanSection).toContain("border-l-4 border-secondary");
    expect(sorotanSection).toContain("stripHtml(item.content)");
    expect(home).toContain('case "HUKUM"');
    expect(home).toContain('case "EKONOMI"');
  });
});
