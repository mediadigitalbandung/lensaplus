import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { safeHref } from "@/components/common/safeHref";
import { getWibDateParts, wibStartOfDayFromKey } from "@/components/common/wib-date";

export const revalidate = 600; // 10-min ISR

export const metadata: Metadata = {
  title: "Kalender Emiten — Earnings, IPO, RUPS, Dividen | Lensaplus",
  description:
    "Jadwal lengkap event emiten Indonesia: release laporan keuangan kuartalan, IPO upcoming, RUPS, pengumuman dividen, stock split, rights issue.",
  openGraph: {
    title: "Kalender Emiten Indonesia | Lensaplus",
    description:
      "Jadwal lengkap event emiten: earnings, IPO, RUPS, dividen.",
  },
};

const TYPE_META: Record<string, { label: string }> = {
  EARNINGS: { label: "Laporan Keuangan" },
  IPO: { label: "IPO" },
  RUPS: { label: "RUPS" },
  DIVIDEND: { label: "Dividen" },
  STOCK_SPLIT: { label: "Stock Split" },
  RIGHTS_ISSUE: { label: "Rights Issue" },
  OTHER: { label: "Lainnya" },
};

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(d);
}

function formatTime(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(d);
}

interface MarketEventItem {
  id: string;
  type: string;
  title: string;
  companyName: string;
  ticker: string | null;
  description: string | null;
  scheduledAt: Date;
  articleId: string | null;
  source: string | null;
}

interface EventTypeGroup {
  type: string;
  _count: { _all: number };
}

export default async function KalenderEmitenPage() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const ninetyDaysFwd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  let events: MarketEventItem[] = [];
  let typeGroups: EventTypeGroup[] = [];
  let slugByArticleId = new Map<string, string>();
  try {
    [events, typeGroups] = await Promise.all([
      prisma.marketEvent.findMany({
        where: {
          isPublished: true,
          scheduledAt: { gte: sevenDaysAgo, lte: ninetyDaysFwd },
        },
        orderBy: { scheduledAt: "asc" },
        take: 200,
      }),
      prisma.marketEvent.groupBy({
        by: ["type"],
        where: {
          isPublished: true,
          scheduledAt: { gte: sevenDaysAgo, lte: ninetyDaysFwd },
        },
        _count: { _all: true },
      }),
    ]);

    const articleIds = Array.from(
      new Set(events.map((e) => e.articleId).filter((id): id is string => Boolean(id)))
    );
    if (articleIds.length > 0) {
      const linkedArticles = await prisma.article.findMany({
        where: { id: { in: articleIds }, status: "PUBLISHED" },
        select: { id: true, slug: true },
      });
      slugByArticleId = new Map(linkedArticles.map((a) => [a.id, a.slug]));
    }
  } catch {
    events = [];
    typeGroups = [];
  }

  // Group events by WIB date key (YYYY-MM-DD in Asia/Jakarta)
  const byDate = new Map<string, MarketEventItem[]>();
  for (const e of events) {
    const key = getWibDateParts(new Date(e.scheduledAt)).key;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(e);
  }

  const typeCounts: Record<string, number> = {};
  for (const g of typeGroups) typeCounts[g.type] = g._count._all;
  const total = events.length;

  const todayKey = getWibDateParts(now).key;

  return (
    <main className="container-main py-8 sm:py-12">
      <header className="mb-8 sm:mb-12">
        <div className="mb-3">
          <h1 className="font-serif text-headline-md sm:text-display-sm font-bold text-on-surface border-l-4 border-primary pl-3">
            Kalender Emiten
          </h1>
        </div>
        <p className="text-body-md sm:text-body-lg text-on-surface-variant max-w-2xl">
          Jadwal lengkap event emiten Indonesia — release laporan keuangan
          kuartalan, IPO upcoming, RUPS, pengumuman dividen, stock split, dan
          rights issue.
        </p>
      </header>

      {/* Type summary strip */}
      <div className="mb-8 flex flex-wrap gap-x-5 gap-y-2 border-b border-border pb-3 text-xs">
        <span className="font-bold text-primary border-b-2 border-primary pb-1">
          Semua ({total})
        </span>
        {Object.entries(TYPE_META).map(([type, meta]) => {
          const count = typeCounts[type] || 0;
          if (count === 0) return null;
          return (
            <span
              key={type}
              className="font-medium text-txt-secondary pb-1"
            >
              {meta.label} ({count})
            </span>
          );
        })}
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <p className="text-body-md text-txt-muted">
            Belum ada event terjadwal dalam 90 hari ke depan.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(byDate.entries()).map(([dateKey, dateEvents]) => {
            const date = wibStartOfDayFromKey(dateKey);
            const isPast = dateKey < todayKey;
            const isToday = dateKey === todayKey;

            return (
              <section key={dateKey} className={isPast ? "opacity-60" : ""}>
                <div className="flex items-center gap-3 mb-3">
                  <h2
                    className={`font-serif text-headline-sm font-bold ${
                      isToday ? "text-secondary" : "text-on-surface"
                    }`}
                  >
                    {isToday && (
                      <span className="mr-2 text-xs font-bold uppercase tracking-wider text-secondary">
                        Hari Ini —
                      </span>
                    )}
                    {formatDate(date)}
                  </h2>
                  {isPast && (
                    <span className="text-xs text-txt-muted font-medium">
                      (Selesai)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {dateEvents.map((event) => {
                    const meta = TYPE_META[event.type] ?? TYPE_META.OTHER;
                    const articleSlug = event.articleId
                      ? slugByArticleId.get(event.articleId)
                      : undefined;
                    const safeSourceUrl = safeHref(event.source);
                    return (
                      <article
                        key={event.id}
                        className="card p-4 sm:p-5 flex flex-col"
                      >
                        <div className="mb-3">
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-primary font-bold">
                              {meta.label}
                            </p>
                            <p className="text-xs text-txt-secondary mt-0.5">
                              {formatTime(new Date(event.scheduledAt))} WIB
                              {event.ticker && (
                                <span className="ml-2 font-mono font-bold text-primary">
                                  {event.ticker}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <h3 className="text-sm font-bold text-on-surface mb-1 leading-snug line-clamp-2">
                          {event.title}
                        </h3>

                        <p className="text-xs text-txt-secondary mb-2 line-clamp-1">
                          {event.companyName}
                        </p>

                        {event.description && (
                          <p className="text-xs text-txt-muted line-clamp-3 mb-3">
                            {event.description}
                          </p>
                        )}

                        {(articleSlug || safeSourceUrl) && (
                          <div className="flex items-center gap-3 mt-auto pt-2">
                            {articleSlug && (
                              <Link
                                href={`/berita/${articleSlug}`}
                                className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
                              >
                                Coverage <ArrowRight size={10} aria-hidden="true" />
                              </Link>
                            )}
                            {safeSourceUrl && (
                              <a
                                href={safeSourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-txt-muted hover:text-txt-primary hover:underline"
                              >
                                Sumber IDX
                              </a>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <footer className="mt-12 pt-6 border-t border-border">
        <p className="text-xs text-txt-muted">
          Data diperbarui oleh redaksi. Untuk kontribusi event atau koreksi
          jadwal, hubungi{" "}
          <a
            href="mailto:redaksi@lensaplus.com"
            className="text-primary hover:underline"
          >
            redaksi@lensaplus.com
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
