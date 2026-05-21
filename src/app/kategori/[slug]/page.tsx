export const revalidate = 60; // ISR: revalidate category page every 60 seconds

import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Vote } from "lucide-react";
import ArticleCard from "@/components/artikel/ArticleCard";
import PaginatedArticles from "@/components/artikel/PaginatedArticles";
import SearchableArticleList from "@/components/artikel/SearchableArticleList";
import Sidebar from "@/components/layout/Sidebar";
import HeadlineSlider from "@/components/slider/HeadlineSlider";
import SubHeadlineSlider from "@/components/slider/SubHeadlineSlider";
import VideoStory from "@/components/slider/VideoStory";
import BannerAd, { SidebarAd } from "@/components/ads/BannerAd";
import { videoStoryData } from "@/lib/video-data";

type Poll = { question: string; image?: string; options: { label: string; percentage: number }[]; totalVotes: number };
const categoryPolling: Record<string, Poll[]> = {
  "hukum-pidana": [
    { question: "Apakah hukuman mati masih relevan dalam sistem hukum pidana Indonesia?", image: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&q=80", options: [{ label: "Sangat Relevan", percentage: 38 }, { label: "Relevan", percentage: 24 }, { label: "Netral", percentage: 16 }, { label: "Tidak Relevan", percentage: 15 }, { label: "Sangat Tidak Relevan", percentage: 7 }], totalVotes: 3842 },
    { question: "Setujukah Anda dengan penerapan restorative justice untuk kasus pidana ringan?", options: [{ label: "Sangat Setuju", percentage: 40 }, { label: "Setuju", percentage: 28 }, { label: "Netral", percentage: 15 }, { label: "Tidak Setuju", percentage: 12 }, { label: "Sangat Tidak Setuju", percentage: 5 }], totalVotes: 2910 },
    { question: "Apakah sistem peradilan pidana Indonesia sudah memberikan keadilan bagi korban?", options: [{ label: "Sudah Adil", percentage: 12 }, { label: "Cukup Adil", percentage: 22 }, { label: "Netral", percentage: 25 }, { label: "Kurang Adil", percentage: 28 }, { label: "Tidak Adil", percentage: 13 }], totalVotes: 4150 },
  ],
  "hukum-perdata": [
    { question: "Apakah proses mediasi wajib di pengadilan efektif menyelesaikan sengketa perdata?", options: [{ label: "Sangat Efektif", percentage: 22 }, { label: "Efektif", percentage: 31 }, { label: "Cukup", percentage: 25 }, { label: "Tidak Efektif", percentage: 16 }, { label: "Sangat Tidak Efektif", percentage: 6 }], totalVotes: 2156 },
    { question: "Apakah biaya berperkara di pengadilan perdata terjangkau bagi masyarakat umum?", options: [{ label: "Sangat Terjangkau", percentage: 5 }, { label: "Terjangkau", percentage: 15 }, { label: "Netral", percentage: 20 }, { label: "Mahal", percentage: 35 }, { label: "Sangat Mahal", percentage: 25 }], totalVotes: 1890 },
    { question: "Perlukah Small Claims Court diperluas untuk sengketa di bawah Rp 500 juta?", options: [{ label: "Sangat Perlu", percentage: 45 }, { label: "Perlu", percentage: 28 }, { label: "Netral", percentage: 14 }, { label: "Tidak Perlu", percentage: 9 }, { label: "Sangat Tidak Perlu", percentage: 4 }], totalVotes: 2430 },
  ],
  "hukum-tata-negara": [
    { question: "Perlukah perubahan (amandemen) kelima terhadap UUD 1945?", options: [{ label: "Sangat Perlu", percentage: 35 }, { label: "Perlu", percentage: 28 }, { label: "Netral", percentage: 18 }, { label: "Tidak Perlu", percentage: 13 }, { label: "Sangat Tidak Perlu", percentage: 6 }], totalVotes: 5230 },
    { question: "Apakah Mahkamah Konstitusi masih independen dalam memutus perkara?", options: [{ label: "Sangat Independen", percentage: 10 }, { label: "Independen", percentage: 20 }, { label: "Netral", percentage: 25 }, { label: "Kurang Independen", percentage: 30 }, { label: "Tidak Independen", percentage: 15 }], totalVotes: 6120 },
    { question: "Setujukah Anda dengan sistem presidential threshold saat ini?", options: [{ label: "Sangat Setuju", percentage: 18 }, { label: "Setuju", percentage: 22 }, { label: "Netral", percentage: 20 }, { label: "Tidak Setuju", percentage: 25 }, { label: "Sangat Tidak Setuju", percentage: 15 }], totalVotes: 4870 },
  ],
  "ham": [
    { question: "Apakah Indonesia sudah cukup serius dalam menangani kasus pelanggaran HAM berat?", options: [{ label: "Sangat Serius", percentage: 8 }, { label: "Cukup Serius", percentage: 18 }, { label: "Netral", percentage: 20 }, { label: "Kurang Serius", percentage: 32 }, { label: "Sangat Kurang", percentage: 22 }], totalVotes: 4710 },
    { question: "Perlukah pembentukan Pengadilan HAM Permanen di Indonesia?", options: [{ label: "Sangat Perlu", percentage: 48 }, { label: "Perlu", percentage: 25 }, { label: "Netral", percentage: 14 }, { label: "Tidak Perlu", percentage: 9 }, { label: "Sangat Tidak Perlu", percentage: 4 }], totalVotes: 3560 },
    { question: "Apakah kebebasan berpendapat di Indonesia saat ini terjamin?", options: [{ label: "Sangat Terjamin", percentage: 8 }, { label: "Terjamin", percentage: 20 }, { label: "Netral", percentage: 22 }, { label: "Kurang Terjamin", percentage: 30 }, { label: "Tidak Terjamin", percentage: 20 }], totalVotes: 5240 },
  ],
  "hukum-bisnis": [
    { question: "Apakah regulasi bisnis di Indonesia sudah mendukung pertumbuhan UMKM?", options: [{ label: "Sangat Mendukung", percentage: 12 }, { label: "Mendukung", percentage: 25 }, { label: "Netral", percentage: 28 }, { label: "Kurang Mendukung", percentage: 25 }, { label: "Tidak Mendukung", percentage: 10 }], totalVotes: 1890 },
    { question: "Apakah perlindungan HKI (Hak Kekayaan Intelektual) di Indonesia sudah memadai?", options: [{ label: "Sangat Memadai", percentage: 8 }, { label: "Memadai", percentage: 18 }, { label: "Netral", percentage: 25 }, { label: "Kurang Memadai", percentage: 32 }, { label: "Tidak Memadai", percentage: 17 }], totalVotes: 1540 },
    { question: "Setujukah Anda dengan kemudahan perizinan berusaha melalui OSS (Online Single Submission)?", options: [{ label: "Sangat Setuju", percentage: 30 }, { label: "Setuju", percentage: 32 }, { label: "Netral", percentage: 18 }, { label: "Tidak Setuju", percentage: 14 }, { label: "Sangat Tidak Setuju", percentage: 6 }], totalVotes: 2210 },
  ],
  "hukum-lingkungan": [
    { question: "Apakah sanksi hukum terhadap perusahaan pencemar lingkungan sudah cukup berat?", options: [{ label: "Sudah Berat", percentage: 8 }, { label: "Cukup", percentage: 15 }, { label: "Netral", percentage: 18 }, { label: "Kurang Berat", percentage: 35 }, { label: "Sangat Kurang", percentage: 24 }], totalVotes: 3120 },
    { question: "Perlukah class action dipermudah untuk kasus pencemaran lingkungan?", options: [{ label: "Sangat Perlu", percentage: 52 }, { label: "Perlu", percentage: 25 }, { label: "Netral", percentage: 12 }, { label: "Tidak Perlu", percentage: 7 }, { label: "Sangat Tidak Perlu", percentage: 4 }], totalVotes: 2780 },
    { question: "Apakah AMDAL masih efektif mencegah kerusakan lingkungan?", options: [{ label: "Sangat Efektif", percentage: 6 }, { label: "Efektif", percentage: 14 }, { label: "Netral", percentage: 22 }, { label: "Kurang Efektif", percentage: 34 }, { label: "Tidak Efektif", percentage: 24 }], totalVotes: 2450 },
  ],
  "ketenagakerjaan": [
    { question: "Apakah UU Cipta Kerja sudah melindungi hak-hak pekerja secara memadai?", options: [{ label: "Sangat Memadai", percentage: 10 }, { label: "Memadai", percentage: 18 }, { label: "Netral", percentage: 22 }, { label: "Kurang Memadai", percentage: 30 }, { label: "Tidak Memadai", percentage: 20 }], totalVotes: 5680 },
    { question: "Setujukah Anda dengan sistem outsourcing di Indonesia saat ini?", options: [{ label: "Sangat Setuju", percentage: 8 }, { label: "Setuju", percentage: 15 }, { label: "Netral", percentage: 20 }, { label: "Tidak Setuju", percentage: 32 }, { label: "Sangat Tidak Setuju", percentage: 25 }], totalVotes: 4320 },
    { question: "Apakah upah minimum regional saat ini sudah layak untuk pekerja?", options: [{ label: "Sangat Layak", percentage: 5 }, { label: "Layak", percentage: 15 }, { label: "Netral", percentage: 20 }, { label: "Kurang Layak", percentage: 35 }, { label: "Tidak Layak", percentage: 25 }], totalVotes: 6150 },
  ],
  "opini": [
    { question: "Apakah media di Indonesia sudah cukup independen dalam memberitakan isu hukum?", options: [{ label: "Sangat Independen", percentage: 10 }, { label: "Independen", percentage: 22 }, { label: "Netral", percentage: 25 }, { label: "Kurang Independen", percentage: 28 }, { label: "Tidak Independen", percentage: 15 }], totalVotes: 2940 },
    { question: "Perlukah kolom opini hukum wajib memuat disclaimer?", options: [{ label: "Sangat Perlu", percentage: 42 }, { label: "Perlu", percentage: 30 }, { label: "Netral", percentage: 15 }, { label: "Tidak Perlu", percentage: 9 }, { label: "Sangat Tidak Perlu", percentage: 4 }], totalVotes: 1870 },
    { question: "Apakah trial by media (penghakiman oleh media) semakin parah di Indonesia?", options: [{ label: "Sangat Parah", percentage: 38 }, { label: "Parah", percentage: 28 }, { label: "Netral", percentage: 18 }, { label: "Tidak Parah", percentage: 12 }, { label: "Sangat Tidak Parah", percentage: 4 }], totalVotes: 3650 },
  ],
  "berita-bandung": [
    { question: "Bagaimana penilaian Anda terhadap penegakan hukum di Kota Bandung saat ini?", options: [{ label: "Sangat Baik", percentage: 12 }, { label: "Baik", percentage: 28 }, { label: "Cukup", percentage: 30 }, { label: "Buruk", percentage: 20 }, { label: "Sangat Buruk", percentage: 10 }], totalVotes: 4350 },
    { question: "Apakah akses bantuan hukum gratis di Bandung sudah memadai?", options: [{ label: "Sangat Memadai", percentage: 8 }, { label: "Memadai", percentage: 20 }, { label: "Netral", percentage: 25 }, { label: "Kurang Memadai", percentage: 30 }, { label: "Tidak Memadai", percentage: 17 }], totalVotes: 2680 },
    { question: "Perlukah Pengadilan Khusus Korupsi (Tipikor) di Bandung ditambah kapasitasnya?", options: [{ label: "Sangat Perlu", percentage: 45 }, { label: "Perlu", percentage: 28 }, { label: "Netral", percentage: 14 }, { label: "Tidak Perlu", percentage: 9 }, { label: "Sangat Tidak Perlu", percentage: 4 }], totalVotes: 3920 },
  ],
  "infografis": [
    { question: "Format konten hukum apa yang paling Anda sukai?", options: [{ label: "Infografis Visual", percentage: 42 }, { label: "Artikel Panjang", percentage: 20 }, { label: "Video Pendek", percentage: 22 }, { label: "Podcast", percentage: 10 }, { label: "Thread/Ringkasan", percentage: 6 }], totalVotes: 1580 },
    { question: "Apakah infografis membantu Anda memahami isu hukum yang kompleks?", options: [{ label: "Sangat Membantu", percentage: 52 }, { label: "Membantu", percentage: 28 }, { label: "Netral", percentage: 12 }, { label: "Kurang Membantu", percentage: 5 }, { label: "Tidak Membantu", percentage: 3 }], totalVotes: 2140 },
    { question: "Topik infografis hukum apa yang paling Anda butuhkan?", options: [{ label: "Alur Peradilan", percentage: 35 }, { label: "Data Statistik Kasus", percentage: 28 }, { label: "Perbandingan UU", percentage: 18 }, { label: "Profil Lembaga", percentage: 12 }, { label: "Peta Sebaran Kasus", percentage: 7 }], totalVotes: 1320 },
  ],
};
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

async function getCategory(slug: string) {
  return prisma.category.findUnique({ where: { slug } });
}

export async function generateMetadata({ params: paramsPromise }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await paramsPromise;
  const category = await getCategory(params.slug);
  if (!category) return { title: "Kategori Tidak Ditemukan" };

  const title = `${category.name} - Berita Terkini`;
  const description = `Kumpulan berita ${category.name.toLowerCase()} terbaru dari Kartawarta — portal berita digital Bandung & Jawa Barat. Menyajikan liputan terpercaya dan terverifikasi Dewan Pers.`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | Kartawarta`,
      description,
      type: "website",
      locale: "id_ID",
      siteName: "Kartawarta",
      images: [{ url: "/kartawarta-icon.png", width: 512, height: 512, alt: "Kartawarta" }],
    },
    alternates: {
      canonical: `/kategori/${params.slug}`,
    },
  };
}

export default async function CategoryPage({ params: paramsPromise }: { params: Promise<{ slug: string }> }) {
  const params = await paramsPromise;
  const category = await getCategory(params.slug);
  if (!category) notFound();

  const [articles, trendingArticles] = await Promise.all([
    prisma.article.findMany({
      where: { status: "PUBLISHED", categoryId: category.id },
      include: { author: true, category: true },
      orderBy: { publishedAt: "desc" },
      take: 20,
    }),
    prisma.article.findMany({
      where: { status: "PUBLISHED" },
      include: { category: true },
      orderBy: { viewCount: "desc" },
      take: 5,
    }),
  ]);

  const sidebarTrending = trendingArticles.map((a) => ({
    title: a.title,
    slug: a.slug,
    category: a.category.name,
    publishedAt: a.publishedAt
      ? new Date(a.publishedAt).toLocaleDateString("id-ID")
      : "",
    viewCount: a.viewCount,
  }));

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";
  // CollectionPage + ItemList so crawlers see what's in this category, plus a
  // sibling BreadcrumbList script for rich-result eligibility.
  const categoryJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.name} — Kartawarta`,
    description: category.description || `Berita ${category.name} terbaru dari Kartawarta.`,
    url: `${siteUrl}/kategori/${category.slug}`,
    isPartOf: { "@type": "WebSite", name: "Kartawarta", url: siteUrl },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: articles.length,
      itemListElement: articles.map((a: { slug: string; title: string }, i: number) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${siteUrl}/berita/${a.slug}`,
        name: a.title,
      })),
    },
  };
  const categoryBreadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Beranda", item: siteUrl },
      { "@type": "ListItem", position: 2, name: category.name, item: `${siteUrl}/kategori/${category.slug}` },
    ],
  };

  return (
    <div className="bg-surface min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryBreadcrumbJsonLd) }} />
      <div className="container-main py-6 sm:py-8 lg:py-10 2xl:py-14">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-txt-muted">
          <Link href="/" className="hover:text-primary">Beranda</Link>
          <ChevronRight size={14} />
          <span className="font-medium text-txt-primary">{category.name}</span>
        </nav>

        <div className="mb-6">
          <h1 className="flex items-center gap-3 font-serif text-headline-sm font-bold text-txt-primary sm:text-headline-md lg:text-headline-lg">
            <span className="block h-7 w-[3px] rounded-full bg-primary" />
            {category.name}
          </h1>
          <p className="mt-1 text-sm text-txt-muted">
            Kumpulan berita {category.name.toLowerCase()} terbaru dan terpercaya
          </p>
        </div>

        {/* Banner Ad — Leaderboard */}
        <div className="mb-6">
          <BannerAd slot="HEADER" />
        </div>

        {/* Headline slider */}
        {articles.length >= 3 && (
          <div className="mb-6">
            <HeadlineSlider items={JSON.parse(JSON.stringify(articles.slice(0, 5)))} />
          </div>
        )}

        {/* Sub-headline slider — crossfade like headline */}
        {articles.length >= 7 && (
          <div className="mb-6">
            <SubHeadlineSlider items={JSON.parse(JSON.stringify(articles.slice(5, 11)))} />
          </div>
        )}

        {/* Polling — right below headline */}
        {categoryPolling[params.slug] && (
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <h2 className="border-l-[3px] border-primary pl-3 text-lg font-bold text-txt-primary flex items-center">
                <Vote size={18} className="mr-2 text-primary" />
                Polling {category.name}
              </h2>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
              {categoryPolling[params.slug].map((poll, idx) => (
                <div key={idx} className="shrink-0 w-[300px] sm:w-[340px] rounded-[12px] border border-border bg-surface-secondary overflow-hidden">
                  {poll.image && (
                    <div className="relative w-full aspect-[2/1]">
                      <Image src={poll.image} alt={poll.question} fill className="object-cover" />
                    </div>
                  )}
                  <div className="p-5">
                  <p className="text-sm font-semibold text-txt-primary mb-4">{poll.question}</p>
                  <div className="space-y-2.5">
                    {poll.options.map((opt) => (
                      <div key={opt.label}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-txt-primary text-xs">{opt.label}</span>
                          <span className="font-bold text-txt-primary text-xs">{opt.percentage}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-border">
                          <div className="h-1.5 rounded-full bg-primary" style={{ width: `${opt.percentage}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-txt-muted mt-3">{poll.totalVotes.toLocaleString("id-ID")} suara</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Banner Ad — below polling */}
        <div className="mb-6">
          <BannerAd slot="BETWEEN_SECTIONS" />
        </div>

        {/* Video Story */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="border-l-[3px] border-primary pl-3 text-lg font-bold text-txt-primary flex items-center">
              Video Story
            </h2>
            <Link href="/video" className="text-sm font-medium text-primary hover:underline">
              Lihat Semua &rarr;
            </Link>
          </div>
          <VideoStory items={videoStoryData} />
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {/* Section header */}
            <div className="mb-5">
              <h2 className="border-l-[3px] border-primary pl-3 text-lg font-bold text-txt-primary">
                Berita Terkini {category.name}
              </h2>
            </div>
            {/* Articles grid — paginated, 6 per page */}
            <PaginatedArticles articles={JSON.parse(JSON.stringify(articles.slice(11)))} perPage={6} />

            {articles.length === 0 && (
              <div className="rounded-[12px] border-2 border-dashed border-border py-16 text-center">
                <p className="text-txt-muted">Belum ada artikel di kategori ini.</p>
              </div>
            )}
          </div>

          <div className="lg:col-span-1 flex flex-col">
            <Sidebar trending={sidebarTrending} />
            <div className="mt-5">
              <SidebarAd />
            </div>
          </div>
        </div>

        {/* Banner Ad — Bottom full width */}
        <div className="mt-8">
          <BannerAd slot="IN_ARTICLE" />
        </div>

        {/* Semua Berita — searchable list view */}
        <section className="mt-8">
          <div className="mb-5">
            <h2 className="border-l-[3px] border-primary pl-3 text-lg font-bold text-txt-primary">
              Semua Berita {category.name}
            </h2>
          </div>
          <SearchableArticleList
            articles={JSON.parse(JSON.stringify(articles))}
            categoryName={category.name.toLowerCase()}
          />
        </section>

        {/* Banner Ad — paling bawah */}
        <div className="mt-8">
          <BannerAd slot="FOOTER" />
        </div>
      </div>
    </div>
  );
}
