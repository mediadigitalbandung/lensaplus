"use client";

import Link from "next/link";

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
    <footer className="bg-gradient-primary text-white" role="contentinfo" aria-label="Footer situs">
      <div className="container-main py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Brand */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2">
              <span className="font-serif text-xl font-bold text-white tracking-tight">
                Kartawarta
              </span>
            </div>
            <p className="mt-4 max-w-xs text-body-sm leading-relaxed text-white/40">
              Media digital terpercaya. Menyajikan berita terkini dengan standar jurnalistik tertinggi.
            </p>

            {/* Badge Dewan Pers */}
            <div className="mt-6 inline-flex items-center gap-3 rounded-full bg-white/[0.07] px-4 py-2.5 backdrop-blur-sm border border-white/[0.08]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500">
                <svg
                  width="18"
                  height="18"
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
                <span className="text-label-md font-semibold text-white tracking-wide leading-tight" style={{ letterSpacing: "0.01em" }}>
                  Terverifikasi Dewan Pers
                </span>
                <span className="text-[10px] text-white/40 leading-tight mt-0.5">
                  Sertifikat No. 608/DP-Verifikasi/K/XI/2020
                </span>
              </div>
            </div>
          </div>

          {/* Tentang */}
          <div>
            <h4 className="mb-4 text-label-md font-semibold uppercase tracking-wider text-white/30">
              Tentang
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.tentang.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-body-sm text-white/50 transition-colors duration-200 hover:text-white"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Kontak */}
          <div>
            <h4 className="mb-4 text-label-md font-semibold uppercase tracking-wider text-white/30">
              Kontak
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.kontak.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-body-sm text-white/50 transition-colors duration-200 hover:text-white"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar — no border line, use spacing */}
        <div className="mt-12 pt-6">
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <p className="text-label-sm text-white/30 uppercase tracking-wider">
              &copy; {new Date().getFullYear()} Kartawarta. Seluruh hak cipta dilindungi.
            </p>
            <p className="text-label-sm text-white/30">
              Anggota{" "}
              <span className="font-medium text-white/50">Dewan Pers Indonesia</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
