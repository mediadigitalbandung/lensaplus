"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PushSubscribeButton from "@/components/push/PushSubscribeButton";

function ClientYear() {
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => setYear(new Date().getFullYear()), []);
  return <>{year ?? ""}</>;
}

const footerLinks = {
  tentang: [
    { name: "Tentang Kami", href: "/tentang" },
    { name: "Redaksi", href: "/redaksi" },
    { name: "Kode Etik", href: "/kode-etik" },
    { name: "Pedoman Media", href: "/pedoman-media" },
  ],
  kontak: [
    { name: "Kontak Redaksi", href: "/kontak" },
    { name: "Siaran Langsung", href: "/live" },
    { name: "Pasang Aplikasi", href: "/unduh" },
    { name: "Newsletter", href: "/newsletter" },
    { name: "Bookmark Saya", href: "/bookmark" },
    { name: "Pasar & Bursa", href: "/pasar" },
    { name: "Direktori Emiten", href: "/emiten" },
    { name: "Ekonomi Bandung", href: "/ekonomi-bandung" },
    { name: "Anggaran APBD", href: "/anggaran" },
    { name: "Kalender Emiten", href: "/kalender-emiten" },
    { name: "Regulasi", href: "/regulasi" },
    { name: "Pejabat", href: "/pejabat" },
    { name: "Kebijakan Privasi", href: "/privasi" },
    { name: "Syarat & Ketentuan", href: "/syarat-ketentuan" },
    { name: "Pasang Iklan", href: "/pasang-iklan" },
  ],
};

export default function Footer({ dewanPersNumber }: { dewanPersNumber?: string }) {
  return (
    <footer className="bg-[#1E1B4B] text-white border-t border-stone-800" role="contentinfo" aria-label="Footer situs">
      <div className="container-main py-10 sm:py-12 lg:py-14 2xl:py-20">
        <div className="grid grid-cols-1 gap-8 sm:gap-10 sm:grid-cols-2 md:grid-cols-12">
          {/* Brand + Badge — takes more space */}
          <div className="col-span-1 sm:col-span-2 md:col-span-5">
            <div className="flex items-center gap-2">
              <span className="font-serif text-2xl font-bold text-white tracking-tight">
                Lensaplus
              </span>
            </div>
            <p className="mt-4 max-w-sm text-body-md leading-relaxed text-stone-300">
              Media digital terpercaya. Menyajikan berita terkini dengan standar jurnalistik tertinggi.
            </p>

            {/* Push Notification subscribe */}
            <div className="mt-6">
              <p className="mb-2 text-body-sm text-stone-400">
                Dapatkan notifikasi artikel terbaru langsung di browser Anda.
              </p>
              <PushSubscribeButton />
            </div>

            {/* Badge Dewan Pers — open layout, no container box */}
            <div className="mt-8 flex items-start gap-3.5">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                className="shrink-0 text-secondary"
              >
                <path
                  d="M12 2L4 5.5V11.5C4 16.74 7.42 21.59 12 23C16.58 21.59 20 16.74 20 11.5V5.5L12 2Z"
                  fill="currentColor"
                  fillOpacity="0.08"
                />
                <path
                  d="M12 2L4 5.5V11.5C4 16.74 7.42 21.59 12 23C16.58 21.59 20 16.74 20 11.5V5.5L12 2Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 12L11 14L15 10"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="flex flex-col leading-tight">
                <span className="font-serif text-title-md font-semibold text-white tracking-tight">
                  Terverifikasi Dewan Pers
                </span>
                <span className="mt-1 text-label-sm uppercase tracking-wider text-stone-400">
                  {dewanPersNumber ? `Sertifikat ${dewanPersNumber}` : "Anggota Dewan Pers Indonesia"}
                </span>
              </div>
            </div>
          </div>

          {/* Tentang — shifted right */}
          <div className="md:col-span-3 md:col-start-7">
            <h4 id="footer-tentang-heading" className="mb-4 text-label-md font-bold uppercase tracking-wider text-stone-400">
              Tentang
            </h4>
            <ul className="space-y-3">
              {footerLinks.tentang.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-body-md text-stone-300 transition-colors duration-200 hover:text-white"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Kontak — shifted right */}
          <div className="md:col-span-3 md:col-start-10">
            <h4 id="footer-kontak-heading" className="mb-4 text-label-md font-bold uppercase tracking-wider text-stone-400">
              Kontak
            </h4>
            <ul className="space-y-3 flex flex-col">
              {footerLinks.kontak.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-body-md text-stone-300 transition-colors duration-200 hover:text-white"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 pt-6 border-t border-stone-850">
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <p className="text-label-sm text-stone-400 uppercase tracking-wider">
              &copy; <ClientYear /> Lensaplus. Seluruh hak cipta dilindungi.
            </p>
            <p className="text-label-sm text-stone-400">
              Anggota{" "}
              <span className="font-semibold text-stone-300">Dewan Pers Indonesia</span>
            </p>
          </div>
        </div>
      </div>

      {/* Honeypot */}
      <a
        href="/api/trap"
        rel="nofollow noindex"
        aria-hidden="true"
        tabIndex={-1}
        className="pointer-events-none absolute -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0"
      >
        Arsip lengkap
      </a>
    </footer>
  );
}
