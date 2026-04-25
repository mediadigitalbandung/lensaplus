export const dynamic = "force-dynamic";

import Link from "next/link";
import { Metadata } from "next";
import {
  ChevronRight,
  Compass,
  Scale,
  Briefcase,
  Trophy,
  Film,
  Heart,
  Wheat,
  Cpu,
  Vote as VoteIcon,
  GraduationCap,
  Leaf,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Topik",
  description:
    "Telusuri seluruh topik dan kategori berita di Kartawarta — hukum, bisnis, politik, lingkungan, dan banyak lagi.",
  openGraph: {
    title: "Topik - Kartawarta",
    description: "Telusuri seluruh topik berita di Kartawarta.",
    type: "website",
  },
  alternates: { canonical: "/topik" },
};

const categoryIconMap: Record<string, LucideIcon> = {
  "hukum": Scale,
  "hukum-pidana": Scale,
  "hukum-perdata": Scale,
  "hukum-tata-negara": Scale,
  "hukum-bisnis": Briefcase,
  "hukum-lingkungan": Leaf,
  "ham": Heart,
  "ketenagakerjaan": Briefcase,
  "bisnis-ekonomi": Briefcase,
  "olahraga": Trophy,
  "hiburan": Film,
  "kesehatan": Heart,
  "pertanian-peternakan": Wheat,
  "teknologi": Cpu,
  "politik": VoteIcon,
  "pendidikan": GraduationCap,
  "lingkungan": Leaf,
  "gaya-hidup": Compass,
  "opini": BookOpen,
  "berita-bandung": Compass,
  "infografis": BookOpen,
};

export default async function TopikIndexPage() {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { articles: true } } },
    orderBy: { order: "asc" },
  });

  return (
    <div className="bg-surface min-h-screen">
      <div className="container-main py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-txt-muted">
          <Link href="/" className="hover:text-primary">Beranda</Link>
          <ChevronRight size={14} />
          <span className="font-medium text-txt-primary">Topik</span>
        </nav>

        <div className="mb-8 max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="block h-7 w-[3px] rounded-full bg-primary" />
            <h1 className="flex items-center gap-2 text-xl font-bold text-txt-primary sm:text-2xl lg:text-3xl">
              <Compass size={22} className="text-primary" />
              Telusuri Topik
            </h1>
          </div>
          <p className="mt-3 text-sm text-on-surface-variant">
            Pilih topik di bawah ini untuk membaca berita berdasarkan kategori. Kartawarta
            mengelompokkan liputan berdasarkan ranah hukum, isu sosial, dan tema editorial
            agar pembaca lebih mudah mengikuti perkembangan.
          </p>
        </div>

        {categories.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((cat) => {
              const Icon = categoryIconMap[cat.slug] || Compass;
              return (
                <Link
                  key={cat.slug}
                  href={`/topik/${cat.slug}`}
                  className="group flex h-full flex-col gap-3 rounded-[12px] border border-border bg-surface-container-lowest p-5 shadow-card transition-all hover:border-primary hover:shadow-card-hover hover:-translate-y-0.5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/10 group-hover:from-primary/25 group-hover:to-primary/10 transition-all">
                    <Icon size={20} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h2 className="font-serif text-title-md text-on-surface group-hover:text-primary transition-colors">
                      {cat.name}
                    </h2>
                    <p className="mt-1 text-label-sm uppercase tracking-wider text-on-surface-variant">
                      {cat._count.articles.toLocaleString("id-ID")} artikel
                    </p>
                  </div>
                  {cat.description && (
                    <p className="line-clamp-2 text-sm text-on-surface-variant">
                      {cat.description}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[12px] border-2 border-dashed border-border py-16 text-center">
            <Compass size={36} className="mx-auto text-border" />
            <p className="mt-4 text-on-surface-variant">Belum ada topik tersedia.</p>
          </div>
        )}
      </div>
    </div>
  );
}
