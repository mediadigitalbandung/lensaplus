export const revalidate = 60;

import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Sparkles, BookOpen, Eye } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  organizationJsonLd,
} from "@/lib/seo/json-ld";

const ANGLE_LABEL: Record<string, string> = {
  KRONOLOGI: "Kronologi",
  ANALISIS: "Analisis",
  DAMPAK: "Dampak",
  LATAR_BELAKANG: "Latar Belakang",
  PROFIL: "Profil Tokoh",
  REAKSI: "Reaksi",
  HUKUM: "Sudut Hukum",
  EKONOMI: "Sudut Ekonomi",
  PROYEKSI: "Proyeksi",
  FAQ: "Tanya Jawab",
};

// All angles share one elegant on-brand (navy) badge — the angle LABEL already
// distinguishes them, so a uniform colour reads more editorial than a rainbow.
const ANGLE_BADGE = "bg-primary-light text-primary border-primary/15";
const ANGLE_COLOR: Record<string, string> = {
  KRONOLOGI: ANGLE_BADGE,
  ANALISIS: ANGLE_BADGE,
  DAMPAK: ANGLE_BADGE,
  LATAR_BELAKANG: ANGLE_BADGE,
  PROFIL: ANGLE_BADGE,
  REAKSI: ANGLE_BADGE,
  HUKUM: ANGLE_BADGE,
  EKONOMI: ANGLE_BADGE,
  PROYEKSI: ANGLE_BADGE,
  FAQ: ANGLE_BADGE,
};

async function getSorotan(slug: string) {
  return prisma.sorotan.findUnique({
    where: { slug },
    include: {
      article: {
        include: {
          author: true,
          category: true,
        },
      },
    },
  });
}

export async function generateMetadata({ params: paramsPromise }: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const params = await paramsPromise;
  const sorotan = await getSorotan(params.slug);
  if (!sorotan) return { title: "Sorotan Tidak Ditemukan" };

  const title = `${ANGLE_LABEL[sorotan.angle] ?? sorotan.angle} — ${sorotan.article.title}`;
  const description = sorotan.content.slice(0, 160).replace(/\s+/g, " ").trim();

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: sorotan.createdAt.toISOString(),
      modifiedTime: sorotan.updatedAt.toISOString(),
      authors: [sorotan.article.author.name],
      section: sorotan.article.category.name,
      ...(sorotan.article.featuredImage && {
        images: [
          {
            url: sorotan.article.featuredImage,
            width: 1200,
            height: 630,
            alt: sorotan.title,
          },
        ],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(sorotan.article.featuredImage && {
        images: [sorotan.article.featuredImage],
      }),
    },
    alternates: {
      canonical: `/sorotan/${params.slug}`,
    },
  };
}

export default async function SorotanDetailPage({ params: paramsPromise }: {
  params: Promise<{ slug: string }>;
}) {
  const params = await paramsPromise;
  const sorotan = await getSorotan(params.slug);
  if (!sorotan) notFound();

  const { article } = sorotan;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";
  const sorotanUrl = `${appUrl}/sorotan/${sorotan.slug}`;
  const angleLabel = ANGLE_LABEL[sorotan.angle] ?? sorotan.angle;

  // JSON-LD. Sorotan adalah re-framing dari artikel utama (long-tail SEO),
  // jadi WAJIB declare isBasedOn → article asli supaya Google ngerti relasi
  // dan tidak nge-flag thin/duplicate content. Plus mainEntityOfPage = sorotan
  // URL (self) supaya Google tetap bisa rank halaman sorotan untuk query
  // long-tail spesifik (e.g. "kronologi kasus X").
  const articleLdBase = articleJsonLd(
    {
      title: sorotan.title,
      slug: sorotan.slug,
      excerpt: sorotan.content.slice(0, 200),
      content: sorotan.content,
      featuredImage: article.featuredImage,
      publishedAt: sorotan.createdAt,
      updatedAt: sorotan.updatedAt,
      author: { name: article.author.name },
      category: {
        name: article.category.name,
        slug: article.category.slug,
      },
    },
    `/sorotan/${sorotan.slug}`,
  ) as Record<string, unknown>;
  const articleLd = {
    ...articleLdBase,
    isBasedOn: `${appUrl}/berita/${article.slug}`,
    about: {
      "@type": "NewsArticle",
      headline: article.title,
      url: `${appUrl}/berita/${article.slug}`,
      ...(article.publishedAt && { datePublished: article.publishedAt.toISOString() }),
    },
  };

  // Breadcrumb taut sorotan ke artikel induk supaya search engine + reader
  // dapat path balik yang jelas: Home → Berita → Article → Sorotan-angle.
  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Beranda", url: "/" },
    { name: article.category.name, url: `/kategori/${article.category.slug}` },
    { name: article.title, url: `/berita/${article.slug}` },
    { name: angleLabel, url: `/sorotan/${sorotan.slug}` },
  ]);

  const orgLd = organizationJsonLd();

  // Split content into paragraphs for readable rendering.
  const paragraphs = sorotan.content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([articleLd, breadcrumbLd, orgLd]),
        }}
      />

      <div className="bg-surface min-h-screen">
        <div className="container-main py-6 sm:py-8 lg:py-10 2xl:py-14">
          {/* Breadcrumb */}
          <nav
            className="mb-6 flex items-center gap-2 text-sm text-txt-secondary"
            aria-label="Breadcrumb"
          >
            <Link href="/" className="transition-colors hover:text-primary">
              Beranda
            </Link>
            <span>&gt;</span>
            <Link
              href="/sorotan"
              className="transition-colors hover:text-primary"
            >
              Sorotan
            </Link>
            <span>&gt;</span>
            <span className="truncate max-w-[200px] sm:max-w-[400px] text-txt-muted">
              {sorotan.title}
            </span>
          </nav>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
            <article className="lg:col-span-2">
              {/* Angle badge + category */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-secondary to-secondary-dark px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm shadow-secondary/30 ring-1 ring-inset ring-white/15">
                  <Sparkles size={12} className="opacity-90" />
                  <span className="opacity-80">Sorotan</span>
                  <span className="opacity-50">·</span>
                  <span>{angleLabel}</span>
                </span>
                <Link
                  href={`/kategori/${article.category.slug}`}
                  className="text-xs font-bold uppercase tracking-wide text-primary hover:underline"
                >
                  {article.category.name}
                </Link>
              </div>

              {/* Title */}
              <h1 className="font-serif text-headline-sm font-extrabold leading-tight text-txt-primary tracking-tight sm:text-headline-md lg:text-display-sm">
                {sorotan.title}
              </h1>

              {/* Meta */}
              <div className="mt-4 text-sm text-txt-muted">
                <span>
                  Penulis artikel sumber:{" "}
                  <span className="text-txt-primary font-medium">
                    {article.author.name}
                  </span>
                </span>
                <span className="mx-2">·</span>
                <span>
                  {sorotan.createdAt.toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                {(article.viewCount ?? 0) > 0 && (
                  <>
                    <span className="mx-2">·</span>
                    <span className="inline-flex items-center gap-1 align-middle">
                      <Eye size={13} aria-hidden />
                      {(article.viewCount ?? 0).toLocaleString("id-ID")} dilihat
                    </span>
                  </>
                )}
              </div>

              <div className="mt-6 h-px bg-border" />

              {/* Featured image from source article */}
              {article.featuredImage && (
                <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-lg">
                  <Image
                    src={article.featuredImage}
                    alt={sorotan.title}
                    fill
                    className="object-cover"
                  />
                </div>
              )}

              {/* Content */}
              <div className="mt-8 space-y-5 text-base sm:text-[17px] leading-[1.85] text-txt-primary text-justify">
                {paragraphs.length > 0 ? (
                  paragraphs.map((p, i) => <p key={i}>{p}</p>)
                ) : (
                  <p>{sorotan.content}</p>
                )}
              </div>

              {/* Continue-reading CTA — prominent navy banner that funnels every
                  sorotan reader to the main article page. */}
              <div className="mt-10 overflow-hidden rounded-lg border-2 border-primary/30 bg-gradient-to-br from-primary-light to-primary-light/40 shadow-card">
                <div className="px-6 pt-6 pb-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                    <BookOpen size={12} />
                    Selesai Baca Sorotan?
                  </span>
                </div>
                <div className="px-6 pb-6">
                  <h3 className="mt-3 font-serif text-headline-sm text-on-surface leading-tight">
                    Lanjutkan ke artikel utama
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold text-txt-primary">
                    {article.title}
                  </p>
                  <p className="mt-2 text-xs text-txt-secondary">
                    Versi lengkap dengan semua fakta, narasumber, kutipan, dan konteks latar belakang.
                  </p>
                  <Link
                    href={`/berita/${article.slug}`}
                    className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-dark active:scale-[0.98]"
                  >
                    Lanjut Baca Artikel Lengkap
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </article>

            {/* Sidebar: other angles for the same article */}
            <aside className="hidden lg:block lg:col-span-1">
              <OtherAngles articleId={article.id} currentSlug={sorotan.slug} />
            </aside>
          </div>

          <meta itemProp="url" content={sorotanUrl} />
        </div>
      </div>
    </>
  );
}

async function OtherAngles({
  articleId,
  currentSlug,
}: {
  articleId: string;
  currentSlug: string;
}) {
  const others = await prisma.sorotan.findMany({
    where: { articleId, slug: { not: currentSlug } },
    orderBy: { angle: "asc" },
  });

  if (others.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-txt-primary">
        Sudut pandang lain
      </h3>
      <ul className="space-y-3">
        {others.map((o) => (
          <li key={o.id}>
            <Link
              href={`/sorotan/${o.slug}`}
              className="group block rounded-md p-2 -mx-2 transition-colors hover:bg-surface-secondary"
            >
              <span
                className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                  ANGLE_COLOR[o.angle] ??
                  "bg-surface-secondary text-txt-secondary border-border"
                }`}
              >
                {ANGLE_LABEL[o.angle] ?? o.angle}
              </span>
              <p className="mt-1.5 text-sm font-medium text-txt-primary transition-colors group-hover:text-primary line-clamp-2">
                {o.title}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
