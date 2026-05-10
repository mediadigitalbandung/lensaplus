import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Scale, ExternalLink, FileText, ChevronLeft, Calendar, Building2, Tag } from "lucide-react";
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

const TYPE_COLORS: Record<RegulationType, string> = {
  UU: "bg-blue-100 text-blue-800",
  PERPPU: "bg-indigo-100 text-indigo-800",
  PP: "bg-sky-100 text-sky-800",
  PERPRES: "bg-violet-100 text-violet-800",
  KEPPRES: "bg-purple-100 text-purple-800",
  INPRES: "bg-fuchsia-100 text-fuchsia-800",
  PERMEN: "bg-teal-100 text-teal-800",
  KEPMEN: "bg-cyan-100 text-cyan-800",
  PERDA_PROV: "bg-emerald-100 text-emerald-800",
  PERDA_KAB: "bg-green-100 text-green-800",
  PERGUB: "bg-lime-100 text-lime-800",
  PERWAL: "bg-yellow-100 text-yellow-800",
  PUTUSAN_MK: "bg-red-100 text-red-800",
  PUTUSAN_MA: "bg-orange-100 text-orange-800",
  OTHER: "bg-surface-tertiary text-txt-secondary",
};

const STATUS_LABELS: Record<RegulationStatus, string> = {
  DRAFT_RUU: "Masih RUU",
  ENACTED: "Berlaku",
  AMENDED: "Telah Diubah",
  REVOKED: "Dicabut / Dibatalkan",
};

const STATUS_COLORS: Record<RegulationStatus, string> = {
  DRAFT_RUU: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  ENACTED: "bg-primary-light text-primary border border-primary/20",
  AMENDED: "bg-blue-50 text-blue-700 border border-blue-200",
  REVOKED: "bg-red-50 text-red-700 border border-red-200",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const reg = await prisma.regulation.findFirst({
    where: { id, isPublished: true },
    select: { type: true, number: true, year: true, title: true, shortTitle: true, description: true },
  });
  if (!reg) return { title: "Regulasi tidak ditemukan | Kartawarta" };

  const typeLabel = TYPE_LABELS[reg.type];
  const pageTitle = `${reg.shortTitle || typeLabel} No. ${reg.number} Tahun ${reg.year} | Kartawarta`;
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

export default async function RegulasiDetailPage({ params }: PageProps) {
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
    url: regulation.sourceUrl || undefined,
    description: regulation.description?.slice(0, 500) || regulation.title,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-card mb-6">
            {/* Type + status badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${TYPE_COLORS[regulation.type]}`}
              >
                <Scale size={13} className="mr-1.5" />
                {TYPE_LABELS[regulation.type]}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLORS[regulation.status]}`}
              >
                {STATUS_LABELS[regulation.status]}
              </span>
              {regulation.topic && (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-secondary px-3 py-1 text-sm text-txt-muted">
                  <Tag size={12} />
                  {regulation.topic}
                </span>
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
                <div className="flex items-start gap-2">
                  <Calendar size={14} className="text-txt-muted shrink-0 mt-0.5" />
                  <div>
                    <dt className="text-xs font-semibold text-txt-muted uppercase tracking-wide">
                      Tanggal Diundangkan
                    </dt>
                    <dd className="text-txt-primary">
                      {new Intl.DateTimeFormat("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(new Date(regulation.enactedAt))}
                    </dd>
                  </div>
                </div>
              )}
              {regulation.effectiveAt && (
                <div className="flex items-start gap-2">
                  <Calendar size={14} className="text-txt-muted shrink-0 mt-0.5" />
                  <div>
                    <dt className="text-xs font-semibold text-txt-muted uppercase tracking-wide">
                      Mulai Berlaku
                    </dt>
                    <dd className="text-txt-primary">
                      {new Intl.DateTimeFormat("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(new Date(regulation.effectiveAt))}
                    </dd>
                  </div>
                </div>
              )}
              {regulation.issuedBy && (
                <div className="flex items-start gap-2">
                  <Building2 size={14} className="text-txt-muted shrink-0 mt-0.5" />
                  <div>
                    <dt className="text-xs font-semibold text-txt-muted uppercase tracking-wide">
                      Diterbitkan Oleh
                    </dt>
                    <dd className="text-txt-primary">{regulation.issuedBy}</dd>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <FileText size={14} className="text-txt-muted shrink-0 mt-0.5" />
                <div>
                  <dt className="text-xs font-semibold text-txt-muted uppercase tracking-wide">
                    Dilihat
                  </dt>
                  <dd className="text-txt-primary">
                    {regulation.viewCount.toLocaleString("id-ID")} kali
                  </dd>
                </div>
              </div>
            </dl>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 mt-6">
              {regulation.sourceUrl && (
                <a
                  href={regulation.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold"
                >
                  <ExternalLink size={14} /> Lihat Sumber Resmi
                </a>
              )}
              {regulation.pdfUrl && (
                <a
                  href={regulation.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold"
                >
                  <FileText size={14} /> Unduh PDF
                </a>
              )}
            </div>
          </div>

          {/* Description */}
          {regulation.description && (
            <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-card mb-6">
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
            <div className="rounded-2xl border border-primary/20 bg-primary-light p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
                Liputan Kartawarta
              </p>
              <Link
                href={`/artikel/${linkedArticle.slug}`}
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
