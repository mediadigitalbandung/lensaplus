export const revalidate = 300;

import Link from "next/link";
import { Metadata } from "next";
import {
  ChevronRight,
  Megaphone,
  CheckCircle2,
  FileText,
  MessageCircle,
  Mail,
  Smartphone,
  LayoutGrid,
  Newspaper,
  ImageIcon,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Beriklan di Kartawarta",
  description:
    "Paket iklan, tarif, spesifikasi, dan kontak pemasangan iklan di Kartawarta — media hukum digital tepercaya di Bandung.",
  openGraph: {
    title: "Beriklan di Kartawarta",
    description:
      "Paket iklan, tarif, dan spesifikasi pemasangan iklan di Kartawarta.",
    type: "website",
  },
  alternates: { canonical: "/iklan" },
};

interface AdPackage {
  slug: string;
  name: string;
  price: string;
  unit: string;
  description: string;
  bullets: string[];
  highlight?: boolean;
  icon: typeof LayoutGrid;
}

const packages: AdPackage[] = [
  {
    slug: "header",
    name: "Banner Header",
    price: "Rp 5.000.000",
    unit: "/ bulan",
    description: "Banner premium di area paling atas — terlihat seluruh pengunjung.",
    bullets: [
      "Posisi tetap di atas konten",
      "Tampil di seluruh halaman publik",
      "Estimasi 100k+ impresi / bulan",
      "Format gambar atau HTML5",
    ],
    icon: LayoutGrid,
  },
  {
    slug: "sidebar",
    name: "Sidebar",
    price: "Rp 3.000.000",
    unit: "/ bulan",
    description: "Slot sidebar di halaman artikel dan kategori — visibilitas tinggi saat membaca.",
    bullets: [
      "Tampil di sidebar kanan artikel",
      "Sticky di scroll halaman",
      "Estimasi 60k+ impresi / bulan",
      "Cocok brand awareness berkelanjutan",
    ],
    icon: Smartphone,
    highlight: true,
  },
  {
    slug: "in-article",
    name: "In-Article",
    price: "Rp 2.000.000",
    unit: "/ bulan",
    description: "Iklan menyatu di tengah artikel — engagement tinggi dari pembaca yang fokus.",
    bullets: [
      "Tampil di tengah artikel",
      "Native-like, tidak intrusif",
      "Estimasi 40k+ impresi / bulan",
      "Tracking klik tersedia",
    ],
    icon: Newspaper,
  },
  {
    slug: "sponsored",
    name: "Sponsored Article",
    price: "Rp 10.000.000",
    unit: "/ artikel",
    description: "Artikel bersponsor lengkap — ditulis tim editorial Kartawarta dengan label transparan.",
    bullets: [
      "Artikel 800–1500 kata",
      "Ditulis & disunting tim Kartawarta",
      "Label “Bersponsor” transparan",
      "Promosi di kanal sosial Kartawarta",
      "Permanen di arsip selama domain aktif",
    ],
    icon: FileText,
  },
];

const specs = [
  { label: "Banner Header (Leaderboard)", value: "1456 × 180 px, JPG/PNG/WebP, maks 200 KB" },
  { label: "Sidebar (MPU)", value: "300 × 250 px atau 300 × 600 px, JPG/PNG, maks 150 KB" },
  { label: "In-Article (Banner)", value: "728 × 90 px atau 320 × 100 px, JPG/PNG, maks 120 KB" },
  { label: "Sponsored Article", value: "Materi pendukung 1200 × 630 px untuk featured image" },
  { label: "Format video", value: "MP4 ≤ 5 MB, autoplay muted, opsional" },
  { label: "Deadline submit materi", value: "H-3 sebelum tanggal mulai tayang" },
];

export default function IklanPage() {
  return (
    <div className="bg-surface min-h-screen">
      <div className="container-main py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-txt-muted">
          <Link href="/" className="hover:text-primary">Beranda</Link>
          <ChevronRight size={14} />
          <span className="font-medium text-txt-primary">Beriklan</span>
        </nav>

        {/* Hero */}
        <header className="mb-10 rounded-[12px] border border-border bg-gradient-to-br from-primary/5 to-surface-container-lowest p-8 shadow-card">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/20">
              <Megaphone size={20} />
            </span>
            <span className="text-label-md uppercase tracking-widest text-primary font-bold">
              Untuk Brand & Lembaga
            </span>
          </div>
          <h1 className="mt-4 max-w-3xl font-serif text-3xl font-extrabold leading-tight text-on-surface sm:text-4xl">
            Beriklan di Kartawarta
          </h1>
          <p className="mt-4 max-w-2xl text-base text-on-surface-variant">
            Jangkau pembaca berita hukum di Bandung dan nasional melalui platform editorial yang
            terpercaya. Pilih paket yang sesuai kebutuhan kampanye Anda — dari banner singkat
            hingga sponsored article dengan permanent archive.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href="https://wa.me/628000000000?text=Halo%20Kartawarta%2C%20saya%20tertarik%20beriklan."
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
            >
              <MessageCircle size={16} />
              Hubungi via WhatsApp
            </a>
            <a
              href="mailto:iklan@kartawarta.com?subject=Pemasangan%20Iklan"
              className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
            >
              <Mail size={16} />
              iklan@kartawarta.com
            </a>
          </div>
        </header>

        {/* Packages */}
        <section className="mb-12">
          <h2 className="mb-6 border-l-[3px] border-primary pl-3 text-lg font-bold text-on-surface">
            Paket &amp; Tarif
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {packages.map((pkg) => {
              const Icon = pkg.icon;
              return (
                <article
                  key={pkg.slug}
                  className={`flex h-full flex-col rounded-[12px] border p-6 shadow-card transition-all hover:shadow-card-hover hover:-translate-y-0.5 ${
                    pkg.highlight
                      ? "border-primary/40 bg-primary/[0.03] ring-1 ring-primary/10"
                      : "border-border bg-surface-container-lowest"
                  }`}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon size={18} />
                    </span>
                    {pkg.highlight && (
                      <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                        Populer
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif text-title-lg text-on-surface">{pkg.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="font-serif text-2xl font-extrabold text-primary">
                      {pkg.price}
                    </span>
                    <span className="text-xs text-on-surface-variant">{pkg.unit}</span>
                  </div>
                  <p className="mt-3 text-sm text-on-surface-variant">{pkg.description}</p>
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-on-surface-variant">
                    {pkg.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-primary" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-on-surface-variant">
            *Harga belum termasuk PPN. Diskon berlaku untuk kontrak 3 / 6 / 12 bulan. Tarif khusus
            tersedia untuk lembaga publik dan UMKM lokal Bandung.
          </p>
        </section>

        {/* Specs */}
        <section className="mb-12">
          <h2 className="mb-6 flex items-center gap-2 border-l-[3px] border-primary pl-3 text-lg font-bold text-on-surface">
            <ImageIcon size={18} className="text-primary" />
            Spesifikasi Teknis
          </h2>
          <div className="overflow-hidden rounded-[12px] border border-border bg-surface-container-lowest shadow-card">
            <table className="w-full text-sm">
              <tbody>
                {specs.map((s, i) => (
                  <tr
                    key={s.label}
                    className={i > 0 ? "border-t border-border" : ""}
                  >
                    <th className="w-1/3 bg-surface-container-low px-5 py-3 text-left font-semibold text-on-surface">
                      {s.label}
                    </th>
                    <td className="px-5 py-3 text-on-surface-variant">{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-[12px] border border-border bg-primary p-8 text-white shadow-card">
          <h2 className="font-serif text-2xl font-bold">Tertarik beriklan? Mari bicara.</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/80">
            Tim sales kami akan membantu memilih paket yang paling sesuai dengan target kampanye
            dan anggaran Anda. Konsultasi gratis tanpa komitmen.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a
              href="https://wa.me/628000000000?text=Halo%20Kartawarta%2C%20saya%20tertarik%20beriklan."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-primary hover:bg-white/90 transition-colors"
            >
              <MessageCircle size={16} />
              WhatsApp Kami
            </a>
            <a
              href="mailto:iklan@kartawarta.com?subject=Pemasangan%20Iklan"
              className="inline-flex items-center gap-2 rounded-md border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              <Mail size={16} />
              Email
            </a>
            <Link
              href="/kontak"
              className="inline-flex items-center gap-2 rounded-md border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Form Kontak
            </Link>
          </div>
          <p className="mt-4 text-[11px] uppercase tracking-wider text-white/60">
            *Nomor WhatsApp dan email di atas adalah placeholder — silakan ganti dengan kontak resmi
            tim iklan Kartawarta.
          </p>
        </section>
      </div>
    </div>
  );
}
