export const revalidate = 600;

import Link from "next/link";
import { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Topik",
  description:
    "Telusuri seluruh topik dan kategori berita di Lensaplus — hukum, bisnis, politik, lingkungan, dan banyak lagi.",
  openGraph: {
    title: "Topik - Lensaplus",
    description: "Telusuri seluruh topik berita di Lensaplus.",
    type: "website",
  },
  alternates: { canonical: "/topik" },
};

export default async function TopikIndexPage() {
  let categories: any[] = [];
  try {
    categories = await prisma.category.findMany({
      include: { _count: { select: { articles: true } } },
      orderBy: { order: "asc" },
    });
  } catch {
    categories = [];
  }

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
            <span className="block h-7 w-[3px] rounded-full bg-secondary" />
            <h1 className="text-xl font-bold text-txt-primary sm:text-2xl lg:text-3xl">
              Telusuri Topik
            </h1>
          </div>
          <p className="mt-3 text-sm text-on-surface-variant">
            Pilih topik di bawah ini untuk membaca berita berdasarkan kategori. Lensaplus
            mengelompokkan liputan berdasarkan ranah hukum, isu sosial, dan tema editorial
            agar pembaca lebih mudah mengikuti perkembangan.
          </p>
        </div>

        {categories.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/topik/${cat.slug}`}
                className="group flex h-full flex-col gap-2 rounded-lg border border-border border-t-2 border-t-primary/40 bg-surface-container-lowest p-5 shadow-card transition-all hover:border-primary hover:border-t-primary hover:shadow-card-hover hover:-translate-y-0.5"
              >
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
            ))}
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-border py-16 text-center">
            <p className="text-on-surface-variant">Belum ada topik tersedia.</p>
          </div>
        )}
      </div>
    </div>
  );
}
