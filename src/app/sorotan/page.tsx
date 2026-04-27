export const dynamic = "force-dynamic";

import Link from "next/link";
import { Metadata } from "next";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";

export const metadata: Metadata = {
  title: "Sorotan",
  description:
    "Sorotan — ringkasan sudut pandang kronologi, analisis, dan dampak atas berita hukum pilihan Kartawarta.",
  openGraph: {
    title: "Sorotan - Kartawarta",
    description:
      "Ringkasan sudut pandang kronologi, analisis, dan dampak atas berita hukum pilihan Kartawarta.",
    type: "website",
  },
  alternates: {
    canonical: "/sorotan",
  },
};

const PER_PAGE = 12;

const ANGLE_LABEL: Record<string, string> = {
  KRONOLOGI: "Kronologi",
  ANALISIS: "Analisis",
  DAMPAK: "Dampak",
};

const ANGLE_COLOR: Record<string, string> = {
  KRONOLOGI: "bg-blue-50 text-blue-700 border-blue-200",
  ANALISIS: "bg-amber-50 text-amber-700 border-amber-200",
  DAMPAK: "bg-rose-50 text-rose-700 border-rose-200",
};

interface PageProps {
  searchParams: {
    page?: string;
    angle?: string;
  };
}

export default async function SorotanListPage({ searchParams }: PageProps) {
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const angleParam = searchParams.angle?.toUpperCase();
  const validAngle =
    angleParam && ["KRONOLOGI", "ANALISIS", "DAMPAK"].includes(angleParam)
      ? (angleParam as "KRONOLOGI" | "ANALISIS" | "DAMPAK")
      : null;

  const where = validAngle ? { angle: validAngle } : {};

  const [sorotan, total] = await Promise.all([
    prisma.sorotan.findMany({
      where,
      include: {
        article: {
          select: {
            slug: true,
            title: true,
            featuredImage: true,
            category: { select: { name: true, slug: true } },
            author: { select: { name: true } },
            publishedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.sorotan.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  function buildUrl(params: { page?: number; angle?: string | null }) {
    const qs = new URLSearchParams();
    qs.set("page", String(params.page ?? page));
    const a = params.angle === undefined ? validAngle : params.angle;
    if (a) qs.set("angle", a);
    return `/sorotan?${qs.toString()}`;
  }

  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Beranda", url: "/" },
    { name: "Sorotan", url: "/sorotan" },
  ]);

  return (
    <div className="bg-surface min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <div className="container-main py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <span className="block h-7 w-[3px] rounded-full bg-primary" />
            <h1 className="flex items-center gap-2 text-xl font-bold text-txt-primary sm:text-2xl lg:text-3xl">
              <Sparkles size={22} className="text-primary" />
              Sorotan
            </h1>
          </div>
          <p className="mt-2 text-sm text-txt-secondary">
            Ringkasan sudut pandang — kronologi, analisis, dan dampak — dari
            berita pilihan redaksi.
          </p>
          <p className="mt-1 text-xs text-txt-muted">
            {total.toLocaleString("id-ID")} sorotan tersedia
          </p>
        </div>

        {/* Angle filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href={buildUrl({ page: 1, angle: null })}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              !validAngle
                ? "bg-primary text-white"
                : "bg-surface text-txt-secondary hover:bg-surface-tertiary border border-border"
            }`}
          >
            Semua
          </Link>
          {(["KRONOLOGI", "ANALISIS", "DAMPAK"] as const).map((a) => (
            <Link
              key={a}
              href={buildUrl({ page: 1, angle: a })}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                validAngle === a
                  ? "bg-primary text-white"
                  : "bg-surface text-txt-secondary hover:bg-surface-tertiary border border-border"
              }`}
            >
              {ANGLE_LABEL[a]}
            </Link>
          ))}
        </div>

        {/* List */}
        {sorotan.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sorotan.map((s) => (
              <Link
                key={s.id}
                href={`/sorotan/${s.slug}`}
                className="group flex h-full flex-col rounded-[12px] border border-border bg-surface p-5 shadow-card transition-all hover:border-primary"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={`inline-block rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                      ANGLE_COLOR[s.angle] ??
                      "bg-surface-secondary text-txt-secondary border-border"
                    }`}
                  >
                    {ANGLE_LABEL[s.angle] ?? s.angle}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {s.article.category.name}
                  </span>
                </div>
                <h2 className="line-clamp-3 text-base font-bold leading-snug text-txt-primary transition-colors group-hover:text-primary">
                  {s.title}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm text-txt-secondary">
                  {s.content.slice(0, 200).replace(/\s+/g, " ").trim()}…
                </p>
                <div className="mt-auto pt-4 text-xs text-txt-muted">
                  <span>{s.article.author.name}</span>
                  <span className="mx-1">·</span>
                  <span>
                    {s.createdAt.toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <Sparkles size={48} className="mx-auto text-border" />
            <p className="mt-4 text-txt-secondary">Belum ada sorotan</p>
            <p className="text-sm text-txt-muted">
              Sorotan akan muncul setelah redaksi mempublikasikan artikel baru.
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            {page > 1 ? (
              <Link
                href={buildUrl({ page: page - 1 })}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-txt-primary transition-all hover:border-primary hover:text-primary"
              >
                <ChevronLeft size={16} />
                <span className="hidden sm:inline">Sebelumnya</span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-txt-muted opacity-50">
                <ChevronLeft size={16} />
                <span className="hidden sm:inline">Sebelumnya</span>
              </span>
            )}
            <span className="text-sm font-medium text-txt-secondary">
              Halaman {page} dari {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={buildUrl({ page: page + 1 })}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-txt-primary transition-all hover:border-primary hover:text-primary"
              >
                <span className="hidden sm:inline">Selanjutnya</span>
                <ChevronRight size={16} />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-txt-muted opacity-50">
                <span className="hidden sm:inline">Selanjutnya</span>
                <ChevronRight size={16} />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
