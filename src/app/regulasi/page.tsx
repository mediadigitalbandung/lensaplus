import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Scale, ExternalLink, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import type { RegulationType, RegulationStatus } from "@prisma/client";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Regulasi Hukum Indonesia — UU, PP, Perpres, Perda | Kartawarta",
  description:
    "Direktori peraturan perundang-undangan Indonesia: Undang-Undang, Peraturan Pemerintah, Peraturan Presiden, Peraturan Menteri, Perda, dan Putusan MK/MA.",
  openGraph: {
    title: "Regulasi Hukum Indonesia | Kartawarta",
    description:
      "Direktori UU, PP, Perpres, Permen, Perda, dan Putusan Mahkamah terlengkap.",
  },
};

const TYPE_LABELS: Record<RegulationType, string> = {
  UU: "Undang-Undang",
  PERPPU: "Perppu",
  PP: "PP",
  PERPRES: "Perpres",
  KEPPRES: "Keppres",
  INPRES: "Inpres",
  PERMEN: "Permen",
  KEPMEN: "Kepmen",
  PERDA_PROV: "Perda Prov.",
  PERDA_KAB: "Perda Kab./Kota",
  PERGUB: "Pergub",
  PERWAL: "Perwal/Perbup",
  PUTUSAN_MK: "Putusan MK",
  PUTUSAN_MA: "Putusan MA",
  OTHER: "Lainnya",
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
  DRAFT_RUU: "RUU",
  ENACTED: "Berlaku",
  AMENDED: "Diubah",
  REVOKED: "Dicabut",
};

const STATUS_COLORS: Record<RegulationStatus, string> = {
  DRAFT_RUU: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  ENACTED: "bg-primary-light text-primary border border-primary/20",
  AMENDED: "bg-blue-50 text-blue-700 border border-blue-200",
  REVOKED: "bg-red-50 text-red-700 border border-red-200",
};

const ALL_TYPES: RegulationType[] = [
  "UU",
  "PERPPU",
  "PP",
  "PERPRES",
  "KEPPRES",
  "INPRES",
  "PERMEN",
  "KEPMEN",
  "PERDA_PROV",
  "PERDA_KAB",
  "PERGUB",
  "PERWAL",
  "PUTUSAN_MK",
  "PUTUSAN_MA",
  "OTHER",
];

const LIMIT = 20;

interface PageProps {
  searchParams: Promise<{ type?: string; search?: string; page?: string; topic?: string }>;
}

export default async function RegulasiPage({ searchParams: searchParamsPromise }: PageProps) {
  const searchParams = await searchParamsPromise;
  const sp = await searchParams;
  const typeParam = ALL_TYPES.includes(sp.type as RegulationType)
    ? (sp.type as RegulationType)
    : undefined;
  const searchParam = sp.search?.trim() || undefined;
  const topicParam = sp.topic?.trim() || undefined;
  const page = Math.max(1, parseInt(sp.page || "1", 10));

  const where = {
    isPublished: true,
    ...(typeParam ? { type: typeParam } : {}),
    ...(topicParam
      ? { topic: { contains: topicParam, mode: "insensitive" as const } }
      : {}),
    ...(searchParam
      ? {
          OR: [
            { title: { contains: searchParam, mode: "insensitive" as const } },
            { shortTitle: { contains: searchParam, mode: "insensitive" as const } },
            { number: { contains: searchParam, mode: "insensitive" as const } },
            { topic: { contains: searchParam, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [regulations, total] = await Promise.all([
    prisma.regulation.findMany({
      where,
      select: {
        id: true,
        type: true,
        number: true,
        year: true,
        title: true,
        shortTitle: true,
        topic: true,
        status: true,
        enactedAt: true,
        issuedBy: true,
        sourceUrl: true,
        pdfUrl: true,
      },
      orderBy: [{ enactedAt: "desc" }, { year: "desc" }, { createdAt: "desc" }],
      take: LIMIT,
      skip: (page - 1) * LIMIT,
    }),
    prisma.regulation.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  // JSON-LD WebPage
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Regulasi Hukum Indonesia",
    description:
      "Direktori peraturan perundang-undangan Indonesia: UU, PP, Perpres, Permen, Perda, Putusan MK/MA.",
    url: "https://kartawarta.com/regulasi",
    publisher: {
      "@type": "Organization",
      name: "Kartawarta",
      url: "https://kartawarta.com",
    },
  };

  function buildHref(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged = {
      type: typeParam,
      search: searchParam,
      topic: topicParam,
      page: String(page),
      ...overrides,
    };
    if (merged.type) p.set("type", merged.type);
    if (merged.search) p.set("search", merged.search);
    if (merged.topic) p.set("topic", merged.topic);
    if (merged.page && merged.page !== "1") p.set("page", merged.page);
    const qs = p.toString();
    return `/regulasi${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="container-main py-8 sm:py-12">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Scale size={28} className="text-primary shrink-0" />
            <h1 className="font-serif text-headline-md text-txt-primary">
              Regulasi
            </h1>
          </div>
          <p className="text-body-md text-txt-secondary max-w-2xl">
            Direktori peraturan perundang-undangan Indonesia — Undang-Undang,
            Peraturan Pemerintah, Perpres, Permen, Perda, hingga Putusan
            Mahkamah.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-3">
          {/* Search */}
          <form action="/regulasi" method="get" className="flex gap-2">
            {typeParam && (
              <input type="hidden" name="type" value={typeParam} />
            )}
            <input
              type="text"
              name="search"
              defaultValue={searchParam}
              placeholder="Cari berdasarkan judul, nomor, atau topik..."
              className="input flex-1 py-2 text-sm"
            />
            <button
              type="submit"
              className="btn-primary rounded-md px-4 py-2 text-sm font-semibold"
            >
              Cari
            </button>
            {(searchParam || typeParam || topicParam) && (
              <a
                href="/regulasi"
                className="btn-ghost rounded-md px-3 py-2 text-sm"
              >
                Reset
              </a>
            )}
          </form>

          {/* Type filter pills */}
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildHref({ type: undefined, page: "1" })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                !typeParam
                  ? "bg-primary text-white"
                  : "bg-surface-tertiary text-txt-secondary hover:bg-border"
              }`}
            >
              Semua
            </Link>
            {ALL_TYPES.map((t) => (
              <Link
                key={t}
                href={buildHref({ type: t, page: "1" })}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  typeParam === t
                    ? "bg-primary text-white"
                    : "bg-surface-tertiary text-txt-secondary hover:bg-border"
                }`}
              >
                {TYPE_LABELS[t]}
              </Link>
            ))}
          </div>
        </div>

        {/* Results count */}
        <p className="mb-4 text-sm text-txt-muted">
          {total === 0
            ? "Tidak ada regulasi ditemukan."
            : `Menampilkan ${(page - 1) * LIMIT + 1}–${Math.min(page * LIMIT, total)} dari ${total} regulasi`}
        </p>

        {/* Card list */}
        {regulations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface py-20 text-center">
            <FileText size={40} className="mx-auto text-border mb-3" />
            <p className="text-sm text-txt-secondary">
              Belum ada regulasi yang sesuai.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {regulations.map((reg) => (
              <article
                key={reg.id}
                className="card flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 sm:p-5 transition-shadow hover:shadow-card-hover sm:flex-row sm:items-start sm:gap-5"
              >
                {/* Left: badges */}
                <div className="flex shrink-0 flex-wrap gap-2 sm:w-40 sm:flex-col sm:gap-1.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_COLORS[reg.type]}`}
                  >
                    {TYPE_LABELS[reg.type]}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[reg.status]}`}
                  >
                    {STATUS_LABELS[reg.status]}
                  </span>
                  {reg.topic && (
                    <span className="inline-flex items-center rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs text-txt-muted">
                      {reg.topic}
                    </span>
                  )}
                </div>

                {/* Right: content */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-txt-muted mb-1 font-mono">
                    No. {reg.number} Tahun {reg.year}
                    {reg.issuedBy && ` — ${reg.issuedBy}`}
                  </p>
                  <Link href={`/regulasi/${reg.id}`} className="group">
                    <h2 className="text-body-lg font-semibold text-txt-primary group-hover:text-primary line-clamp-2 transition-colors">
                      {reg.shortTitle ? (
                        <>
                          <span className="text-primary mr-1.5">{reg.shortTitle}</span>
                          {reg.title}
                        </>
                      ) : (
                        reg.title
                      )}
                    </h2>
                  </Link>
                  {reg.enactedAt && (
                    <p className="mt-1 text-xs text-txt-muted">
                      Diundangkan:{" "}
                      {new Intl.DateTimeFormat("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(new Date(reg.enactedAt))}
                    </p>
                  )}
                  {/* Links */}
                  <div className="mt-2 flex flex-wrap gap-3">
                    {reg.sourceUrl && (
                      <a
                        href={reg.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink size={11} /> Sumber Resmi
                      </a>
                    )}
                    {reg.pdfUrl && (
                      <a
                        href={reg.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-secondary hover:underline"
                      >
                        <FileText size={11} /> Unduh PDF
                      </a>
                    )}
                    <Link
                      href={`/regulasi/${reg.id}`}
                      className="inline-flex items-center gap-1 text-xs text-txt-secondary hover:text-primary"
                    >
                      Lihat Detail
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between text-sm text-txt-secondary">
            <span>
              Halaman {page} dari {totalPages}
            </span>
            <div className="flex gap-1">
              {page > 1 && (
                <Link
                  href={buildHref({ page: String(page - 1) })}
                  className="btn-ghost flex items-center gap-1 rounded-md px-3 py-2"
                >
                  <ChevronLeft size={16} /> Sebelumnya
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildHref({ page: String(page + 1) })}
                  className="btn-ghost flex items-center gap-1 rounded-md px-3 py-2"
                >
                  Berikutnya <ChevronRight size={16} />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
