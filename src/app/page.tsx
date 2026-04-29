// Revalidate window. Articles published via /api/articles or the cron route
// also call revalidatePath("/") via seo-auto.onArticlePublished — so new posts
// appear instantly. This 30s window is the fallback when that path-revalidate
// fails (e.g. AI auto-publish at scale, or cache cold-start after deploy).
export const revalidate = 30;

import Link from "next/link";
import Image from "next/image";
import NewsTicker from "@/components/layout/NewsTicker";
import HeroCarousel from "@/components/slider/HeroCarousel";
import PollingCarousel from "@/components/slider/PollingCarousel";
import BannerAd, { SidebarAd, InlineAd, NativeAd } from "@/components/ads/BannerAd";
import { Scale, Briefcase, Trophy, Film, Heart, Wheat, Cpu, Vote as VoteIcon, GraduationCap, Leaf, Compass, BookOpen, TrendingUp, LucideIcon, ArrowRight, Clock, Eye, Flame, Sparkles, ChevronRight, Shield } from "lucide-react";
import { prisma } from "@/lib/prisma";

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
  const [articles, categories, trendingArticles] = await Promise.all([
    prisma.article.findMany({
      where: { status: "PUBLISHED" },
      include: { author: true, category: true },
      orderBy: { publishedAt: "desc" },
      take: 60,
    }),
    prisma.category.findMany({
      include: { _count: { select: { articles: true } } },
      orderBy: { order: "asc" },
    }),
    prisma.article.findMany({
      where: { status: "PUBLISHED" },
      include: { author: true, category: true },
      orderBy: { viewCount: "desc" },
      take: 10,
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

  // Berita Terkini — 18 latest articles (1 lead + 17 in 2-col grid). Sized so
  // the left column matches the height of the right Terpopuler+ads sidebar
  // and there's no awkward whitespace below. Skip only the lead hero #1 so
  // we don't render the same article as "big" in two places.
  const terkiniArticles = dedupedArticles.slice(1, 19);

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
  const sameAs = socialUrls.length > 0 ? socialUrls : fallbackSocialUrls;

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
                "Portal berita hukum digital terpercaya untuk Bandung dan Jawa Barat. Putusan pengadilan, regulasi, advokasi, dan analisis ahli.",
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
                "Hukum Indonesia", "Putusan Pengadilan", "UU ITE", "Tipikor",
                "Hukum Pidana", "Hukum Perdata", "Hukum Tata Negara",
                "Berita Bandung", "Jurnalisme Hukum",
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
              alternateName: "Kartawarta — Media Hukum Digital",
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

      <NewsTicker />

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          HERO â€” Auto-rotating carousel + side stories
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* AD: Banner di bawah ticker market, di atas hero — visibility tinggi */}
      <BannerAd size="leaderboard" slot="HEADER" className="bg-surface" />

      <HeroCarousel
        main={JSON.parse(JSON.stringify(heroMain))}
        side={JSON.parse(JSON.stringify(heroSide))}
      />

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          TERKINI + TERPOPULER + SIDEBAR AD
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <section className="bg-surface-container-low py-14">
        <div className="container-main">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Berita Terkini â€” 7 cols */}
            <div className="lg:col-span-7">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/20">
                    <Flame size={18} strokeWidth={2.5} />
                  </div>
                  <h2 className="font-serif text-headline-md text-on-surface">Berita Terkini</h2>
                </div>
                <Link href="/berita" className="flex items-center gap-1.5 rounded-full bg-primary/5 px-4 py-2 text-label-md uppercase tracking-wider font-semibold text-primary hover:bg-primary/10 transition-colors">
                  Lihat Semua <ChevronRight size={14} />
                </Link>
              </div>
              {/* First article large */}
              {terkiniArticles[0] && (
                <article className="group mb-8">
                  <Link href={`/berita/${terkiniArticles[0].slug}`} className="block">
                    <div className="relative aspect-[2/1] overflow-hidden rounded-sm">
                      {terkiniArticles[0].featuredImage ? (
                        <Image src={terkiniArticles[0].featuredImage} alt={terkiniArticles[0].title} fill className="object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                      ) : (
                        <div className="h-full w-full bg-surface-container" />
                      )}
                    </div>
                  </Link>
                  <div className="mt-4">
                    <span className="text-label-sm font-bold uppercase tracking-widest text-primary">{terkiniArticles[0].category.name}</span>
                    <Link href={`/berita/${terkiniArticles[0].slug}`}>
                      <h3 className="mt-1 font-serif text-headline-md leading-tight text-on-surface group-hover:text-primary transition-colors">
                        {terkiniArticles[0].title}
                      </h3>
                    </Link>
                    {terkiniArticles[0].excerpt && (
                      <p className="mt-2 text-body-md text-on-surface-variant line-clamp-2">{terkiniArticles[0].excerpt}</p>
                    )}
                  </div>
                </article>
              )}
              {/* Rest as compact list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                {terkiniArticles.slice(1).map((a) => (
                  <article key={a.slug} className="group flex gap-4">
                    {a.featuredImage && (
                      <Link href={`/berita/${a.slug}`} className="shrink-0">
                        <div className="relative h-20 w-28 overflow-hidden rounded-sm">
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
              <div className="mt-10 border-t border-on-surface/10 pt-6 flex justify-center">
                <Link
                  href="/berita"
                  className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-label-md font-bold uppercase tracking-wider text-white transition-all hover:bg-primary-dark hover:gap-3 shadow-md shadow-primary/20"
                >
                  Lihat Berita Lainnya
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

            {/* Sidebar â€” 5 cols: Terpopuler + Ads */}
            <aside className="lg:col-span-5">
              {/* Terpopuler */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-white shadow-md shadow-secondary/20">
                    <TrendingUp size={16} strokeWidth={2.5} />
                  </div>
                  <h2 className="font-serif text-headline-sm text-on-surface">Terpopuler</h2>
                </div>
                <div className="flex flex-col">
                  {trendingArticles.slice(0, 6).map((a, i) => (
                    <div key={a.slug} className={`group flex items-start gap-4 py-4 ${i > 0 ? "border-t border-on-surface/5" : ""}`}>
                      <span className="shrink-0 font-serif text-3xl font-bold text-primary/15 leading-none select-none w-7 text-right mt-0.5">
                        {i + 1}
                      </span>
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

              {/* AD: Sidebar */}
              <SidebarAd />

              {/* AD: 2nd sidebar */}
              <div className="mt-6">
                <SidebarAd />
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          EDITOR'S PICK â€” 4 cards horizontal
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {editorsPickArticles.length > 0 && (
        <section className="bg-surface py-14">
          <div className="container-main">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-white shadow-md shadow-secondary/20">
                  <Sparkles size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <span className="text-label-md uppercase tracking-widest text-secondary font-bold">Pilihan Editor</span>
                  <h2 className="font-serif text-headline-md text-on-surface mt-0.5">
                    Wajib Dibaca Hari Ini
                  </h2>
                </div>
              </div>
              <Link href="/berita" className="hidden sm:flex items-center gap-1.5 rounded-full bg-primary/5 px-4 py-2 text-label-md uppercase tracking-wider font-semibold text-primary hover:bg-primary/10 transition-colors">
                Semua Berita <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  <div className="mt-3">
                    <span className="text-label-sm font-bold uppercase tracking-widest text-primary">{a.category.name}</span>
                    <Link href={`/berita/${a.slug}`}>
                      <h3 className="mt-1 font-serif text-title-lg leading-snug text-on-surface line-clamp-2 group-hover:text-primary transition-colors">
                        {a.title}
                      </h3>
                    </Link>
                    <p className="mt-2 flex items-center gap-1.5 text-label-sm uppercase tracking-wider text-on-surface-variant">
                      {a.author.name} <span className="text-on-surface-variant/30 mx-0.5">/</span> <Clock size={10} className="text-on-surface-variant/50" /> {timeAgo(a.publishedAt)}
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
      <section className="bg-surface py-14">
        <div className="container-main">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-white shadow-md shadow-secondary/20">
              <Shield size={18} strokeWidth={2.5} />
            </div>
            <div>
              <span className="text-label-md uppercase tracking-widest text-secondary font-bold">Suara Pembaca</span>
              <h2 className="font-serif text-headline-md text-on-surface mt-0.5">Polling</h2>
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
            <section className={`py-14 ${isEven ? "bg-surface" : "bg-surface-container-low"}`}>
              <div className="container-main">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                  <Link href={`/kategori/${catSlug}`} className="group flex items-center gap-3">
                    {(() => { const CatIcon = categoryIconMap[catSlug] || Scale; return (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/10 group-hover:from-primary/25 group-hover:to-primary/10 transition-all">
                        <CatIcon size={18} strokeWidth={2.5} />
                      </div>
                    ); })()}
                    <h2 className="font-serif text-headline-sm text-on-surface group-hover:text-primary transition-colors">
                      {catName}
                    </h2>
                  </Link>
                  <Link href={`/kategori/${catSlug}`} className="flex items-center gap-1.5 rounded-full bg-primary/5 px-4 py-2 text-label-md uppercase tracking-wider font-semibold text-primary hover:bg-primary/10 transition-colors">
                    Lihat Semua <ChevronRight size={14} />
                  </Link>
                </div>

                {/* Layout A (even): Large left + list right */}
                {isEven ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {main && (
                      <div className="lg:col-span-7">
                        <Link href={`/berita/${main.slug}`} className="group block">
                          <div className="relative aspect-[16/9] overflow-hidden rounded-sm">
                            {main.featuredImage ? (
                              <Image src={main.featuredImage} alt={main.title} fill className="object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                            ) : (
                              <div className="h-full w-full bg-surface-container" />
                            )}
                          </div>
                        </Link>
                        <div className="mt-5">
                          <Link href={`/berita/${main.slug}`}>
                            <h3 className="font-serif text-headline-md leading-tight text-on-surface group-hover:text-primary transition-colors">
                              {main.title}
                            </h3>
                          </Link>
                          {main.excerpt && <p className="mt-3 text-body-md text-on-surface-variant line-clamp-2">{main.excerpt}</p>}
                          <p className="mt-3 flex items-center gap-1.5 text-label-sm uppercase tracking-wider text-on-surface-variant">
                            {main.author.name} <span className="mx-0.5 text-on-surface-variant/20">/</span> <Clock size={10} className="text-on-surface-variant/50" /> {timeAgo(main.publishedAt)}
                          </p>
                        </div>
                      </div>
                    )}
                    {side.length > 0 && (
                      <div className="lg:col-span-5 flex flex-col gap-5">
                        {side.map((a) => (
                          <article key={a.slug} className="group flex gap-4">
                            {a.featuredImage && (
                              <Link href={`/berita/${a.slug}`} className="shrink-0">
                                <div className="relative h-20 w-28 overflow-hidden rounded-sm">
                                  <Image src={a.featuredImage} alt={a.title} fill className="object-cover" />
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
                ) : (
                  /* Layout B (odd): Grid of cards */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                        <div className="mt-3">
                          <Link href={`/berita/${a.slug}`}>
                            <h3 className="font-serif text-title-lg leading-snug text-on-surface line-clamp-2 group-hover:text-primary transition-colors">{a.title}</h3>
                          </Link>
                          <p className="mt-2 flex items-center gap-1.5 text-label-sm uppercase tracking-wider text-on-surface-variant">
                            {a.author.name} <span className="mx-0.5 text-on-surface-variant/20">/</span> <Clock size={10} className="text-on-surface-variant/50" /> {timeAgo(a.publishedAt)}
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
        // Per-category accent palette — soft hues that read well on the navy
        // background. Same hue families used for the lucide icons elsewhere.
        const ACCENTS: Record<string, { from: string; to: string; ring: string; glow: string }> = {
          hukum:                  { from: "from-blue-500/30",    to: "to-blue-500/5",    ring: "ring-blue-300/20",    glow: "group-hover:shadow-blue-500/20" },
          "bisnis-ekonomi":       { from: "from-amber-500/30",   to: "to-amber-500/5",   ring: "ring-amber-300/20",   glow: "group-hover:shadow-amber-500/20" },
          olahraga:               { from: "from-emerald-500/30", to: "to-emerald-500/5", ring: "ring-emerald-300/20", glow: "group-hover:shadow-emerald-500/20" },
          hiburan:                { from: "from-pink-500/30",    to: "to-pink-500/5",    ring: "ring-pink-300/20",    glow: "group-hover:shadow-pink-500/20" },
          kesehatan:              { from: "from-rose-500/30",    to: "to-rose-500/5",    ring: "ring-rose-300/20",    glow: "group-hover:shadow-rose-500/20" },
          "pertanian-peternakan": { from: "from-lime-500/30",    to: "to-lime-500/5",    ring: "ring-lime-300/20",    glow: "group-hover:shadow-lime-500/20" },
          teknologi:              { from: "from-cyan-500/30",    to: "to-cyan-500/5",    ring: "ring-cyan-300/20",    glow: "group-hover:shadow-cyan-500/20" },
          politik:                { from: "from-red-500/30",     to: "to-red-500/5",     ring: "ring-red-300/20",     glow: "group-hover:shadow-red-500/20" },
          pendidikan:             { from: "from-indigo-500/30",  to: "to-indigo-500/5",  ring: "ring-indigo-300/20",  glow: "group-hover:shadow-indigo-500/20" },
          lingkungan:             { from: "from-green-500/30",   to: "to-green-500/5",   ring: "ring-green-300/20",   glow: "group-hover:shadow-green-500/20" },
          "gaya-hidup":           { from: "from-fuchsia-500/30", to: "to-fuchsia-500/5", ring: "ring-fuchsia-300/20", glow: "group-hover:shadow-fuchsia-500/20" },
          opini:                  { from: "from-orange-500/30",  to: "to-orange-500/5",  ring: "ring-orange-300/20",  glow: "group-hover:shadow-orange-500/20" },
        };
        const defaultAccent = { from: "from-slate-400/20", to: "to-slate-400/5", ring: "ring-white/10", glow: "" };

        // Most-active first; empty (0-article) categories drop to bottom and
        // render at half opacity so they don't compete with the active set.
        const sortedCategories = [...categories].sort(
          (a, b) => b._count.articles - a._count.articles,
        );
        const featured = sortedCategories.slice(0, 4);
        const rest = sortedCategories.slice(4);

        return (
          <section className="relative overflow-hidden bg-primary py-16">
            {/* Backdrop glow — adds depth, breaks up the flat navy field */}
            <div className="pointer-events-none absolute inset-0 opacity-30">
              <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-blue-400 blur-[120px]" />
              <div className="absolute -bottom-40 right-1/4 h-96 w-96 rounded-full bg-secondary blur-[120px]" />
            </div>

            <div className="container-main relative">
              {/* Header */}
              <div className="mb-10 flex flex-wrap items-end justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-white/15 to-white/5 text-white shadow-lg shadow-black/20 ring-1 ring-white/10">
                    <Compass size={24} strokeWidth={2} />
                  </div>
                  <div>
                    <span className="text-label-md font-bold uppercase tracking-widest text-white/50">Topik</span>
                    <h2 className="mt-0.5 font-serif text-headline-lg leading-tight text-white">Jelajahi Kategori</h2>
                  </div>
                </div>
                <p className="max-w-md text-body-md text-white/50">
                  Temukan berita berdasarkan topik yang Anda minati — dari hukum hingga gaya hidup.
                </p>
              </div>

              {/* Featured row — top 4 categories as larger accented cards */}
              {featured.length > 0 && (
                <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {featured.map((cat) => {
                    const Icon = categoryIconMap[cat.slug] || Scale;
                    const accent = ACCENTS[cat.slug] || defaultAccent;
                    const isEmpty = cat._count.articles === 0;
                    return (
                      <Link
                        key={cat.slug}
                        href={`/kategori/${cat.slug}`}
                        className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${accent.from} ${accent.to} p-5 ring-1 ${accent.ring} transition-all duration-500 hover:-translate-y-1 hover:shadow-xl ${accent.glow} ${isEmpty ? "opacity-50" : ""}`}
                      >
                        <div className="absolute inset-0 bg-white/[0.03] backdrop-blur-sm" />
                        <div className="relative flex h-full flex-col justify-between gap-6">
                          <div className="flex items-center justify-between">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-white shadow-md ring-1 ring-white/20 backdrop-blur-md transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                              <Icon size={20} strokeWidth={2.2} />
                            </div>
                            <ChevronRight size={18} className="text-white/30 transition-all duration-500 group-hover:translate-x-1 group-hover:text-white" />
                          </div>
                          <div>
                            <h3 className="font-serif text-title-lg leading-tight text-white">{cat.name}</h3>
                            <p className="mt-1.5 text-label-md font-semibold uppercase tracking-wider text-white/60">
                              {cat._count.articles} artikel
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Compact row — remaining categories */}
              {rest.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {rest.map((cat) => {
                    const Icon = categoryIconMap[cat.slug] || Scale;
                    const accent = ACCENTS[cat.slug] || defaultAccent;
                    const isEmpty = cat._count.articles === 0;
                    return (
                      <Link
                        key={cat.slug}
                        href={`/kategori/${cat.slug}`}
                        className={`group flex items-center gap-3 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/[0.07] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.08] hover:ring-white/[0.15] ${isEmpty ? "opacity-50" : ""}`}
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${accent.from} ${accent.to} text-white/85 ring-1 ${accent.ring} transition-all duration-300 group-hover:scale-105 group-hover:text-white`}>
                          <Icon size={16} strokeWidth={2.2} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-title-sm font-semibold text-white">{cat.name}</span>
                          <span className="block text-label-sm uppercase tracking-wider text-white/35">{cat._count.articles} artikel</span>
                        </div>
                        <ChevronRight size={14} className="shrink-0 text-white/15 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-white/50" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        );
      })()}
    </>
  );
}
