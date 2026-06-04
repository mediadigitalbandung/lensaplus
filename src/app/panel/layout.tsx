"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  FileText,
  Users,
  Megaphone,
  Flag,
  FolderOpen,
  History,
  ChevronLeft,
  Menu,
  X,
  ClipboardCheck,
  ChevronRight,
  Bell,
  Settings,
  BarChart3,
  Vote,
  Sparkles,
  LogOut,
  MessageCircle,
  ImageIcon,
  Mail,
  Search,
  XCircle,
  CheckCircle,
  AlertCircle,
  Clock,
  Bot,
  Globe,
  Share2,
  Lightbulb,
  Hash,
  TrendingUp,
  BookOpen,
  Video,
  RadioTower,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { roleLabelsMap, EDITOR_ROLES, CREATOR_ROLES } from "@/lib/roles";

interface MenuItem {
  name: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean; // SUPER_ADMIN only
  managementOnly?: boolean; // SUPER_ADMIN | CHIEF_EDITOR
  editorOnly?: boolean; // SUPER_ADMIN | CHIEF_EDITOR | EDITOR
}

const menuItems: MenuItem[] = [
  { name: "Dashboard", href: "/panel/dashboard", icon: LayoutDashboard },
  { name: "Artikel", href: "/panel/artikel", icon: FileText },
  { name: "Auto Artikel", href: "/panel/auto-artikel", icon: Bot, adminOnly: true },
  { name: "Material Artikel", href: "/panel/material-artikel", icon: Sparkles, editorOnly: true },
  { name: "Sumber Berita", href: "/panel/sumber-berita", icon: Globe },
  { name: "Kategori", href: "/panel/kategori", icon: FolderOpen, editorOnly: true },
  { name: "Tags", href: "/panel/tags", icon: Hash, editorOnly: true },
  { name: "Riwayat Review", href: "/panel/riwayat-review", icon: ClipboardCheck, editorOnly: true },
  { name: "Komentar", href: "/panel/komentar", icon: MessageCircle, editorOnly: true },
  { name: "Media", href: "/panel/media", icon: ImageIcon, editorOnly: true },
  { name: "Laporan", href: "/panel/laporan", icon: Flag, editorOnly: true },
  { name: "Aktivitas", href: "/panel/aktivitas", icon: History, adminOnly: true },
  { name: "Iklan", href: "/panel/iklan", icon: Megaphone, managementOnly: true },
  { name: "Redaksi", href: "/panel/redaksi", icon: Users, managementOnly: true },
  { name: "Polling", href: "/panel/polling", icon: Vote, managementOnly: true },
  { name: "Sosial Media", href: "/panel/social", icon: Share2, adminOnly: true },
  { name: "Status Sosmed", href: "/panel/sosial-status", icon: Share2 },
  { name: "TikTok", href: "/panel/tiktok", icon: Video, editorOnly: true },
  { name: "Sorotan", href: "/panel/sorotan", icon: Lightbulb, editorOnly: true },
  { name: "Live Blog", href: "/panel/live-blogs", icon: RadioTower, editorOnly: true },
  { name: "Pengguna", href: "/panel/pengguna", icon: Users, adminOnly: true },
  { name: "Analytics", href: "/panel/analytics", icon: BarChart3, managementOnly: true },
  { name: "Statistik", href: "/panel/statistik", icon: TrendingUp },
  { name: "SEO", href: "/panel/seo", icon: Search, managementOnly: true },
  { name: "Statistik Editor", href: "/panel/statistik-editor", icon: BarChart3, editorOnly: true },
  { name: "Email", href: "/panel/email", icon: Mail, adminOnly: true },
  { name: "Pengaturan", href: "/panel/pengaturan", icon: Settings, adminOnly: true },
  { name: "Dokumentasi", href: "/panel/dokumentasi", icon: BookOpen, adminOnly: true },
];

interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

type NotifIconType = "article_rejected" | "article_in_review" | "article_approved" | "article_published" | "default";

const NOTIF_ICON_MAP: Record<NotifIconType, { icon: React.ElementType; bg: string; color: string }> = {
  article_rejected: { icon: XCircle, bg: "bg-red-50", color: "text-red-500" },
  article_in_review: { icon: ClipboardCheck, bg: "bg-yellow-50", color: "text-yellow-500" },
  article_approved: { icon: CheckCircle, bg: "bg-green-50", color: "text-primary" },
  article_published: { icon: CheckCircle, bg: "bg-blue-50", color: "text-blue-500" },
  default: { icon: Bell, bg: "bg-zinc-800", color: "text-zinc-400" },
};

function getNotifIcon(type: string) {
  return NOTIF_ICON_MAP[type as NotifIconType] || NOTIF_ICON_MAP.default;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} hari lalu`;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const userRole = session?.user?.role || "";
  const isAdmin = userRole === "SUPER_ADMIN";
  const isMgmt = userRole === "SUPER_ADMIN" || userRole === "CHIEF_EDITOR";
  const isEditor = EDITOR_ROLES.includes(userRole);

  // Current section (icon + title) shown in the sticky top bar — makes the
  // header reflect the page you're on instead of a static label.
  const currentNav = pathname
    ? menuItems.find(
        (i) => pathname === i.href || pathname.startsWith(i.href + "/")
      )
    : undefined;
  const CurrentIcon = currentNav?.icon ?? LayoutDashboard;
  const currentTitle = currentNav?.name ?? "Panel Admin";

  const fetchNotifications = useCallback(async () => {
    if (!session?.user) return;
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data?.notifications || []);
        setUnreadCount(json.data?.unreadCount || 0);
      }
    } catch {
      // Silently fail — notifications are non-critical
    }
  }, [session?.user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  // Close notification dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session || (session.user as Record<string, unknown>)?.invalid) {
    if (typeof window !== "undefined") {
      signOut({ callbackUrl: "/login?reason=session_expired" });
    }
    return null;
  }

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* non-critical */ }
  };

  const markOneRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* non-critical */ }
  };

  const filteredMenu = menuItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.managementOnly && !isMgmt) return false;
    if (item.editorOnly && !isEditor) return false;
    return true;
  });

  const sidebarContent = (
    <div className="flex h-full flex-col px-3 py-4 overflow-y-auto overscroll-contain pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <a
        href="/"
        className="mb-6 flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-[13px] font-medium text-white/40 hover:text-white/80 hover:bg-white/5 transition-all duration-150"
      >
        <ChevronLeft size={16} />
        Kembali ke Situs
      </a>

      <nav className="flex-1 space-y-0.5">
        {filteredMenu.map((item) => {
          const Icon = item.icon;
          // Boundary-aware match so sibling routes that share a prefix don't
          // both light up (e.g. /panel/statistik vs /panel/statistik-editor).
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-2.5 text-[14px] font-medium transition-all duration-150",
                isActive
                  ? "bg-white/10 text-white shadow-sm border border-white/10"
                  : "text-white/50 hover:text-white/90 hover:bg-white/5 border border-transparent"
              )}
            >
              <Icon size={18} className={isActive ? "text-blue-400" : ""} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User info — klik untuk buka halaman profil */}
      <div className="border-t border-white/[0.08] pt-4 mt-2">
        <Link
          href="/panel/profil"
          onClick={() => setSidebarOpen(false)}
          className="group flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-150 hover:bg-white/5"
          aria-label="Buka profil saya"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-300">
            {session.user.name?.charAt(0)}
          </div>
          <div className="min-w-0 flex-1 truncate">
            <p className="truncate text-[13px] font-semibold text-white/90">
              {session.user.name}
            </p>
            <p className="text-[11px] text-white/40">
              {roleLabelsMap[session.user.role] || session.user.role.replace(/_/g, " ")}
            </p>
          </div>
          <ChevronRight size={16} className="text-white/30 transition-colors group-hover:text-white/70" />
        </Link>
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            signOut({ callbackUrl: "/login" });
          }}
          className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-4 py-2.5 text-[13px] text-white/40 transition-all duration-150 hover:bg-white/5 hover:text-red-400"
          aria-label="Keluar"
        >
          <LogOut size={16} />
          Keluar
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-secondary">
      <div className="flex">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Tutup menu"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSidebarOpen(false); }}
          />
        )}

        {/* Sidebar — desktop: always visible, mobile: slide-in */}
        <aside
          id="panel-sidebar"
          role="navigation"
          aria-label="Navigasi panel"
          className={cn(
            "fixed left-0 top-0 z-50 h-[100dvh] w-60 bg-surface-dark pt-16 transition-transform duration-200 overflow-hidden",
            "lg:translate-x-0 lg:z-40",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Close button — mobile only */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute right-3 top-4 rounded-lg p-1 text-white/60 hover:text-white lg:hidden"
            aria-label="Tutup sidebar"
          >
            <X size={20} />
          </button>
          {sidebarContent}
        </aside>

        {/* Main content. NOTE: no overflow-x here — an overflow ancestor turns
            the sticky top bar into a scroll-bound element and breaks it.
            Wide tables manage their own horizontal scroll wrappers. */}
        <main className="flex-1 lg:ml-60 min-w-0">
          {/* Top bar — sticky, glassy, reflects the current section */}
          <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface/80 px-4 sm:px-5 backdrop-blur-md shadow-[0_1px_2px_rgba(0,32,69,0.06)]">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-xl p-2.5 text-txt-primary hover:bg-surface-secondary lg:hidden"
                aria-label="Buka menu navigasi panel"
                aria-expanded={sidebarOpen}
                aria-controls="panel-sidebar"
              >
                <Menu size={24} />
              </button>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-dark text-white shadow-sm ring-1 ring-black/5">
                <CurrentIcon size={18} />
              </div>
              <div className="min-w-0 leading-tight">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-txt-muted">
                  Panel Admin
                </div>
                <div className="-mt-0.5 truncate text-sm font-bold text-txt-primary">
                  {currentTitle}
                </div>
              </div>
            </div>

            {/* Right side: Lihat Situs + notifications + user chip */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-txt-secondary transition-colors hover:bg-surface-secondary hover:text-primary sm:inline-flex"
                title="Lihat situs publik"
              >
                <Globe size={15} />
                Lihat Situs
              </a>

              {/* Notification bell */}
              <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative rounded-lg p-2 text-txt-secondary hover:bg-surface-secondary hover:text-txt-primary transition-colors"
                aria-label="Notifikasi"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown */}
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-[12px] border border-border bg-surface shadow-lg">
                  {/* Header */}
                  <div className="border-b border-border px-4 py-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-txt-primary">Notifikasi</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs font-medium text-primary hover:text-primary-dark transition-colors"
                      >
                        Tandai semua dibaca
                      </button>
                    )}
                  </div>

                  {/* Notification list */}
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Bell size={32} className="mx-auto text-border mb-2" />
                      <p className="text-sm text-txt-muted">Tidak ada notifikasi baru</p>
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.map((notif) => {
                        const config = getNotifIcon(notif.type);
                        const Icon = config.icon;
                        return (
                          <Link
                            key={notif.id}
                            href={notif.link || "/panel/dashboard"}
                            onClick={() => {
                              markOneRead(notif.id);
                              setNotifOpen(false);
                            }}
                            className={cn(
                              "flex items-start gap-3 px-4 py-3 hover:bg-surface-secondary transition-colors border-b border-border last:border-b-0",
                              !notif.isRead && "bg-primary-50/50"
                            )}
                          >
                            <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full", config.bg)}>
                              <Icon size={16} className={config.color} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-txt-primary truncate">{notif.title}</p>
                                {!notif.isRead && (
                                  <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-txt-secondary mt-0.5 line-clamp-2">{notif.message}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <Clock size={10} className="text-txt-muted" />
                                <span className="text-[10px] text-txt-muted">{timeAgo(notif.createdAt)}</span>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              </div>

              {/* User chip → profil */}
              <Link
                href="/panel/profil"
                className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-surface-secondary sm:pr-3"
                title="Profil saya"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-secondary to-secondary-dark text-xs font-bold text-white ring-1 ring-black/5">
                  {(session.user.name || "?").charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-[150px] text-left leading-tight sm:block">
                  <span className="block truncate text-xs font-semibold text-txt-primary">
                    {session.user.name}
                  </span>
                  <span className="block truncate text-[10px] text-txt-muted">
                    {roleLabelsMap[session.user.role] || session.user.role.replace(/_/g, " ")}
                  </span>
                </span>
              </Link>
            </div>
          </div>

          {/* Warning: login attempt from another device */}
          {!!((session as unknown as Record<string, boolean>)?.loginAttempt) && (
            <div className="mx-4 mt-4 sm:mx-6 rounded-[12px] bg-yellow-50 border border-yellow-200 px-4 py-3 flex items-start gap-3">
              <AlertCircle size={18} className="text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">Percobaan login dari perangkat lain</p>
                <p className="text-xs text-yellow-600 mt-0.5">Seseorang mencoba masuk ke akun Anda dari perangkat lain. Jika bukan Anda, segera ubah password.</p>
              </div>
            </div>
          )}

          <div className="p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
