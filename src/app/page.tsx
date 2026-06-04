// Revalidate window. Articles published via /api/articles or the cron route
// also call revalidatePath("/") via seo-auto.onArticlePublished — so new posts
// appear instantly. This 30s window is the fallback when that path-revalidate
// fails (e.g. AI auto-publish at scale, or cache cold-start after deploy).
export const revalidate = 30;

import Link from "next/link";
import Image from "next/image";
import HeroCarousel from "@/components/slider/HeroCarousel";
import PollingCarousel from "@/components/slider/PollingCarousel";
import BannerAd, { SidebarAd, InlineAd, NativeAd } from "@/components/ads/BannerAd";
import { Scale, Briefcase, Trophy, Film, Heart, Wheat, Cpu, Vote as VoteIcon, GraduationCap, Leaf, Compass, BookOpen, TrendingUp, LucideIcon, ArrowRight, Clock, Eye, Flame, Sparkles, ChevronRight, Shield } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCached } from "@/lib/cache";

const categoryIconMap: Record<string, LucideIcon> = {
  "hukum": Scale, "bisnis-ekonomi": Briefcase, "olahraga": Trophy, "hiburan": Film,
  "kesehatan": Heart, "pertanian-peternakan": Wheat, "teknologi": Cpu, "politik": VoteIcon,
  "pendidikan": GraduationCap, "lingkungan": Leaf, "gaya-hidup": Compass, "opini": BookOpen,
};

function timeAgo(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 60) return `${mins}m lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}j lalu`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default async function HomePage() {
  // 30s in-process cache — matches `export const revalidate = 30` so we
  // never out-stale the page itself. Articles list TTL is the bottleneck
  // for "Berita Terkini" freshness; trending changes slowly so 60s is fine.
  // Cache is invalidated immediately by onArticlePublished() at publish
  // time (see src/lib/seo-auto.ts).
  // MED-DB1: explicit select — omit content @db.Text (≥10KB/row) to avoid
  // ~600KB transfer on each homepage load. excerpt + featuredImage + metadata
  // are all this page needs.
  const articleSelect = {
    id: true,
    title: true,
    slug: true,
    excerpt: true,
    featuredImage: true,
    publishedAt: true,
    viewCount: true,
    sourceArticleId: true,
    verificationLabel: true,
    status: true,
    author: { select: { id: true, name: true, avatar: true } },
    category: { select: { id: true, name: true, slug: true } },
  } as const;

  const [articles, categories, trendingArticles] = await Promise.all([
    getCached("home:articles:30", 30_000, () =>
      prisma.article.findMany({
        where: { status: "PUBLISHED" },
        select: articleSelect,
        orderBy: { publishedAt: "desc" },
        take: 60,
      }),
    ),
    getCached("home:categories", 300_000, () =>
      prisma.category.findMany({
        include: { _count: { select: { articles: true } } },
        orderBy: { order: "asc" },
      }),
    ),
    getCached("home:trending:10", 60_000, async () => {
      const past24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      let trending = await prisma.article.findMany({
        where: {
          status: "PUBLISHED",
          publishedAt: { gte: past24Hours },
        },
        select: articleSelect,
        orderBy: { viewCount: "desc" },
        take: 10,
      });

      // Fallback 1: If fewer than 6 articles, try past 7 days
      if (trending.length < 6) {
        const past7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        trending = await prisma.article.findMany({
          where: {
            status: "PUBLISHED",
            publishedAt: { gte: past7Days },
          },
          select: articleSelect,
          orderBy: { viewCount: "desc" },
          take: 10,
        });
      }

      // Fallback 2: If still fewer than 6, get all time
      if (trending.length < 6) {
        trending = await prisma.article.findMany({
          where: { status: "PUBLISHED" },
          select: articleSelect,
          orderBy: { viewCount: "desc" },
          take: 10,
        });
      }

      return trending;
    }),
  ]);

  // Dedup by source article — auto-articles that paraphrase the same
  // source produce near-duplicate titles ("Bank BJB Raup Laba…" × 3).
  // We keep the first (most recent) occurrence per source. Manual articles
  // have no sourceArticleId, so they all fall through unchanged.
  const seenSource = new Set<string>();
  const dedupedArticles = articles.filter((a) => {
    const key = a.sourceArticleId || a.id;
    if (seenSource.has(key)) return false;
    seenSource.add(key);
    return true;
  });

  const heroMain = dedupedArticles.slice(0, 5);   // 5 articles rotate in hero
  const heroSide = dedupedArticles.slice(5, 14);  // 9 side stories — 3 pages of 3 rotating
  const editorsPickArticles = dedupedArticles.slice(14, 18);

  // Berita Terkini — 14 latest articles (1 lead + 13 in 2-col grid, ~6-7
  // rows). User feedback: 18 (sebelumnya) terlalu panjang, dirampingkan 2
  // baris. Start dari index 0 (absolute newest) — duplikasi hero #1 adalah
  // pola standar news-site (NYT, Tempo, Detik).
  const terkiniArticles = dedupedArticles.slice(0, 14);

  // Category sections — use the deduped FULL list. Same dedup-by-source
  // rule so a category isn't filled with 5 paraphrases of the same source.
  const articlesByCategory: Record<string, { slug: string; articles: typeof articles }> = {};
  for (const a of dedupedArticles) {
    const name = a.category.name;
    if (!articlesByCategory[name]) articlesByCategory[name] = { slug: a.category.slug, articles: [] };
    if (articlesByCategory[name].articles.length < 5) articlesByCategory[name].articles.push(a);
  }
  const catEntries = Object.entries(articlesByCategory);

  // sameAs: pulled from env so we don't need a redeploy to add/remove a profile.
  const socialUrls = (process.env.KARTAWARTA_SOCIAL_URLS || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));
  const fallbackSocialUrls = [
    process.env.KARTAWARTA_TWITTER_URL,
    process.env.KARTAWARTA_FACEBOOK_URL,
    process.env.KARTAWARTA_INSTAGRAM_URL,
    process.env.KARTAWARTA_LINKEDIN_URL,
    process.env.KARTAWARTA_YOUTUBE_URL,
    process.env.KARTAWARTA_TIKTOK_URL,
  ].filter((s): s is string => !!s && /^https?:\/\//i.test(s));
  // Sister media properties — knowledge-graph signal that JHB and Kartawarta
  // share a publisher entity. De-dupe in case it's already in the social list.
  const sisterBrands = ["https://jurnalishukumbandung.com"];
  const baseSameAs = socialUrls.length > 0 ? socialUrls : fallbackSocialUrls;
  const sameAs = Array.from(new Set([...baseSameAs, ...sisterBrands]));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "NewsMediaOrganization",
              "@id": "https://kartawarta.com/#organization",
              name: "Kartawarta",
              alternateName: "Kartawarta Bandung",
              url: "https://kartawarta.com",
              logo: { "@type": "ImageObject", url: "https://kartawarta.com/kartawarta-icon.png", width: 512, height: 512 },
              image: { "@type": "ImageObject", url: "https://kartawarta.com/kartawarta-icon.png" },
              description:
                "Portal berita digital Bandung — bisnis, ekonomi, pemerintahan, hukum, olahraga, hiburan, teknologi, dan peristiwa lokal Indonesia.",
              foundingDate: "2024",
              sameAs,
              publishingPrinciples: "https://kartawarta.com/pedoman-media",
              ethicsPolicy: "https://kartawarta.com/kode-etik",
              missionCoveragePrioritiesPolicy: "https://kartawarta.com/pedoman-media",
              correctionsPolicy: "https://kartawarta.com/kode-etik",
              diversityPolicy: "https://kartawarta.com/kode-etik",
              areaServed: [
                { "@type": "City", name: "Bandung" },
                { "@type": "AdministrativeArea", name: "Jawa Barat" },
                { "@type": "Country", name: "Indonesia" },
              ],
              knowsAbout: [
                "Bisnis Indonesia", "Ekonomi", "Pemerintahan", "Kebijakan Publik",
                "APBD/APBN", "Hukum Indonesia", "Putusan Pengadilan", "UU/Regulasi",
                "Politik", "Pemilu", "Olahraga", "Hiburan", "Teknologi",
                "Pendidikan", "Kesehatan", "Lingkungan",
                "Berita Bandung", "Berita Jawa Barat", "Berita Indonesia",
              ],
              contactPoint: [
                { "@type": "ContactPoint", contactType: "customer service", url: "https://kartawarta.com/kontak", areaServed: "ID", availableLanguage: ["Indonesian"] },
                { "@type": "ContactPoint", contactType: "editorial", url: "https://kartawarta.com/redaksi", areaServed: "ID", availableLanguage: ["Indonesian"] },
              ],
              address: {
                "@type": "PostalAddress",
                addressLocality: "Bandung",
                addressRegion: "Jawa Barat",
                addressCountry: "ID",
              },
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": "https://kartawarta.com/#website",
              name: "Kartawarta",
              alternateName: "Kartawarta — Media Berita Digital Bandung",
              url: "https://kartawarta.com",
              inLanguage: "id-ID",
              publisher: { "@id": "https://kartawarta.com/#organization" },
              potentialAction: {
                "@type": "SearchAction",
                target: { "@type": "EntryPoint", urlTemplate: "https://kartawarta.com/search?q={search_term_string}" },
                "query-input": "required name=search_term_string",
              },
            },
          ]),
        }}
      />


      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          HERO â€” Auto-rotating carousel + side stories
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* AD: Banner di bawah ticker market, di atas hero — visibility tinggi */}
      {/* Single h1 for screen readers and search engines — HeroCarousel uses h2 per slide */}
      <h1 className="sr-only">Kartawarta — Media Berita Digital Bandung</h1>
      <BannerAd size="leaderboard" slot="HEADER" className="bg-surface" />

      <HeroCarousel
        main={JSON.parse(JSON.stringify(heroMain))}
        side={JSON.parse(JSON.stringify(heroSide))}
      />

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          TERKINI + TERPOPULER + SIDEBAR AD
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <section className="bg-surface-container-low py-8 sm:py-10 md:py-12 lg:py-14 2xl:py-20">
        <div className="container-main">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 sm:gap-10">
            {/* Berita Terkini â€” 7 cols */}
            <div className="md:col-span-7">
              <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/20 shrink-0">
                    <Flame size={18} strokeWidth={2.5} />
                  </div>
                  <h2 className="font-serif text-headline-sm sm:text-headline-md text-on-surface truncate">Berita Terkini</h2>
                </div>
                <Link href="/berita" className="flex items-center gap-1.5 rounded-full bg-primary/5 px-3 sm:px-4 py-1.5 sm:py-2 text-label-sm sm:text-label-md uppercase tracking-wider font-semibold text-primary hover:bg-primary/10 transition-colors shrink-0">
                  <span className="hidden sm:inline">Lihat Semua</span>
                  <span className="sm:hidden">Semua</span>
                  <ChevronRight size={14} />
                </Link>
              </div>
              {/* First article large */}
              {terkiniArticles[0] && (
                <article className="group mb-6 sm:mb-8">
                  <Link href={`/berita/${terkiniArticles[0].slug}`} className="block">
                    <div className="relative aspect-[2/1] overflow-hidden rounded-sm">
                      {terkiniArticles[0].featuredImage ? (
                        <Image src={terkiniArticles[0].featuredImage} alt={terkiniArticles[0].title} fill priority className="object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                      ) : (
                        <div className="h-full w-full bg-surface-container" />
                      )}
                    </div>
                  </Link>
                  <div className="mt-3 sm:mt-4">
                    <span className="text-label-sm font-bold uppercase tracking-widest text-primary">{terkiniArticles[0].category.name}</span>
                    <Link href={`/berita/${terkiniArticles[0].slug}`}>
                      <h3 className="mt-1 font-serif text-title-lg sm:text-headline-sm lg:text-headline-md leading-tight text-on-surface group-hover:text-primary transition-colors">
                        {terkiniArticles[0].title}
                      </h3>
                    </Link>
                    {terkiniArticles[0].excerpt && (
                      <p className="mt-2 text-body-sm sm:text-body-md text-on-surface-variant line-clamp-2">{terkiniArticles[0].excerpt}</p>
                    )}
                  </div>
                </article>
              )}
              {/* Rest as compact list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 sm:gap-y-5">
                {terkiniArticles.slice(1).map((a) => (
                  <article key={a.slug} className="group flex gap-3 sm:gap-4">
                    {a.featuredImage && (
                      <Link href={`/berita/${a.slug}`} className="shrink-0">
                        <div className="relative h-16 w-24 sm:h-20 sm:w-28 overflow-hidden rounded-sm">
                          <Image src={a.featuredImage} alt={a.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                        </div>
                      </Link>
                    )}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <Link href={`/berita/${a.slug}`}>
                        <h4 className="text-title-sm leading-snug text-on-surface line-clamp-2 group-hover:text-primary transition-colors">
                          {a.title}
                        </h4>
                      </Link>
                      <p className="mt-1 text-label-sm uppercase tracking-wider text-on-surface-variant">
                        {timeAgo(a.publishedAt)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>

              {/* "Lihat Lainnya" CTA — fills the gap when sidebar runs taller
                  than the article list and gives readers an explicit door to the
                  full /berita listing. */}
              <div className="mt-8 sm:mt-10 border-t border-on-surface/10 pt-5 sm:pt-6 flex justify-center">
                <Link
                  href="/berita"
                  className="group inline-flex items-center gap-2 rounded-full bg-primary px-5 sm:px-6 py-2.5 sm:py-3 text-label-sm sm:text-label-md font-bold uppercase tracking-wider text-white transition-all hover:bg-primary-dark hover:gap-3 shadow-md shadow-primary/20"
                >
                  Lihat Berita Lainnya
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

            {/* Sidebar â€” 5 cols: Terpopuler + Ads */}
            <aside className="md:col-span-5">
              {/* Terpopuler */}
              <div className="mb-8">
                <div className="flex items-center gap-2.5 sm:gap-3 mb-5 sm:mb-6">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-white shadow-md shadow-secondary/20 shrink-0">
                    <TrendingUp size={16} strokeWidth={2.5} />
                  </div>
                  <h2 className="font-serif text-headline-sm text-on-surface">Terpopuler 24 Jam</h2>
                </div>
                <div className="flex flex-col">
                  {trendingArticles.slice(0, 6).map((a, i) => (
                    <div key={a.slug} className={`group flex items-start gap-4 py-4 ${i > 0 ? "border-t border-on-surface/5" : ""}`}>
                      <span className="shrink-0 font-serif text-3xl font-bold text-primary/15 leading-none select-none w-7 text-right mt-0.5">
                        {i + 1}
                      </span>
                      <Link
                        href={`/berita/${a.slug}`}
                        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-container-low"
                        aria-hidden="true"
                        tabIndex={-1}
                      >
                        {a.featuredImage && (
                          <Image
                            src={a.featuredImage}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        )}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={`/berita/${a.slug}`}>
                          <h3 className="text-title-sm leading-snug text-on-surface line-clamp-2 group-hover:text-primary transition-colors">
                            {a.title}
                          </h3>
                        </Link>
                        <p className="mt-1.5 flex items-center gap-1.5 text-label-sm uppercase tracking-wider text-on-surface-variant">
                          <span className="text-primary font-semibold">{a.category.name}</span>
                          <span className="mx-0.5 text-on-surface-variant/20">/</span>
                          <Eye size={10} className="text-on-surface-variant/50" />
                          {a.viewCount?.toLocaleString("id-ID")} views
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AD: Sidebar pair — responsive layout
                  - Mobile (< sm): 1 ad only (compact, less vertical space)
                  - Tablet (sm to md): 2 ads side-by-side
                  - Desktop (md+, sidebar 5/12 cols): 2 ads stacked vertically
                  Index prop ensures the two slots show DIFFERENT ads
                  (instead of random pick that can yield duplicates). */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-4 md:gap-6">
                <SidebarAd index={0} />
                <div className="hidden sm:block">
                  <SidebarAd index={1} />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          EDITOR'S PICK â€” 4 cards horizontal
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {editorsPickArticles.length > 0 && (
        <section className="bg-surface py-8 sm:py-10 md:py-12 lg:py-14 2xl:py-20">
          <div className="container-main">
            <div className="flex items-start sm:items-center justify-between gap-3 mb-6 sm:mb-8">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-secondary text-white shadow-md shadow-secondary/20 shrink-0">
                  <Sparkles size={18} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <span className="text-label-sm sm:text-label-md uppercase tracking-widest text-secondary font-bold">Pilihan Editor</span>
                  <h2 className="font-serif text-headline-sm sm:text-headline-md text-on-surface mt-0.5">
                    Wajib Dibaca Hari Ini
                  </h2>
                </div>
              </div>
              <Link href="/berita" className="hidden sm:flex items-center gap-1.5 rounded-full bg-primary/5 px-4 py-2 text-label-md uppercase tracking-wider font-semibold text-primary hover:bg-primary/10 transition-colors shrink-0">
                Semua Berita <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
              {editorsPickArticles.map((a) => (
                <article key={a.slug} className="group">
                  <Link href={`/berita/${a.slug}`} className="block">
                    <div className="relative aspect-[3/2] overflow-hidden rounded-sm">
                      {a.featuredImage ? (
                        <Image src={a.featuredImage} alt={a.title} fill className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                      ) : (
                        <div className="h-full w-full bg-surface-container-low" />
                      )}
                    </div>
                  </Link>
                  <div className="mt-2 sm:mt-3">
                    <span className="text-[10px] sm:text-label-sm font-bold uppercase tracking-widest text-primary">{a.category.name}</span>
                    <Link href={`/berita/${a.slug}`}>
                      <h3 className="mt-1 font-serif text-title-sm sm:text-title-lg leading-snug text-on-surface line-clamp-3 sm:line-clamp-2 group-hover:text-primary transition-colors">
                        {a.title}
                      </h3>
                    </Link>
                    <p className="mt-1.5 sm:mt-2 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-label-sm uppercase tracking-wider text-on-surface-variant truncate">
                      <span className="truncate">{a.author.name}</span> <span className="text-on-surface-variant/30 mx-0.5 shrink-0">/</span> <Clock size={10} className="text-on-surface-variant/50 shrink-0" /> {timeAgo(a.publishedAt)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* AD: Between sections */}
      <BannerAd size="banner" slot="BETWEEN_SECTIONS" className="bg-surface" />

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          POLLING
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <section className="bg-surface py-8 sm:py-10 md:py-12 lg:py-14 2xl:py-20">
        <div className="container-main">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-6 sm:mb-8">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-secondary text-white shadow-md shadow-secondary/20 shrink-0">
              <Shield size={18} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <span className="text-label-sm sm:text-label-md uppercase tracking-widest text-secondary font-bold">Suara Pembaca</span>
              <h2 className="font-serif text-headline-sm sm:text-headline-md text-on-surface mt-0.5">Polling</h2>
            </div>
          </div>
          <PollingCarousel />
        </div>
      </section>

      {/* AD: Inline */}
      <InlineAd className="bg-surface-container-low" />

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          CATEGORY SECTIONS â€” alternating layouts
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {catEntries.map(([catName, { slug: catSlug, articles: catArticles }], idx) => {
        const main = catArticles[0];
        const side = catArticles.slice(1);
        const isEven = idx % 2 === 0;

        return (
          <div key={catSlug}>
            <section className={`py-8 sm:py-10 md:py-12 lg:py-14 2xl:py-20 ${isEven ? "bg-surface" : "bg-surface-container-low"}`}>
              <div className="container-main">
                {/* Header */}
                <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
                  <Link href={`/kategori/${catSlug}`} className="group flex items-center gap-2.5 sm:gap-3 min-w-0">
                    {(() => { const CatIcon = categoryIconMap[catSlug] || Scale; return (
                      <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/10 group-hover:from-primary/25 group-hover:to-primary/10 transition-all shrink-0">
                        <CatIcon size={18} strokeWidth={2.5} />
                      </div>
                    ); })()}
                    <h2 className="font-serif text-title-lg sm:text-headline-sm text-on-surface group-hover:text-primary transition-colors truncate">
                      {catName}
                    </h2>
                  </Link>
                  <Link href={`/kategori/${catSlug}`} className="flex items-center gap-1.5 rounded-full bg-primary/5 px-3 sm:px-4 py-1.5 sm:py-2 text-label-sm sm:text-label-md uppercase tracking-wider font-semibold text-primary hover:bg-primary/10 transition-colors shrink-0">
                    <span className="hidden sm:inline">Lihat Semua</span>
                    <span className="sm:hidden">Semua</span>
                    <ChevronRight size={14} />
                  </Link>
                </div>

                {/* Layout A (even): Large left + list right on desktop;
                    on mobile, two side-by-side cards on top + list below.
                    The single full-width hero on mobile was overpowering and
                    pushed the rest of the section below the fold — readers
                    reported it felt like only one article per category. */}
                {isEven ? (
                  <>
                    {/* ── Mobile: 2 cards berdampingan, sisa list ── */}
                    <div className="md:hidden">
                      {(() => {
                        const top2 = catArticles.slice(0, 2);
                        const rest = catArticles.slice(2);
                        return (
                          <>
                            {top2.length > 0 && (
                              <div className="grid grid-cols-2 gap-3 mb-5">
                                {top2.map((a) => (
                                  <article key={a.slug} className="group">
                                    <Link href={`/berita/${a.slug}`} className="block">
                                      <div className="relative aspect-[4/3] overflow-hidden rounded-sm">
                                        {a.featuredImage ? (
                                          <Image src={a.featuredImage} alt={a.title} fill className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" sizes="(max-width: 768px) 50vw, 25vw" />
                                        ) : (
                                          <div className="h-full w-full bg-surface-container" />
                                        )}
                                      </div>
                                    </Link>
                                    <div className="mt-2.5">
                                      <Link href={`/berita/${a.slug}`}>
                                        <h3 className="font-serif text-title-sm leading-snug text-on-surface line-clamp-3 group-hover:text-primary transition-colors">
                                          {a.title}
                                        </h3>
                                      </Link>
                                      <p className="mt-1.5 text-[10px] sm:text-label-sm uppercase tracking-wider text-on-surface-variant">
                                        {timeAgo(a.publishedAt)}
                                      </p>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            )}
                            {rest.length > 0 && (
                              <div className="flex flex-col gap-3 border-t border-border pt-4">
                                {rest.map((a) => (
                                  <article key={a.slug} className="group flex gap-3">
                                    {a.featuredImage && (
                                      <Link href={`/berita/${a.slug}`} className="shrink-0">
                                        <div className="relative h-16 w-24 overflow-hidden rounded-sm">
                                          <Image src={a.featuredImage} alt={a.title} fill className="object-cover" sizes="96px" />
                                        </div>
                                      </Link>
                                    )}
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                      <Link href={`/berita/${a.slug}`}>
                                        <h4 className="text-title-sm leading-snug text-on-surface line-clamp-2 group-hover:text-primary transition-colors">{a.title}</h4>
                                      </Link>
                                      <p className="mt-1 text-[10px] sm:text-label-sm uppercase tracking-wider text-on-surface-variant">{timeAgo(a.publishedAt)}</p>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    {/* ── Desktop / tablet: layout asli (lead besar + list samping) ── */}
                    <div className="hidden md:grid md:grid-cols-12 gap-6 sm:gap-8">
                      {main && (
                        <div className="md:col-span-7">
                          <Link href={`/berita/${main.slug}`} className="group block">
                            <div className="relative aspect-[16/9] overflow-hidden rounded-sm">
                              {main.featuredImage ? (
                                <Image src={main.featuredImage} alt={main.title} fill className="object-cover transition-transform duration-500 group-hover:scale-[1.02]" sizes="(max-width: 1024px) 60vw, 50vw" />
                              ) : (
                                <div className="h-full w-full bg-surface-container" />
                              )}
                            </div>
                          </Link>
                          <div className="mt-4 sm:mt-5">
                            <Link href={`/berita/${main.slug}`}>
                              <h3 className="font-serif text-title-lg sm:text-headline-sm lg:text-headline-md leading-tight text-on-surface group-hover:text-primary transition-colors">
                                {main.title}
                              </h3>
                            </Link>
                            {main.excerpt && <p className="mt-2 sm:mt-3 text-body-sm sm:text-body-md text-on-surface-variant line-clamp-2">{main.excerpt}</p>}
                            <p className="mt-2 sm:mt-3 flex items-center gap-1.5 text-label-sm uppercase tracking-wider text-on-surface-variant">
                              {main.author.name} <span className="mx-0.5 text-on-surface-variant/20">/</span> <Clock size={10} className="text-on-surface-variant/50" /> {timeAgo(main.publishedAt)}
                            </p>
                          </div>
                        </div>
                      )}
                      {side.length > 0 && (
                        <div className="md:col-span-5 flex flex-col gap-4 sm:gap-5">
                          {side.map((a) => (
                            <article key={a.slug} className="group flex gap-3 sm:gap-4">
                              {a.featuredImage && (
                                <Link href={`/berita/${a.slug}`} className="shrink-0">
                                  <div className="relative h-16 w-24 sm:h-20 sm:w-28 overflow-hidden rounded-sm">
                                    <Image src={a.featuredImage} alt={a.title} fill className="object-cover" sizes="112px" />
                                  </div>
                                </Link>
                              )}
                              <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <Link href={`/berita/${a.slug}`}>
                                  <h4 className="text-title-sm leading-snug text-on-surface line-clamp-2 group-hover:text-primary transition-colors">{a.title}</h4>
                                </Link>
                                <p className="mt-1 text-label-sm uppercase tracking-wider text-on-surface-variant">{timeAgo(a.publishedAt)}</p>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* Layout B (odd): Grid of cards. 2-col bahkan di viewport
                     paling kecil supaya gambar tidak jadi banner full-width
                     dominan; di sm+ tetap 2-col, naik 3-col di md+. */
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5 lg:gap-6">
                    {catArticles.slice(0, 3).map((a) => (
                      <article key={a.slug} className="group">
                        <Link href={`/berita/${a.slug}`} className="block">
                          <div className="relative aspect-[3/2] overflow-hidden rounded-sm">
                            {a.featuredImage ? (
                              <Image src={a.featuredImage} alt={a.title} fill className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                            ) : (
                              <div className="h-full w-full bg-surface-container" />
                            )}
                          </div>
                        </Link>
                        <div className="mt-2 sm:mt-3">
                          <Link href={`/berita/${a.slug}`}>
                            <h3 className="font-serif text-title-sm sm:text-title-lg leading-snug text-on-surface line-clamp-3 sm:line-clamp-2 group-hover:text-primary transition-colors">{a.title}</h3>
                          </Link>
                          <p className="mt-1.5 sm:mt-2 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-label-sm uppercase tracking-wider text-on-surface-variant truncate">
                            <span className="truncate">{a.author.name}</span> <span className="mx-0.5 text-on-surface-variant/20 shrink-0">/</span> <Clock size={10} className="text-on-surface-variant/50 shrink-0" /> {timeAgo(a.publishedAt)}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              {idx === 1 && <div className="container-main mt-8"><NativeAd /></div>}
            </section>

            {idx > 0 && idx % 3 === 2 && (
              <BannerAd size="banner" slot="BETWEEN_SECTIONS" className={isEven ? "bg-surface-container-low" : "bg-surface"} />
            )}
          </div>
        );
      })}

      {/* AD: Footer */}
      <BannerAd size="leaderboard" slot="FOOTER" className="bg-surface" />

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          CATEGORY GRID
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {(() => {
        // Most-active first; empty (0-article) categories drop to bottom.
        const sortedCategories = [...categories].sort(
          (a, b) => b._count.articles - a._count.articles,
        );

        return (
          <section className="bg-primary py-8 sm:py-10 md:py-12 lg:py-14 2xl:py-20">
            <div className="container-main">
              {/* Header — flat, editorial, no chrome */}
              <div className="mb-6 sm:mb-8 flex items-end justify-between gap-4 border-b border-white/15 pb-4 sm:pb-5">
                <div className="min-w-0">
                  <span className="text-label-sm sm:text-label-md font-bold uppercase tracking-widest text-white/60">Topik</span>
                  <h2 className="mt-1 font-serif text-headline-sm sm:text-headline-md lg:text-headline-lg leading-tight text-white">Jelajahi Kategori</h2>
                </div>
                <p className="hidden max-w-sm text-body-sm text-white/55 sm:block shrink-0">
                  Temukan berita berdasarkan topik yang Anda minati.
                </p>
              </div>

              {/* Uniform grid — square tiles, single bold treatment */}
              <div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {sortedCategories.map((cat) => {
                  const Icon = categoryIconMap[cat.slug] || Scale;
                  const isEmpty = cat._count.articles === 0;
                  return (
                    <Link
                      key={cat.slug}
                      href={`/kategori/${cat.slug}`}
                      className={`group flex flex-col justify-between gap-4 sm:gap-6 bg-primary p-4 sm:p-5 transition-colors duration-200 hover:bg-secondary ${isEmpty ? "opacity-40" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <Icon size={20} strokeWidth={2} className="text-white sm:hidden" />
                        <Icon size={22} strokeWidth={2} className="text-white hidden sm:block" />
                        <ChevronRight size={16} className="text-white/30 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-white" />
                      </div>
                      <div>
                        <h3 className="font-serif text-title-sm sm:text-title-md leading-tight text-white">{cat.name}</h3>
                        <p className="mt-1 text-label-sm uppercase tracking-wider text-white/55">
                          {cat._count.articles} artikel
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })()}
    </>
  );
}
