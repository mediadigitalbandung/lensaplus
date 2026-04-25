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
  UserCircle,
  ClipboardCheck,
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
  Share2,
  Lightbulb,
  Hash,
  TrendingUp,
  Gavel,
  BookOpen,
  Video,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { roleLabelsMap, EDITOR_ROLES, CREATOR_ROLES } from "@/lib/roles";

interface MenuItem {
  name: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  editorOnly?: boolean;
}

const menuItems: MenuItem[] = [
  { name: "Dashboard", href: "/panel/dashboard", icon: LayoutDashboard },
  { name: "Artikel", href: "/panel/artikel", icon: FileText },
  { name: "Auto Artikel", href: "/panel/auto-artikel", icon: Bot, adminOnly: true },
  { name: "Kategori", href: "/panel/kategori", icon: FolderOpen, adminOnly: true },
  { name: "Tags", href: "/panel/tags", icon: Hash, editorOnly: true },
  { name: "Riwayat Review", href: "/panel/riwayat-review", icon: ClipboardCheck, editorOnly: true },
  { name: "Komentar", href: "/panel/komentar", icon: MessageCircle, adminOnly: true },
  { name: "Media", href: "/panel/media", icon: ImageIcon, adminOnly: true },
  { name: "Laporan", href: "/panel/laporan", icon: Flag },
  { name: "Aktivitas", href: "/panel/aktivitas", icon: History, adminOnly: true },
  { name: "Iklan", href: "/panel/iklan", icon: Megaphone, adminOnly: true },
  { name: "Redaksi", href: "/panel/redaksi", icon: Users, adminOnly: true },
  { name: "Polling", href: "/panel/polling", icon: Vote, adminOnly: true },
  { name: "Sosial Media", href: "/panel/social", icon: Share2, adminOnly: true },
  { name: "TikTok", href: "/panel/tiktok", icon: Video, editorOnly: true },
  { name: "Sorotan", href: "/panel/sorotan", icon: Lightbulb, editorOnly: true },
  { name: "Jadwal Sidang", href: "/panel/jadwal-sidang", icon: Gavel, editorOnly: true },
  { name: "Pengguna", href: "/panel/pengguna", icon: Users, adminOnly: true },
  { name: "Analytics", href: "/panel/analytics", icon: BarChart3, adminOnly: true },
  { name: "Statistik", href: "/panel/statistik", icon: TrendingUp, editorOnly: true },
  { name: "SEO", href: "/panel/seo", icon: Search, adminOnly: true },
  { name: "Statistik Editor", href: "/panel/statistik-editor", icon: BarChart3, editorOnly: true },
  { name: "Email", href: "/panel/email", icon: Mail, adminOnly: true },
  { name: "Pengaturan", href: "/panel/pengaturan", icon: Settings, adminOnly: true },
  { name: "Dokumentasi", href: "/panel/dokumentasi", icon: BookOpen, adminOnly: true },
  { name: "Profil", href: "/panel/profil", icon: UserCircle },
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
  const isEditor = EDITOR_ROLES.includes(userRole);

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
    if (item.editorOnly && !isEditor) return false;
    return true;
  });

  const sidebarContent = (
    <div className="flex h-full flex-col px-3 py-4 overflow-y-auto overscroll-contain">
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
          const isActive = pathname.startsWith(item.href);
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

      {/* User info */}
      <div className="border-t border-white/[0.08] pt-4 mt-2">
        <div className="flex items-center gap-3 rounded-lg px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-300">
            {session.user.name?.charAt(0)}
          </div>
          <div className="truncate">
            <p className="truncate text-[13px] font-semibold text-white/90">
              {session.user.name}
            </p>
            <p className="text-[11px] text-white/40">
              {roleLabelsMap[session.user.role] || session.user.role.replace(/_/g, " ")}
            </p>
          </div>
        </div>
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

        {/* Main content */}
        <main className="flex-1 lg:ml-60 min-w-0 overflow-x-auto">
          {/* Top bar */}
          <div className="sticky top-0 z-30 flex items-center justify-between bg-surface border-b border-border h-16 px-5">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-xl p-2 text-txt-primary hover:bg-surface-secondary lg:hidden"
                aria-label="Buka menu navigasi"
              >
                <Menu size={24} />
              </button>
              <span className="ml-3 text-base font-bold text-txt-primary lg:ml-0">Panel Admin</span>
            </div>

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
