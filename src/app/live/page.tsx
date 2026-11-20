import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Metadata } from "next";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Siaran Langsung | Lensaplus",
  description:
    "Ikuti liputan langsung peristiwa hukum, persidangan, dan konferensi pers terkini dari Lensaplus.",
  openGraph: {
    title: "Siaran Langsung | Lensaplus",
    description: "Liputan langsung peristiwa terkini.",
  },
  alternates: { canonical: "/live" },
};

type LiveBlogStatus = "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";

interface LiveBlogCard {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
  status: LiveBlogStatus;
  scheduledAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  coverImage: string | null;
  viewCount: number;
  author: { name: string };
  _count: { entries: number };
}

function StatusBadge({ status }: { status: LiveBlogStatus }) {
  if (status === "LIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 text-label-sm font-bold uppercase tracking-wider text-secondary">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-secondary" />
        </span>
        LIVE
      </span>
    );
  }
  if (status === "SCHEDULED") {
    return (
      <span className="text-label-sm font-bold uppercase tracking-wider text-primary">
        Akan Datang
      </span>
    );
  }
  if (status === "ENDED") {
    return (
      <span className="text-label-sm font-semibold uppercase tracking-wider text-txt-muted">
        Selesai
      </span>
    );
  }
  return null;
}

function LiveCard({ blog }: { blog: LiveBlogCard }) {
  const scheduledDate = new Date(blog.scheduledAt);
  const dateStr = scheduledDate.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });

  return (
    <Link href={`/live/${blog.slug}`} className="card group flex gap-3 sm:block p-3 sm:p-4 hover:shadow-card-hover transition-all">
      {blog.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={blog.coverImage}
          alt={blog.title}
          className="h-20 w-24 sm:h-40 sm:w-full shrink-0 rounded-md sm:rounded-sm sm:mb-3 object-cover"
          loading="lazy"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2 mb-1 sm:mb-2">
          <StatusBadge status={blog.status} />
          {blog.category && (
            <span className="text-[10px] sm:text-label-sm text-txt-muted truncate">{blog.category}</span>
          )}
        </div>
        <h3 className="font-serif text-sm sm:text-title-md font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-2 mb-1">
          {blog.title}
        </h3>
        {blog.description && (
          <p className="text-xs sm:text-body-sm text-txt-secondary line-clamp-1 sm:line-clamp-2 mb-1.5 sm:mb-3">
            {blog.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-label-sm text-txt-muted">
          <span>{dateStr}</span>
          <span>·</span>
          <span>{blog._count.entries} update</span>
        </div>
      </div>
    </Link>
  );
}

async function getLiveBlogs() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    const [liveNow, upcoming, recent] = await Promise.all([
      prisma.liveBlog.findMany({
        where: { status: "LIVE", isPublished: true },
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
          viewCount: true,
          author: { select: { name: true } },
          _count: { select: { entries: true } },
        },
        orderBy: { startedAt: "desc" },
        take: 5,
      }),
      prisma.liveBlog.findMany({
        where: {
          status: "SCHEDULED",
          isPublished: true,
          scheduledAt: { gte: now },
        },
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
          viewCount: true,
          author: { select: { name: true } },
          _count: { select: { entries: true } },
        },
        orderBy: { scheduledAt: "asc" },
        take: 10,
      }),
      prisma.liveBlog.findMany({
        where: {
          status: "ENDED",
          isPublished: true,
          endedAt: { gte: sevenDaysAgo },
        },
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
          viewCount: true,
          author: { select: { name: true } },
          _count: { select: { entries: true } },
        },
        orderBy: { endedAt: "desc" },
        take: 12,
      }),
    ]);
    return { liveNow, upcoming, recent };
  } catch {
    return { liveNow: [], upcoming: [], recent: [] };
  }
}

export default async function LiveListPage() {
  const { liveNow, upcoming, recent } = await getLiveBlogs();

  return (
    <div className="container-main py-8 sm:py-12">
      {/* Page header */}
      <div className="mb-8 border-l-4 border-secondary pl-3">
        <h1 className="font-serif text-headline-sm font-bold text-on-surface">
          Siaran Langsung
        </h1>
        <p className="text-body-md text-txt-muted">
          Liputan real-time peristiwa hukum, persidangan, dan konferensi pers
        </p>
      </div>

      {/* Hero: Currently LIVE */}
      {liveNow.length > 0 && (
        <section className="mb-10" aria-label="Sedang berlangsung">
          <div className="mb-4 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-secondary" />
            </span>
            <h2 className="text-title-md font-bold text-on-surface uppercase tracking-wide">
              Sedang Live
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {liveNow.map((blog) => (
              <LiveCard key={blog.id} blog={blog as LiveBlogCard} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section className="mb-10" aria-label="Akan datang">
          <div className="section-header mb-4">
            <h2 className="section-title">Akan Datang</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((blog) => (
              <LiveCard key={blog.id} blog={blog as LiveBlogCard} />
            ))}
          </div>
        </section>
      )}

      {/* Recent ended */}
      {recent.length > 0 && (
        <section aria-label="Arsip siaran langsung 7 hari terakhir">
          <div className="section-header mb-4">
            <h2 className="section-title">7 Hari Terakhir</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((blog) => (
              <LiveCard key={blog.id} blog={blog as LiveBlogCard} />
            ))}
          </div>
        </section>
      )}

      {liveNow.length === 0 && upcoming.length === 0 && recent.length === 0 && (
        <div className="py-24 text-center text-txt-muted">
          <p className="text-body-lg">Belum ada siaran langsung saat ini.</p>
          <p className="text-body-md mt-1">Pantau halaman ini untuk update terbaru.</p>
        </div>
      )}
    </div>
  );
}
