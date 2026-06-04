export const revalidate = 300;

import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";
import { Newspaper, ChevronRight, CalendarDays, Layers } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Rangkuman",
  description:
    "Rangkuman berita Kartawarta — kumpulan ringkasan harian, mingguan, dan tematik (bisnis, ekonomi, pemerintahan, hukum, olahraga, dan topik lainnya) untuk pembaca yang ingin update cepat.",
  openGraph: {
    title: "Rangkuman - Kartawarta",
    description:
      "Kumpulan ringkasan harian, mingguan, dan tematik berita Bandung & Indonesia.",
    type: "website",
  },
  alternates: { canonical: "/rangkuman" },
};

interface DigestCard {
  slug: string;
  title: string;
  description: string;
  href: string;
  image?: string | null;
  count: number;
  dateRange: string;
}

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function fmtDateRange(from: Date, to: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const fromStr = from.toLocaleDateString("id-ID", opts);
  const toStr = to.toLocaleDateString("id-ID", { ...opts, year: "numeric" });
  return `${fromStr} – ${toStr}`;
}

export default async function RangkumanIndexPage() {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [weekArticles, monthArticles, topCategories] = await Promise.all([
    prisma.article.findMany({
      where: { status: "PUBLISHED", publishedAt: { gte: weekStart } },
      include: { category: true },
      orderBy: { publishedAt: "desc" },
      take: 50,
    }),
    prisma.article.findMany({
      where: { status: "PUBLISHED", publishedAt: { gte: monthStart } },
      include: { category: true },
      orderBy: { publishedAt: "desc" },
      take: 100,
    }),
    prisma.category.findMany({
      include: { _count: { select: { articles: true } } },
      orderBy: { order: "asc" },
      take: 6,
    }),
  ]);

  const cards: DigestCard[] = [];

  cards.push({
    slug: "harian",
    title: "Rangkuman Harian",
    description: "Arsip ringkasan berita per tanggal — cek apa yang terjadi tiap harinya.",
    href: "/rangkuman/harian",
    image: weekArticles[0]?.featuredImage ?? null,
    count: weekArticles.filter((a) => {
      const ad = a.publishedAt ? new Date(a.publishedAt) : null;
      return ad && ad >= last7d;
    }).length,
    dateRange: "Tiap hari",
  });

  cards.push({
    slug: "pekan-ini",
    title: "Rangkuman Pekan Ini",
    description: "Sorotan berita sepekan terakhir di Bandung dan nasional — bisnis, pemerintahan, hukum, dan peristiwa lainnya.",
    href: "/rangkuman/pekan-ini",
    image: weekArticles[1]?.featuredImage ?? weekArticles[0]?.featuredImage ?? null,
    count: weekArticles.length,
    dateRange: fmtDateRange(last7d, now),
  });

  cards.push({
    slug: "bulan-ini",
    title: "Rangkuman Bulan Ini",
    description: "Ringkasan agenda dan peristiwa penting bulan berjalan dari berbagai topik.",
    href: "/rangkuman/bulan-ini",
    image: monthArticles[0]?.featuredImage ?? null,
    count: monthArticles.length,
    dateRange: fmtDateRange(last30d, now),
  });

  // Topical roundups based on top categories
  for (const cat of topCategories.slice(0, 3)) {
    const sample = monthArticles.find((a) => a.category.slug === cat.slug);
    cards.push({
      slug: cat.slug,
      title: `Rangkuman ${cat.name}`,
      description: `Ringkasan berita ${cat.name.toLowerCase()} dalam 30 hari terakhir.`,
      href: `/rangkuman/${cat.slug}`,
      image: sample?.featuredImage ?? null,
      count: monthArticles.filter((a) => a.category.slug === cat.slug).length,
      dateRange: fmtDateRange(last30d, now),
    });
  }

  return (
    <div className="bg-surface min-h-screen">
      <div className="container-main py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-txt-muted">
          <Link href="/" className="hover:text-primary">Beranda</Link>
          <ChevronRight size={14} />
          <span className="font-medium text-txt-primary">Rangkuman</span>
        </nav>

        <div className="mb-8">
          <div className="flex items-center gap-3">
            <span className="block h-7 w-[3px] rounded-full bg-primary" />
            <h1 className="flex items-center gap-2 text-xl font-bold text-txt-primary sm:text-2xl lg:text-3xl">
              <Newspaper size={22} className="text-primary" />
              Rangkuman
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-txt-secondary">
            Kumpulan ringkasan berita Kartawarta — pilih per periode atau per topik untuk
            membaca cepat tanpa kehilangan konteks penting.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.slug}
              href={card.href}
              className="card group flex h-full flex-col overflow-hidden"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-container">
                {card.image ? (
                  <Image
                    src={card.image}
                    alt={card.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary/5">
                    <Layers size={36} className="text-primary/30" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-2 flex items-center gap-2 text-label-sm uppercase tracking-wider text-primary">
                  <CalendarDays size={12} />
                  <span className="font-semibold">{card.dateRange}</span>
                </div>
                <h2 className="font-serif text-title-lg leading-snug text-on-surface group-hover:text-primary transition-colors">
                  {card.title}
                </h2>
                <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">
                  {card.description}
                </p>
                <div className="mt-auto pt-4 text-xs uppercase tracking-wider text-on-surface-variant">
                  {card.count.toLocaleString("id-ID")} artikel terkait
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Empty / placeholder note */}
        <div className="mt-10 rounded-lg border border-dashed border-border bg-surface-container-low p-6 text-center text-sm text-on-surface-variant">
          Lebih banyak rangkuman tematik akan hadir secara berkala. Saran topik?{" "}
          <Link href="/kontak" className="text-primary hover:underline">Kirim ke redaksi</Link>.
        </div>
      </div>
    </div>
  );
}
