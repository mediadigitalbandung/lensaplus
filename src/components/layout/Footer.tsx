"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
    { name: "Bookmark Saya", href: "/bookmark" },
    { name: "Kebijakan Privasi", href: "/privasi" },
    { name: "Syarat & Ketentuan", href: "/syarat-ketentuan" },
    { name: "Pasang Iklan", href: "/kontak" },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-white text-on-surface border-t border-border" role="contentinfo" aria-label="Footer situs">
      <div className="container-main py-14">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12">
          {/* Brand + Badge — takes more space */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-5">
            <div className="flex items-center gap-2">
              <span className="font-serif text-2xl font-bold text-on-surface tracking-tight">
                Kartawarta
              </span>
            </div>
            <p className="mt-4 max-w-sm text-body-md leading-relaxed text-txt-muted">
              Media digital terpercaya. Menyajikan berita terkini dengan standar jurnalistik tertinggi.
            </p>

            {/* Badge Dewan Pers — Larger */}
            <div className="mt-8 inline-flex items-center gap-4 rounded-2xl bg-primary px-6 py-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-500 shadow-lg shadow-blue-500/30">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M12 2L4 5.5V11.5C4 16.74 7.42 21.59 12 23C16.58 21.59 20 16.74 20 11.5V5.5L12 2Z"
                    fill="white"
                    fillOpacity="0.25"
                  />
                  <path
                    d="M12 2L4 5.5V11.5C4 16.74 7.42 21.59 12 23C16.58 21.59 20 16.74 20 11.5V5.5L12 2Z"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9 12L11 14L15 10"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-label-lg font-bold text-white tracking-wide leading-tight">
                  Terverifikasi Dewan Pers
                </span>
                <span className="text-body-sm text-white/50 leading-tight mt-1">
                  Sertifikat No. 608/DP-Verifikasi/K/XI/2020
                </span>
              </div>
            </div>
          </div>

          {/* Tentang — shifted right */}
          <div className="lg:col-span-3 lg:col-start-7">
            <h4 className="mb-4 text-label-md font-semibold uppercase tracking-wider text-txt-muted">
              Tentang
            </h4>
            <ul className="space-y-3">
              {footerLinks.tentang.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-body-md text-txt-secondary transition-colors duration-200 hover:text-primary"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Kontak — shifted right */}
          <div className="lg:col-span-3 lg:col-start-10">
            <h4 className="mb-4 text-label-md font-semibold uppercase tracking-wider text-txt-muted">
              Kontak
            </h4>
            <ul className="space-y-3">
              {footerLinks.kontak.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-body-md text-txt-secondary transition-colors duration-200 hover:text-primary"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 pt-6 border-t border-border">
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <p className="text-label-sm text-txt-muted uppercase tracking-wider">
              &copy; <ClientYear /> Kartawarta. Seluruh hak cipta dilindungi.
            </p>
            <p className="text-label-sm text-txt-muted">
              Anggota{" "}
              <span className="font-semibold text-txt-secondary">Dewan Pers Indonesia</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
