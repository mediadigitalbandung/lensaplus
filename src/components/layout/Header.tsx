"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import ClientDate from "@/components/ClientDate";
import {
  Menu,
  X,
  Search,
  LogOut,
  LogIn,
  LayoutDashboard,
  ChevronRight,
  ChevronDown,
  Bookmark,
  User,
  Sparkles,
} from "lucide-react";

const categoryNav = [
  { name: "Hukum", href: "/kategori/hukum" },
  { name: "Bisnis", href: "/kategori/bisnis-ekonomi" },
  { name: "Olahraga", href: "/kategori/olahraga" },
  { name: "Hiburan", href: "/kategori/hiburan" },
  { name: "Kesehatan", href: "/kategori/kesehatan" },
  { name: "Pertanian", href: "/kategori/pertanian-peternakan" },
  { name: "Teknologi", href: "/kategori/teknologi" },
  { name: "Politik", href: "/kategori/politik" },
  { name: "Pendidikan", href: "/kategori/pendidikan" },
  { name: "Lingkungan", href: "/kategori/lingkungan" },
  { name: "Gaya Hidup", href: "/kategori/gaya-hidup" },
  { name: "Opini", href: "/kategori/opini" },
  { name: "Regulasi", href: "/regulasi" },
  { name: "Pejabat", href: "/pejabat" },
  { name: "Live", href: "/live" },
  { name: "Pasang Iklan", href: "/pasang-iklan" },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Category-bar overflow: instead of clipping the rightmost links, measure how
  // many fit and collapse the rest into a "Lainnya" dropdown.
  const navUlRef = useRef<HTMLUListElement>(null);
  const rulerRef = useRef<HTMLUListElement>(null);
  const [visibleCount, setVisibleCount] = useState(3); // safe SSR default; refined on mount
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const container = navUlRef.current;
    const ruler = rulerRef.current;
    if (!container || !ruler) return;
    const MORE_WIDTH = 92; // px reserved for the "Lainnya ▾" button when needed
    const compute = () => {
      const avail = container.clientWidth;
      const items = Array.from(ruler.children) as HTMLElement[];
      let used = 0;
      let count = 0;
      for (let i = 0; i < items.length; i++) {
        const w = items[i].getBoundingClientRect().width;
        const reserve = i < items.length - 1 ? MORE_WIDTH : 0; // leave room for the menu unless it's the last item
        if (used + w + reserve <= avail) {
          used += w;
          count++;
        } else {
          break;
        }
      }
      setVisibleCount(Math.max(1, count));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Close the overflow dropdown when navigating.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  useEffect(() => {
    let lastY = 0;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > 150 && y > lastY) {
        setScrolled(true);
      } else if (y < 100) {
        setScrolled(false);
      }
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* ── 1. Classic Editorial Newspaper Masthead (Unscrolled Mode) ── */}
      <header className={`bg-white border-b border-stone-200/50 transition-all duration-300 ${scrolled ? "opacity-0 -translate-y-full h-0 overflow-hidden pointer-events-none" : "opacity-100 translate-y-0"}`} role="banner" aria-label="Header utama">
        {/* Top level masthead: Left (Date), Center (Centered Large Logo), Right (Actions) */}
        <div className="container-main py-5 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left: Date */}
          <div className="hidden md:flex items-center gap-2 text-stone-500 uppercase tracking-wider text-label-sm font-semibold">
            <ClientDate date={new Date()} format="weekday-long" live={false} />
          </div>

          {/* Center: Large Serif Brand Name */}
          <div className="text-center">
            <Link href="/" className="group inline-flex items-center gap-3.5">
              <Image
                src="/lensaplus-icon.png"
                alt="Lensaplus"
                width={128}
                height={128}
                className="h-10 w-10 sm:h-12 sm:w-12 object-contain transition-transform duration-355 group-hover:rotate-12"
                quality={100}
                priority
              />
              <span className="font-serif text-3xl sm:text-4xl lg:text-5xl font-extrabold text-primary tracking-tighter">
                Lensaplus
              </span>
            </Link>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3.5">
            {/* Search Form */}
            <form action="/search" className="relative hidden md:block md:w-48 lg:w-64" role="search" aria-label="Pencarian artikel">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
                aria-hidden="true"
              />
              <input
                type="text"
                name="q"
                placeholder="Cari berita..."
                aria-label="Cari artikel"
                className="w-full rounded-full bg-stone-100 border border-transparent py-1.5 pl-9 pr-4 text-body-sm text-stone-900 placeholder:text-stone-400 transition-all focus:bg-white focus:border-stone-250 focus:outline-none focus:ring-2 focus:ring-primary/10"
              />
            </form>

            {/* Bookmarks */}
            <Link
              href="/bookmark"
              className="hidden md:flex items-center justify-center h-9 w-9 rounded-full bg-stone-100 text-stone-600 hover:text-primary hover:bg-primary/5 transition-all"
              title="Bookmark Saya"
            >
              <Bookmark size={15} />
            </Link>

            {/* User Profile */}
            {status === "loading" ? (
              <div className="h-9 w-9 animate-pulse rounded-full bg-stone-100" />
            ) : session ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-label-md font-bold text-primary hover:bg-primary/20 transition-all"
                >
                  {session.user?.name?.charAt(0)?.toUpperCase() || "U"}
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl bg-white border border-stone-200/60 py-1 shadow-ambient">
                      <div className="px-4 py-2.5">
                        <p className="text-title-sm text-on-surface font-semibold">{session.user?.name}</p>
                      </div>
                      <div className="h-px bg-stone-100" />
                      <Link href="/panel/dashboard" className="flex items-center gap-2 px-4 py-2.5 text-body-sm text-on-surface-variant hover:bg-stone-50 hover:text-primary" onClick={() => setUserMenuOpen(false)}>
                        <LayoutDashboard size={14} /> Panel
                      </Link>
                      <button onClick={() => { setUserMenuOpen(false); signOut(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-body-sm text-on-surface-variant hover:bg-stone-50 hover:text-primary">
                        <LogOut size={14} /> Keluar
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-label-sm font-bold text-white hover:bg-primary-dark transition-all"
              >
                Masuk
              </Link>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100 md:hidden"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>

        {/* Double-Rule Nav Bar (Categories) */}
        <nav className="border-y border-stone-200/50 bg-white" aria-label="Navigasi kategori">
          <div className="container-main relative">
            {/* Hidden ruler for width measurement */}
            <ul ref={rulerRef} aria-hidden="true" className="pointer-events-none invisible absolute -left-[9999px] top-0 flex items-center gap-0">
              {categoryNav.map((item) => (
                <li key={item.href} className="shrink-0">
                  <span className="inline-block px-3 py-3 text-label-md font-bold whitespace-nowrap">
                    {item.name}
                  </span>
                </li>
              ))}
            </ul>

            <ul ref={navUlRef} className="flex items-center justify-center gap-1 overflow-hidden">
              {categoryNav.slice(0, visibleCount).map((item) => {
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      className={`relative inline-block px-3 py-3 text-label-md font-bold transition-all duration-200 whitespace-nowrap ${
                        isActive
                          ? "text-primary after:absolute after:bottom-0 after:left-3 after:right-3 after:h-[2px] after:bg-primary"
                          : "text-stone-600 hover:text-primary"
                      }`}
                    >
                      {item.name}
                    </Link>
                  </li>
                );
              })}

              {visibleCount < categoryNav.length && (
                <li className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setMoreOpen((o) => !o)}
                    className="inline-flex items-center gap-1 px-3 py-3 text-label-md font-bold text-stone-600 hover:text-primary whitespace-nowrap"
                  >
                    Lainnya
                    <ChevronDown size={14} className={`transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`} />
                  </button>
                  {moreOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} />
                      <div className="absolute right-0 top-full z-40 max-h-[70vh] w-56 overflow-y-auto overscroll-contain rounded-b-xl border border-stone-200 bg-white py-1 shadow-ambient-lg">
                        {categoryNav.slice(visibleCount).map((item) => {
                          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setMoreOpen(false)}
                              className={`block px-4 py-2.5 text-label-md transition-colors hover:bg-stone-50 ${
                                isActive ? "font-bold text-primary bg-stone-50" : "font-medium text-stone-600 hover:text-primary"
                              }`}
                            >
                              {item.name}
                            </Link>
                          );
                        })}
                      </div>
                    </>
                  )}
                </li>
              )}
            </ul>
          </div>
        </nav>
      </header>

      {/* ── 2. Floating Island Capsule (Scrolled Mode) ── */}
      <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-5xl rounded-full bg-white/90 backdrop-blur-md border border-stone-200/60 shadow-ambient px-6 py-2.5 flex items-center justify-between transition-all duration-300 ${scrolled ? "translate-y-0 opacity-100" : "-translate-y-16 opacity-0 pointer-events-none"}`}>
        {/* Left: Compact Logo */}
        <Link href="/" className="group flex shrink-0 items-center gap-2">
          <Image
            src="/lensaplus-icon.png"
            alt="Lensaplus"
            width={64}
            height={64}
            className="h-7 w-7 object-contain"
            quality={100}
            priority
          />
          <span className="font-serif text-lg font-bold text-primary tracking-tight">
            Lensaplus
          </span>
        </Link>

        {/* Middle: Micro Category list (Top 4 Categories) */}
        <nav className="hidden md:flex items-center gap-1.5" aria-label="Navigasi cepat kategori">
          {categoryNav.slice(0, 4).map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3.5 py-1 text-label-sm font-bold transition-all ${isActive ? "bg-primary text-white" : "text-stone-600 hover:bg-stone-100 hover:text-primary"}`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Simple Search Toggle/Link */}
          <Link
            href="/search"
            className="flex h-8 w-8 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100 hover:text-primary transition-all"
            title="Cari"
          >
            <Search size={14} />
          </Link>

          {/* Bookmarks */}
          <Link
            href="/bookmark"
            className="flex h-8 w-8 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100 hover:text-primary transition-all"
            title="Bookmark Saya"
          >
            <Bookmark size={14} />
          </Link>

          {/* User profile */}
          {status === "loading" ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-stone-100" />
          ) : session ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-label-sm font-bold text-primary hover:bg-primary/20 transition-all"
              >
                {session.user?.name?.charAt(0)?.toUpperCase() || "U"}
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl bg-white border border-stone-200/60 py-1 shadow-ambient">
                    <div className="px-4 py-2.5">
                      <p className="text-title-sm text-on-surface font-semibold">{session.user?.name}</p>
                    </div>
                    <div className="h-px bg-stone-100" />
                    <Link href="/panel/dashboard" className="flex items-center gap-2 px-4 py-2.5 text-body-sm text-on-surface-variant hover:bg-stone-50 hover:text-primary" onClick={() => setUserMenuOpen(false)}>
                      <LayoutDashboard size={12} /> Panel
                    </Link>
                    <button onClick={() => { setUserMenuOpen(false); signOut(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-body-sm text-on-surface-variant hover:bg-stone-50 hover:text-primary">
                      <LogOut size={12} /> Keluar
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-8 items-center justify-center rounded-full bg-primary px-4 py-1 text-[11px] font-bold text-white hover:bg-primary-dark transition-all"
            >
              Masuk
            </Link>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100 md:hidden"
          >
            <Menu size={16} />
          </button>
        </div>
      </div>

      {/* Mobile slide-in panel */}
      <div
        className={`fixed inset-0 z-[60] lg:hidden transition-all duration-300 ${
          mobileMenuOpen ? "visible" : "invisible"
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
            mobileMenuOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileMenuOpen(false)}
        />

        <div
          id="mobile-nav-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Menu navigasi"
          className={`absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-surface-container-lowest transition-transform duration-300 ease-out shadow-ambient-lg ${
            mobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-title-sm text-on-surface">Menu</span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
              aria-label="Tutup menu"
            >
              <X size={20} />
            </button>
          </div>

          <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: "calc(100vh - 130px)" }}>
            <div className="px-3 py-2">
              <span className="px-3 text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                Kategori
              </span>
            </div>
            <ul className="space-y-0.5 px-3 pb-3">
              {categoryNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-[44px] items-center justify-between rounded-md px-3 py-3 text-body-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low hover:text-primary active:bg-surface-container"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.name}
                    <ChevronRight size={16} className="text-on-surface-variant" />
                  </Link>
                </li>
              ))}
            </ul>

            <div className="px-3 py-2">
              <span className="px-3 text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                Lainnya
              </span>
            </div>
            <ul className="space-y-0.5 px-3 pb-3">
              <li>
                <Link
                  href="/untuk-anda"
                  className="flex min-h-[44px] items-center gap-2 rounded-md px-3 py-3 text-body-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low hover:text-primary active:bg-surface-container"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Sparkles size={16} className="text-secondary" />
                  Untuk Anda
                </Link>
              </li>
              <li>
                <Link
                  href="/bookmark"
                  className="flex min-h-[44px] items-center gap-2 rounded-md px-3 py-3 text-body-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low hover:text-primary active:bg-surface-container"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Bookmark size={16} className="text-primary" />
                  Bookmark Saya
                </Link>
              </li>
              {session && (
                <li>
                  <Link
                    href="/panel/dashboard"
                    className="flex min-h-[44px] items-center gap-2 rounded-md px-3 py-3 text-body-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low hover:text-primary active:bg-surface-container"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <LayoutDashboard size={16} className="text-primary" />
                    Panel
                  </Link>
                </li>
              )}
            </ul>
          </div>

          <div className="absolute bottom-0 left-0 right-0 border-t border-surface-container-low px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {status === "loading" ? (
              <div className="h-10 w-full animate-pulse rounded-md bg-surface-container-low" />
            ) : session ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-label-lg font-bold text-white">
                  {session.user?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-semibold text-on-surface">
                    {session.user?.name || "User"}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      signOut();
                    }}
                    className="flex items-center gap-1 text-label-sm text-on-surface-variant transition-colors hover:text-secondary"
                  >
                    <LogOut size={12} />
                    Keluar
                  </button>
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-label-lg font-semibold text-white transition-all hover:bg-primary-dark"
              >
                <LogIn size={16} />
                Masuk
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
