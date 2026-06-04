import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, BookOpen, Tag as TagIcon } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";

export const revalidate = 300;

const RANAH_LABEL: Record<string, string> = {
  PIDANA: "Pidana",
  PERDATA: "Perdata",
  HTN: "Hukum Tata Negara",
  HI: "Hukum Internasional",
  PROSEDUR: "Hukum Acara",
  UMUM: "Umum",
};

export async function generateMetadata({ params: paramsPromise }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await paramsPromise;
  const item = await prisma.glossary.findUnique({
    where: { slug: params.slug },
    select: { istilah: true, singkatan: true, ranah: true, bodyHtml: true },
  });
  if (!item) return { title: "Istilah tidak ditemukan | Kartawarta" };

  // Extract first sentence from HTML for description
  const text = item.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const description = text.slice(0, 155).replace(/\s+\S*$/, "") + "...";

  const title = item.singkatan
    ? `${item.istilah} (${item.singkatan})`
    : item.istilah;

  return {
    title: `${title} | Glossary Hukum Kartawarta`,
    description,
    alternates: { canonical: `https://kartawarta.com/glossary/${params.slug}` },
    openGraph: {
      title,
      description,
      type: "article",
      url: `https://kartawarta.com/glossary/${params.slug}`,
    },
  };
}

export default async function GlossaryDetailPage({ params: paramsPromise }: { params: Promise<{ slug: string }> }) {
  const params = await paramsPromise;
  const item = await prisma.glossary.findUnique({
    where: { slug: params.slug, isPublished: true },
  });

  if (!item) notFound();

  // Resolve related glossary slugs to actual data
  const related = item.related?.length
    ? await prisma.glossary.findMany({
        where: { slug: { in: item.related }, isPublished: true },
        select: { slug: true, istilah: true, singkatan: true },
      })
    : [];

  // Increment view count async (non-blocking)
  void prisma.glossary
    .update({ where: { id: item.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "DefinedTerm",
            name: item.istilah,
            ...(item.singkatan && { alternateName: item.singkatan }),
            inDefinedTermSet: {
              "@type": "DefinedTermSet",
              name: "Glossary Hukum Kartawarta",
              url: "https://kartawarta.com/glossary",
            },
            url: `https://kartawarta.com/glossary/${item.slug}`,
            description: item.bodyHtml.replace(/<[^>]+>/g, " ").slice(0, 300),
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://kartawarta.com" },
              { "@type": "ListItem", position: 2, name: "Glossary", item: "https://kartawarta.com/glossary" },
              {
                "@type": "ListItem",
                position: 3,
                name: item.istilah,
                item: `https://kartawarta.com/glossary/${item.slug}`,
              },
            ],
          }),
        }}
      />

      <main className="bg-surface min-h-screen py-10">
        <div className="container-main max-w-4xl">
          {/* Back link */}
          <Link
            href="/glossary"
            className="mb-6 inline-flex items-center gap-1.5 text-label-md uppercase tracking-wider text-primary hover:text-primary-dark"
          >
            <ArrowLeft size={14} />
            Kembali ke Glossary
          </Link>

          {/* Header */}
          <header className="mb-8 border-b border-outline-variant/40 pb-8">
            <div className="mb-3 flex items-center gap-2 text-label-md uppercase tracking-wider">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-primary font-semibold">
                {RANAH_LABEL[item.ranah]}
              </span>
              {item.singkatan && (
                <span className="text-on-surface-variant">/ {item.singkatan}</span>
              )}
            </div>
            <h1 className="font-serif text-display-sm text-on-surface">{item.istilah}</h1>
            {item.bahasaAsli && (
              <p className="mt-2 italic text-body-md text-on-surface-variant">
                {item.bahasaAsli}
              </p>
            )}
            {item.tags && item.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <TagIcon size={14} className="text-on-surface-variant/50" />
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-lg bg-surface-container-low px-2 py-0.5 text-label-sm text-on-surface-variant"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </header>

          {/* Body — defense-in-depth re-sanitize even though Obsidian sync already sanitizes on save */}
          <article
            className="article-content"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.bodyHtml) }}
          />

          {/* Related */}
          {related.length > 0 && (
            <section className="mt-12 border-t border-outline-variant/40 pt-8">
              <h2 className="mb-4 flex items-center gap-2 font-serif text-headline-sm text-on-surface">
                <BookOpen size={18} className="text-primary" />
                Lihat Juga
              </h2>
              <ul className="space-y-2">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/glossary/${r.slug}`}
                      className="text-body-md text-primary hover:underline"
                    >
                      {r.istilah}
                      {r.singkatan && (
                        <span className="ml-1 text-on-surface-variant">({r.singkatan})</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Footer disclaimer */}
          <div className="mt-12 rounded-md bg-primary/5 p-4 text-body-sm text-on-surface-variant">
            Definisi di sini adalah ringkasan untuk pembaca awam. Untuk konsultasi hukum
            profesional, hubungi advokat berlisensi.
          </div>
        </div>
      </main>
    </>
  );
}
