import Link from "next/link";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Scale, Gavel, Building2, Globe2, FileText, BookOpen, Search } from "lucide-react";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";

export const revalidate = 300; // 5 min ISR

export const metadata: Metadata = {
  title: "Glossary Hukum | Kartawarta",
  description:
    "Daftar istilah hukum yang sering muncul di pemberitaan Kartawarta. Dari Tipikor hingga Restorative Justice — definisi singkat, dasar hukum, dan konteks.",
  alternates: { canonical: "https://kartawarta.com/glossary" },
};

const RANAH_LABEL: Record<string, string> = {
  PIDANA: "Pidana",
  PERDATA: "Perdata",
  HTN: "Hukum Tata Negara",
  HI: "Hukum Internasional",
  PROSEDUR: "Hukum Acara",
  UMUM: "Umum",
};

import type { LucideIcon } from "lucide-react";
const RANAH_ICON: Record<string, LucideIcon> = {
  PIDANA: Gavel,
  PERDATA: FileText,
  HTN: Building2,
  HI: Globe2,
  PROSEDUR: Scale,
  UMUM: BookOpen,
};

export default async function GlossaryPage() {
  const items = await prisma.glossary.findMany({
    where: { isPublished: true },
    orderBy: [{ ranah: "asc" }, { istilah: "asc" }],
    select: {
      slug: true,
      istilah: true,
      singkatan: true,
      ranah: true,
      tags: true,
    },
  });

  // Group by ranah
  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    if (!acc[item.ranah]) acc[item.ranah] = [];
    acc[item.ranah].push(item);
    return acc;
  }, {});

  const ranahOrder = ["PIDANA", "PERDATA", "HTN", "HI", "PROSEDUR", "UMUM"];

  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Beranda", url: "/" },
    { name: "Glossary", url: "/glossary" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "DefinedTermSet",
            name: "Glossary Hukum Kartawarta",
            url: "https://kartawarta.com/glossary",
            description: metadata.description,
            hasDefinedTerm: items.map((i) => ({
              "@type": "DefinedTerm",
              name: i.istilah,
              url: `https://kartawarta.com/glossary/${i.slug}`,
            })),
          }),
        }}
      />

      <main className="bg-surface min-h-screen py-8 sm:py-10 lg:py-14 2xl:py-20">
        <div className="container-main">
          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
                <BookOpen size={20} strokeWidth={2.2} />
              </div>
              <span className="text-label-md uppercase tracking-widest text-primary font-bold">
                Glossary
              </span>
            </div>
            <h1 className="font-serif text-display-sm text-on-surface max-w-3xl">
              Istilah Hukum di Pemberitaan Kartawarta
            </h1>
            <p className="mt-4 max-w-2xl text-body-md text-on-surface-variant">
              Definisi singkat istilah hukum yang sering muncul di artikel kami — dari Tipikor
              hingga Restorative Justice. Dasar hukum, contoh kasus, dan salah kaprah umum
              yang patut diketahui pembaca.
            </p>
          </div>

          {/* Stats */}
          <div className="mb-8 flex flex-wrap items-center gap-4 text-label-md uppercase tracking-wider">
            <span className="text-on-surface-variant">
              <strong className="text-on-surface">{items.length}</strong> istilah
            </span>
            <span className="text-on-surface-variant/40">·</span>
            <span className="text-on-surface-variant">
              {ranahOrder.filter((r) => grouped[r]).length} ranah hukum
            </span>
          </div>

          {/* Grouped list */}
          {ranahOrder.map((ranah) => {
            const list = grouped[ranah];
            if (!list || list.length === 0) return null;
            const Icon = RANAH_ICON[ranah] || BookOpen;
            return (
              <section key={ranah} className="mb-12">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon size={16} strokeWidth={2.2} />
                  </div>
                  <h2 className="font-serif text-headline-sm text-on-surface">
                    {RANAH_LABEL[ranah]}
                  </h2>
                  <span className="text-label-md uppercase tracking-wider text-on-surface-variant">
                    {list.length} istilah
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {list.map((item) => (
                    <Link
                      key={item.slug}
                      href={`/glossary/${item.slug}`}
                      className="group block rounded-md border border-outline-variant/40 bg-surface-container-lowest p-4 transition-all hover:border-primary/30 hover:bg-surface-container-low"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-serif text-title-md text-on-surface group-hover:text-primary transition-colors">
                            {item.istilah}
                          </h3>
                          {item.singkatan && (
                            <p className="mt-0.5 text-label-sm uppercase tracking-wider text-on-surface-variant">
                              {item.singkatan}
                            </p>
                          )}
                        </div>
                      </div>
                      {item.tags && item.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-lg bg-primary/5 px-1.5 py-0.5 text-label-sm text-primary/70"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}

          {items.length === 0 && (
            <div className="rounded-md border border-dashed border-outline-variant/60 bg-surface-container-lowest p-10 text-center">
              <Search className="mx-auto mb-3 text-on-surface-variant/40" size={32} />
              <p className="text-body-md text-on-surface-variant">
                Glossary belum tersedia. Tim editorial sedang menyusun daftar istilah hukum.
              </p>
            </div>
          )}

          {/* Footer note */}
          <div className="mt-16 rounded-md bg-primary/5 p-5 text-body-sm text-on-surface-variant">
            <p>
              <strong className="text-on-surface">Catatan</strong> — definisi di sini adalah
              ringkasan untuk pembaca awam. Untuk konsultasi hukum profesional, silakan hubungi
              advokat berlisensi atau lembaga bantuan hukum.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
