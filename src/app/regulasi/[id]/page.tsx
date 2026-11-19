import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { safeJsonLdStringify } from "@/lib/seo/json-ld";
import { safeHref } from "@/components/common/safeHref";
import { ExternalLink, FileText, ChevronLeft } from "lucide-react";
import type { RegulationType, RegulationStatus } from "@prisma/client";

export const revalidate = 3600;

const TYPE_LABELS: Record<RegulationType, string> = {
  UU: "Undang-Undang",
  PERPPU: "Peraturan Pemerintah Pengganti UU",
  PP: "Peraturan Pemerintah",
  PERPRES: "Peraturan Presiden",
  KEPPRES: "Keputusan Presiden",
  INPRES: "Instruksi Presiden",
  PERMEN: "Peraturan Menteri",
  KEPMEN: "Keputusan Menteri",
  PERDA_PROV: "Peraturan Daerah Provinsi",
  PERDA_KAB: "Peraturan Daerah Kabupaten/Kota",
  PERGUB: "Peraturan Gubernur",
  PERWAL: "Peraturan Walikota / Bupati",
  PUTUSAN_MK: "Putusan Mahkamah Konstitusi",
  PUTUSAN_MA: "Putusan Mahkamah Agung",
  OTHER: "Peraturan Lainnya",
};

const STATUS_LABELS: Record<RegulationStatus, string> = {
  DRAFT_RUU: "Masih RUU",
  ENACTED: "Berlaku",
  AMENDED: "Telah Diubah",
  REVOKED: "Dicabut / Dibatalkan",
};

const STATUS_TEXT_COLORS: Record<RegulationStatus, string> = {
  DRAFT_RUU: "text-amber-700 font-semibold",
  ENACTED: "text-primary font-semibold",
  AMENDED: "text-blue-700 font-semibold",
  REVOKED: "text-red-700 font-semibold",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params: paramsPromise }: PageProps): Promise<Metadata> {
  const params = await paramsPromise;
  const { id } = await params;
  const reg = await prisma.regulation.findFirst({
    where: { id, isPublished: true },
    select: { type: true, number: true, year: true, title: true, shortTitle: true, description: true },
  });
  if (!reg) return { title: "Regulasi tidak ditemukan | Lensaplus" };

  const typeLabel = TYPE_LABELS[reg.type];
  const pageTitle = `${reg.shortTitle || typeLabel} No. ${reg.number} Tahun ${reg.year} | Lensaplus`;
  const description =
    reg.description?.slice(0, 160) ||
    `${typeLabel} Nomor ${reg.number} Tahun ${reg.year} tentang ${reg.title.slice(0, 100)}`;

  return {
    title: pageTitle,
    description,
    openGraph: {
      title: pageTitle,
      description,
    },
  };
}

export default async function RegulasiDetailPage({ params: paramsPromise }: PageProps) {
  const params = await paramsPromise;
  const { id } = await params;

  const regulation = await prisma.regulation.findFirst({
    where: { id, isPublished: true },
  });

  if (!regulation) notFound();

  // Increment viewCount — fire and forget
  prisma.regulation
    .update({ where: { id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  // Fetch linked article if exists
  const linkedArticle = regulation.articleId
    ? await prisma.article.findFirst({
        where: { id: regulation.articleId, status: "PUBLISHED" },
        select: { slug: true, title: true },
      })
    : null;

  const safeSourceUrl = safeHref(regulation.sourceUrl);
  const safePdfUrl = safeHref(regulation.pdfUrl, { allowRelative: true });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Legislation",
    name: regulation.shortTitle || regulation.title,
    legislationIdentifier: `${TYPE_LABELS[regulation.type]} No. ${regulation.number} Tahun ${regulation.year}`,
    legislationType: TYPE_LABELS[regulation.type],
    legislationDate: regulation.enactedAt?.toISOString().split("T")[0],
    legislationLegalForce: regulation.status === "ENACTED" ? "InForce" : undefined,
    publisher: regulation.issuedBy
      ? { "@type": "Organization", name: regulation.issuedBy }
      : undefined,
    url: safeSourceUrl || undefined,
    description: regulation.description?.slice(0, 500) || regulation.title,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />

      <div className="container-main py-8 sm:py-12">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-txt-muted" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-primary transition-colors">
            Beranda
          </Link>
          <span>/</span>
          <Link href="/regulasi" className="hover:text-primary transition-colors">
            Regulasi
          </Link>
          <span>/</span>
          <span className="text-txt-primary line-clamp-1 max-w-xs">
            {regulation.shortTitle ||
              `${TYPE_LABELS[regulation.type].split(" ")[0]} No. ${regulation.number}`}
          </span>
        </nav>

        <div className="mx-auto max-w-4xl">
          {/* Back link */}
          <Link
            href="/regulasi"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-txt-secondary hover:text-primary transition-colors"
          >
            <ChevronLeft size={16} /> Kembali ke Direktori Regulasi
          </Link>

          {/* Header card */}
          <div className="rounded-xl border border-border bg-surface p-6 sm:p-8 shadow-card mb-6">
            {/* Type + status metadata */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 text-xs uppercase tracking-wider">
              <span className="font-bold text-primary">
                {TYPE_LABELS[regulation.type]}
              </span>
              <span className="text-border">·</span>
              <span className={STATUS_TEXT_COLORS[regulation.status]}>
                {STATUS_LABELS[regulation.status]}
              </span>
              {regulation.topic && (
                <>
                  <span className="text-border">·</span>
                  <span className="font-medium text-txt-muted normal-case tracking-normal">
                    {regulation.topic}
                  </span>
                </>
              )}
            </div>

            {/* Number */}
            <p className="font-mono text-sm text-txt-muted mb-2">
              Nomor {regulation.number} Tahun {regulation.year}
            </p>

            {/* Title */}
            <h1 className="font-serif text-headline-sm sm:text-headline-md text-txt-primary leading-snug mb-4">
              {regulation.shortTitle && (
                <span className="block text-primary text-xl font-bold mb-1">
                  {regulation.shortTitle}
                </span>
              )}
              {regulation.title}
            </h1>

            {/* Meta grid */}
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-5 pt-5 border-t border-border text-sm">
              {regulation.enactedAt && (
                <div>
                  <dt className="text-xs font-semibold text-txt-muted uppercase tracking-wide">
                    Tanggal Diundangkan
                  </dt>
                  <dd className="text-txt-primary">
                    {new Intl.DateTimeFormat("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      timeZone: "Asia/Jakarta",
                    }).format(new Date(regulation.enactedAt))}
                  </dd>
                </div>
              )}
              {regulation.effectiveAt && (
                <div>
                  <dt className="text-xs font-semibold text-txt-muted uppercase tracking-wide">
                    Mulai Berlaku
                  </dt>
                  <dd className="text-txt-primary">
                    {new Intl.DateTimeFormat("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      timeZone: "Asia/Jakarta",
                    }).format(new Date(regulation.effectiveAt))}
                  </dd>
                </div>
              )}
              {regulation.issuedBy && (
                <div>
                  <dt className="text-xs font-semibold text-txt-muted uppercase tracking-wide">
                    Diterbitkan Oleh
                  </dt>
                  <dd className="text-txt-primary">{regulation.issuedBy}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-semibold text-txt-muted uppercase tracking-wide">
                  Dilihat
                </dt>
                <dd className="text-txt-primary">
                  {regulation.viewCount.toLocaleString("id-ID")} kali
                </dd>
              </div>
            </dl>

            {/* Action buttons */}
            {(safeSourceUrl || safePdfUrl) && (
              <div className="flex flex-wrap gap-3 mt-6">
                {safeSourceUrl && (
                  <a
                    href={safeSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold"
                  >
                    <ExternalLink size={14} aria-hidden="true" /> Lihat Sumber Resmi
                  </a>
                )}
                {safePdfUrl && (
                  <a
                    href={safePdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold"
                  >
                    <FileText size={14} aria-hidden="true" /> Unduh PDF
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          {regulation.description && (
            <div className="rounded-xl border border-border bg-surface p-6 sm:p-8 shadow-card mb-6">
              <h2 className="text-title-md font-semibold text-txt-primary mb-4">
                Ringkasan / Keterangan
              </h2>
              <div className="text-body-md text-txt-secondary leading-relaxed whitespace-pre-wrap">
                {regulation.description}
              </div>
            </div>
          )}

          {/* Linked article */}
          {linkedArticle && (
            <div className="rounded-xl border border-border border-l-4 border-l-primary bg-surface p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
                Liputan Lensaplus
              </p>
              <Link
                href={`/berita/${linkedArticle.slug}`}
                className="text-body-lg font-semibold text-primary hover:underline line-clamp-2"
              >
                {linkedArticle.title}
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
