// Revalidate window. Articles published via /api/articles or the cron route
// also call revalidatePath("/") via seo-auto.onArticlePublished — so new posts
// appear instantly. This 30s window is the fallback when that path-revalidate
// fails (e.g. AI auto-publish at scale, or cache cold-start after deploy).
export const revalidate = 30;

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import HeadlineSlider from "@/components/slider/HeadlineSlider";
import SubHeadlineSlider from "@/components/slider/SubHeadlineSlider";
import PollingCarousel from "@/components/slider/PollingCarousel";
import BannerAd, { SidebarAd, InlineAd, NativeAd } from "@/components/ads/BannerAd";
import NewsletterBox from "@/components/common/NewsletterBox";
import { ArrowRight, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCached } from "@/lib/cache";

interface HomeArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImage: string | null;
  publishedAt: Date | string | null;
  viewCount: number;
  sourceArticleId?: string | null;
  verificationLabel: string | null;
  status?: string;
  author: { id: string; name: string; avatar: string | null } | null;
  category: { id: string; name: string; slug: string } | null;
}

interface HomeSorotan {
  id: string;
  slug: string;
  title: string;
  content: string;
  angle: string;
  createdAt: Date | string;
  article: {
    id: string;
    title: string;
    slug: string;
    featuredImage: string | null;
    publishedAt: Date | string | null;
    category: { id: string; name: string; slug: string } | null;
  } | null;
}

export const metadata: Metadata = {
  title: {
    absolute: "Lensaplus — Media Berita Digital Nasional Indonesia",
  },
  description:
    "Lensaplus — portal media berita digital nasional Indonesia. Berita terkini politik nasional, hukum & peradilan, bisnis-ekonomi, pemerintahan, olahraga, teknologi, dan peristiwa Nusantara.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: "Lensaplus — Media Berita Digital Nasional Indonesia",
    description:
      "Berita terkini politik nasional, hukum & peradilan, bisnis-ekonomi, pemerintahan, olahraga, teknologi, dan peristiwa Nusantara.",
  },
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

function resolveArticleImage(featuredImage: string | null | undefined, categorySlug?: string, index: number = 0): string {
  const trimmed = featuredImage?.trim();
  return trimmed ? trimmed : getAIImage(categorySlug, index);
}

function timeAgo(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins}m lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}j lalu`;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  });
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getAngleBadge(angle: string) {
  switch (angle) {
    case "KRONOLOGI":
      return { label: "Kronologi Kejadian", color: "text-amber-700" };
    case "ANALISIS":
      return { label: "Analisis Mendalam", color: "text-secondary-dark" };
    case "DAMPAK":
      return { label: "Dampak & Implikasi", color: "text-tertiary-dark" };
    case "PROYEKSI":
      return { label: "Proyeksi", color: "text-primary" };
    case "HUKUM":
      return { label: "Sudut Hukum", color: "text-primary" };
    case "EKONOMI":
      return { label: "Sudut Ekonomi", color: "text-secondary-dark" };
    case "LATAR_BELAKANG":
      return { label: "Latar Belakang", color: "text-stone-700" };
    case "PROFIL":
      return { label: "Profil Tokoh", color: "text-secondary-dark" };
    case "REAKSI":
      return { label: "Reaksi Publik", color: "text-tertiary-dark" };
    case "FAQ":
      return { label: "Tanya Jawab", color: "text-primary" };
    default:
      return { label: "Sudut Pandang", color: "text-stone-600" };
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

  let articles: HomeArticle[] = [];
  let trendingArticles: HomeArticle[] = [];
  let sorotanList: HomeSorotan[] = [];

  try {
    [articles, trendingArticles, sorotanList] = await Promise.all([
      getCached("home:articles:30", 30_000, () =>
        prisma.article.findMany({
          where: { status: "PUBLISHED" },
          select: articleSelect,
          orderBy: { publishedAt: "desc" },
          take: 60,
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
          where: { article: { status: "PUBLISHED" } },
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
    trendingArticles = [];
    sorotanList = [];
  }

  // Fallback demo articles with AI generated images if DB is empty
  const demoArticles: HomeArticle[] = [
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

  // 1) Hero Lead Carousel (1 besar di atas): berita terhangat hari ini + terbaru (maks 5 slide)
  const heroLeadCandidates: HomeArticle[] = [];
  const heroLeadSeen = new Set<string>();
  const heroLeadPool = [
    ...(dedupedArticles[0] ? [dedupedArticles[0]] : []),
    ...activeTrending,
    ...dedupedArticles,
  ];
  for (const candidate of heroLeadPool) {
    if (heroLeadSeen.has(candidate.slug)) continue;
    heroLeadSeen.add(candidate.slug);
    heroLeadCandidates.push(candidate);
    if (heroLeadCandidates.length >= 5) break;
  }

  // Kolom Pilihan Redaksi & Terhangat di samping Hero Carousel
  const afterHeroLead = dedupedArticles.filter((a) => !heroLeadSeen.has(a.slug));
  const heroMiddle =
    afterHeroLead.length >= 3 ? afterHeroLead.slice(0, 3) : dedupedArticles.slice(1, 4);
  const heroRight =
    afterHeroLead.length >= 6 ? afterHeroLead.slice(3, 6) : dedupedArticles.slice(4, 7);

  // 2) Hero Sub-Carousel (2 berita carousel di bawahnya): 6 berita = 3 slide × 2 kartu
  const heroSideSlugs = new Set([
    ...heroLeadCandidates.map((a) => a.slug),
    ...heroMiddle.map((a) => a.slug),
    ...heroRight.map((a) => a.slug),
  ]);
  const afterHeroAll = dedupedArticles.filter((a) => !heroSideSlugs.has(a.slug));
  const heroSubCandidates =
    afterHeroAll.length >= 4 ? afterHeroAll.slice(0, 6) : dedupedArticles.slice(1, 5);

  const toCarouselItems = (list: HomeArticle[], imageOffset = 0) =>
    list.map((a, idx) => ({
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      featuredImage: resolveArticleImage(a.featuredImage, a.category?.slug, idx + imageOffset),
      category: a.category
        ? { name: a.category.name, slug: a.category.slug }
        : { name: "Berita", slug: "umum" },
      author: a.author ? { name: a.author.name } : { name: "Redaksi Lensaplus" },
      publishedAt: a.publishedAt ? new Date(a.publishedAt).toISOString() : null,
      readTime: null,
    }));

  const heroCarouselItems = toCarouselItems(heroLeadCandidates, 0);
  const heroSubCarouselItems = toCarouselItems(heroSubCandidates, 2);

  // Pilihan Editor — prioritaskan artikel populer yang tidak duplikat dengan Hero atas
  const heroLeadSlugs = new Set([...heroLeadCandidates, ...heroMiddle].map((a) => a.slug));
  const distinctTrending = activeTrending.filter((a) => !heroLeadSlugs.has(a.slug));
  const editorsPickArticles = (
    distinctTrending.length >= 4
      ? distinctTrending.slice(0, 4)
      : dedupedArticles.slice(4, 8).length >= 4
      ? dedupedArticles.slice(4, 8)
      : dedupedArticles.slice(0, 4)
  );

  // Berita Terkini — lanjut setelah artikel Hero (maks 17 artikel: 5 lead carousel + 6 sub-carousel + 6 grid)
  const terkiniFallback =
    dedupedArticles.length > 7
      ? dedupedArticles.slice(7, 18)
      : dedupedArticles.slice(1, 12);
  const heroAllSlugs = new Set([...heroSideSlugs, ...heroSubCandidates.map((a) => a.slug)]);
  const afterHeroPool = dedupedArticles.filter((a) => !heroAllSlugs.has(a.slug));
  const terkiniArticles =
    afterHeroPool.length >= 11 ? afterHeroPool.slice(0, 17) : terkiniFallback;

  const terkiniLeadCandidates = terkiniArticles.slice(0, 5);
  const terkiniSubCandidates =
    terkiniArticles.length >= 9
      ? terkiniArticles.slice(5, 11)
      : terkiniArticles.length >= 7
        ? terkiniArticles.slice(5, 7)
        : dedupedArticles.slice(1, 5);
  const terkiniGridArticles =
    terkiniArticles.length > 11
      ? terkiniArticles.slice(11, 17)
      : terkiniArticles.slice(1, 7);

  const terkiniCarouselItems = toCarouselItems(terkiniLeadCandidates, 1);
  const terkiniSubCarouselItems = toCarouselItems(terkiniSubCandidates, 3);

  // Category sections
  const articlesByCategory: Record<string, { slug: string; articles: HomeArticle[] }> = {};
  for (const a of dedupedArticles) {
    const name = a.category?.name || "Berita";
    const slug = a.category?.slug || "umum";
    if (!articlesByCategory[name]) articlesByCategory[name] = { slug, articles: [] };
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
              alternateName: "Lensaplus Indonesia",
              url: "https://lensaplus.com",
              logo: { "@type": "ImageObject", url: "https://lensaplus.com/lensaplus-icon.png", width: 512, height: 512 },
              image: { "@type": "ImageObject", url: "https://lensaplus.com/lensaplus-icon.png" },
              description:
                "Portal media berita digital nasional Indonesia — bisnis, ekonomi, politik nasional, hukum & peradilan, olahraga, hiburan, teknologi, dan peristiwa Nusantara.",
              foundingDate: "2024",
              sameAs,
              publishingPrinciples: "https://lensaplus.com/pedoman-media",
              ethicsPolicy: "https://lensaplus.com/kode-etik",
              missionCoveragePrioritiesPolicy: "https://lensaplus.com/pedoman-media",
              correctionsPolicy: "https://lensaplus.com/kode-etik",
              diversityPolicy: "https://lensaplus.com/kode-etik",
              areaServed: [
                { "@type": "Country", name: "Indonesia" },
                { "@type": "City", name: "Jakarta" },
                { "@type": "City", name: "Bandung" },
                { "@type": "AdministrativeArea", name: "Ibu Kota Nusantara" },
              ],
              knowsAbout: [
                "Berita Nasional", "Politik Indonesia", "Bisnis Indonesia", "Ekonomi Makro", "Pemerintahan", "Kebijakan Publik",
                "APBD/APBN", "Hukum Indonesia", "Putusan Pengadilan", "UU/Regulasi",
                "Pemilu", "Olahraga Indonesia", "Hiburan", "Teknologi Digital",
                "Pendidikan", "Kesehatan", "Lingkungan",
                "Berita Indonesia", "Peristiwa Nusantara",
              ],
              contactPoint: [
                { "@type": "ContactPoint", contactType: "customer service", url: "https://lensaplus.com/kontak", areaServed: "ID", availableLanguage: ["Indonesian"] },
                { "@type": "ContactPoint", contactType: "editorial", url: "https://lensaplus.com/redaksi", areaServed: "ID", availableLanguage: ["Indonesian"] },
              ],
              address: {
                "@type": "PostalAddress",
                addressLocality: "Jakarta & Bandung",
                addressRegion: "Indonesia",
                addressCountry: "ID",
              },
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": "https://lensaplus.com/#website",
              name: "Lensaplus",
              alternateName: "Lensaplus — Media Berita Digital Nasional Indonesia",
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

      <h1 className="sr-only">Lensaplus — Media Berita Digital Nasional Indonesia</h1>
      
      {/* ── TOP LEADERBOARD AD ── */}
      <BannerAd size="leaderboard" slot="HEADER" className="bg-surface" />

      {/* ── HERO EDITORIAL GRID ── */}
      <section className="bg-surface py-4 sm:py-8 lg:py-10">
        <div className="container-main">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-10">
            {/* Column 1: Main Spotlight Carousel + 2-Card Carousel (6/12) */}
            {heroCarouselItems.length > 0 && (
              <div className="lg:col-span-6 flex flex-col gap-3 sm:gap-4">
                <HeadlineSlider
                  items={heroCarouselItems}
                  badgeLabel="Terhangat Hari Ini"
                  aspectClass="aspect-[16/10] sm:aspect-[16/10] min-h-[220px] sm:min-h-[290px]"
                  intervalMs={6000}
                />
                {heroSubCarouselItems.length > 0 && (
                  <SubHeadlineSlider
                    items={heroSubCarouselItems}
                    aspectClass="aspect-[16/9] sm:aspect-[16/6.2] min-h-[148px] sm:min-h-[172px]"
                    intervalMs={5000}
                  />
                )}
              </div>
            )}

            {/* Column 2: Top Stories / Pilihan Redaksi (3/12)
                Mobile (<sm): horizontal split rows (~84px/item)
                Tablet / Narrow (sm..md): 3-column compact grid
                Desktop (lg+): 3/12 vertical editorial stack */}
            <div className="lg:col-span-3 flex flex-col gap-3.5 sm:gap-4 lg:gap-5 border-t lg:border-t-0 lg:border-x border-stone-200/60 pt-4 sm:pt-5 lg:pt-0 lg:px-6">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-primary">
                  Pilihan Redaksi
                </span>
              </div>
              <div className="divide-y divide-stone-200/60 sm:divide-y-0 sm:grid sm:grid-cols-3 sm:gap-4 lg:flex lg:flex-col lg:gap-5">
                {heroMiddle.map((a, i) => (
                  <article
                    key={a.slug}
                    className={`group flex flex-row-reverse sm:flex-col items-center sm:items-stretch gap-3 sm:gap-0 py-3 first:pt-0 last:pb-0 sm:py-0 ${
                      i > 0 ? "lg:pt-4 lg:border-t lg:border-stone-100" : ""
                    }`}
                  >
                    <Link href={`/berita/${a.slug}`} className="shrink-0 sm:order-2 sm:mt-2 block">
                      <div className="relative h-[66px] w-24 sm:h-auto sm:w-full sm:aspect-[16/10] overflow-hidden rounded-lg sm:rounded-xl bg-stone-200/70 shadow-sm">
                        <Image
                          src={resolveArticleImage(a.featuredImage, a.category?.slug, i + 1)}
                          alt={a.title}
                          fill
                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                          sizes="(max-width: 640px) 96px, (max-width: 1024px) 33vw, 25vw"
                        />
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0 sm:contents">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-secondary sm:order-1">
                        {a.category?.name || "Berita"}
                      </span>
                      <Link href={`/berita/${a.slug}`} className="sm:order-1">
                        <h3 className="mt-0.5 sm:mt-1 text-sm sm:text-title-sm lg:text-title-md font-serif leading-snug text-on-surface group-hover:text-primary transition-colors line-clamp-2">
                          {a.title}
                        </h3>
                      </Link>
                      <p className="mt-1 sm:mt-2 text-[10px] text-stone-500 uppercase tracking-wider sm:order-3">
                        {timeAgo(a.publishedAt)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {/* Column 3: Fresh News / Terhangat (3/12)
                Mobile (<sm): horizontal split rows (thumbnail left, text right for creative contrast)
                Tablet / Narrow (sm..md): 3-column compact grid
                Desktop (lg+): 3/12 vertical editorial stack */}
            <div className="lg:col-span-3 flex flex-col gap-3.5 sm:gap-4 lg:gap-5 border-t lg:border-t-0 border-stone-200/60 pt-4 sm:pt-5 lg:pt-0">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-secondary">
                  Terhangat
                </span>
              </div>
              <div className="divide-y divide-stone-200/60 sm:divide-y-0 sm:grid sm:grid-cols-3 sm:gap-4 lg:flex lg:flex-col lg:gap-5">
                {heroRight.map((a, i) => (
                  <article
                    key={a.slug}
                    className={`group flex flex-row sm:flex-col items-center sm:items-stretch gap-3 sm:gap-0 py-3 first:pt-0 last:pb-0 sm:py-0 ${
                      i > 0 ? "lg:pt-4 lg:border-t lg:border-stone-100" : ""
                    }`}
                  >
                    <Link href={`/berita/${a.slug}`} className="shrink-0 sm:order-2 sm:mt-2 block">
                      <div className="relative h-[66px] w-24 sm:h-auto sm:w-full sm:aspect-[16/10] overflow-hidden rounded-lg sm:rounded-xl bg-stone-200/70 shadow-sm">
                        <Image
                          src={resolveArticleImage(a.featuredImage, a.category?.slug, i + 4)}
                          alt={a.title}
                          fill
                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                          sizes="(max-width: 640px) 96px, (max-width: 1024px) 33vw, 25vw"
                        />
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0 sm:contents">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-tertiary sm:order-1">
                        {a.category?.name || "Berita"}
                      </span>
                      <Link href={`/berita/${a.slug}`} className="sm:order-1">
                        <h3 className="mt-0.5 sm:mt-1 text-sm sm:text-title-sm lg:text-title-md font-serif leading-snug text-on-surface group-hover:text-primary transition-colors line-clamp-2">
                          {a.title}
                        </h3>
                      </Link>
                      <p className="mt-1 sm:mt-2 text-[10px] text-stone-500 uppercase tracking-wider sm:order-3">
                        {timeAgo(a.publishedAt)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRENDING STRIP (Big Numbers) ── */}
      <section className="bg-white border-y border-stone-200/60 py-5 sm:py-8">
        <div className="container-main">
          <div className="flex items-center gap-2 mb-3.5 sm:mb-5">
            <span className="flex h-2 w-2 rounded-full bg-secondary animate-pulse" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-widest text-stone-600">Trending Topik Hari Ini</span>
          </div>
          <div className="flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide lg:grid lg:grid-cols-5 lg:gap-6 lg:overflow-visible lg:pb-0">
            {activeTrending.slice(0, 5).map((a, i) => (
              <article key={a.slug} className="flex flex-col justify-between w-[46vw] min-w-[162px] max-w-[205px] sm:w-[205px] md:w-[215px] shrink-0 snap-start lg:w-auto lg:shrink group">
                <div className="flex gap-2 lg:gap-3 items-start min-w-0">
                  <span className="shrink-0 font-serif text-xl sm:text-2xl lg:text-3xl font-extrabold text-primary/20 group-hover:text-secondary transition-colors select-none leading-none" aria-hidden="true">
                    0{i + 1}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-secondary truncate">
                      {a.category?.name || "Berita"}
                    </span>
                    <Link href={`/berita/${a.slug}`}>
                      <h3 className="mt-0.5 sm:mt-1 text-[13px] sm:text-title-sm font-bold leading-snug text-on-surface line-clamp-2 group-hover:text-primary transition-colors">
                        {a.title}
                      </h3>
                    </Link>
                  </div>
                </div>
                <div className="mt-2 sm:mt-3">
                  <Link href={`/berita/${a.slug}`} className="block">
                    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg sm:rounded-xl bg-stone-200/70 shadow-sm">
                      <Image
                        src={resolveArticleImage(a.featuredImage, a.category?.slug, i)}
                        alt={a.title}
                        fill
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        sizes="(max-width: 640px) 46vw, (max-width: 1024px) 215px, 20vw"
                      />
                    </div>
                  </Link>
                  <p className="mt-1.5 sm:mt-2 text-[10px] text-stone-600 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <span>{timeAgo(a.publishedAt)}</span>
                    {a.viewCount > 0 && (
                      <span className="truncate">
                        · {a.viewCount.toLocaleString("id-ID")} dilihat
                      </span>
                    )}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOROTAN & ANALISIS SUDUT PANDANG (EDITORIAL AUTHORITY DESIGN SYSTEM) ── */}
      <section className="bg-surface py-7 sm:py-12 border-b border-stone-200/70">
        <div className="container-main">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2.5 sm:gap-4 mb-5 sm:mb-8">
            <div className="border-l-4 border-secondary pl-3">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-secondary-dark block">
                Desk Sorotan &amp; Bedah Isu
              </span>
              <h2 className="font-serif text-xl sm:text-3xl font-bold text-on-surface mt-0.5">
                Analisis Sudut Pandang &amp; Bedah Isu Nasional
              </h2>
            </div>
            <Link
              href="/sorotan"
              className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-dark transition-colors shrink-0 self-start sm:self-auto"
            >
              Jelajahi Semua Sorotan <ChevronRight size={14} aria-hidden="true" />
            </Link>
          </div>

          <div className="flex gap-3.5 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:pb-0">
            {sorotanList.length > 0 ? (
              sorotanList.slice(0, 3).map((item) => {
                const badge = getAngleBadge(item.angle);
                const plainExcerpt = stripHtml(item.content);
                return (
                  <article
                    key={item.id}
                    className="w-[74vw] min-w-[244px] max-w-[300px] sm:w-[46%] md:w-auto shrink-0 snap-start group flex flex-col justify-between rounded-xl sm:rounded-2xl bg-white p-4 sm:p-5 md:p-6 border border-stone-200/80 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                        <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-widest ${badge.color}`}>
                          {badge.label}
                        </span>
                        <span className="text-[10px] text-stone-500">
                          {timeAgo(item.createdAt)}
                        </span>
                      </div>
                      <Link href={`/sorotan/${item.slug}`}>
                        <h3 className="font-serif text-base sm:text-lg font-bold leading-snug text-on-surface group-hover:text-primary transition-colors line-clamp-2">
                          {item.title}
                        </h3>
                      </Link>
                      {plainExcerpt && (
                        <p className="mt-2 text-xs text-stone-600 line-clamp-2 sm:line-clamp-3 leading-relaxed">
                          {plainExcerpt}
                        </p>
                      )}
                    </div>

                    <div className="mt-3.5 sm:mt-5 border-t border-stone-200/60 pt-2.5 sm:pt-3 flex items-center justify-between gap-3">
                      <span className="text-[11px] text-stone-500 truncate max-w-[165px] sm:max-w-[200px]">
                        {item.article?.title ? `Berita Terkait: ${item.article.title}` : "Bedah Isu Lensaplus"}
                      </span>
                      <Link
                        href={`/sorotan/${item.slug}`}
                        className="text-xs font-bold text-primary group-hover:text-secondary-dark group-hover:translate-x-0.5 transition-all inline-flex items-center gap-1 shrink-0"
                      >
                        Baca <ChevronRight size={14} aria-hidden="true" />
                      </Link>
                    </div>
                  </article>
                );
              })
            ) : (
              // Fallback cards with clean editorial typography
              [
                { title: "Kronologi & Evaluasi Kebijakan Ekonomi Nasional", angle: "KRONOLOGI", desc: "Rekap urutan keputusan anggaran dan alokasi prioritas pembangunan infrastruktur publik Indonesia." },
                { title: "Analisis Dampak Regulasi Perdagangan & Investasi", angle: "ANALISIS", desc: "Kajian komprehensif pengaruh kebijakan tarif dan pajak terhadap iklim usaha dan investasi nasional." },
                { title: "Proyeksi Pertumbuhan Sektor Industri & Transportasi", angle: "DAMPAK", desc: "Tinjauan estimasi perkembangan sektor transportasi darat, laut, dan udara Nusantara." },
              ].map((item, idx) => {
                const badge = getAngleBadge(item.angle);
                return (
                  <article
                    key={idx}
                    className="w-[74vw] min-w-[244px] max-w-[300px] sm:w-[46%] md:w-auto shrink-0 snap-start group flex flex-col justify-between rounded-xl sm:rounded-2xl bg-white p-4 sm:p-5 md:p-6 border border-stone-200/80 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                        <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-widest ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <Link href="/sorotan">
                        <h3 className="font-serif text-base sm:text-lg font-bold leading-snug text-on-surface group-hover:text-primary transition-colors line-clamp-2">
                          {item.title}
                        </h3>
                      </Link>
                      <p className="mt-2 text-xs text-stone-600 line-clamp-2 sm:line-clamp-3 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                    <div className="mt-3.5 sm:mt-5 border-t border-stone-200/60 pt-2.5 sm:pt-3 flex items-center justify-end">
                      <Link href="/sorotan" className="text-xs font-bold text-primary group-hover:text-secondary-dark inline-flex items-center gap-1">
                        Jelajahi <ChevronRight size={14} aria-hidden="true" />
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
      <section className="bg-surface-secondary py-6 sm:py-10 lg:py-14">
        <div className="container-main">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-10">
            {/* Left: Berita Terkini (7 cols) */}
            <div className="lg:col-span-7">
              <div className="flex items-center justify-between gap-3 mb-4 sm:mb-7">
                <h2 className="font-serif text-headline-sm sm:text-headline-md text-on-surface border-l-4 border-primary pl-3 truncate">
                  Berita Terkini
                </h2>
                <Link href="/berita" className="flex items-center gap-1 text-label-sm sm:text-label-md uppercase tracking-wider font-bold text-primary hover:text-primary-dark transition-colors shrink-0">
                  <span className="hidden sm:inline">Lihat Semua</span>
                  <span className="sm:hidden">Semua</span>
                  <ChevronRight size={14} />
                </Link>
              </div>

              {/* Lead Carousel — Berita Terbaru (1 besar di atas + 2 berita carousel di bawahnya) */}
              {terkiniCarouselItems.length > 0 && (
                <div className="mb-3 sm:mb-4">
                  <HeadlineSlider
                    items={terkiniCarouselItems}
                    badgeLabel="Berita Terbaru"
                    aspectClass="aspect-[16/10] sm:aspect-[16/9] min-h-[210px] sm:min-h-[270px]"
                    intervalMs={6500}
                  />
                </div>
              )}

              {terkiniSubCarouselItems.length > 0 && (
                <div className="mb-5 sm:mb-7">
                  <SubHeadlineSlider
                    items={terkiniSubCarouselItems}
                    aspectClass="aspect-[16/9] sm:aspect-[16/6] min-h-[145px] sm:min-h-[175px]"
                    intervalMs={5200}
                  />
                </div>
              )}

              {/* Rest as compact list grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y divide-stone-200/60 sm:divide-y-0 gap-x-6 sm:gap-y-5">
                {terkiniGridArticles.map((a, idx) => (
                  <article key={a.slug} className="group flex gap-3 sm:gap-3.5 py-2.5 first:pt-0 last:pb-0 sm:py-0 items-center sm:items-start">
                    <Link href={`/berita/${a.slug}`} className="shrink-0">
                      <div className="relative h-[60px] w-[88px] sm:h-20 sm:w-28 overflow-hidden rounded-lg sm:rounded-xl bg-stone-200/70 shadow-sm">
                        <Image
                          src={resolveArticleImage(a.featuredImage, a.category?.slug, idx + 2)}
                          alt={a.title}
                          fill
                          sizes="(max-width: 640px) 88px, 112px"
                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-secondary mb-0.5 sm:hidden truncate">
                        {a.category?.name || "Berita"}
                      </span>
                      <Link href={`/berita/${a.slug}`}>
                        <h3 className="text-[13px] sm:text-title-sm font-serif leading-snug text-on-surface line-clamp-2 group-hover:text-primary transition-colors">
                          {a.title}
                        </h3>
                      </Link>
                      <p className="mt-1 text-[10px] text-stone-500 uppercase tracking-wider">
                        {timeAgo(a.publishedAt)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>

              {/* "Lihat Lainnya" CTA */}
              <div className="mt-6 sm:mt-10 border-t border-stone-200/60 pt-4 sm:pt-6 flex justify-center">
                <Link
                  href="/berita"
                  className="group inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-label-md font-bold uppercase tracking-wider text-white transition-all hover:bg-primary-dark hover:gap-3 shadow-md shadow-primary/20"
                >
                  Lihat Berita Lainnya
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Right Sidebar — 5 cols: Polling + Legal Agenda + Ads */}
            <aside className="lg:col-span-5 flex flex-col gap-5 sm:gap-6 lg:gap-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-5 sm:gap-6">
                {/* Interactive Polling Card */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200/60 shadow-sm">
                  <div className="mb-4 sm:mb-5 border-b border-stone-100 pb-2.5 sm:pb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-secondary block">Suara Pembaca</span>
                    <h3 className="font-serif text-title-md text-on-surface font-semibold mt-0.5">Polling</h3>
                  </div>
                  <PollingCarousel />
                </div>

                {/* Legal Agenda & Public Services Widget */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200/60 shadow-sm">
                  <div className="mb-3 sm:mb-4 border-b border-stone-100 pb-2.5 sm:pb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary block">Layanan &amp; Informasi</span>
                    <h3 className="font-serif text-title-md text-on-surface font-semibold mt-0.5">Agenda &amp; Layanan Hukum</h3>
                  </div>

                  <div className="divide-y divide-stone-100">
                    <Link
                      href="/live"
                      className="group flex items-center justify-between py-2.5 sm:py-3 transition-colors"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-stone-800 group-hover:text-primary transition-colors">Liputan Langsung Persidangan</h4>
                        <p className="text-[10px] text-stone-500 mt-0.5">Laporan real-time sidang &amp; konferensi pers</p>
                      </div>
                      <ChevronRight size={15} className="text-stone-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" aria-hidden="true" />
                    </Link>

                    <Link
                      href="/lokasi"
                      className="group flex items-center justify-between py-2.5 sm:py-3 transition-colors"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-stone-800 group-hover:text-primary transition-colors">Direktori Pengadilan Bandung</h4>
                        <p className="text-[10px] text-stone-500 mt-0.5">Lokasi &amp; info 8 lembaga peradilan</p>
                      </div>
                      <ChevronRight size={15} className="text-stone-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>

                    <Link
                      href="/regulasi"
                      className="group flex items-center justify-between pt-2.5 sm:pt-3 pb-1 transition-colors"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-stone-800 group-hover:text-primary transition-colors">Database Regulasi &amp; Perda</h4>
                        <p className="text-[10px] text-stone-500 mt-0.5">Peraturan daerah &amp; UU terbaru</p>
                      </div>
                      <ChevronRight size={15} className="text-stone-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Sidebar Ads */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-6">
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
        <section className="bg-surface py-6 sm:py-10 border-t border-stone-200/60">
          <div className="container-main">
            <div className="flex items-end justify-between gap-3 mb-4 sm:mb-7">
              <div className="min-w-0 border-l-4 border-secondary pl-3">
                <span className="text-label-sm sm:text-label-md uppercase tracking-widest text-secondary font-bold block">Pilihan Editor</span>
                <h2 className="font-serif text-headline-sm sm:text-headline-md text-on-surface mt-0.5">
                  Wajib Dibaca Hari Ini
                </h2>
              </div>
              <Link href="/berita" className="hidden sm:inline-flex items-center gap-1.5 text-label-md uppercase tracking-wider font-bold text-primary hover:text-primary-dark transition-colors shrink-0">
                Semua Berita <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
              {editorsPickArticles.map((a, idx) => (
                <article key={a.slug} className="group flex flex-col justify-between">
                  <div>
                    <Link href={`/berita/${a.slug}`} className="block">
                      <div className="relative aspect-[16/10] sm:aspect-[3/2] overflow-hidden rounded-lg sm:rounded-xl bg-stone-200/70 shadow-sm">
                        <Image
                          src={resolveArticleImage(a.featuredImage, a.category?.slug, idx)}
                          alt={a.title}
                          fill
                          sizes="(max-width: 768px) 50vw, 25vw"
                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                      </div>
                    </Link>
                    <div className="mt-2 sm:mt-3">
                      <span className="text-[10px] sm:text-label-sm font-bold uppercase tracking-widest text-primary truncate block">{a.category?.name || "Berita"}</span>
                      <Link href={`/berita/${a.slug}`}>
                        <h3 className="mt-0.5 sm:mt-1 font-serif text-[13px] sm:text-title-md lg:text-title-lg leading-snug text-on-surface line-clamp-2 group-hover:text-primary transition-colors">
                          {a.title}
                        </h3>
                      </Link>
                    </div>
                  </div>
                  <p className="mt-2 sm:mt-3 flex items-center gap-1.5 text-[10px] sm:text-label-sm uppercase tracking-wider text-stone-500 border-t border-stone-100 pt-1.5 sm:pt-2 truncate">
                    <span className="truncate">{a.author?.name || "Redaksi Lensaplus"}</span>
                    <span className="text-stone-300">/</span>
                    <span className="shrink-0">{timeAgo(a.publishedAt)}</span>
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── RANGKUMAN BERITA PINTAR ── */}
      <section className="bg-gradient-to-b from-stone-100 to-stone-50 py-7 sm:py-12 border-t border-stone-200/60">
        <div className="container-main">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2.5 sm:gap-4 mb-5 sm:mb-8">
            <div className="border-l-4 border-primary pl-3">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-primary block">
                Rangkuman Pintar
              </span>
              <h2 className="font-serif text-xl sm:text-3xl font-bold text-on-surface mt-0.5">
                Kilas Berita &amp; Rekap Penting
              </h2>
            </div>
            <Link
              href="/rangkuman"
              className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-dark transition-colors shrink-0 self-start sm:self-auto"
            >
              Lihat Semua Rangkuman <ChevronRight size={14} />
            </Link>
          </div>

          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:pb-0">
            <Link
              href="/rangkuman/harian"
              className="w-[72vw] min-w-[232px] max-w-[275px] sm:w-[46%] md:w-auto shrink-0 snap-start group rounded-xl sm:rounded-2xl bg-white p-4 sm:p-5 md:p-6 border border-stone-200/70 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-primary block mb-1.5 sm:mb-2">
                  Harian
                </span>
                <h3 className="font-serif text-base sm:text-lg font-bold text-stone-900 group-hover:text-primary transition-colors">
                  Rangkuman Harian
                </h3>
                <p className="mt-1.5 sm:mt-2 text-xs text-stone-600 leading-relaxed line-clamp-2 sm:line-clamp-none">
                  Ringkasan peristiwa dan berita paling krusial hari ini di Indonesia dan daerah.
                </p>
              </div>
              <div className="mt-3 sm:mt-4 flex items-center gap-1 text-xs font-bold text-primary">
                <span>Buka Arsip Harian</span>
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </div>
            </Link>

            <Link
              href="/rangkuman/pekan-ini"
              className="w-[72vw] min-w-[232px] max-w-[275px] sm:w-[46%] md:w-auto shrink-0 snap-start group rounded-xl sm:rounded-2xl bg-white p-4 sm:p-5 md:p-6 border border-stone-200/70 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-secondary block mb-1.5 sm:mb-2">
                  Mingguan
                </span>
                <h3 className="font-serif text-base sm:text-lg font-bold text-stone-900 group-hover:text-primary transition-colors">
                  Kilas Pekan Ini
                </h3>
                <p className="mt-1.5 sm:mt-2 text-xs text-stone-600 leading-relaxed line-clamp-2 sm:line-clamp-none">
                  Evaluasi mingguan kebijakan publik, dinamika pasar, dan isu hangat sepekan terakhir.
                </p>
              </div>
              <div className="mt-3 sm:mt-4 flex items-center gap-1 text-xs font-bold text-secondary">
                <span>Baca Kilas Mingguan</span>
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </div>
            </Link>

            <Link
              href="/rangkuman/bulan-ini"
              className="w-[72vw] min-w-[232px] max-w-[275px] sm:w-[46%] md:w-auto shrink-0 snap-start group rounded-xl sm:rounded-2xl bg-white p-4 sm:p-5 md:p-6 border border-stone-200/70 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-emerald-700 block mb-1.5 sm:mb-2">
                  Bulanan
                </span>
                <h3 className="font-serif text-base sm:text-lg font-bold text-stone-900 group-hover:text-primary transition-colors">
                  Kaleidoskop Bulanan
                </h3>
                <p className="mt-1.5 sm:mt-2 text-xs text-stone-600 leading-relaxed line-clamp-2 sm:line-clamp-none">
                  Rangkuman komprehensif perkembangan ekonomi, proyek daerah, dan regulasi bulan ini.
                </p>
              </div>
              <div className="mt-3 sm:mt-4 flex items-center gap-1 text-xs font-bold text-emerald-700">
                <span>Lihat Kaleidoskop</span>
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" aria-hidden="true" />
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
            <section className={`py-6 sm:py-10 ${isEven ? "bg-surface" : "bg-stone-50"}`}>
              <div className="container-main">
                {/* Header */}
                <div className="flex items-center justify-between gap-3 mb-4 sm:mb-7">
                  <Link href={`/kategori/${catSlug}`} className="group min-w-0">
                    <h2 className="font-serif text-title-lg sm:text-headline-sm text-on-surface border-l-4 border-primary pl-3 group-hover:text-primary transition-colors truncate">
                      {catName}
                    </h2>
                  </Link>
                  <Link href={`/kategori/${catSlug}`} className="flex items-center gap-1 text-label-sm sm:text-label-md uppercase tracking-wider font-bold text-primary hover:text-primary-dark transition-colors shrink-0">
                    <span className="hidden sm:inline">Lihat Semua</span>
                    <span className="sm:hidden">Semua</span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </Link>
                </div>

                {isEven ? (
                  <>
                    {/* Mobile: 2 cards berdampingan + compact divided rows */}
                    <div className="md:hidden">
                      {(() => {
                        const top2 = catArticles.slice(0, 2);
                        const rest = catArticles.slice(2);
                        return (
                          <>
                            {top2.length > 0 && (
                              <div className="grid grid-cols-2 gap-3 mb-4">
                                {top2.map((a, subIdx) => (
                                  <article key={a.slug} className="group">
                                    <Link href={`/berita/${a.slug}`} className="block">
                                      <div className="relative aspect-[16/10] overflow-hidden rounded-lg sm:rounded-xl bg-stone-200/70">
                                        <Image
                                          src={resolveArticleImage(a.featuredImage, a.category?.slug, subIdx)}
                                          alt={a.title}
                                          fill
                                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                                          sizes="(max-width: 768px) 50vw, 25vw"
                                        />
                                      </div>
                                    </Link>
                                    <div className="mt-2">
                                      <Link href={`/berita/${a.slug}`}>
                                        <h3 className="font-serif text-[13px] leading-snug text-on-surface line-clamp-2 group-hover:text-primary transition-colors">
                                          {a.title}
                                        </h3>
                                      </Link>
                                      <p className="mt-1 text-[10px] uppercase tracking-wider text-stone-500">
                                        {timeAgo(a.publishedAt)}
                                      </p>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            )}
                            {rest.length > 0 && (
                              <div className="flex flex-col divide-y divide-stone-200/60 border-t border-stone-200/60 pt-2.5">
                                {rest.map((a, subIdx) => (
                                  <article key={a.slug} className="group flex gap-3 py-2.5 first:pt-0 last:pb-0 items-center">
                                    <Link href={`/berita/${a.slug}`} className="shrink-0">
                                      <div className="relative h-14 w-20 overflow-hidden rounded-lg bg-stone-200/70">
                                        <Image
                                          src={resolveArticleImage(a.featuredImage, a.category?.slug, subIdx + 2)}
                                          alt={a.title}
                                          fill
                                          className="object-cover"
                                          sizes="80px"
                                        />
                                      </div>
                                    </Link>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                      <Link href={`/berita/${a.slug}`}>
                                        <h3 className="text-[13px] font-serif leading-snug text-on-surface line-clamp-2 group-hover:text-primary transition-colors">{a.title}</h3>
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
                            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-stone-200/70 shadow-sm">
                              <Image
                                src={resolveArticleImage(main.featuredImage, main.category?.slug, 0)}
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
                              {main.author?.name || "Redaksi Lensaplus"} <span className="mx-0.5 text-stone-300">/</span> {timeAgo(main.publishedAt)}
                            </p>
                          </div>
                        </div>
                      )}
                      {side.length > 0 && (
                        <div className="md:col-span-5 flex flex-col gap-4 sm:gap-5">
                          {side.map((a, subIdx) => (
                            <article key={a.slug} className="group flex gap-3 sm:gap-4">
                              <Link href={`/berita/${a.slug}`} className="shrink-0">
                                <div className="relative h-16 w-24 sm:h-20 sm:w-28 overflow-hidden rounded-xl bg-stone-200/70 shadow-sm">
                                  <Image
                                    src={resolveArticleImage(a.featuredImage, a.category?.slug, subIdx + 1)}
                                    alt={a.title}
                                    fill
                                    className="object-cover"
                                    sizes="112px"
                                  />
                                </div>
                              </Link>
                              <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <Link href={`/berita/${a.slug}`}>
                                  <h3 className="text-title-sm leading-snug text-on-surface line-clamp-2 group-hover:text-primary transition-colors">{a.title}</h3>
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
                  <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:pb-0">
                    {catArticles.slice(0, 3).map((a, subIdx) => (
                      <article key={a.slug} className="w-[46vw] min-w-[162px] max-w-[235px] sm:w-[38vw] md:w-auto shrink-0 snap-start group">
                        <Link href={`/berita/${a.slug}`} className="block">
                          <div className="relative aspect-[16/10] sm:aspect-[3/2] overflow-hidden rounded-lg sm:rounded-xl bg-stone-200/70 shadow-sm">
                            <Image
                              src={resolveArticleImage(a.featuredImage, a.category?.slug, subIdx)}
                              alt={a.title}
                              fill
                              sizes="(max-width: 640px) 46vw, (max-width: 768px) 38vw, 33vw"
                              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                            />
                          </div>
                        </Link>
                        <div className="mt-2 sm:mt-3">
                          <Link href={`/berita/${a.slug}`}>
                            <h3 className="font-serif text-[13px] sm:text-title-md lg:text-title-lg leading-snug text-on-surface line-clamp-2 group-hover:text-primary transition-colors">{a.title}</h3>
                          </Link>
                          <p className="mt-1 sm:mt-1.5 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-label-sm uppercase tracking-wider text-stone-500 truncate">
                            <span className="truncate">{a.author?.name || "Redaksi Lensaplus"}</span> <span className="mx-0.5 text-stone-300 shrink-0">/</span> <span className="shrink-0">{timeAgo(a.publishedAt)}</span>
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              {idx === 1 && <div className="container-main mt-6 sm:mt-8"><NativeAd /></div>}
            </section>

            {idx > 0 && idx % 3 === 2 && (
              <BannerAd size="banner" slot="BETWEEN_SECTIONS" className={isEven ? "bg-surface-container-low" : "bg-surface"} />
            )}
          </div>
        );
      })}

      {/* ── NEWSLETTER SUBSCRIPTION BOX ── */}
      <section className="bg-surface py-7 sm:py-12 border-t border-stone-200/60">
        <div className="container-main">
          <NewsletterBox />
        </div>
      </section>

      {/* AD: Footer */}
      <BannerAd size="leaderboard" slot="FOOTER" className="bg-surface" />
    </>
  );
}
