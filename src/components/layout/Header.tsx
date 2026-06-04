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
      {/* Row 1: Top bar — Split Blue/White header */}
      <header className="sticky top-0 z-50 bg-gradient-primary border-b border-[#001530]" role="banner" aria-label="Header utama">
        <div className="container-main flex items-stretch justify-between">
          
          {/* Left side: Logo Block with White Background */}
          <div className="relative flex items-center bg-white py-3 pr-6 sm:pr-10 pl-5 sm:pl-8 lg:pl-8 -ml-5 sm:-ml-8 lg:-ml-8">
            {/* Extend white background to the far left screen edge */}
            <div className="absolute top-0 bottom-0 right-full w-[50vw] bg-white"></div>
            {/* Slanted edge on the right */}
            <div className="absolute top-0 bottom-0 left-full w-8 sm:w-12 bg-white" style={{ clipPath: "polygon(0 0, 100% 100%, 0 100%)" }}></div>
            
            {/* Logo */}
            <Link href="/" className="group flex shrink-0 items-center gap-3 relative z-10">
              <Image
                src="/kartawarta-icon.png"
                alt="Kartawarta"
                width={96}
                height={96}
                className="h-9 w-9 sm:h-12 sm:w-12 object-contain"
                quality={100}
                priority
              />
              <span className="flex items-baseline gap-1.5 sm:gap-2">
                <span className="font-serif text-lg font-bold text-primary sm:text-2xl lg:text-3xl tracking-tight">
                  Kartawarta
                </span>
              </span>
            </Link>
          </div>

          {/* Right side: Date, Search, Actions */}
          <div className="flex flex-1 items-center justify-end gap-3 py-3 pl-8 sm:pl-12 md:pl-16 relative z-10">
            {/* Live date — deferred to client to avoid hydration mismatch
                between VPS (UTC) and visitor (Asia/Jakarta) timezones */}
            <span className="hidden text-label-sm text-white/50 md:block uppercase tracking-wider">
              <ClientDate date={new Date()} format="weekday-long" live={false} />
            </span>
            <div className="hidden h-4 w-px bg-white/20 md:block" />
            
            {/* Search */}
            <form action="/search" className="relative hidden md:block md:w-64 lg:w-80" role="search" aria-label="Pencarian artikel">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
                aria-hidden="true"
              />
              <input
                type="text"
                name="q"
                placeholder="Cari berita..."
                aria-label="Cari artikel"
                className="w-full rounded-md bg-white border border-transparent py-2 pl-10 pr-4 text-body-sm text-gray-900 placeholder:text-gray-400 transition-all shadow-inner focus:border-white focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </form>

            {/* Untuk Anda link */}
            <Link
              href="/untuk-anda"
              className="hidden md:flex items-center gap-1.5 rounded-md px-3 py-1.5 text-label-sm font-medium text-white/70 transition-colors hover:text-white hover:bg-white/10"
              title="Untuk Anda — Feed Personal"
            >
              <Sparkles size={14} />
              <span className="hidden lg:inline">Untuk Anda</span>
            </Link>

            {/* Bookmark link */}
            <Link
              href="/bookmark"
              className="hidden md:flex items-center gap-1.5 rounded-md px-3 py-1.5 text-label-sm font-medium text-white/70 transition-colors hover:text-white hover:bg-white/10"
              title="Bookmark Saya"
            >
              <Bookmark size={14} />
              <span className="hidden lg:inline">Bookmark</span>
            </Link>

            {/* User area */}
            {status === "loading" ? (
              <div className="h-10 w-10 animate-pulse rounded-md bg-white/10" aria-hidden="true" />
            ) : session ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex h-10 w-10 items-center justify-center rounded-md bg-white/10 text-label-lg font-bold text-white transition-all hover:bg-white/20"
                  aria-label="Menu pengguna"
                  aria-expanded={userMenuOpen}
                >
                    {session.user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </button>
                  {userMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-md bg-surface-container-lowest py-1 shadow-ambient">
                        <div className="px-4 py-2.5">
                          <p className="text-title-sm text-on-surface">
                            {session.user?.name || "User"}
                          </p>
                        </div>
                        <div className="h-px bg-surface-container" />
                        <Link
                          href="/panel/dashboard"
                          className="flex items-center gap-2 px-4 py-2.5 text-body-sm text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <LayoutDashboard size={14} />
                          Panel
                        </Link>
                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            signOut();
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-body-sm text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
                        >
                          <LogOut size={14} />
                          Keluar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-label-md font-semibold text-primary shadow-sm transition-all hover:bg-white/90 sm:px-4"
                  aria-label="Masuk ke akun"
                >
                  <LogIn size={14} />
                  <span>Masuk</span>
                </Link>
              )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-11 w-11 items-center justify-center rounded-md text-white/70 transition-colors hover:text-white hover:bg-white/10 lg:hidden"
              aria-label={mobileMenuOpen ? "Tutup menu" : "Buka menu navigasi"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile search bar — add pt-3 so it doesn't visually fuse with
            the brand row above (no breathing room between the white logo
            block and the white search input on the dark navy backdrop). */}
        <div className={`overflow-hidden md:hidden transition-all duration-500 ease-in-out container-main ${scrolled || mobileMenuOpen ? "max-h-0 pt-0 pb-0 opacity-0 -translate-y-2" : "max-h-24 pt-3 pb-3 opacity-100 translate-y-0"}`}>
          <form action="/search" className="relative" role="search" aria-label="Pencarian artikel (mobile)">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
              aria-hidden="true"
            />
            <input
              type="text"
              name="q"
              placeholder="Cari berita..."
              aria-label="Cari artikel"
              className="w-full rounded-md bg-white border border-transparent py-2 pl-10 pr-4 text-body-sm text-gray-900 placeholder:text-gray-400 transition-all shadow-inner focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </form>
        </div>
      </header>

      {/* Row 2: Category navigation — overflow collapses into a "Lainnya" menu
          instead of clipping the rightmost links off the edge. */}
      <nav className="bg-[#1C1C1E] relative border-b border-[#2C2C2E]" aria-label="Navigasi kategori">
        <div className="container-main relative">
          {/* Hidden ruler — the FULL list, off-screen, used only to measure how
              many links fit at the current width. */}
          <ul ref={rulerRef} aria-hidden="true" className="pointer-events-none invisible absolute -left-[9999px] top-0 flex items-center gap-0">
            {categoryNav.map((item) => (
              <li key={item.href} className="shrink-0">
                <span className="inline-block px-2 sm:px-3 py-2 sm:py-3 text-label-sm sm:text-label-lg font-bold whitespace-nowrap">
                  {item.name}
                </span>
              </li>
            ))}
          </ul>

          <ul ref={navUlRef} className="flex items-center gap-0">
            {categoryNav.slice(0, visibleCount).map((item) => {
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <li key={item.href} className="shrink-0">
                  <Link
                    href={item.href}
                    className={`relative inline-block px-2 sm:px-3 py-2 sm:py-3 text-label-sm sm:text-label-lg transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? "text-white font-bold after:absolute after:bottom-0 after:left-2 sm:after:left-2.5 after:right-2 sm:after:right-2.5 after:h-[2px] after:bg-primary"
                        : "text-white/70 font-medium hover:text-white"
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
                  aria-haspopup="true"
                  aria-expanded={moreOpen}
                  className="inline-flex items-center gap-1 px-2 sm:px-3 py-2 sm:py-3 text-label-sm sm:text-label-lg font-medium text-white/70 transition-colors hover:text-white whitespace-nowrap"
                >
                  Lainnya
                  <ChevronDown size={14} className={`transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`} />
                </button>
                {moreOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} aria-hidden="true" />
                    <div className="absolute right-0 top-full z-40 max-h-[70vh] w-56 overflow-y-auto overscroll-contain rounded-b-md border border-[#2C2C2E] bg-[#1C1C1E] py-1 shadow-ambient-lg sm:w-64">
                      {categoryNav.slice(visibleCount).map((item) => {
                        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMoreOpen(false)}
                            className={`block px-4 py-2.5 text-label-md transition-colors hover:bg-white/5 ${
                              isActive ? "font-bold text-white" : "font-medium text-white/80 hover:text-white"
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
