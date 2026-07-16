import { Metadata } from "next";
import Link from "next/link";
import {
  Calendar,
  TrendingUp,
  Building2,
  Users,
  Coins,
  ScrollText,
  FileText,
  ArrowRight,
} from "lucide-react";
import { prisma } from "@/lib/prisma";

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

const TYPE_META: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  EARNINGS: {
    label: "Laporan Keuangan",
    icon: FileText,
    color: "bg-blue-500",
  },
  IPO: { label: "IPO", icon: TrendingUp, color: "bg-emerald-500" },
  RUPS: { label: "RUPS", icon: Users, color: "bg-purple-500" },
  DIVIDEND: { label: "Dividen", icon: Coins, color: "bg-yellow-500" },
  STOCK_SPLIT: { label: "Stock Split", icon: ScrollText, color: "bg-pink-500" },
  RIGHTS_ISSUE: {
    label: "Rights Issue",
    icon: Building2,
    color: "bg-orange-500",
  },
  OTHER: { label: "Lainnya", icon: Calendar, color: "bg-gray-500" },
};

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function formatTime(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function KalenderEmitenPage() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const ninetyDaysFwd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const [events, typeGroups] = await Promise.all([
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

  // Group events by date key (YYYY-MM-DD)
  const byDate = new Map<string, typeof events>();
  for (const e of events) {
    const key = e.scheduledAt.toISOString().slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(e);
  }

  const typeCounts: Record<string, number> = {};
  for (const g of typeGroups) typeCounts[g.type] = g._count._all;
  const total = events.length;

  const todayKey = now.toISOString().slice(0, 10);

  return (
    <main className="container-main py-8 sm:py-12">
      <header className="mb-8 sm:mb-12">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-primary text-white shrink-0">
            <Calendar size={20} strokeWidth={2.5} />
          </div>
          <h1 className="font-serif text-headline-md sm:text-display-sm font-bold text-on-surface">
            Kalender Emiten
          </h1>
        </div>
        <p className="text-body-md sm:text-body-lg text-on-surface-variant max-w-2xl">
          Jadwal lengkap event emiten Indonesia — release laporan keuangan
          kuartalan, IPO upcoming, RUPS, pengumuman dividen, stock split, dan
          rights issue.
        </p>
      </header>

      {/* Type summary pills */}
      <div className="mb-8 flex flex-wrap gap-2">
        <span className="rounded-full bg-primary text-white px-3 py-1.5 text-xs font-bold">
          Semua ({total})
        </span>
        {Object.entries(TYPE_META).map(([type, meta]) => {
          const count = typeCounts[type] || 0;
          if (count === 0) return null;
          return (
            <span
              key={type}
              className="rounded-full bg-surface-secondary border border-border px-3 py-1.5 text-xs font-medium text-txt-primary"
            >
              {meta.label} ({count})
            </span>
          );
        })}
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-secondary p-12 text-center">
          <Calendar size={40} className="mx-auto text-border mb-3" />
          <p className="text-body-md text-txt-muted">
            Belum ada event terjadwal dalam 90 hari ke depan.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(byDate.entries()).map(([dateKey, dateEvents]) => {
            const date = new Date(dateKey + "T00:00:00");
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
                      <span className="mr-2 inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-white">
                        Hari Ini
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
                    const Icon = meta.icon;
                    return (
                      <article
                        key={event.id}
                        className="card p-4 sm:p-5 flex flex-col"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.color} text-white`}
                          >
                            <Icon size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-txt-muted font-bold">
                              {meta.label}
                            </p>
                            <p className="text-xs text-txt-secondary">
                              {formatTime(event.scheduledAt)} WIB
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

                        {(event.articleId || event.source) && (
                          <div className="flex items-center gap-3 mt-auto pt-2">
                            {event.articleId && (
                              <Link
                                href={`/berita/${event.articleId}`}
                                className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
                              >
                                Coverage <ArrowRight size={10} />
                              </Link>
                            )}
                            {event.source && (
                              <a
                                href={event.source}
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
