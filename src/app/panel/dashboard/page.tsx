"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Eye,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Users,
  Megaphone,
  XCircle,
  Send,
  BarChart3,
  Layers,
  CalendarClock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Vote,
  Sparkles,
  BookOpen,
  Share2,
  Folder,
  Tag,
  Bot,
  Settings,
  Highlighter,
  Newspaper,
  Music,
  Mail,
  Activity,
  Radio,
  Bell,
} from "lucide-react";

interface Article {
  id: string;
  title: string;
  slug: string;
  status: string;
  viewCount: number;
  publishedAt: string | null;
  scheduledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string | null;
  author?: { name: string };
  category?: { name: string; id: string };
  reviewerName?: string | null;
}

interface StatsItem {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  href?: string;
  hint?: string;
  accent?: "primary" | "warn" | "danger" | "info" | "ok" | "muted";
}

import { CREATOR_ROLES, EDITOR_ROLES } from "@/lib/roles";
import CronHealthWidget from "@/components/dashboard/CronHealthWidget";
import PowerWidgets from "@/components/dashboard/PowerWidgets";
import CountUp from "@/components/panel/CountUp";

const statusColors: Record<string, string> = {
  PUBLISHED: "bg-primary-light text-primary",
  IN_REVIEW: "bg-yellow-50 text-yellow-600",
  DRAFT: "bg-surface-tertiary text-txt-secondary",
  REJECTED: "bg-red-50 text-red-600",
  APPROVED: "bg-blue-50 text-blue-600",
  ARCHIVED: "bg-surface-tertiary text-txt-muted",
};

const statusLabels: Record<string, string> = {
  PUBLISHED: "Dipublikasi",
  IN_REVIEW: "Menunggu Review",
  DRAFT: "Draf",
  REJECTED: "Ditolak",
  APPROVED: "Disetujui",
  ARCHIVED: "Diarsipkan",
};

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[12px] border border-border bg-surface p-4 shadow-card"
          >
            <div className="h-8 w-8 rounded-[12px] bg-surface-tertiary" />
            <div className="mt-2 h-7 w-16 rounded bg-surface-tertiary" />
            <div className="mt-1 h-3 w-20 rounded bg-surface-secondary" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-[12px] border border-border bg-surface shadow-card">
          <div className="border-b border-border px-5 py-4">
            <div className="h-5 w-32 rounded bg-surface-tertiary" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3">
              <div className="flex-1">
                <div className="h-4 w-3/4 rounded bg-surface-tertiary" />
                <div className="mt-1 h-3 w-24 rounded bg-surface-secondary" />
              </div>
              <div className="ml-4 h-5 w-20 rounded-full bg-surface-tertiary" />
            </div>
          ))}
        </div>
        <div className="rounded-[12px] border border-border bg-surface p-5 shadow-card">
          <div className="h-5 w-24 rounded bg-surface-tertiary" />
        </div>
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  return num.toLocaleString("id-ID");
}

const accentBar: Record<NonNullable<StatsItem["accent"]>, string> = {
  primary: "from-primary/80 via-primary/40 to-transparent",
  warn: "from-yellow-400/80 via-yellow-300/40 to-transparent",
  danger: "from-red-500/80 via-red-400/40 to-transparent",
  info: "from-blue-500/80 via-blue-400/40 to-transparent",
  ok: "from-emerald-500/80 via-emerald-400/40 to-transparent",
  muted: "from-txt-muted/40 via-txt-muted/20 to-transparent",
};

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="kw-reveal mb-4 group">
      <div className="flex items-end justify-between gap-3 mb-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/20 transition-transform group-hover:scale-110 group-hover:rotate-3">
            <Icon size={16} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-txt-primary tracking-tight truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[10px] sm:text-[11px] text-txt-muted truncate font-medium">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action && (
          <Link
            href={action.href}
            className="text-xs font-semibold text-primary hover:text-primary-dark transition-all hover:gap-1.5 inline-flex items-center gap-1 whitespace-nowrap"
          >
            {action.label} <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
          </Link>
        )}
      </div>
      {/* Gradient underline yang shimmer on section hover */}
      <div className="kw-section-bar h-[2px] w-12 rounded-full opacity-80" />
    </div>
  );
}

function PremiumStatCard({ stat }: { stat: StatsItem }) {
  const Icon = stat.icon;
  const isClickable = !!stat.href;
  const Wrapper: any = isClickable ? Link : "div";
  const wrapperProps = isClickable ? { href: stat.href! } : {};
  const accent = stat.accent ?? "info";

  // Detect special "live" state pada Live Blog card supaya bisa pulse-glow
  const isLiveAlert = stat.label === "Live Blog" && accent === "danger" && stat.value !== "0";

  return (
    <Wrapper
      {...wrapperProps}
      className={`kw-card-glow kw-fade-in-up group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface to-surface-secondary/30 p-3 sm:p-4 shadow-card transition-all duration-300 ${
        isClickable ? "hover:-translate-y-1 hover:shadow-ambient hover:border-primary/40 cursor-pointer" : ""
      } ${isLiveAlert ? "kw-pulse-live border-secondary/40" : ""}`}
      aria-label={isClickable ? `Buka ${stat.label}` : undefined}
    >
      {/* Top accent bar — gradient yang lebih bold + shimmer on hover */}
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentBar[accent]} opacity-70 group-hover:opacity-100 transition-opacity`}
      />

      {/* Decorative blob — subtle background per accent supaya tiap card punya identitas warna */}
      <div
        className={`pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br ${accentBar[accent]} opacity-[0.05] group-hover:opacity-[0.10] transition-opacity blur-2xl`}
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between gap-2">
        <div
          className={`inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl ${stat.color} shadow-sm ring-1 ring-inset ring-black/5 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-md`}
        >
          <Icon size={18} />
        </div>
        {isClickable && (
          <ChevronRight
            size={16}
            className="text-txt-muted opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all duration-300 -translate-x-2 group-hover:translate-x-0"
          />
        )}
      </div>

      <div className="relative mt-3">
        <p className="kw-stat-number text-2xl sm:text-3xl xl:text-[32px] font-extrabold leading-none text-txt-primary tracking-tight">
          <CountUp value={stat.value} duration={800} />
        </p>
        <p className="mt-2 text-[11px] sm:text-xs font-semibold text-txt-secondary truncate group-hover:text-txt-primary transition-colors">
          {stat.label}
        </p>
        {stat.hint && (
          <p className="mt-0.5 text-[10px] sm:text-[11px] text-txt-muted truncate font-medium">
            {stat.hint}
          </p>
        )}
      </div>
    </Wrapper>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// --- Analytics Components ---

// Donut chart for article status distribution
// Recent activity feed
function RecentActivity({ articles }: { articles: Article[] }) {
  const activities = useMemo(() => {
    return [...articles]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8)
      .map((a) => {
        const actionMap: Record<string, { label: string; color: string; icon: string }> = {
          PUBLISHED: { label: "dipublikasikan", color: "text-primary", icon: "bg-primary" },
          IN_REVIEW: { label: "diajukan review", color: "text-yellow-600", icon: "bg-yellow-500" },
          APPROVED: { label: "disetujui", color: "text-blue-600", icon: "bg-blue-500" },
          REJECTED: { label: "ditolak", color: "text-red-600", icon: "bg-red-500" },
          DRAFT: { label: "disimpan sebagai draf", color: "text-txt-secondary", icon: "bg-gray-400" },
          ARCHIVED: { label: "diarsipkan", color: "text-txt-muted", icon: "bg-gray-500" },
        };
        const action = actionMap[a.status] || actionMap.DRAFT;
        const timeAgo = getTimeAgo(a.updatedAt);
        return { ...a, action, timeAgo };
      });
  }, [articles]);

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
      <div className="border-b border-border px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-txt-primary">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
            <Clock size={14} className="text-blue-500" />
          </div>
          Aktivitas Terbaru
        </h2>
      </div>
      <div className="divide-y divide-border">
        {activities.length === 0 ? (
          <div className="p-5 text-center text-sm text-txt-muted">Belum ada aktivitas.</div>
        ) : (
          activities.map((a, i) => (
            <Link key={`${a.id}-${i}`} href={`/panel/artikel/${a.id}/edit`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-3 hover:bg-surface-secondary/50 transition-colors">
              <div className={`h-2 w-2 rounded-full ${a.action.icon}`} />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-txt-primary truncate">{a.title}</p>
                <p className="text-[11px] text-txt-muted mt-0.5">
                  {a.author?.name || "—"} &middot; {a.timeAgo}
                </p>
              </div>
              <span className={`rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
                a.action.color === "text-primary" ? "bg-primary-light text-primary" :
                a.action.color === "text-yellow-600" ? "bg-yellow-50 text-yellow-600" :
                a.action.color === "text-blue-600" ? "bg-blue-50 text-blue-600" :
                a.action.color === "text-red-600" ? "bg-red-50 text-red-600" :
                "bg-surface-tertiary text-txt-secondary"
              }`}>{a.action.label}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = new Date().getTime();
  const then = new Date(dateStr).getTime();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} hari lalu`;
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

// Top articles ranked by views with horizontal bar
function ViewsRanking({ articles }: { articles: Article[] }) {
  const data = useMemo(() => {
    return [...articles]
      .filter((a) => a.status === "PUBLISHED")
      .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
      .slice(0, 10);
  }, [articles]);

  const totalViews = articles.filter(a => a.status === "PUBLISHED").reduce((s, a) => s + (a.viewCount || 0), 0);
  const publishedCount = articles.filter(a => a.status === "PUBLISHED").length;
  const avgViews = publishedCount > 0 ? Math.round(totalViews / publishedCount) : 0;
  const maxViews = data[0]?.viewCount || 1;

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
      <div className="border-b border-border px-6 py-5">
        <h2 className="flex items-center gap-2.5 text-base font-bold text-txt-primary">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light">
            <TrendingUp size={16} className="text-primary" />
          </div>
          Statistik Tayangan
        </h2>
      </div>
      <div className="p-6">
        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl bg-surface-secondary p-4">
            <p className="text-xs text-txt-muted mb-1">Total Tayangan</p>
            <p className="text-2xl font-extrabold text-txt-primary">{formatNumber(totalViews)}</p>
          </div>
          <div className="rounded-xl bg-surface-secondary p-4">
            <p className="text-xs text-txt-muted mb-1">Artikel Terpublikasi</p>
            <p className="text-2xl font-extrabold text-txt-primary">{formatNumber(publishedCount)}</p>
          </div>
          <div className="rounded-xl bg-surface-secondary p-4">
            <p className="text-xs text-txt-muted mb-1">Rata-rata/Artikel</p>
            <p className="text-2xl font-extrabold text-txt-primary">{formatNumber(avgViews)}</p>
          </div>
        </div>

        {/* Ranked bar list */}
        <p className="text-sm font-semibold text-txt-secondary mb-3">Top 10 Artikel Terpopuler</p>
        {data.length === 0 ? (
          <p className="text-sm text-txt-muted py-4 text-center">Belum ada artikel terpublikasi.</p>
        ) : (
          <div className="space-y-3">
            {data.map((article, i) => {
              const pct = (article.viewCount / maxViews) * 100;
              return (
                <Link
                  key={article.id}
                  href={`/panel/artikel/${article.id}/edit`}
                  className="block group"
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                      i < 3 ? "bg-primary text-white" : "bg-surface-tertiary text-txt-secondary"
                    }`}>
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium text-txt-primary truncate group-hover:text-primary transition-colors">
                      {article.title}
                    </span>
                    <span className="text-sm font-bold text-txt-primary shrink-0">
                      {formatNumber(article.viewCount)}
                    </span>
                  </div>
                  <div className="ml-9 h-2 rounded-full bg-surface-tertiary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        i === 0 ? "bg-primary" : i < 3 ? "bg-primary/70" : "bg-primary/30"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Creator-specific stats component
function MyArticleStats({ articles }: { articles: Article[] }) {
  const totalViews = articles.reduce((s, a) => s + (a.viewCount || 0), 0);
  const avgViews = articles.length > 0 ? Math.round(totalViews / articles.length) : 0;
  const totalArticles = articles.length;

  // Top 5 articles by views
  const top5 = useMemo(() => {
    return [...articles]
      .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
      .slice(0, 5);
  }, [articles]);
  const maxViews = top5[0]?.viewCount || 1;

  // Status breakdown
  const statusBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    articles.forEach((a) => {
      map.set(a.status, (map.get(a.status) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [articles]);

  // Monthly productivity (last 6 months)
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: { label: string; count: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString("id-ID", { month: "short", year: "numeric" });
      const monthNum = d.getMonth();
      const yearNum = d.getFullYear();
      const count = articles.filter((a) => {
        const created = new Date(a.createdAt);
        return created.getMonth() === monthNum && created.getFullYear() === yearNum;
      }).length;
      months.push({ label, count });
    }
    return months;
  }, [articles]);
  const maxMonthly = Math.max(...monthlyData.map((m) => m.count), 1);

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
      <div className="border-b border-border px-6 py-5">
        <h2 className="flex items-center gap-2.5 text-base font-bold text-txt-primary">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light">
            <TrendingUp size={16} className="text-primary" />
          </div>
          Statistik Artikel Saya
        </h2>
      </div>
      <div className="p-6">
        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl bg-surface-secondary p-4">
            <p className="text-xs text-txt-muted mb-1">Total Views Saya</p>
            <p className="text-2xl font-extrabold text-txt-primary">{formatNumber(totalViews)}</p>
          </div>
          <div className="rounded-xl bg-surface-secondary p-4">
            <p className="text-xs text-txt-muted mb-1">Rata-rata Views/Artikel</p>
            <p className="text-2xl font-extrabold text-txt-primary">{formatNumber(avgViews)}</p>
          </div>
          <div className="rounded-xl bg-surface-secondary p-4">
            <p className="text-xs text-txt-muted mb-1">Total Artikel Saya</p>
            <p className="text-2xl font-extrabold text-txt-primary">{formatNumber(totalArticles)}</p>
          </div>
        </div>

        {/* Status breakdown */}
        {statusBreakdown.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-semibold text-txt-secondary mb-3">Artikel per Status</p>
            <div className="flex flex-wrap gap-2">
              {statusBreakdown.map(([status, count]) => (
                <span key={status} className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[status] || "bg-surface-tertiary text-txt-secondary"}`}>
                  {statusLabels[status] || status}: {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Top 5 articles by views */}
        <p className="text-sm font-semibold text-txt-secondary mb-3">Top 5 Artikel Saya</p>
        {top5.length === 0 ? (
          <p className="text-sm text-txt-muted py-4 text-center">Belum ada artikel.</p>
        ) : (
          <div className="space-y-3 mb-6">
            {top5.map((article, i) => {
              const pct = (article.viewCount / maxViews) * 100;
              return (
                <Link
                  key={article.id}
                  href={`/panel/artikel/${article.id}/edit`}
                  className="block group"
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                      i < 3 ? "bg-primary text-white" : "bg-surface-tertiary text-txt-secondary"
                    }`}>
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium text-txt-primary truncate group-hover:text-primary transition-colors">
                      {article.title}
                    </span>
                    <span className="text-sm font-bold text-txt-primary shrink-0">
                      {formatNumber(article.viewCount)}
                    </span>
                  </div>
                  <div className="ml-9 h-2 rounded-full bg-surface-tertiary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        i === 0 ? "bg-primary" : i < 3 ? "bg-primary/70" : "bg-primary/30"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Monthly productivity */}
        <p className="text-sm font-semibold text-txt-secondary mb-3">Produktivitas Bulanan</p>
        <div className="space-y-2">
          {monthlyData.map((month, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-20 text-xs text-txt-secondary text-right shrink-0 font-medium">
                {month.label}
              </span>
              <div className="flex-1 h-5 bg-surface-secondary rounded-md overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary-dark rounded-md transition-all duration-500 flex items-center justify-end pr-1.5"
                  style={{ width: `${(month.count / maxMonthly) * 100}%`, minWidth: month.count > 0 ? "24px" : "0px" }}
                >
                  {month.count > 0 && (
                    <span className="text-[10px] font-bold text-white">{month.count}</span>
                  )}
                </div>
              </div>
              {month.count === 0 && (
                <span className="w-4 text-xs text-txt-muted text-right">0</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Publication rate ring
function WeeklyArticleTrend({ articles }: { articles: Article[] }) {
  const weekData = useMemo(() => {
    const now = new Date();
    const days: { label: string; count: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric" });

      const count = articles.filter((a) => {
        const created = new Date(a.createdAt).toISOString().split("T")[0];
        return created === dayStr;
      }).length;

      days.push({ label, count });
    }
    return days;
  }, [articles]);

  const maxCount = Math.max(...weekData.map((d) => d.count), 1);

  const totalWeek = weekData.reduce((s, d) => s + d.count, 0);

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
      <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-txt-primary">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
            <BarChart3 size={14} className="text-blue-500" />
          </div>
          Aktivitas Mingguan
        </h2>
        <span className="text-xs text-txt-muted">{totalWeek} artikel</span>
      </div>
      <div className="p-5 space-y-2">
        {weekData.map((day, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-16 text-xs text-txt-secondary text-right shrink-0 font-medium">
              {day.label}
            </span>
            <div className="flex-1 h-5 bg-surface-secondary rounded-md overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary-dark rounded-md transition-all duration-500 flex items-center justify-end pr-1.5"
                style={{ width: `${(day.count / maxCount) * 100}%`, minWidth: day.count > 0 ? "24px" : "0px" }}
              >
                {day.count > 0 && (
                  <span className="text-[10px] font-bold text-white">{day.count}</span>
                )}
              </div>
            </div>
            {day.count === 0 && (
              <span className="w-4 text-xs text-txt-muted text-right">0</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryPerformance({ articles }: { articles: Article[] }) {
  const categoryData = useMemo(() => {
    const map = new Map<string, { name: string; count: number; views: number }>();

    articles.forEach((a) => {
      const catName = a.category?.name || "Tanpa Kategori";
      const existing = map.get(catName) || { name: catName, count: 0, views: 0 };
      existing.count += 1;
      existing.views += a.viewCount || 0;
      map.set(catName, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.views - a.views);
  }, [articles]);

  return (
    <div className="rounded-[12px] border border-border bg-surface shadow-card overflow-hidden">
      <div className="border-b border-border bg-surface-secondary px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold text-txt-primary">
          <Layers size={18} className="text-blue-500" />
          Performa per Kategori
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-secondary/50">
              <th className="px-5 py-2.5 text-left text-xs font-semibold text-txt-muted uppercase tracking-wider">
                Kategori
              </th>
              <th className="px-5 py-2.5 text-right text-xs font-semibold text-txt-muted uppercase tracking-wider">
                Artikel
              </th>
              <th className="px-5 py-2.5 text-right text-xs font-semibold text-txt-muted uppercase tracking-wider">
                Total Views
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {categoryData.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-center text-txt-secondary">
                  Belum ada data.
                </td>
              </tr>
            ) : (
              categoryData.map((cat) => (
                <tr key={cat.name} className="hover:bg-surface-secondary/50">
                  <td className="px-5 py-2.5 font-medium text-txt-primary">{cat.name}</td>
                  <td className="px-5 py-2.5 text-right text-txt-secondary">{cat.count}</td>
                  <td className="px-5 py-2.5 text-right font-semibold text-gold">
                    {formatNumber(cat.views)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function ArticleCalendar({ articles }: { articles: Article[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthName = currentDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  // Map: day number -> articles for that day
  const dayArticles = useMemo(() => {
    const map = new Map<number, Article[]>();
    articles.forEach((a) => {
      const dateStr = a.publishedAt || a.scheduledAt || a.createdAt;
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        const arr = map.get(day) || [];
        arr.push(a);
        map.set(day, arr);
      }
    });
    return map;
  }, [articles, year, month]);

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  }
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  }

  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedArticles = selectedDay ? dayArticles.get(selectedDay) || [] : [];

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
      <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-txt-primary">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-light">
            <Calendar size={14} className="text-primary" />
          </div>
          Kalender Artikel
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="btn-ghost rounded-lg p-1.5" aria-label="Bulan sebelumnya">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-txt-primary min-w-[140px] text-center">{monthName}</span>
          <button onClick={nextMonth} className="btn-ghost rounded-lg p-1.5" aria-label="Bulan berikutnya">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row">
        {/* Calendar grid — left side */}
        <div className="p-4 lg:w-1/2 lg:border-r lg:border-border">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {dayNames.map((dn) => (
              <div key={dn} className="text-center text-xs font-semibold text-txt-muted uppercase tracking-wider py-1">
                {dn}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} className="h-10" />;
              const count = dayArticles.get(day)?.length || 0;
              const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
              const isSelected = selectedDay === day;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`relative flex flex-col items-center justify-center h-10 rounded-lg text-sm font-medium transition-colors ${
                    isSelected ? "bg-primary text-white" : isToday ? "bg-primary-light text-primary font-bold" : count > 0 ? "bg-surface-secondary text-txt-primary hover:bg-primary-light" : "text-txt-muted hover:bg-surface-secondary"
                  }`}
                  aria-label={`${day} ${monthName}${count > 0 ? `, ${count} artikel` : ""}`}
                >
                  {day}
                  {count > 0 && (
                    <span className={`absolute bottom-1 h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-primary"}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Article list — right side, scrollable */}
        <div className="lg:w-1/2 border-t lg:border-t-0 border-border">
          <div className="px-4 py-3 border-b border-border bg-surface-secondary/50">
            <p className="text-xs font-semibold text-txt-secondary">
              {selectedDay ? `Artikel tanggal ${selectedDay} ${monthName}` : "Klik tanggal untuk lihat artikel"}
              {selectedDay !== null && selectedArticles.length > 0 && (
                <span className="ml-2 text-primary">({selectedArticles.length} artikel)</span>
              )}
            </p>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {selectedDay === null ? (
              <div className="flex items-center justify-center h-[200px] text-sm text-txt-muted">
                <div className="text-center">
                  <Calendar size={32} className="mx-auto text-border mb-2" />
                  <p>Pilih tanggal di kalender</p>
                </div>
              </div>
            ) : selectedArticles.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-sm text-txt-muted">
                Tidak ada artikel pada tanggal ini.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {selectedArticles.map((a) => (
                  <Link
                    key={a.id}
                    href={`/panel/artikel/${a.id}/edit`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-secondary/50 transition-colors"
                  >
                    <span className={`h-2 w-2 rounded-full shrink-0 ${
                      a.status === "PUBLISHED" ? "bg-primary" : a.status === "APPROVED" ? "bg-blue-500" : a.status === "IN_REVIEW" ? "bg-yellow-500" : "bg-gray-400"
                    }`} />
                    <span className="flex-1 text-sm font-medium text-txt-primary truncate">{a.title}</span>
                    <span className={`shrink-0 text-xs rounded px-2 py-0.5 font-semibold ${statusColors[a.status] || "bg-surface-tertiary text-txt-secondary"}`}>
                      {statusLabels[a.status] || a.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role || "";
  const userId = session?.user?.id || "";
  const isCreator = CREATOR_ROLES.includes(userRole);
  const isEditorRole = EDITOR_ROLES.includes(userRole);
  const isAdmin = userRole === "SUPER_ADMIN";
  // SUPER_ADMIN | CHIEF_EDITOR — for gating quick-links/cards to the same tier
  // as the pages they point to (matches the panel nav + middleware).
  const isManagement = isAdmin || userRole === "CHIEF_EDITOR";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsItem[]>([]);
  const [recentArticles, setRecentArticles] = useState<Article[]>([]);
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  const [extraStats, setExtraStats] = useState<StatsItem[]>([]);

  const fetchData = useCallback(async () => {
      if (!session?.user) return;
      try {
        setLoading(true);
        setError(null);

        // Creators fetch only their articles; editors/admins fetch all.
        // limit=200 is enough for the 6-month chart + ranking widgets, while
        // cutting payload ~5x vs the legacy limit=1000 (which transferred
        // every article every dashboard load).
        const articlesUrl = isCreator
          ? `/api/articles?limit=200&status=ALL&authorId=${userId}`
          : `/api/articles?limit=200&status=ALL`;

        const fetches: Promise<Response>[] = [fetch(articlesUrl)];
        // Only admins/editors see reports + aggregated dashboard stats
        if (!isCreator) {
          fetches.push(fetch("/api/reports"));
          fetches.push(fetch("/api/panel/dashboard-stats"));
        }

        const results = await Promise.all(fetches);

        let fetchedArticles: Article[] = [];
        let reportsPending = 0;
        let dashStats: any = null;

        if (results[0].ok) {
          const articlesJson = await results[0].json();
          fetchedArticles = articlesJson.data?.articles || [];
        }

        if (!isCreator && results[1]?.ok) {
          const reportsJson = await results[1].json();
          reportsPending = reportsJson.data?.pendingCount || 0;
        }

        if (!isCreator && results[2]?.ok) {
          const statsJson = await results[2].json();
          dashStats = statsJson.data || null;
        }

        // Store all articles for analytics
        setAllArticles(fetchedArticles);

        // Build stats based on role (check isAdmin first since SUPER_ADMIN is also in EDITOR_ROLES)
        if (isAdmin) {
          // Admin (SUPER_ADMIN): full stats
          //
          // PREFER dashStats (count langsung dari DB via prisma) supaya angka
          // akurat dan tidak ke-cap di pagination limit /api/articles?limit=200.
          // Fallback ke fetchedArticles.length hanya kalau dashStats belum
          // termuat (race kondisi awal load).
          const totalArticles = dashStats?.articles?.total ?? fetchedArticles.length;
          const totalViews = dashStats?.articles?.totalViews ?? fetchedArticles.reduce((sum, a) => sum + (a.viewCount || 0), 0);
          const pendingReview = dashStats?.articles?.byStatus?.IN_REVIEW ?? fetchedArticles.filter((a) => a.status === "IN_REVIEW").length;
          const published = dashStats?.articles?.byStatus?.PUBLISHED ?? fetchedArticles.filter((a) => a.status === "PUBLISHED").length;
          const scheduled = dashStats?.articles?.scheduled ?? fetchedArticles.filter((a) => a.scheduledAt && a.status === "APPROVED").length;
          const todayViews = dashStats?.articles?.viewsToday ?? (() => {
            const today = new Date().toDateString();
            return fetchedArticles
              .filter((a) => a.publishedAt && new Date(a.publishedAt).toDateString() === today)
              .reduce((sum, a) => sum + (a.viewCount || 0), 0);
          })();

          setStats([
            { label: "Total Artikel", value: formatNumber(totalArticles), icon: FileText, color: "text-blue-500 bg-blue-50", href: "/panel/artikel", accent: "info", hint: "Semua status" },
            { label: "Total Tayangan", value: formatNumber(totalViews), icon: Eye, color: "text-primary bg-primary-light", href: "/panel/statistik", accent: "primary", hint: "Akumulasi semua artikel" },
            { label: "Tayangan Artikel Hari Ini", value: formatNumber(todayViews), icon: TrendingUp, color: "text-purple-500 bg-purple-50", href: "/panel/statistik", accent: "primary", hint: "Akumulasi view artikel yang publish hari ini" },
            { label: "Menunggu Review", value: pendingReview.toString(), icon: Clock, color: "text-yellow-500 bg-yellow-50", href: "/panel/artikel?status=IN_REVIEW", accent: "warn", hint: pendingReview > 0 ? "Perlu tindakan editor" : "Antrean kosong" },
            { label: "Dipublikasi", value: formatNumber(published), icon: CheckCircle, color: "text-primary bg-primary-light", href: "/panel/artikel?status=PUBLISHED", accent: "ok", hint: "Live di website" },
            { label: "Dijadwalkan", value: scheduled.toString(), icon: CalendarClock, color: "text-blue-500 bg-blue-50", href: "/panel/artikel?status=APPROVED", accent: "info", hint: "Menunggu auto-publish" },
            { label: "Laporan Masuk", value: reportsPending.toString(), icon: AlertTriangle, color: "text-red-500 bg-red-50", href: "/panel/laporan", accent: "danger", hint: reportsPending > 0 ? "Perlu ditinjau" : "Tidak ada laporan" },
          ]);

          // Extra cards from aggregated dashboard-stats
          if (dashStats) {
            const aiTokens = dashStats.aiUsage?.totalTokens30d || 0;
            const aiTokensDisplay =
              aiTokens >= 1_000_000
                ? `${(aiTokens / 1_000_000).toFixed(1)}M`
                : aiTokens >= 1000
                ? `${(aiTokens / 1000).toFixed(1)}K`
                : formatNumber(aiTokens);

            const faqPercent = dashStats.faqCoverage?.percent ?? 0;
            const faqHint =
              dashStats.faqCoverage?.published > 0
                ? `${dashStats.faqCoverage.withFaq}/${dashStats.faqCoverage.published} artikel`
                : "Belum ada artikel published";

            setExtraStats([
              { label: "Total Komentar", value: formatNumber(dashStats.comments?.total || 0), icon: MessageSquare, color: "text-blue-500 bg-blue-50", href: "/panel/komentar", accent: "info", hint: "Total semua komentar" },
              { label: "Komentar Pending", value: formatNumber(dashStats.comments?.pending || 0), icon: MessageSquare, color: "text-yellow-500 bg-yellow-50", href: "/panel/komentar", accent: "warn", hint: "Belum disetujui" },
              { label: "Total Sorotan", value: formatNumber(dashStats.sorotan?.total || 0), icon: Highlighter, color: "text-amber-500 bg-amber-50", href: "/panel/sorotan", accent: "primary", hint: "Variasi SEO artikel" },
              { label: "Topic Cluster", value: formatNumber(dashStats.topics?.total || 0), icon: Layers, color: "text-emerald-600 bg-emerald-50", href: "/panel/topik", accent: "ok", hint: `${dashStats.topics?.published || 0} aktif` },
              { label: "Coverage FAQ", value: `${faqPercent}%`, icon: BookOpen, color: "text-violet-600 bg-violet-50", href: "/panel/artikel", accent: faqPercent >= 50 ? "ok" : "warn", hint: faqHint },
              { label: "Newsletter", value: formatNumber(dashStats.newsletter?.confirmed || 0), icon: Mail, color: "text-indigo-600 bg-indigo-50", href: "/panel/newsletter-subscribers", accent: "primary", hint: `${dashStats.newsletter?.total || 0} pendaftar total` },
              { label: "Total Polling", value: formatNumber(dashStats.polls?.total || 0), icon: Vote, color: "text-purple-500 bg-purple-50", href: "/panel/polling", accent: "info", hint: `${dashStats.polls?.active || 0} aktif` },
              { label: "Total Glossary", value: formatNumber(dashStats.glossary?.total || 0), icon: BookOpen, color: "text-green-600 bg-green-50", href: "/panel/dokumentasi", accent: "ok", hint: `${dashStats.glossary?.published || 0} dipublikasi` },
              { label: "Posting Sosmed (30hr)", value: formatNumber(dashStats.socialPosts?.thisMonth || 0), icon: Share2, color: "text-pink-500 bg-pink-50", href: "/panel/social", accent: "primary", hint: "Bulan ini" },
              { label: "Token AI (30hr)", value: aiTokensDisplay, icon: Bot, color: "text-indigo-500 bg-indigo-50", href: "/panel/ai-log", accent: "info", hint: "Konsumsi 30 hari" },
              { label: "Total Kategori", value: formatNumber(dashStats.categories?.total || 0), icon: Folder, color: "text-orange-500 bg-orange-50", href: "/panel/kategori", accent: "muted", hint: "Taksonomi utama" },
              { label: "Total Tag", value: formatNumber(dashStats.tags?.total || 0), icon: Tag, color: "text-teal-500 bg-teal-50", href: "/panel/tags", accent: "muted", hint: "Taksonomi sekunder" },
              { label: "Pengguna Aktif", value: formatNumber(dashStats.users?.active || 0), icon: Users, color: "text-blue-500 bg-blue-50", href: "/panel/pengguna", accent: "info", hint: `${dashStats.users?.total || 0} total` },
              { label: "Iklan Aktif", value: formatNumber(dashStats.ads?.active || 0), icon: Megaphone, color: "text-rose-500 bg-rose-50", href: "/panel/iklan", accent: "danger", hint: `${dashStats.ads?.total || 0} total` },
              { label: "Sumber Berita Aktif", value: formatNumber(dashStats.newsSources?.active || 0), icon: Newspaper, color: "text-cyan-600 bg-cyan-50", href: "/panel/sumber-berita", accent: "info", hint: "Untuk auto-artikel" },
              { label: "Live Blog", value: formatNumber(dashStats.liveBlogs?.total || 0), icon: Radio, color: "text-red-500 bg-red-50", href: "/panel/live-blogs", accent: dashStats.liveBlogs?.live ? "danger" : "muted", hint: dashStats.liveBlogs?.live ? `${dashStats.liveBlogs.live} LIVE saat ini` : "Tidak ada yang live" },
              { label: "Subscriber Push", value: formatNumber(dashStats.pushSubscribers?.active || 0), icon: Bell, color: "text-violet-500 bg-violet-50", href: "/panel/pengaturan", accent: "muted", hint: "Push notification" },
            ]);
          }

          const sorted = [...fetchedArticles].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setRecentArticles(sorted.slice(0, 5));
        } else if (isCreator) {
          // Creator stats: my articles, my drafts, pending review, published
          const myTotal = fetchedArticles.length;
          const myDrafts = fetchedArticles.filter((a) => a.status === "DRAFT").length;
          const myPendingReview = fetchedArticles.filter((a) => a.status === "IN_REVIEW").length;
          const myPublished = fetchedArticles.filter((a) => a.status === "PUBLISHED").length;

          setStats([
            { label: "Artikel Saya", value: formatNumber(myTotal), icon: FileText, color: "text-blue-500 bg-blue-50", href: "/panel/artikel", accent: "info", hint: "Semua status" },
            { label: "Draf Saya", value: myDrafts.toString(), icon: FileText, color: "text-surface-tertiary bg-surface-secondary", href: "/panel/artikel?status=DRAFT", accent: "muted", hint: "Belum dikirim" },
            { label: "Menunggu Review", value: myPendingReview.toString(), icon: Clock, color: "text-yellow-500 bg-yellow-50", href: "/panel/artikel?status=IN_REVIEW", accent: "warn", hint: "Diproses editor" },
            { label: "Dipublikasi", value: formatNumber(myPublished), icon: CheckCircle, color: "text-primary bg-primary-light", href: "/panel/artikel?status=PUBLISHED", accent: "ok", hint: "Live di website" },
          ]);

          // Recent: my articles sorted by createdAt
          const sorted = [...fetchedArticles].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setRecentArticles(sorted.slice(0, 5));
        } else if (isEditorRole) {
          // Editor stats — prefer ACCURATE DB counts from dashStats. The fetched
          // array is capped at limit=200, so deriving counts from it desyncs the
          // cards from the article list once the DB has >200 articles. Fallback
          // to the array only while dashStats is still loading.
          const aStats = dashStats?.articles;
          const reviewQueue = aStats?.byStatus?.IN_REVIEW ?? fetchedArticles.filter((a) => a.status === "IN_REVIEW").length;
          const rejected = aStats?.byStatus?.REJECTED ?? fetchedArticles.filter((a) => a.status === "REJECTED").length;
          const totalArticles = aStats?.total ?? fetchedArticles.length;
          // "Disetujui Hari Ini" = currently-approved (awaiting publish) + published today.
          const today = new Date().toDateString();
          const approvedToday = aStats
            ? (aStats.byStatus?.APPROVED ?? 0) + (aStats.publishedToday ?? 0)
            : fetchedArticles.filter(
                (a) => a.status === "APPROVED" || (a.status === "PUBLISHED" && a.publishedAt && new Date(a.publishedAt).toDateString() === today)
              ).length;

          setStats([
            { label: "Antrean Review", value: reviewQueue.toString(), icon: Clock, color: "text-yellow-500 bg-yellow-50", href: "/panel/artikel?status=IN_REVIEW", accent: "warn", hint: reviewQueue > 0 ? "Perlu tindakan" : "Antrean kosong" },
            { label: "Disetujui Hari Ini", value: approvedToday.toString(), icon: CheckCircle, color: "text-primary bg-primary-light", href: "/panel/riwayat-review", accent: "ok", hint: "Approval hari ini" },
            { label: "Ditolak", value: rejected.toString(), icon: XCircle, color: "text-red-500 bg-red-50", href: "/panel/artikel?status=REJECTED", accent: "danger", hint: "Perlu revisi" },
            { label: "Total Artikel", value: formatNumber(totalArticles), icon: FileText, color: "text-blue-500 bg-blue-50", href: "/panel/artikel", accent: "info", hint: "Seluruh artikel" },
          ]);

          if (dashStats?.comments) {
            // Editor/Chief-editor extra card: only the one site-wide metric they
            // can actually act on (comment moderation). Other global metrics
            // (sorotan/polling/glossary/social/users/ads/AI) are SUPER_ADMIN-only
            // — they'd link to pages this role can't open and aren't its data.
            setExtraStats([
              { label: "Komentar Pending", value: formatNumber(dashStats.comments?.pending || 0), icon: MessageSquare, color: "text-yellow-500 bg-yellow-50", href: "/panel/komentar", accent: "warn", hint: "Belum disetujui" },
            ]);
          }

          // Recent: IN_REVIEW first, then by createdAt
          const sorted = [...fetchedArticles].sort((a, b) => {
            if (a.status === "IN_REVIEW" && b.status !== "IN_REVIEW") return -1;
            if (a.status !== "IN_REVIEW" && b.status === "IN_REVIEW") return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          setRecentArticles(sorted.slice(0, 5));
        }
      } catch (err) {
        setError("Gagal memuat data dashboard. Silakan coba lagi.");
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
  }, [session?.user, isCreator, isEditorRole, isAdmin, userId]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 60s so leadership-pinned dashboards stay fresh
    // without manual reload. Visibility check skips refresh when tab is
    // backgrounded — saves bandwidth + DB load.
    const i = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        fetchData();
      }
    }, 60_000);
    return () => clearInterval(i);
  }, [fetchData]);

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-lg sm:text-2xl font-bold text-txt-primary">
            Dashboard
          </h2>
          <p className="mt-1 text-sm text-txt-secondary">
            Selamat datang kembali, {session?.user?.name}!
          </p>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-lg sm:text-2xl font-bold text-txt-primary">
            Dashboard
          </h2>
          <p className="mt-1 text-sm text-txt-secondary">
            Selamat datang kembali, {session?.user?.name}!
          </p>
        </div>
        <div className="rounded-[12px] border border-red-200 bg-red-50 p-6 text-center text-red-700">
          <p>{error}</p>
          <button
            onClick={fetchData}
            className="mt-3 rounded-[12px] bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            aria-label="Coba muat ulang data"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  // Group extra stats into semantic sections for premium feel
  const contentStats = extraStats.filter((s) =>
    ["Komentar Pending", "Total Komentar", "Total Sorotan", "Total Polling", "Total Glossary", "Posting Sosmed (30hr)"].includes(s.label)
  );
  const operasionalStats = extraStats.filter((s) =>
    ["Token AI (30hr)", "Total Kategori", "Total Tag", "Pengguna Aktif", "Iklan Aktif", "Sumber Berita Aktif"].includes(s.label)
  );

  // Role label for display
  const roleLabelMap: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    CHIEF_EDITOR: "Editor Kepala",
    EDITOR: "Editor",
    SENIOR_JOURNALIST: "Jurnalis Senior",
    JOURNALIST: "Jurnalis",
    CONTRIBUTOR: "Kontributor",
  };
  const roleLabel = roleLabelMap[userRole] || "Pengguna";
  const todayLabel = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      {/* Premium hero header */}
      <div className="mb-6 relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary via-primary to-primary-dark text-white shadow-card">
        <div className="kw-aurora" aria-hidden />
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/5 blur-2xl" aria-hidden />
        <div className="absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-secondary/20 blur-3xl" aria-hidden />
        <div className="relative px-5 py-5 sm:px-7 sm:py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur-sm px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider ring-1 ring-white/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                {roleLabel}
              </span>
              <span className="text-[10px] sm:text-xs text-white/70 hidden sm:inline">{todayLabel}</span>
            </div>
            <h1 className="mt-2 text-xl sm:text-3xl font-extrabold tracking-tight">
              Halo, {session?.user?.name?.split(" ")[0] || "Editor"} 👋
            </h1>
            <p className="mt-1 text-sm text-white/80">
              {isCreator
                ? "Lihat performa artikel Anda dan mulai menulis."
                : "Pantau alur redaksi, distribusi, dan operasional dari satu tempat."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href="/panel/artikel/baru"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-primary shadow-sm hover:bg-white/90 transition-colors"
            >
              <FileText size={15} /> Tulis Artikel
            </Link>
          </div>
        </div>
      </div>

      {/* Section: Ikhtisar Editorial */}
      <SectionHeader
        icon={BarChart3}
        title="Ikhtisar Editorial"
        subtitle="Ringkasan status artikel dan trafik"
      />
      <div className={`kw-reveal kw-stagger mb-8 grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4 sm:grid-cols-3 ${isAdmin ? "md:grid-cols-4 xl:grid-cols-7" : "md:grid-cols-4"}`}>
        {stats.map((stat) => (
          <PremiumStatCard key={stat.label} stat={stat} />
        ))}
      </div>

      {/* Section: Konten & Engagement */}
      {contentStats.length > 0 && (
        <>
          <SectionHeader
            icon={MessageSquare}
            title="Konten & Engagement"
            subtitle="Komentar, sorotan, polling, dan distribusi sosial"
          />
          <div className={`kw-reveal kw-stagger mb-8 grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4 sm:grid-cols-3 md:grid-cols-4 ${isAdmin ? "xl:grid-cols-6" : "xl:grid-cols-6"}`}>
            {contentStats.map((stat) => (
              <PremiumStatCard key={stat.label} stat={stat} />
            ))}
          </div>
        </>
      )}

      {/* Section: Operasional & Sistem */}
      {operasionalStats.length > 0 && (
        <>
          <SectionHeader
            icon={Settings}
            title="Operasional & Sistem"
            subtitle="Pengguna, taksonomi, AI, dan integrasi"
          />
          <div className="kw-reveal kw-stagger mb-8 grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
            {operasionalStats.map((stat) => (
              <PremiumStatCard key={stat.label} stat={stat} />
            ))}
          </div>
        </>
      )}

      {/* Quick actions — grouped premium */}
      {(() => {
        type Action = {
          href: string;
          label: string;
          icon: React.ElementType;
          color: string;
          bg: string;
          show: boolean;
        };
        type Group = {
          id: string;
          title: string;
          icon: React.ElementType;
          subtitle: string;
          actions: Action[];
        };
        const groups: Group[] = [
          {
            id: "editorial",
            title: "Editorial",
            icon: FileText,
            subtitle: "Tulis, review, dan moderasi",
            actions: [
              { href: "/panel/artikel/baru", label: "Tulis Artikel", icon: FileText, color: "text-primary", bg: "bg-primary-light", show: true },
              { href: "/panel/auto-artikel", label: "Auto Artikel AI", icon: Sparkles, color: "text-indigo-600", bg: "bg-indigo-50", show: isAdmin },
              { href: "/panel/material-artikel", label: "Material Artikel", icon: BookOpen, color: "text-emerald-600", bg: "bg-emerald-50", show: !isCreator },
              { href: "/panel/sumber-berita", label: "Sumber Berita", icon: Newspaper, color: "text-cyan-600", bg: "bg-cyan-50", show: !isCreator },
              { href: "/panel/artikel", label: isCreator ? "Artikel Saya" : "Review Artikel", icon: isCreator ? Send : Clock, color: isCreator ? "text-blue-600" : "text-yellow-600", bg: isCreator ? "bg-blue-50" : "bg-yellow-50", show: true },
              { href: "/panel/komentar", label: "Komentar", icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-50", show: !isCreator },
              { href: "/panel/laporan", label: "Laporan", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", show: !isCreator },
              { href: "/panel/live-blogs", label: "Live Blog", icon: Radio, color: "text-red-600", bg: "bg-red-50", show: !isCreator },
            ],
          },
          {
            id: "distribusi",
            title: "Distribusi & SEO",
            icon: Share2,
            subtitle: "Sebar ke pembaca, mesin pencari, dan sosmed",
            actions: [
              { href: "/panel/sorotan", label: "Sorotan SEO", icon: Highlighter, color: "text-amber-600", bg: "bg-amber-50", show: isAdmin },
              { href: "/panel/topik", label: "Topic Cluster", icon: Layers, color: "text-emerald-600", bg: "bg-emerald-50", show: isAdmin || userRole === "CHIEF_EDITOR" },
              { href: "/panel/seo", label: "SEO Panel", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", show: isManagement },
              { href: "/panel/social", label: "Sosial Media", icon: Share2, color: "text-pink-600", bg: "bg-pink-50", show: isAdmin },
              { href: "/panel/tiktok", label: "TikTok", icon: Music, color: "text-fuchsia-600", bg: "bg-fuchsia-50", show: !isCreator },
              { href: "/panel/newsletter-subscribers", label: "Newsletter", icon: Mail, color: "text-indigo-600", bg: "bg-indigo-50", show: isAdmin || userRole === "CHIEF_EDITOR" },
              { href: "/panel/statistik", label: "Statistik", icon: BarChart3, color: "text-green-600", bg: "bg-green-50", show: !isCreator },
              { href: "/panel/polling", label: "Polling", icon: Vote, color: "text-purple-600", bg: "bg-purple-50", show: isManagement },
            ],
          },
          {
            id: "manajemen",
            title: "Manajemen",
            icon: Settings,
            subtitle: "Pengguna, taksonomi, dan iklan",
            actions: [
              { href: "/panel/redaksi", label: "Redaksi", icon: Users, color: "text-blue-600", bg: "bg-blue-50", show: isManagement },
              { href: "/panel/pengguna", label: "Pengguna", icon: Users, color: "text-purple-600", bg: "bg-purple-50", show: isAdmin },
              { href: "/panel/kategori", label: "Kategori", icon: Folder, color: "text-orange-600", bg: "bg-orange-50", show: isAdmin || userRole === "CHIEF_EDITOR" },
              { href: "/panel/tags", label: "Tag", icon: Tag, color: "text-teal-600", bg: "bg-teal-50", show: isAdmin || userRole === "CHIEF_EDITOR" },
              { href: "/panel/iklan", label: "Iklan", icon: Megaphone, color: "text-rose-600", bg: "bg-rose-50", show: isAdmin || userRole === "CHIEF_EDITOR" },
              { href: "/panel/email", label: "Email", icon: Mail, color: "text-blue-700", bg: "bg-blue-50", show: isAdmin },
              { href: "/panel/ai-log", label: "Log AI", icon: Bot, color: "text-indigo-600", bg: "bg-indigo-50", show: isAdmin },
              { href: "/panel/pengaturan", label: "Pengaturan", icon: Settings, color: "text-slate-700", bg: "bg-slate-100", show: isAdmin },
            ],
          },
        ];

        const visibleGroups = groups
          .map((g) => ({ ...g, actions: g.actions.filter((a) => a.show) }))
          .filter((g) => g.actions.length > 0);

        if (visibleGroups.length === 0) return null;

        return (
          <div className="mb-8">
            <SectionHeader
              icon={Layers}
              title="Aksi Cepat"
              subtitle="Pintasan ke tugas yang paling sering dipakai"
            />
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {visibleGroups.map((group) => {
                const GIcon = group.icon;
                return (
                  <div key={group.id} className="kw-reveal rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
                    <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-surface-secondary/60 to-transparent px-4 py-2.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-light text-primary">
                        <GIcon size={12} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-txt-primary tracking-tight truncate">
                          {group.title}
                        </p>
                        <p className="text-[10px] text-txt-muted truncate">{group.subtitle}</p>
                      </div>
                    </div>
                    <div className="kw-stagger grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-3">
                      {group.actions.map((a) => {
                        const Icon = a.icon;
                        return (
                          <Link
                            key={a.href}
                            href={a.href}
                            className="kw-fade-in-up group/action relative flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-3 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md overflow-hidden"
                            aria-label={a.label}
                          >
                            {/* Hover gradient overlay */}
                            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${a.bg} opacity-0 group-hover/action:opacity-30 transition-opacity`} aria-hidden="true" />
                            <div className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${a.bg} ${a.color} ring-1 ring-inset ring-black/5 transition-all duration-300 group-hover/action:scale-110 group-hover/action:rotate-3 group-hover/action:shadow-md`}>
                              <Icon size={18} strokeWidth={2.2} />
                            </div>
                            <span className="relative text-[11px] sm:text-xs font-semibold text-txt-secondary leading-tight group-hover/action:text-txt-primary transition-colors">
                              {a.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Recent articles - full width, rich info */}
      <div className="mb-6 rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="border-b border-border px-6 py-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2.5 text-base font-bold text-txt-primary">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
              <FileText size={16} className="text-blue-500" />
            </div>
            {isCreator ? "Artikel Saya Terbaru" : isEditorRole ? "Antrean Review" : "Artikel Terbaru"}
          </h2>
          <Link href="/panel/artikel" className="text-sm font-semibold text-primary hover:text-primary-dark transition-colors">
            Lihat Semua &rarr;
          </Link>
        </div>
        {recentArticles.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FileText size={40} className="mx-auto text-border mb-3" />
            <p className="text-base text-txt-secondary">
              {isCreator ? "Anda belum memiliki artikel." : "Belum ada artikel."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentArticles.map((article) => (
              <Link
                key={article.id}
                href={`/panel/artikel/${article.id}/edit`}
                className="block px-6 py-5 hover:bg-surface-secondary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-txt-primary mb-2 line-clamp-1">
                      {article.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      {article.author?.name && (
                        <span className="flex items-center gap-1.5 text-sm text-txt-secondary">
                          <Users size={14} className="text-blue-500" />
                          <span className="text-txt-muted">Penulis:</span> {article.author.name}
                        </span>
                      )}
                      {article.reviewerName && (
                        <span className="flex items-center gap-1.5 text-sm text-txt-secondary">
                          <CheckCircle size={14} className="text-primary" />
                          <span className="text-txt-muted">Editor:</span> {article.reviewerName}
                        </span>
                      )}
                      {article.category?.name && (
                        <span className="flex items-center gap-1.5 text-sm text-txt-secondary">
                          <Layers size={14} className="text-purple-500" />
                          <span className="text-txt-muted">Kategori:</span> {article.category.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-sm text-txt-secondary">
                        <CalendarClock size={14} className="text-txt-muted" />
                        <span className="text-txt-muted">Tanggal:</span> {formatDate(article.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`badge text-sm ${statusColors[article.status] || "bg-surface-tertiary text-txt-secondary"}`}>
                      {statusLabels[article.status] || article.status}
                    </span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-txt-muted">
                      <Eye size={14} />
                      {formatNumber(article.viewCount)} tayangan
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Cron health — admin/editor only */}
      {!isCreator && (
        <div className="kw-reveal mt-6">
          <CronHealthWidget />
        </div>
      )}

      {/* Power Widgets — pipeline, pending, AI, top authors, backup */}
      {!isCreator && (
        <div className="kw-reveal mt-6">
          <SectionHeader
            icon={Activity}
            title="Operasional Realtime"
            subtitle="Pipeline, item butuh tindakan, leaderboard, dan health"
          />
          <PowerWidgets isAdmin={isAdmin} />
        </div>
      )}

      {/* Analytics Section */}
      <div className="kw-reveal mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {isCreator ? (
          <MyArticleStats articles={allArticles} />
        ) : (
          <ViewsRanking articles={allArticles} />
        )}
        <RecentActivity articles={allArticles} />
        <WeeklyArticleTrend articles={allArticles} />
        <CategoryPerformance articles={allArticles} />
        <div className="lg:col-span-2">
          <ArticleCalendar articles={allArticles} />
        </div>
      </div>

      {/* Editorial checklist reminder */}
      <div className="mt-6 rounded-[12px] border border-primary/20 bg-primary-50 p-5">
        <h3 className="flex items-center gap-2 font-semibold text-primary-dark">
          <CheckCircle size={18} />
          Pengingat Standar Jurnalistik
        </h3>
        <ul className="mt-2 space-y-1 text-sm text-primary">
          <li>&#10003; Pastikan setiap artikel memiliki minimal 1 sumber terverifikasi</li>
          <li>&#10003; Judul tidak clickbait atau sensasional berlebihan</li>
          <li>&#10003; Cover both sides — berikan perspektif berimbang</li>
          <li>&#10003; Tidak mengandung unsur SARA</li>
          <li>&#10003; Gunakan bahasa sesuai PUEBI</li>
        </ul>
      </div>
    </div>
  );
}
