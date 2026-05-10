import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import LiveBlogTimeline, {
  LiveBlogEntry,
} from "@/components/live/LiveBlogTimeline";
import { Radio, Clock, ArrowLeft, ExternalLink } from "lucide-react";

export const revalidate = 30;

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const blog = await prisma.liveBlog.findUnique({
    where: { slug: params.slug, isPublished: true },
    select: { title: true, description: true, coverImage: true, status: true },
  });

  if (!blog) {
    return { title: "Siaran Langsung | Kartawarta" };
  }

  return {
    title: `${blog.title} | Siaran Langsung Kartawarta`,
    description:
      blog.description ||
      `Ikuti siaran langsung: ${blog.title}`,
    openGraph: {
      title: blog.title,
      description: blog.description ?? undefined,
      images: blog.coverImage ? [blog.coverImage] : undefined,
      type: "article",
    },
    robots:
      blog.status === "SCHEDULED"
        ? { index: true, follow: true }
        : undefined,
  };
}

function StatusBadge({ status }: { status: string }) {
  if (status === "LIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-label-md font-bold text-white">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
        </span>
        LIVE
      </span>
    );
  }
  if (status === "SCHEDULED") {
    return (
      <span className="badge badge-green">Akan Datang</span>
    );
  }
  if (status === "ENDED") {
    return (
      <span className="badge">Selesai</span>
    );
  }
  if (status === "CANCELLED") {
    return (
      <span className="badge">Dibatalkan</span>
    );
  }
  return null;
}

function buildJsonLd(blog: {
  title: string;
  description: string | null;
  slug: string;
  status: string;
  scheduledAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  coverImage: string | null;
  author: { name: string };
  entries: Array<{ id: string; content: string; postedAt: Date }>;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kartawarta.com";
  const liveEntry = blog.entries.map((e) => ({
    "@type": "BlogPosting",
    "@id": `${baseUrl}/live/${blog.slug}#${e.id}`,
    articleBody: e.content.replace(/<[^>]*>/g, "").slice(0, 500),
    datePublished: e.postedAt.toISOString(),
  }));

  return {
    "@context": "https://schema.org",
    "@type": "LiveBlogPosting",
    headline: blog.title,
    description: blog.description ?? undefined,
    url: `${baseUrl}/live/${blog.slug}`,
    startDate: blog.scheduledAt.toISOString(),
    endDate: blog.endedAt?.toISOString(),
    coverageStartTime: blog.startedAt?.toISOString(),
    coverageEndTime: blog.endedAt?.toISOString(),
    image: blog.coverImage ?? undefined,
    author: {
      "@type": "Person",
      name: blog.author.name,
    },
    publisher: {
      "@type": "Organization",
      name: "Kartawarta",
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/kartawarta-icon.png`,
      },
    },
    liveBlogUpdate: liveEntry,
  };
}

export default async function LiveBlogDetailPage({ params }: Props) {
  const blog = await prisma.liveBlog.findUnique({
    where: { slug: params.slug, isPublished: true },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      category: true,
      status: true,
      scheduledAt: true,
      startedAt: true,
      endedAt: true,
      coverImage: true,
      articleId: true,
      viewCount: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
      entries: {
        orderBy: [{ isPinned: "desc" }, { postedAt: "desc" }],
        take: 50,
        select: {
          id: true,
          content: true,
          postedAt: true,
          authorId: true,
          isPinned: true,
          isHighlight: true,
          imageUrl: true,
          videoUrl: true,
        },
      },
    },
  });

  if (!blog) notFound();

  const isLive = blog.status === "LIVE";

  // Increment view count
  prisma.liveBlog
    .update({ where: { id: blog.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  const jsonLd = buildJsonLd({
    ...blog,
    entries: blog.entries.map((e) => ({
      ...e,
      postedAt: new Date(e.postedAt),
    })),
    scheduledAt: new Date(blog.scheduledAt),
    startedAt: blog.startedAt ? new Date(blog.startedAt) : null,
    endedAt: blog.endedAt ? new Date(blog.endedAt) : null,
  });

  const scheduledDateStr = new Date(blog.scheduledAt).toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });

  // Cast entries for the client component
  const initialEntries: LiveBlogEntry[] = blog.entries.map((e) => ({
    ...e,
    postedAt: new Date(e.postedAt).toISOString(),
  }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="container-main py-6 sm:py-10">
        {/* Back */}
        <Link
          href="/live"
          className="mb-6 inline-flex items-center gap-1.5 text-body-sm text-txt-muted hover:text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          Siaran Langsung
        </Link>

        {/* Hero */}
        <header className="mb-8">
          {blog.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={blog.coverImage}
              alt={blog.title}
              className="mb-6 h-56 w-full rounded-md object-cover sm:h-72"
            />
          )}

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <StatusBadge status={blog.status} />
            {blog.category && (
              <span className="text-label-sm text-txt-muted">{blog.category}</span>
            )}
          </div>

          <h1 className="font-serif text-headline-md font-bold text-on-surface mb-3">
            {blog.title}
          </h1>

          {blog.description && (
            <p className="text-body-lg text-txt-secondary mb-4">
              {blog.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-label-sm text-txt-muted">
            <span className="flex items-center gap-1.5">
              <Radio size={13} className="text-primary" />
              Diliput oleh {blog.author.name}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={13} />
              {scheduledDateStr} WIB
            </span>
            <span>{blog.entries.length} update</span>
            {blog.articleId && (
              <Link
                href={`/artikel/${blog.articleId}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink size={12} />
                Baca artikel terkait
              </Link>
            )}
          </div>
        </header>

        {/* Timeline */}
        <div className="max-w-2xl">
          <LiveBlogTimeline
            slug={blog.slug}
            initialEntries={initialEntries}
            isLive={isLive}
          />
        </div>
      </main>
    </>
  );
}
