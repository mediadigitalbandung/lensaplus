import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  Users,
  ChevronLeft,
  Calendar,
  Building2,
  Globe,
  Twitter,
  Instagram,
  Briefcase,
  GraduationCap,
  Flag,
} from "lucide-react";
import type { OfficialLevel, OfficialStatus } from "@prisma/client";

export const revalidate = 600;

const LEVEL_LABELS: Record<OfficialLevel, string> = {
  NASIONAL: "Nasional",
  PROVINSI: "Provinsi",
  KOTA_KABUPATEN: "Kota/Kabupaten",
  KECAMATAN: "Kecamatan",
  YUDIKATIF: "Yudikatif",
  LEMBAGA: "Lembaga",
  OTHER: "Lainnya",
};

const LEVEL_COLORS: Record<OfficialLevel, string> = {
  NASIONAL: "bg-blue-100 text-blue-800",
  PROVINSI: "bg-violet-100 text-violet-800",
  KOTA_KABUPATEN: "bg-primary-light text-primary",
  KECAMATAN: "bg-teal-100 text-teal-800",
  YUDIKATIF: "bg-red-100 text-red-800",
  LEMBAGA: "bg-amber-100 text-amber-800",
  OTHER: "bg-surface-tertiary text-txt-secondary",
};

const STATUS_LABELS: Record<OfficialStatus, string> = {
  AKTIF: "Aktif",
  PURNA: "Purna",
  CUTI: "Cuti",
  NONAKTIF: "Nonaktif",
};

const STATUS_COLORS: Record<OfficialStatus, string> = {
  AKTIF: "bg-primary-light text-primary border border-primary/20",
  PURNA: "bg-surface-secondary text-txt-muted border border-border",
  CUTI: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  NONAKTIF: "bg-red-50 text-red-700 border border-red-200",
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const official = await prisma.publicOfficial.findFirst({
    where: { slug, isPublished: true },
    select: { name: true, position: true, institution: true, bio: true, region: true },
  });
  if (!official) return { title: "Pejabat tidak ditemukan | Kartawarta" };

  const pageTitle = `${official.name} — ${official.position} | Kartawarta`;
  const description =
    official.bio?.slice(0, 160) ||
    `Profil ${official.position} ${official.institution}${official.region ? `, ${official.region}` : ""}.`;

  return {
    title: pageTitle,
    description,
    openGraph: { title: pageTitle, description },
  };
}

export default async function PejabatDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const official = await prisma.publicOfficial.findFirst({
    where: { slug, isPublished: true },
  });

  if (!official) notFound();

  // Fire-and-forget viewCount
  prisma.publicOfficial
    .update({ where: { id: official.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  // Related articles — search by official name in title
  const relatedArticles = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      title: { contains: official.name, mode: "insensitive" },
    },
    select: { slug: true, title: true, publishedAt: true, featuredImage: true, excerpt: true },
    orderBy: { publishedAt: "desc" },
    take: 5,
  });

  // JSON-LD Person + GovernmentOrganization
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: official.fullName || official.name,
    jobTitle: official.position,
    worksFor: {
      "@type": "GovernmentOrganization",
      name: official.institution,
    },
    ...(official.birthdate && {
      birthDate: official.birthdate.toISOString().split("T")[0],
    }),
    ...(official.birthplace && { birthPlace: official.birthplace }),
    ...(official.websiteUrl && { url: official.websiteUrl }),
    ...(official.twitterHandle && {
      sameAs: `https://twitter.com/${official.twitterHandle.replace(/^@/, "")}`,
    }),
    description: official.bio?.slice(0, 500) || `${official.position} di ${official.institution}`,
    image: official.photoUrl || undefined,
  };

  const fmt = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="container-main py-8 sm:py-12">
        {/* Breadcrumb */}
        <nav
          className="mb-6 flex items-center gap-2 text-sm text-txt-muted"
          aria-label="Breadcrumb"
        >
          <Link href="/" className="hover:text-primary transition-colors">
            Beranda
          </Link>
          <span>/</span>
          <Link href="/pejabat" className="hover:text-primary transition-colors">
            Pejabat
          </Link>
          <span>/</span>
          <span className="text-txt-primary line-clamp-1 max-w-xs">
            {official.name}
          </span>
        </nav>

        <div className="mx-auto max-w-4xl">
          <Link
            href="/pejabat"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-txt-secondary hover:text-primary transition-colors"
          >
            <ChevronLeft size={16} /> Kembali ke Direktori Pejabat
          </Link>

          {/* Hero card */}
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-card mb-6">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              {/* Photo / initials */}
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-light shadow-md">
                {official.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={official.photoUrl}
                    alt={official.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-bold text-primary">
                    {official.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Identity */}
              <div className="flex-1 text-center sm:text-left">
                {/* Badges */}
                <div className="mb-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${LEVEL_COLORS[official.level]}`}
                  >
                    {LEVEL_LABELS[official.level]}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLORS[official.status]}`}
                  >
                    {STATUS_LABELS[official.status]}
                  </span>
                </div>

                <h1 className="font-serif text-headline-sm sm:text-headline-md text-txt-primary leading-snug">
                  {official.fullName || official.name}
                </h1>
                <p className="mt-1 text-body-lg font-medium text-primary">
                  {official.position}
                </p>
                <p className="mt-0.5 text-body-md text-txt-secondary">
                  {official.institution}
                  {official.region && (
                    <span className="text-txt-muted"> — {official.region}</span>
                  )}
                </p>

                {/* Social links */}
                <div className="mt-3 flex flex-wrap justify-center gap-3 sm:justify-start">
                  {official.websiteUrl && (
                    <a
                      href={official.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-txt-secondary hover:text-primary transition-colors"
                    >
                      <Globe size={14} /> Website
                    </a>
                  )}
                  {official.twitterHandle && (
                    <a
                      href={`https://twitter.com/${official.twitterHandle.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-txt-secondary hover:text-primary transition-colors"
                    >
                      <Twitter size={14} /> @{official.twitterHandle.replace(/^@/, "")}
                    </a>
                  )}
                  {official.instagramHandle && (
                    <a
                      href={`https://instagram.com/${official.instagramHandle.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-txt-secondary hover:text-primary transition-colors"
                    >
                      <Instagram size={14} /> @{official.instagramHandle.replace(/^@/, "")}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Meta grid */}
            <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 pt-6 border-t border-border text-sm">
              {official.termStart && (
                <div className="flex items-start gap-2">
                  <Calendar size={14} className="text-txt-muted shrink-0 mt-0.5" />
                  <div>
                    <dt className="text-xs font-semibold text-txt-muted uppercase tracking-wide">
                      Mulai Jabatan
                    </dt>
                    <dd className="text-txt-primary">
                      {fmt.format(new Date(official.termStart))}
                    </dd>
                  </div>
                </div>
              )}
              {official.termEnd && (
                <div className="flex items-start gap-2">
                  <Calendar size={14} className="text-txt-muted shrink-0 mt-0.5" />
                  <div>
                    <dt className="text-xs font-semibold text-txt-muted uppercase tracking-wide">
                      Akhir Jabatan
                    </dt>
                    <dd className="text-txt-primary">
                      {fmt.format(new Date(official.termEnd))}
                    </dd>
                  </div>
                </div>
              )}
              {official.party && (
                <div className="flex items-start gap-2">
                  <Flag size={14} className="text-txt-muted shrink-0 mt-0.5" />
                  <div>
                    <dt className="text-xs font-semibold text-txt-muted uppercase tracking-wide">
                      Partai
                    </dt>
                    <dd className="text-txt-primary">{official.party}</dd>
                  </div>
                </div>
              )}
              {official.birthplace && (
                <div className="flex items-start gap-2">
                  <Building2 size={14} className="text-txt-muted shrink-0 mt-0.5" />
                  <div>
                    <dt className="text-xs font-semibold text-txt-muted uppercase tracking-wide">
                      Tempat Lahir
                    </dt>
                    <dd className="text-txt-primary">
                      {official.birthplace}
                      {official.birthdate && (
                        <span className="text-txt-muted">
                          , {fmt.format(new Date(official.birthdate))}
                        </span>
                      )}
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </div>

          {/* Bio */}
          {official.bio && (
            <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-card mb-6">
              <h2 className="flex items-center gap-2 text-title-md font-semibold text-txt-primary mb-4">
                <Users size={18} className="text-primary" />
                Biografi
              </h2>
              <div className="text-body-md text-txt-secondary leading-relaxed whitespace-pre-wrap">
                {official.bio}
              </div>
            </div>
          )}

          {/* Education */}
          {official.education && (
            <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-card mb-6">
              <h2 className="flex items-center gap-2 text-title-md font-semibold text-txt-primary mb-4">
                <GraduationCap size={18} className="text-primary" />
                Pendidikan
              </h2>
              <div className="text-body-md text-txt-secondary leading-relaxed whitespace-pre-wrap">
                {official.education}
              </div>
            </div>
          )}

          {/* Career */}
          {official.career && (
            <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-card mb-6">
              <h2 className="flex items-center gap-2 text-title-md font-semibold text-txt-primary mb-4">
                <Briefcase size={18} className="text-primary" />
                Riwayat Karier
              </h2>
              <div className="text-body-md text-txt-secondary leading-relaxed whitespace-pre-wrap">
                {official.career}
              </div>
            </div>
          )}

          {/* Related articles */}
          {relatedArticles.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-card">
              <h2 className="text-title-md font-semibold text-txt-primary mb-4">
                Berita Terkait
              </h2>
              <div className="space-y-4">
                {relatedArticles.map((article) => (
                  <article
                    key={article.slug}
                    className="flex gap-3 pb-4 border-b border-border last:border-b-0 last:pb-0"
                  >
                    {article.featuredImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={article.featuredImage}
                        alt=""
                        className="h-16 w-24 shrink-0 rounded-md object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/artikel/${article.slug}`}
                        className="text-body-md font-semibold text-txt-primary hover:text-primary transition-colors line-clamp-2"
                      >
                        {article.title}
                      </Link>
                      {article.publishedAt && (
                        <p className="mt-1 text-xs text-txt-muted">
                          {fmt.format(new Date(article.publishedAt))}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
