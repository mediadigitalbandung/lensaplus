import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Metadata } from "next";
import { Radio, Clock, CheckCircle, Calendar } from "lucide-react";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Siaran Langsung | Kartawarta",
  description:
    "Ikuti liputan langsung peristiwa hukum, persidangan, dan konferensi pers terkini dari Kartawarta.",
  openGraph: {
    title: "Siaran Langsung | Kartawarta",
    description: "Liputan langsung peristiwa terkini.",
  },
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
      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-label-sm font-bold text-white">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        LIVE
      </span>
    );
  }
  if (status === "SCHEDULED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-1 text-label-sm font-semibold text-primary">
        <Calendar size={10} />
        Akan Datang
      </span>
    );
  }
  if (status === "ENDED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-low px-2.5 py-1 text-label-sm text-txt-muted">
        <CheckCircle size={10} />
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
    <Link href={`/live/${blog.slug}`} className="card group block p-4 hover:shadow-card-hover transition-all">
      {blog.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={blog.coverImage}
          alt={blog.title}
          className="mb-3 h-40 w-full rounded-sm object-cover"
          loading="lazy"
        />
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <StatusBadge status={blog.status} />
        {blog.category && (
          <span className="text-label-sm text-txt-muted">{blog.category}</span>
        )}
      </div>
      <h3 className="font-serif text-title-md font-bold text-on-surface group-hover:text-secondary transition-colors line-clamp-2 mb-1">
        {blog.title}
      </h3>
      {blog.description && (
        <p className="text-body-sm text-txt-secondary line-clamp-2 mb-3">
          {blog.description}
        </p>
      )}
      <div className="flex items-center gap-3 text-label-sm text-txt-muted">
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {dateStr}
        </span>
        <span>{blog._count.entries} update</span>
      </div>
    </Link>
  );
}

async function getLiveBlogs() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

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
}

export default async function LiveListPage() {
  const { liveNow, upcoming, recent } = await getLiveBlogs();

  return (
    <main className="container-main py-8 sm:py-12">
      {/* Page header */}
      <div className="mb-8 flex items-center gap-3">
        <Radio size={28} className="text-secondary" />
        <div>
          <h1 className="font-serif text-headline-sm font-bold text-on-surface">
            Siaran Langsung
          </h1>
          <p className="text-body-md text-txt-muted">
            Liputan real-time peristiwa hukum, persidangan, dan konferensi pers
          </p>
        </div>
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
          <Radio size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-body-lg">Belum ada siaran langsung saat ini.</p>
          <p className="text-body-md mt-1">Pantau halaman ini untuk update terbaru.</p>
        </div>
      )}
    </main>
  );
}
