export const revalidate = 600;

import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  Clock,
  Globe,
  Building2,
  Gavel,
  Newspaper,
  ExternalLink,
} from "lucide-react";
import ArticleCard from "@/components/artikel/ArticleCard";
import { courtLocations, getCourtLocationBySlug } from "@/data/court-locations";
import { prisma } from "@/lib/prisma";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";

interface PageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return courtLocations.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const court = getCourtLocationBySlug(params.slug);
  if (!court) return { title: "Lokasi Tidak Ditemukan" };
  const ogImage = `/api/og?title=${encodeURIComponent(court.name)}&type=lokasi`;
  return {
    title: court.name,
    description: court.description,
    openGraph: {
      title: `${court.name} - Kartawarta`,
      description: court.description,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: court.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${court.name} - Kartawarta`,
      description: court.description,
      images: [ogImage],
    },
    alternates: { canonical: `/lokasi/${court.slug}` },
  };
}

const TYPE_LABEL: Record<string, string> = {
  PN: "Pengadilan Negeri",
  PA: "Pengadilan Agama",
  PT: "Pengadilan Tinggi",
  PTUN: "Pengadilan Tata Usaha Negara",
  PTA: "Pengadilan Tinggi Agama",
  TIPIKOR: "Pengadilan Tipikor",
  MIL: "Pengadilan Militer",
  MA: "Mahkamah Agung",
};

export default async function LokasiDetailPage({ params }: PageProps) {
  const court = getCourtLocationBySlug(params.slug);
  if (!court) notFound();

  // Upcoming schedules where courtName matches (case-insensitive contains)
  const allUpcoming = await prisma.courtSchedule.findMany({
    where: {
      status: { in: ["SCHEDULED", "LIVE"] },
      scheduledAt: { gte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
    take: 50,
  });
  const upcoming = allUpcoming.filter((s) => {
    const name = s.courtName.toLowerCase();
    return (
      name.includes(court.shortName.toLowerCase()) ||
      name.includes(court.name.toLowerCase())
    );
  });

  // Related articles whose title or content includes the court name
  const relatedArticles = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { title: { contains: court.shortName, mode: "insensitive" } },
        { title: { contains: court.name, mode: "insensitive" } },
        { content: { contains: court.shortName, mode: "insensitive" } },
      ],
    },
    include: { author: true, category: true },
    orderBy: { publishedAt: "desc" },
    take: 6,
  });

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "GovernmentOffice",
    name: court.name,
    description: court.description,
    url: `${siteUrl}/lokasi/${court.slug}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: court.address,
      addressLocality: court.city,
      addressCountry: "ID",
    },
    telephone: court.phone,
    ...(court.email && { email: court.email }),
    ...(court.website && { sameAs: [court.website] }),
    openingHours: court.hours,
  };

  const breadcrumb = breadcrumbJsonLd([
    { name: "Beranda", url: "/" },
    { name: "Lokasi", url: "/lokasi" },
    { name: court.shortName, url: `/lokasi/${court.slug}` },
  ]);

  return (
    <div className="bg-surface min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([jsonLd, breadcrumb]) }}
      />
      <div className="container-main py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-txt-muted">
          <Link href="/" className="hover:text-primary">Beranda</Link>
          <ChevronRight size={14} />
          <Link href="/lokasi" className="hover:text-primary">Lokasi</Link>
          <ChevronRight size={14} />
          <span className="font-medium text-txt-primary truncate">{court.shortName}</span>
        </nav>

        {/* Hero */}
        <header className="mb-8 rounded-[12px] border border-border bg-surface-container-lowest p-6 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <span className="inline-block rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                {TYPE_LABEL[court.type] ?? court.type}
              </span>
              <h1 className="mt-3 flex items-start gap-3 font-serif text-2xl font-bold leading-tight text-on-surface sm:text-3xl">
                <Building2 size={28} className="mt-1 shrink-0 text-primary" />
                {court.name}
              </h1>
              <p className="mt-3 max-w-2xl text-base text-on-surface-variant">
                {court.description}
              </p>
              <p className="mt-4 flex items-start gap-2 text-sm text-on-surface-variant">
                <MapPin size={16} className="mt-0.5 shrink-0 text-primary" />
                {court.address}
              </p>
            </div>
            <a
              href={court.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
              <ExternalLink size={14} />
              Buka di Google Maps
            </a>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            {/* Upcoming schedules */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 border-l-[3px] border-primary pl-3 text-lg font-bold text-on-surface">
                <Gavel size={18} className="text-primary" />
                Jadwal Sidang Mendatang
              </h2>
              {upcoming.length > 0 ? (
                <div className="space-y-3">
                  {upcoming.map((s) => (
                    <article
                      key={s.id}
                      className="rounded-[12px] border border-border bg-surface-container-lowest p-4 shadow-card"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-serif text-title-md leading-snug text-on-surface">
                            {s.caseName}
                          </h3>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                            {s.caseNumber && <span>No. {s.caseNumber}</span>}
                            <span>
                              {s.scheduledAt.toLocaleString("id-ID", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              WIB
                            </span>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                            s.status === "LIVE"
                              ? "bg-secondary text-white"
                              : "bg-primary/10 text-primary border border-primary/20"
                          }`}
                        >
                          {s.status === "LIVE" ? "Berlangsung" : "Terjadwal"}
                        </span>
                      </div>
                    </article>
                  ))}
                  <div className="pt-2">
                    <Link href="/jadwal-sidang" className="text-sm font-semibold text-primary hover:underline">
                      Lihat semua jadwal sidang &rarr;
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="rounded-[12px] border border-dashed border-border bg-surface-container-low p-6 text-sm text-on-surface-variant">
                  Belum ada jadwal sidang yang dipublikasikan untuk pengadilan ini.
                </p>
              )}
            </section>

            {/* Related articles */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 border-l-[3px] border-primary pl-3 text-lg font-bold text-on-surface">
                <Newspaper size={18} className="text-primary" />
                Berita Terkait
              </h2>
              {relatedArticles.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {relatedArticles.map((a) => (
                    <ArticleCard
                      key={a.slug}
                      title={a.title}
                      slug={a.slug}
                      excerpt={a.excerpt}
                      featuredImage={a.featuredImage}
                      category={a.category}
                      author={a.author}
                      publishedAt={a.publishedAt}
                      variant="standard"
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-[12px] border border-dashed border-border bg-surface-container-low p-6 text-sm text-on-surface-variant">
                  Belum ada berita terkait yang ditandai untuk pengadilan ini.
                </p>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-1 space-y-6">
            <div className="rounded-[12px] border border-border bg-surface-container-lowest p-5 shadow-card">
              <h3 className="mb-4 border-l-[3px] border-primary pl-3 text-sm font-bold uppercase tracking-wider text-on-surface">
                Kontak &amp; Operasional
              </h3>
              <ul className="space-y-3 text-sm text-on-surface-variant">
                <li className="flex items-start gap-2">
                  <Phone size={14} className="mt-0.5 shrink-0 text-primary" />
                  <span>{court.phone}</span>
                </li>
                {court.email && (
                  <li className="flex items-start gap-2">
                    <Mail size={14} className="mt-0.5 shrink-0 text-primary" />
                    <a href={`mailto:${court.email}`} className="hover:text-primary">
                      {court.email}
                    </a>
                  </li>
                )}
                {court.website && (
                  <li className="flex items-start gap-2">
                    <Globe size={14} className="mt-0.5 shrink-0 text-primary" />
                    <a
                      href={court.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all hover:text-primary"
                    >
                      {court.website.replace(/^https?:\/\//, "")}
                    </a>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <Clock size={14} className="mt-0.5 shrink-0 text-primary" />
                  <span>{court.hours}</span>
                </li>
              </ul>
            </div>

            <div className="rounded-[12px] border border-border bg-surface-container-lowest p-5 shadow-card">
              <h3 className="mb-3 border-l-[3px] border-primary pl-3 text-sm font-bold uppercase tracking-wider text-on-surface">
                Wilayah Hukum
              </h3>
              <p className="text-sm text-on-surface-variant">{court.jurisdiction}</p>
            </div>

            <div className="rounded-[12px] border border-border bg-surface-container-lowest p-5 shadow-card">
              <h3 className="mb-3 border-l-[3px] border-primary pl-3 text-sm font-bold uppercase tracking-wider text-on-surface">
                Pengadilan Lain
              </h3>
              <ul className="space-y-2 text-sm">
                {courtLocations
                  .filter((c) => c.slug !== court.slug)
                  .slice(0, 6)
                  .map((c) => (
                    <li key={c.slug}>
                      <Link
                        href={`/lokasi/${c.slug}`}
                        className="text-on-surface hover:text-primary transition-colors"
                      >
                        {c.shortName}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
