export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";
import { ChevronRight, CalendarDays, Newspaper } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Rangkuman Harian",
  description:
    "Arsip rangkuman berita harian Kartawarta — pilih tanggal untuk membaca ringkasan berita pada hari tersebut.",
  openGraph: {
    title: "Rangkuman Harian - Kartawarta",
    description: "Arsip rangkuman berita per tanggal.",
    type: "website",
  },
  alternates: { canonical: "/rangkuman/harian" },
};

function dayKey(d: Date): string {
  // YYYY-MM-DD in local timezone
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function RangkumanHarianIndexPage() {
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const articles = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { gte: since },
    },
    select: {
      slug: true,
      title: true,
      featuredImage: true,
      publishedAt: true,
    },
    orderBy: { publishedAt: "desc" },
  });

  // Group by date key
  const byDay = new Map<
    string,
    { date: Date; count: number; image: string | null; firstTitle: string }
  >();
  for (const a of articles) {
    if (!a.publishedAt) continue;
    const d = new Date(a.publishedAt);
    const key = dayKey(d);
    const existing = byDay.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.image && a.featuredImage) existing.image = a.featuredImage;
    } else {
      byDay.set(key, {
        date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        count: 1,
        image: a.featuredImage ?? null,
        firstTitle: a.title,
      });
    }
  }

  const days = Array.from(byDay.entries())
    .map(([key, val]) => ({ key, ...val }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="bg-surface min-h-screen">
      <div className="container-main py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-txt-muted">
          <Link href="/" className="hover:text-primary">Beranda</Link>
          <ChevronRight size={14} />
          <Link href="/rangkuman" className="hover:text-primary">Rangkuman</Link>
          <ChevronRight size={14} />
          <span className="font-medium text-txt-primary">Harian</span>
        </nav>

        <div className="mb-8 max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="block h-7 w-[3px] rounded-full bg-primary" />
            <h1 className="flex items-center gap-2 text-xl font-bold text-txt-primary sm:text-2xl lg:text-3xl">
              <CalendarDays size={22} className="text-primary" />
              Rangkuman Harian
            </h1>
          </div>
          <p className="mt-3 text-sm text-on-surface-variant">
            Arsip ringkasan berita per tanggal. Klik salah satu tanggal di bawah untuk membaca
            kumpulan artikel yang terbit di hari tersebut.
          </p>
        </div>

        {days.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {days.map((day) => (
              <Link
                key={day.key}
                href={`/rangkuman/harian/${day.key}`}
                className="card group flex h-full flex-col overflow-hidden"
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-container">
                  {day.image ? (
                    <Image
                      src={day.image}
                      alt={fmtDay(day.date)}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-primary/5">
                      <CalendarDays size={36} className="text-primary/30" />
                    </div>
                  )}
                  <div className="absolute left-3 top-3 rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-white shadow">
                    {day.date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-label-sm uppercase tracking-wider text-primary font-semibold">
                    {fmtDay(day.date)}
                  </p>
                  <p className="mt-2 line-clamp-2 font-serif text-title-md leading-snug text-on-surface group-hover:text-primary transition-colors">
                    {day.firstTitle}
                  </p>
                  <div className="mt-auto pt-4 flex items-center gap-1.5 text-xs uppercase tracking-wider text-on-surface-variant">
                    <Newspaper size={12} />
                    {day.count.toLocaleString("id-ID")} artikel
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-border py-16 text-center">
            <CalendarDays size={36} className="mx-auto text-border" />
            <p className="mt-4 text-on-surface-variant">Belum ada arsip rangkuman harian.</p>
            <p className="text-sm text-txt-muted">Arsip akan terisi otomatis seiring artikel diterbitkan.</p>
          </div>
        )}
      </div>
    </div>
  );
}
