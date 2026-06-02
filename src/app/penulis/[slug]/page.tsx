export const revalidate = 120; // ISR: revalidate author page every 2 minutes

import { Metadata } from "next";
import ArticleCard from "@/components/artikel/ArticleCard";
import { FileText, Eye, Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { slugify } from "@/lib/utils";

async function getAuthorBySlug(slug: string) {
  // Public profile — never pull password/email/phone into request memory.
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      bio: true,
      role: true,
      specialization: true,
      avatar: true,
      createdAt: true,
    },
  });
  return users.find((u) => slugify(u.name) === slug) || null;
}

export async function generateMetadata({ params: paramsPromise }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await paramsPromise;
  const author = await getAuthorBySlug(params.slug);
  if (!author) return { title: "Penulis Tidak Ditemukan" };

  return {
    title: `${author.name} - Penulis`,
    description: author.bio || `Profil penulis ${author.name} di Kartawarta.`,
    alternates: {
      canonical: `/penulis/${params.slug}`,
    },
  };
}

export default async function PenulisPage({ params: paramsPromise }: { params: Promise<{ slug: string }> }) {
  const params = await paramsPromise;
  const author = await getAuthorBySlug(params.slug);
  if (!author) notFound();

  const [articles, viewAgg] = await Promise.all([
    prisma.article.findMany({
      where: { status: "PUBLISHED", authorId: author.id },
      include: { author: { select: { name: true, avatar: true } }, category: true },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.article.aggregate({
      where: { status: "PUBLISHED", authorId: author.id },
      _sum: { viewCount: true },
    }),
  ]);

  const totalArticles = articles.length;
  const totalViews = viewAgg._sum.viewCount || 0;
  const joinedDate = author.createdAt.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";
  const authorJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: author.name,
      description: author.bio || `Penulis di Kartawarta`,
      url: `${siteUrl}/penulis/${params.slug}`,
      worksFor: { "@type": "Organization", name: "Kartawarta", url: siteUrl },
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Beranda", item: siteUrl },
        { "@type": "ListItem", position: 2, name: author.name, item: `${siteUrl}/penulis/${params.slug}` },
      ],
    },
  };

  return (
    <div className="bg-surface min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(authorJsonLd) }} />
      <div className="container-main py-8">
        {/* Author profile */}
        <div className="rounded-[12px] border border-border bg-surface p-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-primary text-4xl font-bold text-white">
              {author.name.charAt(0)}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-xl font-bold text-txt-primary sm:text-2xl lg:text-3xl">
                {author.name}
              </h1>
              <p className="mt-1 text-sm text-primary">{author.role.replace(/_/g, " ")}</p>
              {author.specialization && (
                <p className="text-sm text-txt-muted">
                  Spesialisasi: {author.specialization}
                </p>
              )}
              <p className="mt-3 max-w-xl text-sm text-txt-secondary">
                {author.bio}
              </p>

              <div className="mt-4 flex flex-wrap justify-center gap-4 sm:gap-6 sm:justify-start">
                <div className="flex items-center gap-1.5 text-sm text-txt-muted">
                  <FileText size={14} />
                  <span className="font-semibold text-txt-primary">
                    {totalArticles}
                  </span>{" "}
                  artikel
                </div>
                <div className="flex items-center gap-1.5 text-sm text-txt-muted">
                  <Eye size={14} />
                  <span className="font-semibold text-txt-primary">
                    {totalViews.toLocaleString("id-ID")}
                  </span>{" "}
                  views
                </div>
                <div className="flex items-center gap-1.5 text-sm text-txt-muted">
                  <Calendar size={14} />
                  Bergabung {joinedDate}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Articles by author */}
        <div className="mt-8">
          <h2 className="mb-4 flex items-center gap-3 text-base font-bold text-txt-primary sm:text-lg lg:text-xl">
            <span className="block h-6 w-[3px] rounded-full bg-primary" />
            Artikel oleh {author.name}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.slug} {...article} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
