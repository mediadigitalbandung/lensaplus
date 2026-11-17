import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ChevronLeft,
  Globe,
  Twitter,
  Instagram,
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

const STATUS_LABELS: Record<OfficialStatus, string> = {
  AKTIF: "Aktif",
  PURNA: "Purna",
  CUTI: "Cuti",
  NONAKTIF: "Nonaktif",
};

const STATUS_TEXT_COLORS: Record<OfficialStatus, string> = {
  AKTIF: "text-primary font-semibold",
  PURNA: "text-txt-muted font-medium",
  CUTI: "text-amber-700 font-semibold",
  NONAKTIF: "text-red-700 font-semibold",
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params: paramsPromise }: PageProps): Promise<Metadata> {
  const params = await paramsPromise;
  const { slug } = await params;
  const official = await prisma.publicOfficial.findFirst({
    where: { slug, isPublished: true },
    select: { name: true, position: true, institution: true, bio: true, region: true },
  });
  if (!official) return { title: "Pejabat tidak ditemukan | Lensaplus" };

  const pageTitle = `${official.name} — ${official.position} | Lensaplus`;
  const description =
    official.bio?.slice(0, 160) ||
    `Profil ${official.position} ${official.institution}${official.region ? `, ${official.region}` : ""}.`;

  return {
    title: pageTitle,
    description,
    openGraph: { title: pageTitle, description },
  };
}

export default async function PejabatDetailPage({ params: paramsPromise }: PageProps) {
  const params = await paramsPromise;
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
          <div className="rounded-xl border border-border bg-surface p-6 sm:p-8 shadow-card mb-6">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              {/* Photo / initials */}
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-container-low shadow-sm">
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
                {/* Level & status metadata */}
                <div className="mb-2 flex flex-wrap justify-center items-center gap-x-2 gap-y-1 text-xs uppercase tracking-wider sm:justify-start">
                  <span className="font-bold text-primary">
                    {LEVEL_LABELS[official.level]}
                  </span>
                  <span className="text-border">·</span>
                  <span className={STATUS_TEXT_COLORS[official.status]}>
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
                <div>
                  <dt className="text-xs font-semibold text-txt-muted uppercase tracking-wide">
                    Mulai Jabatan
                  </dt>
                  <dd className="text-txt-primary">
                    {fmt.format(new Date(official.termStart))}
                  </dd>
                </div>
              )}
              {official.termEnd && (
                <div>
                  <dt className="text-xs font-semibold text-txt-muted uppercase tracking-wide">
                    Akhir Jabatan
                  </dt>
                  <dd className="text-txt-primary">
                    {fmt.format(new Date(official.termEnd))}
                  </dd>
                </div>
              )}
              {official.party && (
                <div>
                  <dt className="text-xs font-semibold text-txt-muted uppercase tracking-wide">
                    Partai
                  </dt>
                  <dd className="text-txt-primary">{official.party}</dd>
                </div>
              )}
              {official.birthplace && (
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
              )}
            </dl>
          </div>

          {/* Bio */}
          {official.bio && (
            <div className="rounded-xl border border-border bg-surface p-6 sm:p-8 shadow-card mb-6">
              <h2 className="text-title-md font-semibold text-txt-primary mb-4 border-l-[3px] border-primary pl-3">
                Biografi
              </h2>
              <div className="text-body-md text-txt-secondary leading-relaxed whitespace-pre-wrap">
                {official.bio}
              </div>
            </div>
          )}

          {/* Education */}
          {official.education && (
            <div className="rounded-xl border border-border bg-surface p-6 sm:p-8 shadow-card mb-6">
              <h2 className="text-title-md font-semibold text-txt-primary mb-4 border-l-[3px] border-primary pl-3">
                Pendidikan
              </h2>
              <div className="text-body-md text-txt-secondary leading-relaxed whitespace-pre-wrap">
                {official.education}
              </div>
            </div>
          )}

          {/* Career */}
          {official.career && (
            <div className="rounded-xl border border-border bg-surface p-6 sm:p-8 shadow-card mb-6">
              <h2 className="text-title-md font-semibold text-txt-primary mb-4 border-l-[3px] border-primary pl-3">
                Riwayat Karier
              </h2>
              <div className="text-body-md text-txt-secondary leading-relaxed whitespace-pre-wrap">
                {official.career}
              </div>
            </div>
          )}

          {/* Related articles */}
          {relatedArticles.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-6 sm:p-8 shadow-card">
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
