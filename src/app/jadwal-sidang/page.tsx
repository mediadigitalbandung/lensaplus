export const dynamic = "force-dynamic";

import Link from "next/link";
import { Metadata } from "next";
import { ChevronRight, Gavel, Calendar, MapPin, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Jadwal Sidang",
  description:
    "Jadwal sidang pengadilan yang diliput Kartawarta — sidang berlangsung, akan datang, dan rencana liputan tim.",
  openGraph: {
    title: "Jadwal Sidang - Kartawarta",
    description: "Pantau jadwal sidang pengadilan yang diliput Kartawarta.",
    type: "website",
  },
  alternates: { canonical: "/jadwal-sidang" },
};

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Terjadwal",
  LIVE: "Sedang Berlangsung",
};

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

type ScheduleItem = {
  id: string;
  caseName: string;
  caseNumber: string | null;
  courtName: string;
  scheduledAt: Date;
  status: string;
  notes: string | null;
};

function ScheduleCard({ item }: { item: ScheduleItem }) {
  const isLive = item.status === "LIVE";
  return (
    <article
      className={`relative overflow-hidden rounded-[12px] border bg-surface-container-lowest p-5 shadow-card transition-all hover:shadow-card-hover ${
        isLive ? "border-secondary/30" : "border-border hover:border-primary/40"
      }`}
    >
      {isLive && (
        <span className="absolute left-0 top-0 h-full w-[3px] bg-secondary" aria-hidden />
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                isLive
                  ? "bg-secondary text-white"
                  : "bg-primary/10 text-primary border border-primary/20"
              }`}
            >
              {isLive && (
                <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              )}
              {STATUS_LABEL[item.status] ?? item.status}
            </span>
            {item.caseNumber && (
              <span className="text-xs text-on-surface-variant">
                No. {item.caseNumber}
              </span>
            )}
          </div>
          <h3 className="font-serif text-title-lg leading-snug text-on-surface">
            {item.caseName}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} className="text-primary" />
              {item.courtName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} className="text-primary" />
              {item.scheduledAt.toLocaleString("id-ID", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              WIB
            </span>
          </div>
          {item.notes && (
            <p className="mt-3 text-sm text-on-surface-variant border-l-2 border-border pl-3 italic line-clamp-3">
              {item.notes}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export default async function JadwalSidangPage() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  const schedules = await prisma.courtSchedule.findMany({
    where: {
      status: { in: ["SCHEDULED", "LIVE"] },
      scheduledAt: { gte: todayStart },
    },
    orderBy: { scheduledAt: "asc" },
    take: 100,
  });

  const live = schedules.filter((s) => s.status === "LIVE");
  const today = schedules.filter(
    (s) => s.status !== "LIVE" && s.scheduledAt >= todayStart && s.scheduledAt <= todayEnd,
  );
  const thisWeek = schedules.filter(
    (s) => s.scheduledAt > todayEnd && s.scheduledAt <= weekEnd,
  );
  const later = schedules.filter((s) => s.scheduledAt > weekEnd);

  return (
    <div className="bg-surface min-h-screen">
      <div className="container-main py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-txt-muted">
          <Link href="/" className="hover:text-primary">Beranda</Link>
          <ChevronRight size={14} />
          <span className="font-medium text-txt-primary">Jadwal Sidang</span>
        </nav>

        <div className="mb-8 max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="block h-7 w-[3px] rounded-full bg-primary" />
            <h1 className="flex items-center gap-2 text-xl font-bold text-txt-primary sm:text-2xl lg:text-3xl">
              <Gavel size={22} className="text-primary" />
              Jadwal Sidang
            </h1>
          </div>
          <p className="mt-3 text-sm text-on-surface-variant">
            Pantau agenda sidang yang diliput Kartawarta — mulai dari yang sedang berlangsung,
            jadwal hari ini, hingga sidang yang akan datang.
          </p>
        </div>

        {/* Live */}
        {live.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 flex items-center gap-2 border-l-[3px] border-secondary pl-3 text-lg font-bold text-on-surface">
              <span className="block h-2 w-2 animate-pulse rounded-full bg-secondary" />
              Sedang Berlangsung
            </h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {live.map((s) => (
                <ScheduleCard key={s.id} item={s} />
              ))}
            </div>
          </section>
        )}

        {/* Today */}
        <section className="mb-10">
          <h2 className="mb-4 border-l-[3px] border-primary pl-3 text-lg font-bold text-on-surface">
            Hari Ini
          </h2>
          {today.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {today.map((s) => (
                <ScheduleCard key={s.id} item={s} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">
              Tidak ada sidang yang dijadwalkan hari ini.
            </p>
          )}
        </section>

        {/* This week */}
        <section className="mb-10">
          <h2 className="mb-4 border-l-[3px] border-primary pl-3 text-lg font-bold text-on-surface">
            Pekan Ini
          </h2>
          {thisWeek.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {thisWeek.map((s) => (
                <ScheduleCard key={s.id} item={s} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">
              Belum ada sidang lain dijadwalkan dalam 7 hari ke depan.
            </p>
          )}
        </section>

        {/* Later */}
        {later.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 border-l-[3px] border-primary pl-3 text-lg font-bold text-on-surface">
              Bulan Depan & Selanjutnya
            </h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {later.map((s) => (
                <ScheduleCard key={s.id} item={s} />
              ))}
            </div>
          </section>
        )}

        {/* Empty overall */}
        {schedules.length === 0 && (
          <div className="rounded-[12px] border-2 border-dashed border-border py-16 text-center">
            <Calendar size={36} className="mx-auto text-border" />
            <p className="mt-4 text-on-surface-variant">Belum ada jadwal sidang dipublikasikan.</p>
            <p className="text-sm text-txt-muted">
              Tim redaksi akan memperbarui halaman ini begitu agenda sidang baru tersedia.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
