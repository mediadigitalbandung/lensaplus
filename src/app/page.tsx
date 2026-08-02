// Revalidate window. Articles published via /api/articles or the cron route
// also call revalidatePath("/") via seo-auto.onArticlePublished — so new posts
// appear instantly. This 30s window is the fallback when that path-revalidate
// fails (e.g. AI auto-publish at scale, or cache cold-start after deploy).
export const revalidate = 30;

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import PollingCarousel from "@/components/slider/PollingCarousel";
import BannerAd, { SidebarAd, InlineAd, NativeAd } from "@/components/ads/BannerAd";
import NewsTicker from "@/components/layout/NewsTicker";
import NewsletterBox from "@/components/common/NewsletterBox";
import {
  Scale, Briefcase, Trophy, Film, Heart, Wheat, Cpu, Vote as VoteIcon,
  GraduationCap, Leaf, Compass, BookOpen, LucideIcon, ArrowRight,
  Clock, Eye, Flame, Sparkles, ChevronRight, Shield, Layers, Calendar,
  MapPin, CheckCircle2, FileText
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCached } from "@/lib/cache";

export const metadata: Metadata = {
  title: {
    absolute: "Lensaplus — Berita Terkini Bandung: Ekonomi, Pemerintahan, Hukum & Olahraga",
  },
  description:
    "Lensaplus — media berita digital Bandung. Berita terkini ekonomi-bisnis, pemerintahan, hukum, olahraga, teknologi, dan hiburan dari Bandung & Jawa Barat.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: "Lensaplus — Berita Terkini Bandung & Jawa Barat",
    description:
      "Berita terkini ekonomi-bisnis, pemerintahan, hukum, olahraga, dan teknologi dari Bandung & Jawa Barat.",
  },
};

const categoryIconMap: Record<string, LucideIcon> = {
  "hukum": Scale, "bisnis-ekonomi": Briefcase, "olahraga": Trophy, "hiburan": Film,
  "kesehatan": Heart, "pertanian-peternakan": Wheat, "teknologi": Cpu, "politik": VoteIcon,
  "pendidikan": GraduationCap, "lingkungan": Leaf, "gaya-hidup": Compass, "opini": BookOpen,
};

const AI_DEMO_IMAGES = [
  "/uploads/demo/hero-bandung.png",
  "/uploads/demo/bisnis-ekonomi.png",
  "/uploads/demo/hukum-court.png",
  "/uploads/demo/olahraga-stadium.png",
];

function getAIImage(categorySlug?: string, index: number = 0): string {
  if (categorySlug?.includes("hukum")) return "/uploads/demo/hukum-court.png";
  if (categorySlug?.includes("bisnis") || categorySlug?.includes("ekonomi")) return "/uploads/demo/bisnis-ekonomi.png";
  if (categorySlug?.includes("olahraga")) return "/uploads/demo/olahraga-stadium.png";
  return AI_DEMO_IMAGES[index % AI_DEMO_IMAGES.length];
}

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

function getAngleBadge(angle: string) {
  switch (angle) {
    case "KRONOLOGI":
      return { label: "Kronologi Kejadian", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" };
    case "ANALISIS":
      return { label: "Analisis Mendalam", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" };
    case "DAMPAK":
    case "PROYEKSI":
      return { label: "Dampak & Implikasi", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" };
    default:
      return { label: "Sudut Pandang", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" };
  }
}

export default async function HomePage() {
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

  let articles: any[] = [];
  let categories: any[] = [];
  let trendingArticles: any[] = [];
  let sorotanList: any[] = [];

  try {
    [articles, categories, trendingArticles, sorotanList] = await Promise.all([
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
      getCached("home:sorotan:6", 60_000, () =>
        prisma.sorotan.findMany({
          take: 6,
          orderBy: { createdAt: "desc" },
          include: {
            article: {
              select: {
                id: true,
                title: true,
                slug: true,
                featuredImage: true,
                publishedAt: true,
                category: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        }),
      ),
    ]);
  } catch {
    articles = [];
    categories = [];
    trendingArticles = [];
    sorotanList = [];
  }

  // Fallback demo articles with AI generated images if DB is empty
  const demoArticles = [
    {
      id: "demo-1",
      title: "Transformasi Ekonomi Digital & Pembangunan Infrastruktur Bandung 2026",
      slug: "transformasi-ekonomi-digital-bandung",
      excerpt: "Pemerintah Kota Bandung bersama para pelaku usaha meluncurkan insiatif akselerasi ekonomi berbasis teknologi untuk mendorong pertumbuhan UMKM lokal.",
      featuredImage: "/uploads/demo/hero-bandung.png",
      publishedAt: new Date(),
      viewCount: 1420,
      verificationLabel: "VERIFIED",
      author: { id: "a1", name: "Redaksi Lensaplus", avatar: null },
      category: { id: "c1", name: "Bisnis & Ekonomi", slug: "bisnis-ekonomi" },
    },
    {
      id: "demo-2",
      title: "Analisis Kebijakan Investasi & Regulasi Perdagangan Jawa Barat",
      slug: "analisis-kebijakan-investasi-jabar",
      excerpt: "Tinjauan mendalam mengenai implikasi insentif pajak baru bagi pengusaha muda dan ekosistem industri kreatif di Bandung.",
      featuredImage: "/uploads/demo/bisnis-ekonomi.png",
      publishedAt: new Date(Date.now() - 3600000),
      viewCount: 890,
      verificationLabel: "VERIFIED",
      author: { id: "a2", name: "Tim Ekonomi", avatar: null },
      category: { id: "c1", name: "Bisnis & Ekonomi", slug: "bisnis-ekonomi" },
    },
    {
      id: "demo-3",
      title: "Sidang Pleno PN Bandung Putuskan Perkara Perdata Aset Daerah",
      slug: "sidang-pleno-pn-bandung-putuskan-perkara-aset",
      excerpt: "Majelis Hakim Pengadilan Negeri Bandung mengetuk palu atas sengketa lahan fasilitas umum, memberikan kepastian hukum bagi warga.",
      featuredImage: "/uploads/demo/hukum-court.png",
      publishedAt: new Date(Date.now() - 7200000),
      viewCount: 1105,
      verificationLabel: "VERIFIED",
      author: { id: "a3", name: "Desk Hukum", avatar: null },
      category: { id: "c2", name: "Hukum", slug: "hukum" },
    },
    {
      id: "demo-4",
      title: "Persib Bandung Bersiap Hadapi Laga Krusial Liga 1 Malam Ini",
      slug: "persib-bandung-bersiap-hadapi-laga-krusial",
      excerpt: "Stadion Gelora Bandung Lautan Api diprediksi penuh sesak oleh ribuan Bobotoh yang siap memberi dukungan penuh.",
      featuredImage: "/uploads/demo/olahraga-stadium.png",
      publishedAt: new Date(Date.now() - 10800000),
      viewCount: 2350,
      verificationLabel: "VERIFIED",
      author: { id: "a4", name: "Desk Olahraga", avatar: null },
      category: { id: "c3", name: "Olahraga", slug: "olahraga" },
    },
    {
      id: "demo-5",
      title: "Pengembangan Transportasi Publik Terintegrasi di Kawasan Bandung Raya",
      slug: "pengembangan-transportasi-publik-bandung",
      excerpt: "Proyek koridor bus listrik dan revitalisasi stasiun komuter Jawa Barat memasuki tahap finalisasi.",
      featuredImage: "/uploads/demo/hero-bandung.png",
      publishedAt: new Date(Date.now() - 14400000),
      viewCount: 950,
      verificationLabel: "VERIFIED",
      author: { id: "a1", name: "Redaksi Lensaplus", avatar: null },
      category: { id: "c4", name: "Pemerintahan", slug: "pemerintahan" },
    },
    {
      id: "demo-6",
      title: "Tren Industri Kreatif Bandung: Inovasi Startup & Produk Lokal",
      slug: "tren-industri-kreatif-bandung",
      excerpt: "Ekosistem kreator dan pengembang aplikasi Bandung menunjukkan pertumbuhan signifikan di pasar nasional.",
      featuredImage: "/uploads/demo/bisnis-ekonomi.png",
      publishedAt: new Date(Date.now() - 18000000),
      viewCount: 780,
      verificationLabel: "VERIFIED",
      author: { id: "a2", name: "Tim Tekno", avatar: null },
      category: { id: "c5", name: "Teknologi", slug: "teknologi" },
    },
    {
      id: "demo-7",
      title: "Evaluasi Pelaksanaan Perda Pengelolaan Sampah Kota Bandung",
      slug: "evaluasi-pelaksanaan-perda-sampah-bandung",
      excerpt: "Pemerintah Kota bersama dinas lingkungan hidup dorong partisipasi warga tingkatkan pemilahan sampah mandiri.",
      featuredImage: "/uploads/demo/hero-bandung.png",
      publishedAt: new Date(Date.now() - 21600000),
      viewCount: 640,
      verificationLabel: "VERIFIED",
      author: { id: "a3", name: "Desk Lingkungan", avatar: null },
      category: { id: "c6", name: "Lingkungan", slug: "lingkungan" },
    },
  ];

  // Dedup by source article or use demo articles if DB empty
  const seenSource = new Set<string>();
  const activeArticles = articles.length > 0 ? articles : demoArticles;
  const dedupedArticles = activeArticles.filter((a) => {
    const key = a.sourceArticleId || a.id;
    if (seenSource.has(key)) return false;
    seenSource.add(key);
    return true;
  });

  const activeTrending = trendingArticles.length > 0 ? trendingArticles : demoArticles;

  const heroSpotlight = dedupedArticles[0];
  const heroMiddle = dedupedArticles.slice(1, 4);
  const heroRight = dedupedArticles.slice(4, 7);
  const editorsPickArticles = dedupedArticles.slice(0, 4);

  // Berita Terkini — articles after Hero
  const terkiniArticles = dedupedArticles.slice(1);

  // Category sections
  const articlesByCategory: Record<string, { slug: string; articles: typeof articles }> = {};
  for (const a of dedupedArticles) {
    const name = a.category.name;
    if (!articlesByCategory[name]) articlesByCategory[name] = { slug: a.category.slug, articles: [] };
    if (articlesByCategory[name].articles.length < 5) articlesByCategory[name].articles.push(a);
  }
  const catEntries = Object.entries(articlesByCategory);

  const socialUrls = (process.env.LENSAPLUS_SOCIAL_URLS || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));
  const fallbackSocialUrls = [
    process.env.LENSAPLUS_TWITTER_URL,
    process.env.LENSAPLUS_FACEBOOK_URL,
    process.env.LENSAPLUS_INSTAGRAM_URL,
    process.env.LENSAPLUS_LINKEDIN_URL,
    process.env.LENSAPLUS_YOUTUBE_URL,
    process.env.LENSAPLUS_TIKTOK_URL,
  ].filter((s): s is string => !!s && /^https?:\/\//i.test(s));
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
              "@id": "https://lensaplus.com/#organization",
              name: "Lensaplus",
              alternateName: "Lensaplus Bandung",
              url: "https://lensaplus.com",
              logo: { "@type": "ImageObject", url: "https://lensaplus.com/lensaplus-icon.png", width: 512, height: 512 },
              image: { "@type": "ImageObject", url: "https://lensaplus.com/lensaplus-icon.png" },
              description:
                "Portal berita digital Bandung — bisnis, ekonomi, pemerintahan, hukum, olahraga, hiburan, teknologi, dan peristiwa lokal Indonesia.",
              foundingDate: "2024",
              sameAs,
              publishingPrinciples: "https://lensaplus.com/pedoman-media",
              ethicsPolicy: "https://lensaplus.com/kode-etik",
              missionCoveragePrioritiesPolicy: "https://lensaplus.com/pedoman-media",
              correctionsPolicy: "https://lensaplus.com/kode-etik",
              diversityPolicy: "https://lensaplus.com/kode-etik",
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
                { "@type": "ContactPoint", contactType: "customer service", url: "https://lensaplus.com/kontak", areaServed: "ID", availableLanguage: ["Indonesian"] },
                { "@type": "ContactPoint", contactType: "editorial", url: "https://lensaplus.com/redaksi", areaServed: "ID", availableLanguage: ["Indonesian"] },
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
              "@id": "https://lensaplus.com/#website",
              name: "Lensaplus",
              alternateName: "Lensaplus — Media Berita Digital Bandung",
              url: "https://lensaplus.com",
              inLanguage: "id-ID",
              publisher: { "@id": "https://lensaplus.com/#organization" },
              potentialAction: {
                "@type": "SearchAction",
                target: { "@type": "EntryPoint", urlTemplate: "https://lensaplus.com/search?q={search_term_string}" },
                "query-input": "required name=search_term_string",
              },
            },
          ]),
        }}
      />

      <h1 className="sr-only">Lensaplus — Media Berita Digital Bandung</h1>
      
      {/* ── TOP LEADERBOARD AD ── */}
      <BannerAd size="leaderboard" slot="HEADER" className="bg-surface" />

      {/* ── LIVE NEWS & MARKETS TICKER ── */}
      <div className="border-y border-stone-200/60 bg-stone-900">
        <NewsTicker />
      </div>

      {/* ── HERO EDITORIAL GRID ── */}
      <section className="bg-surface py-6 sm:py-10">
        <div className="container-main">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
            {/* Column 1: Main Spotlight (6/12) */}
            {heroSpotlight && (
              <div className="lg:col-span-6 flex flex-col">
                <article className="group flex-1 flex flex-col">
                  <Link href={`/berita/${heroSpotlight.slug}`} className="block overflow-hidden rounded-2xl relative aspect-[16/10] bg-stone-150 shadow-sm group-hover:shadow-md transition-all duration-300">
                    <Image
                      src={heroSpotlight.featuredImage || getAIImage(heroSpotlight.category?.slug, 0)}
                      alt={heroSpotlight.title}
                      fill
                      priority
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                    <div className="absolute top-4 left-4 flex gap-2">
                      <span className="rounded-full bg-primary/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-md shadow-sm">
                        {heroSpotlight.category.name}
                      </span>
                      {heroSpotlight.verificationLabel === "VERIFIED" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md shadow-sm">
                          <CheckCircle2 size={12} /> Verified
                        </span>
                      )}
                    </div>
                  </Link>
                  <div className="mt-4 flex-1 flex flex-col justify-between">
                    <div>
                      <Link href={`/berita/${heroSpotlight.slug}`}>
                        <h2 className="mt-1 font-serif text-headline-sm sm:text-headline-md lg:text-headline-lg leading-tight text-on-surface group-hover:text-primary transition-colors">
                          {heroSpotlight.title}
                        </h2>
                      </Link>
                      {heroSpotlight.excerpt && (
                        <p className="mt-2.5 text-body-md text-stone-600 line-clamp-3 leading-relaxed">
                          {heroSpotlight.excerpt}
                        </p>
                      )}
                    </div>
                    <p className="mt-4 flex items-center gap-2 text-label-sm uppercase tracking-wider text-stone-500 border-t border-stone-200/50 pt-3">
                      <span className="font-bold text-stone-700">{heroSpotlight.author.name}</span>
                      <span className="text-stone-300">/</span>
                      <Clock size={12} className="text-stone-400" />
                      <span>{timeAgo(heroSpotlight.publishedAt)}</span>
                    </p>
                  </div>
                </article>
              </div>
            )}

            {/* Column 2: Top Stories / Pilihan Redaksi (3/12) */}
            <div className="lg:col-span-3 flex flex-col gap-6 border-t lg:border-t-0 lg:border-x border-stone-200/60 pt-6 lg:pt-0 lg:px-6">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Sparkles size={14} className="text-secondary" /> Pilihan Redaksi
                </span>
              </div>
              <div className="flex flex-col gap-6 justify-between flex-1">
                {heroMiddle.map((a, i) => (
                  <article key={a.slug} className={`group flex flex-col justify-between flex-1 ${i > 0 ? "pt-5 border-t border-stone-100" : ""}`}>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                        {a.category.name}
                      </span>
                      <Link href={`/berita/${a.slug}`}>
                        <h3 className="mt-1.5 text-title-md font-serif leading-snug text-on-surface group-hover:text-primary transition-colors line-clamp-3">
                          {a.title}
                        </h3>
                      </Link>
                    </div>
                    <p className="mt-3 text-[10px] text-stone-500 uppercase tracking-wider flex items-center gap-1">
                      <Clock size={10} className="text-stone-400" />
                      {timeAgo(a.publishedAt)}
                    </p>
                  </article>
                ))}
              </div>
            </div>

            {/* Column 3: Fresh News / Terhangat (3/12) */}
            <div className="lg:col-span-3 flex flex-col gap-6 border-t lg:border-t-0 border-stone-200/60 pt-6 lg:pt-0">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                  <Flame size={14} className="text-secondary" /> Terhangat
                </span>
              </div>
              <div className="flex flex-col gap-6 justify-between flex-1">
                {heroRight.map((a, i) => (
                  <article key={a.slug} className={`group flex flex-col justify-between flex-1 ${i > 0 ? "pt-5 border-t border-stone-100" : ""}`}>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-tertiary">
                        {a.category.name}
                      </span>
                      <Link href={`/berita/${a.slug}`}>
                        <h3 className="mt-1.5 text-title-md font-serif leading-snug text-on-surface group-hover:text-primary transition-colors line-clamp-3">
                          {a.title}
                        </h3>
                      </Link>
                    </div>
                    <p className="mt-3 text-[10px] text-stone-500 uppercase tracking-wider flex items-center gap-1">
                      <Clock size={10} className="text-stone-400" />
                      {timeAgo(a.publishedAt)}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRENDING STRIP (Big Numbers) ── */}
      <section className="bg-white border-y border-stone-200/60 py-6 sm:py-8 overflow-x-auto scrollbar-hide">
        <div className="container-main">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-2 w-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-stone-500">Trending Topik Hari Ini</span>
          </div>
          <div className="flex gap-8 md:gap-12 min-w-max">
            {activeTrending.slice(0, 5).map((a, i) => (
              <div key={a.slug} className="flex gap-4 w-72 shrink-0 group">
                <span className="shrink-0 font-serif text-3xl sm:text-4xl font-extrabold text-primary/20 group-hover:text-secondary transition-colors select-none mt-0.5">
                  0{i + 1}
                </span>
                <div className="flex flex-col justify-center min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                    {a.category.name}
                  </span>
                  <Link href={`/berita/${a.slug}`}>
                    <h3 className="mt-1 text-title-sm font-bold leading-snug text-on-surface line-clamp-2 group-hover:text-primary transition-colors">
                      {a.title}
                    </h3>
                  </Link>
                  <p className="mt-1.5 text-[10px] text-stone-400 uppercase tracking-wider flex items-center gap-2">
                    <span>{timeAgo(a.publishedAt)}</span>
                    {a.viewCount > 0 && (
                      <span className="flex items-center gap-1 text-stone-500">
                        <Eye size={10} /> {a.viewCount.toLocaleString("id-ID")}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOROTAN & ANALISIS SUDUT PANDANG (NEW EDITORIAL FEATURE) ── */}
      <section className="bg-[#001530] text-white py-10 sm:py-14">
        <div className="container-main">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-white/10 pb-5">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400 mb-1">
                <Layers size={16} />
                <span>Desk Sorotan & Bedah Isu</span>
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">
                Analisis Sudut Pandang & Perspektif Mendalam
              </h2>
            </div>
            <Link
              href="/sorotan"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/20 transition-all shrink-0 backdrop-blur-md"
            >
              Jelajahi Semua Sorotan <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sorotanList.length > 0 ? (
              sorotanList.slice(0, 3).map((item) => {
                const badge = getAngleBadge(item.angle);
                return (
                  <article
                    key={item.id}
                    className="group flex flex-col justify-between rounded-2xl bg-white/5 p-6 border border-white/10 hover:border-amber-400/40 hover:bg-white/10 transition-all duration-300 shadow-lg"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className={`inline-block rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border ${badge.color}`}>
                          {badge.label}
                        </span>
                        <span className="text-[10px] text-stone-400">
                          {timeAgo(item.createdAt)}
                        </span>
                      </div>
                      <Link href={`/sorotan/${item.slug}`}>
                        <h3 className="font-serif text-lg font-bold leading-snug text-white group-hover:text-amber-300 transition-colors line-clamp-2">
                          {item.title}
                        </h3>
                      </Link>
                      <p className="mt-2.5 text-xs text-stone-300 line-clamp-3 leading-relaxed">
                        {item.content}
                      </p>
                    </div>

                    <div className="mt-5 border-t border-white/10 pt-3 flex items-center justify-between">
                      <span className="text-[11px] text-stone-400 truncate max-w-[200px]">
                        Berita Terkait: {item.article.title}
                      </span>
                      <Link
                        href={`/sorotan/${item.slug}`}
                        className="text-xs font-bold text-amber-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1"
                      >
                        Baca <ChevronRight size={14} />
                      </Link>
                    </div>
                  </article>
                );
              })
            ) : (
              // Fallback cards with AI visual demo
              [
                { title: "Kronologi & Evaluasi Kebijakan APBD Kota Bandung", angle: "KRONOLOGI", desc: "Rekap urutan keputusan anggaran dan alokasi prioritas pembangunan insfrastruktur publik Bandung." },
                { title: "Analisis Dampak Regulasi Ekonomi & Bisnis Lokal", angle: "ANALISIS", desc: "Kajian komprehensif pengaruh kebijakan tarif dan pajak terhadap iklim usaha UMKM di Bandung." },
                { title: "Proyeksi Pertumbuhan Sektor Wisata & Transportasi", angle: "DAMPAK", desc: "Tinjauan estimasi kunjungan wisatawan dan kesiapan infrastruktur transportasi darat Jawa Barat." },
              ].map((item, idx) => {
                const badge = getAngleBadge(item.angle);
                return (
                  <article
                    key={idx}
                    className="group flex flex-col justify-between rounded-2xl bg-white/5 p-6 border border-white/10 hover:border-amber-400/40 hover:bg-white/10 transition-all duration-300 shadow-lg"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className={`inline-block rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <Link href="/sorotan">
                        <h3 className="font-serif text-lg font-bold leading-snug text-white group-hover:text-amber-300 transition-colors line-clamp-2">
                          {item.title}
                        </h3>
                      </Link>
                      <p className="mt-2.5 text-xs text-stone-300 line-clamp-3 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                    <div className="mt-5 border-t border-white/10 pt-3 flex items-center justify-end">
                      <Link href="/sorotan" className="text-xs font-bold text-amber-400 inline-flex items-center gap-1">
                        Jelajahi <ChevronRight size={14} />
                      </Link>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ── TERKINI + SIDEBAR POLLING & WIDGETS ── */}
      <section className="bg-surface-secondary py-8 sm:py-12 md:py-16">
        <div className="container-main">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-10">
            {/* Left: Berita Terkini (7 cols) */}
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

              {/* Lead article */}
              {terkiniArticles[0] && (
                <article className="group mb-8">
                  <Link href={`/berita/${terkiniArticles[0].slug}`} className="block">
                    <div className="relative aspect-[2/1] overflow-hidden rounded-2xl bg-stone-150 shadow-sm">
                      <Image
                        src={terkiniArticles[0].featuredImage || getAIImage(terkiniArticles[0].category?.slug, 1)}
                        alt={terkiniArticles[0].title}
                        fill
                        priority
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                    </div>
                  </Link>
                  <div className="mt-4">
                    <span className="inline-block rounded-full bg-primary/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                      {terkiniArticles[0].category.name}
                    </span>
                    <Link href={`/berita/${terkiniArticles[0].slug}`}>
                      <h3 className="mt-2.5 font-serif text-title-lg sm:text-headline-sm lg:text-headline-md leading-tight text-on-surface group-hover:text-primary transition-colors">
                        {terkiniArticles[0].title}
                      </h3>
                    </Link>
                    {terkiniArticles[0].excerpt && (
                      <p className="mt-2 text-body-md text-stone-600 line-clamp-2 leading-relaxed">
                        {terkiniArticles[0].excerpt}
                      </p>
                    )}
                  </div>
                </article>
              )}

              {/* Rest as compact list grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 sm:gap-y-6">
                {terkiniArticles.slice(1).map((a, idx) => (
                  <article key={a.slug} className="group flex gap-3.5 sm:gap-4">
                    <Link href={`/berita/${a.slug}`} className="shrink-0">
                      <div className="relative h-16 w-24 sm:h-20 sm:w-28 overflow-hidden rounded-xl bg-stone-150 shadow-sm">
                        <Image
                          src={a.featuredImage || getAIImage(a.category?.slug, idx + 2)}
                          alt={a.title}
                          fill
                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <Link href={`/berita/${a.slug}`}>
                        <h4 className="text-title-sm font-serif leading-snug text-on-surface line-clamp-2 group-hover:text-primary transition-colors">
                          {a.title}
                        </h4>
                      </Link>
                      <p className="mt-1.5 text-[10px] text-stone-500 uppercase tracking-wider">
                        {timeAgo(a.publishedAt)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>

              {/* "Lihat Lainnya" CTA */}
              <div className="mt-10 border-t border-stone-200/60 pt-6 flex justify-center">
                <Link
                  href="/berita"
                  className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-label-md font-bold uppercase tracking-wider text-white transition-all hover:bg-primary-dark hover:gap-3 shadow-md shadow-primary/20"
                >
                  Lihat Berita Lainnya
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

            {/* Right Sidebar — 5 cols: Polling + Legal Agenda + Ads */}
            <aside className="md:col-span-5 flex flex-col gap-8">
              {/* Interactive Polling Card */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200/60 shadow-sm">
                <div className="flex items-center gap-2.5 mb-5 border-b border-stone-100 pb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/10 text-secondary shrink-0">
                    <Shield size={18} strokeWidth={2.5} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-secondary block">Suara Pembaca</span>
                    <h3 className="font-serif text-title-md text-on-surface font-semibold -mt-0.5">Polling</h3>
                  </div>
                </div>
                <PollingCarousel />
              </div>

              {/* Legal Agenda & Public Services Widget */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200/60 shadow-sm">
                <div className="flex items-center justify-between mb-4 border-b border-stone-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                      <Scale size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary block">Layanan & Informasi</span>
                      <h3 className="font-serif text-title-md text-on-surface font-semibold -mt-0.5">Agenda & Layanan Hukum</h3>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Link
                    href="/jadwal-sidang"
                    className="group flex items-center justify-between rounded-xl bg-stone-50 p-3.5 border border-stone-100 hover:border-primary/30 hover:bg-primary/5 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar size={18} className="text-primary" />
                      <div>
                        <h4 className="text-xs font-bold text-stone-800 group-hover:text-primary transition-colors">Jadwal Sidang Pengadilan</h4>
                        <p className="text-[10px] text-stone-500">Agenda sidang PN, PTUN, & PA Bandung</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-stone-400 group-hover:translate-x-1 transition-transform" />
                  </Link>

                  <Link
                    href="/lokasi"
                    className="group flex items-center justify-between rounded-xl bg-stone-50 p-3.5 border border-stone-100 hover:border-primary/30 hover:bg-primary/5 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin size={18} className="text-primary" />
                      <div>
                        <h4 className="text-xs font-bold text-stone-800 group-hover:text-primary transition-colors">Direktori Pengadilan Bandung</h4>
                        <p className="text-[10px] text-stone-500">Lokasi & info 8 lembaga peradilan</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-stone-400 group-hover:translate-x-1 transition-transform" />
                  </Link>

                  <Link
                    href="/regulasi"
                    className="group flex items-center justify-between rounded-xl bg-stone-50 p-3.5 border border-stone-100 hover:border-primary/30 hover:bg-primary/5 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-primary" />
                      <div>
                        <h4 className="text-xs font-bold text-stone-800 group-hover:text-primary transition-colors">Database Regulasi & Perda</h4>
                        <p className="text-[10px] text-stone-500">Peraturan daerah & UU terbaru</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-stone-400 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>

              {/* Sidebar Ads */}
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

      {/* ── EDITOR'S PICK — 4 CARDS HORIZONTAL ── */}
      {editorsPickArticles.length > 0 && (
        <section className="bg-surface py-8 sm:py-12 border-t border-stone-200/60">
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {editorsPickArticles.map((a, idx) => (
                <article key={a.slug} className="group flex flex-col justify-between">
                  <div>
                    <Link href={`/berita/${a.slug}`} className="block">
                      <div className="relative aspect-[3/2] overflow-hidden rounded-xl bg-stone-150 shadow-sm">
                        <Image
                          src={a.featuredImage || getAIImage(a.category?.slug, idx)}
                          alt={a.title}
                          fill
                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                      </div>
                    </Link>
                    <div className="mt-3">
                      <span className="text-[10px] sm:text-label-sm font-bold uppercase tracking-widest text-primary">{a.category.name}</span>
                      <Link href={`/berita/${a.slug}`}>
                        <h3 className="mt-1 font-serif text-title-sm sm:text-title-lg leading-snug text-on-surface line-clamp-3 sm:line-clamp-2 group-hover:text-primary transition-colors">
                          {a.title}
                        </h3>
                      </Link>
                    </div>
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-[10px] sm:text-label-sm uppercase tracking-wider text-stone-500 border-t border-stone-100 pt-2 truncate">
                    <span className="truncate">{a.author.name}</span>
                    <span className="text-stone-300">/</span>
                    <Clock size={10} className="text-stone-400 shrink-0" />
                    <span>{timeAgo(a.publishedAt)}</span>
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── RANGKUMAN BERITA PINTAR ── */}
      <section className="bg-gradient-to-b from-stone-100 to-stone-50 py-10 sm:py-14 border-t border-stone-200/60">
        <div className="container-main">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
                <BookOpen size={16} className="text-secondary" /> Rangkuman Pintar
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-on-surface mt-1">
                Kilas Berita & Rekap Penting
              </h2>
            </div>
            <Link
              href="/rangkuman"
              className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/20 transition-all shrink-0"
            >
              Lihat Semua Rangkuman <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link
              href="/rangkuman/harian"
              className="group rounded-2xl bg-white p-6 border border-stone-200/70 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                <Calendar size={20} />
              </div>
              <h3 className="font-serif text-lg font-bold text-stone-900 group-hover:text-primary transition-colors">
                Rangkuman Harian
              </h3>
              <p className="mt-2 text-xs text-stone-600 leading-relaxed">
                Ringkasan peristiwa dan berita paling krusial hari ini di Bandung dan Jawa Barat.
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary">
                <span>Buka Arsip Harian</span>
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            <Link
              href="/rangkuman/pekan-ini"
              className="group rounded-2xl bg-white p-6 border border-stone-200/70 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10 text-secondary mb-4">
                <Flame size={20} />
              </div>
              <h3 className="font-serif text-lg font-bold text-stone-900 group-hover:text-primary transition-colors">
                Kilas Pekan Ini
              </h3>
              <p className="mt-2 text-xs text-stone-600 leading-relaxed">
                Evaluasi mingguan kebijakan publik, dinamika pasar, dan isu hangat sepekan terakhir.
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-secondary">
                <span>Baca Kilas Mingguan</span>
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            <Link
              href="/rangkuman/bulan-ini"
              className="group rounded-2xl bg-white p-6 border border-stone-200/70 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 mb-4">
                <Layers size={20} />
              </div>
              <h3 className="font-serif text-lg font-bold text-stone-900 group-hover:text-primary transition-colors">
                Kaleidoskop Bulanan
              </h3>
              <p className="mt-2 text-xs text-stone-600 leading-relaxed">
                Rangkuman komprehensif perkembangan ekonomi, proyek daerah, dan regulasi bulan ini.
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-emerald-600">
                <span>Lihat Kaleidoskop</span>
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* AD: Between sections */}
      <BannerAd size="banner" slot="BETWEEN_SECTIONS" className="bg-surface" />
      <InlineAd className="bg-surface-container-low" />

      {/* ── CATEGORY SECTIONS ── */}
      {catEntries.map(([catName, { slug: catSlug, articles: catArticles }], idx) => {
        const main = catArticles[0];
        const side = catArticles.slice(1);
        const isEven = idx % 2 === 0;

        return (
          <div key={catSlug}>
            <section className={`py-8 sm:py-12 ${isEven ? "bg-surface" : "bg-stone-50"}`}>
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

                {isEven ? (
                  <>
                    {/* Mobile: 2 cards berdampingan */}
                    <div className="md:hidden">
                      {(() => {
                        const top2 = catArticles.slice(0, 2);
                        const rest = catArticles.slice(2);
                        return (
                          <>
                            {top2.length > 0 && (
                              <div className="grid grid-cols-2 gap-3 mb-5">
                                {top2.map((a, subIdx) => (
                                  <article key={a.slug} className="group">
                                    <Link href={`/berita/${a.slug}`} className="block">
                                      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-150">
                                        <Image
                                          src={a.featuredImage || getAIImage(a.category?.slug, subIdx)}
                                          alt={a.title}
                                          fill
                                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                                          sizes="(max-width: 768px) 50vw, 25vw"
                                        />
                                      </div>
                                    </Link>
                                    <div className="mt-2.5">
                                      <Link href={`/berita/${a.slug}`}>
                                        <h3 className="font-serif text-title-sm leading-snug text-on-surface line-clamp-3 group-hover:text-primary transition-colors">
                                          {a.title}
                                        </h3>
                                      </Link>
                                      <p className="mt-1.5 text-[10px] uppercase tracking-wider text-stone-500">
                                        {timeAgo(a.publishedAt)}
                                      </p>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            )}
                            {rest.length > 0 && (
                              <div className="flex flex-col gap-3 border-t border-stone-200/60 pt-4">
                                {rest.map((a, subIdx) => (
                                  <article key={a.slug} className="group flex gap-3">
                                    <Link href={`/berita/${a.slug}`} className="shrink-0">
                                      <div className="relative h-16 w-24 overflow-hidden rounded-lg bg-stone-150">
                                        <Image
                                          src={a.featuredImage || getAIImage(a.category?.slug, subIdx + 2)}
                                          alt={a.title}
                                          fill
                                          className="object-cover"
                                          sizes="96px"
                                        />
                                      </div>
                                    </Link>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                      <Link href={`/berita/${a.slug}`}>
                                        <h4 className="text-title-sm leading-snug text-on-surface line-clamp-2 group-hover:text-primary transition-colors">{a.title}</h4>
                                      </Link>
                                      <p className="mt-1 text-[10px] uppercase tracking-wider text-stone-500">{timeAgo(a.publishedAt)}</p>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    {/* Desktop layout */}
                    <div className="hidden md:grid md:grid-cols-12 gap-6 sm:gap-8">
                      {main && (
                        <div className="md:col-span-7">
                          <Link href={`/berita/${main.slug}`} className="group block">
                            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-stone-150 shadow-sm">
                              <Image
                                src={main.featuredImage || getAIImage(main.category?.slug, 0)}
                                alt={main.title}
                                fill
                                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                                sizes="(max-width: 1024px) 60vw, 50vw"
                              />
                            </div>
                          </Link>
                          <div className="mt-4 sm:mt-5">
                            <Link href={`/berita/${main.slug}`}>
                              <h3 className="font-serif text-title-lg sm:text-headline-sm lg:text-headline-md leading-tight text-on-surface group-hover:text-primary transition-colors">
                                {main.title}
                              </h3>
                            </Link>
                            {main.excerpt && <p className="mt-2 sm:mt-3 text-body-sm sm:text-body-md text-stone-600 line-clamp-2 leading-relaxed">{main.excerpt}</p>}
                            <p className="mt-2 sm:mt-3 flex items-center gap-1.5 text-label-sm uppercase tracking-wider text-stone-500">
                              {main.author.name} <span className="mx-0.5 text-stone-300">/</span> <Clock size={10} className="text-stone-400" /> {timeAgo(main.publishedAt)}
                            </p>
                          </div>
                        </div>
                      )}
                      {side.length > 0 && (
                        <div className="md:col-span-5 flex flex-col gap-4 sm:gap-5">
                          {side.map((a, subIdx) => (
                            <article key={a.slug} className="group flex gap-3 sm:gap-4">
                              <Link href={`/berita/${a.slug}`} className="shrink-0">
                                <div className="relative h-16 w-24 sm:h-20 sm:w-28 overflow-hidden rounded-xl bg-stone-150 shadow-sm">
                                  <Image
                                    src={a.featuredImage || getAIImage(a.category?.slug, subIdx + 1)}
                                    alt={a.title}
                                    fill
                                    className="object-cover"
                                    sizes="112px"
                                  />
                                </div>
                              </Link>
                              <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <Link href={`/berita/${a.slug}`}>
                                  <h4 className="text-title-sm leading-snug text-on-surface line-clamp-2 group-hover:text-primary transition-colors">{a.title}</h4>
                                </Link>
                                <p className="mt-1 text-label-sm uppercase tracking-wider text-stone-500">{timeAgo(a.publishedAt)}</p>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
                    {catArticles.slice(0, 3).map((a, subIdx) => (
                      <article key={a.slug} className="group">
                        <Link href={`/berita/${a.slug}`} className="block">
                          <div className="relative aspect-[3/2] overflow-hidden rounded-xl bg-stone-150 shadow-sm">
                            <Image
                              src={a.featuredImage || getAIImage(a.category?.slug, subIdx)}
                              alt={a.title}
                              fill
                              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                            />
                          </div>
                        </Link>
                        <div className="mt-2.5 sm:mt-3">
                          <Link href={`/berita/${a.slug}`}>
                            <h3 className="font-serif text-title-sm sm:text-title-lg leading-snug text-on-surface line-clamp-3 sm:line-clamp-2 group-hover:text-primary transition-colors">{a.title}</h3>
                          </Link>
                          <p className="mt-1.5 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-label-sm uppercase tracking-wider text-stone-500 truncate">
                            <span className="truncate">{a.author.name}</span> <span className="mx-0.5 text-stone-300 shrink-0">/</span> <Clock size={10} className="text-stone-400 shrink-0" /> {timeAgo(a.publishedAt)}
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

      {/* ── NEWSLETTER SUBSCRIPTION BOX ── */}
      <section className="bg-surface py-10 sm:py-14 border-t border-stone-200/60">
        <div className="container-main">
          <NewsletterBox />
        </div>
      </section>

      {/* AD: Footer */}
      <BannerAd size="leaderboard" slot="FOOTER" className="bg-surface" />

      {/* ── CATEGORY GRID FOOTER ── */}
      {(() => {
        const sortedCategories = [...categories].sort(
          (a, b) => b._count.articles - a._count.articles,
        );

        return (
          <section className="bg-primary py-10 sm:py-14">
            <div className="container-main">
              <div className="mb-6 sm:mb-8 flex items-end justify-between gap-4 border-b border-white/15 pb-4 sm:pb-5">
                <div className="min-w-0">
                  <span className="text-label-sm sm:text-label-md font-bold uppercase tracking-widest text-white/60">Topik</span>
                  <h2 className="mt-1 font-serif text-headline-sm sm:text-headline-md lg:text-headline-lg leading-tight text-white">Jelajahi Kategori Berita</h2>
                </div>
                <p className="hidden max-w-sm text-body-sm text-white/55 sm:block shrink-0">
                  Temukan berita berdasarkan topik pilihan Anda.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 rounded-2xl overflow-hidden shadow-2xl">
                {sortedCategories.map((cat) => {
                  const Icon = categoryIconMap[cat.slug] || Scale;
                  const isEmpty = cat._count.articles === 0;
                  return (
                    <Link
                      key={cat.slug}
                      href={`/kategori/${cat.slug}`}
                      className={`group flex flex-col justify-between gap-4 sm:gap-6 bg-primary p-4 sm:p-5 transition-all duration-300 hover:bg-secondary ${isEmpty ? "opacity-40" : ""}`}
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
