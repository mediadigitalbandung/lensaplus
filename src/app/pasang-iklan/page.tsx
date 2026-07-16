export const revalidate = 3600; // stats refresh hourly — no need for live data

import type { Metadata } from "next";
import Link from "next/link";
import {
  Megaphone,
  ShieldCheck,
  Newspaper,
  LayoutTemplate,
  Handshake,
  FileText,
  TrendingUp,
  CheckCircle2,
  MapPin,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { slotLabels, slotSpecs } from "@/app/panel/iklan/_components/ad-constants";
import AdInquiryForm from "@/components/ads/AdInquiryForm";

export const metadata: Metadata = {
  title: "Pasang Iklan & Kerjasama",
  description:
    "Jangkau pembaca Bandung & Jawa Barat lewat Lensaplus — media terverifikasi Dewan Pers. Banner display, advertorial, dan kerjasama media pemerintah daerah.",
  alternates: { canonical: "/pasang-iklan" },
};

// ──────────────────────────────────────────────────────────────────────────
// RATE CARD — tarif indikatif. EDIT angka di sini sesuai harga jual Anda.
// Tarif final tetap dinegosiasikan via formulir (audiens & durasi menentukan).
// ──────────────────────────────────────────────────────────────────────────
const DISPLAY_PRICES: Record<string, string> = {
  HEADER: "Rp 2.500.000",
  BETWEEN_SECTIONS: "Rp 2.000.000",
  SIDEBAR: "Rp 1.500.000",
  IN_ARTICLE: "Rp 1.750.000",
  FOOTER: "Rp 1.000.000",
  FLOATING_BOTTOM: "Rp 1.250.000",
  POPUP: "Rp 1.500.000",
};

const PACKAGES = [
  {
    icon: FileText,
    title: "Advertorial / Berita Berbayar",
    price: "Mulai Rp 1.000.000",
    unit: "/ artikel",
    desc: "Konten promosi ditulis gaya jurnalistik, dimuat permanen, diberi label 'Advertorial', plus distribusi ke Google News & media sosial Lensaplus.",
    points: ["Penulisan oleh tim redaksi", "Tayang permanen + label transparan", "Distribusi sosial media"],
  },
  {
    icon: Handshake,
    title: "Kerjasama Media / Pemda",
    price: "Paket Bulanan",
    unit: "/ kontrak",
    desc: "Kontrak publikasi rutin untuk pemerintah daerah, BUMD, instansi, dan korporasi. Kuota artikel & banner bulanan dengan tarif khusus.",
    points: ["Kuota artikel bulanan", "Liputan acara/agenda", "Laporan kinerja berkala"],
  },
  {
    icon: LayoutTemplate,
    title: "Banner Display",
    price: "Mulai Rp 1.000.000",
    unit: "/ bulan / slot",
    desc: "Banner statis/GIF/HTML di posisi strategis. Cocok untuk branding bisnis lokal, properti, event, kampus, dan klinik.",
    points: ["7 posisi slot tersedia", "Statistik impresi & klik", "Ganti materi kapan saja"],
  },
];

const WHY = [
  {
    icon: MapPin,
    title: "Audiens Bandung & Jawa Barat",
    desc: "Pembaca terkonsentrasi di Bandung Raya & Jabar — tepat untuk menjangkau pasar lokal Anda.",
  },
  {
    icon: ShieldCheck,
    title: "Media Kredibel",
    desc: "Terverifikasi standar Dewan Pers. Brand Anda tampil di lingkungan berita tepercaya, bukan situs abal-abal.",
  },
  {
    icon: Newspaper,
    title: "Multi-Kanal",
    desc: "Konten Anda tersebar ke Website, Google News, serta Instagram & kanal sosial Lensaplus.",
  },
  {
    icon: TrendingUp,
    title: "Terukur",
    desc: "Setiap banner dilengkapi statistik impresi & klik. Advertorial dapat dilacak via Google Analytics.",
  },
];

export default async function PasangIklanPage() {
  // Real, honest figures for the media kit. View-count is intentionally NOT
  // surfaced as a headline metric (it's an internal popularity counter, not a
  // GA-grade audience number — detailed traffic data is shared in the media kit).
  const [articleCount, categoryCount] = await Promise.all([
    prisma.article.count({ where: { status: "PUBLISHED" } }).catch(() => 0),
    prisma.category.count().catch(() => 0),
  ]);

  const stats = [
    { value: `${articleCount.toLocaleString("id-ID")}+`, label: "Artikel Terbit" },
    { value: `${categoryCount}`, label: "Rubrik" },
    { value: "Dewan Pers", label: "Terverifikasi" },
    { value: "Google News", label: "Terindeks" },
  ];

  const slotOrder = ["HEADER", "BETWEEN_SECTIONS", "SIDEBAR", "IN_ARTICLE", "FLOATING_BOTTOM", "FOOTER", "POPUP"];

  return (
    <div className="bg-surface min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary to-primary-dark text-white">
        <div className="container-main py-12 sm:py-16 lg:py-20">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider ring-1 ring-inset ring-white/20">
              <Megaphone size={13} /> Pasang Iklan
            </span>
            <h1 className="mt-4 font-serif text-headline-md font-bold leading-tight sm:text-headline-lg lg:text-display-sm">
              Promosikan Bisnis Anda di Media Berita Tepercaya Bandung
            </h1>
            <p className="mt-4 text-base text-white/85 sm:text-lg">
              Jangkau pembaca Bandung &amp; Jawa Barat lewat banner display, advertorial, dan
              kerjasama media. Lensaplus — terverifikasi Dewan Pers, terindeks Google News.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="#formulir" className="btn-primary bg-secondary hover:bg-secondary-dark">
                Minta Penawaran
              </Link>
              <Link
                href="#paket"
                className="rounded-md border border-white/30 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Lihat Paket &amp; Tarif
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-b border-border bg-surface-lowest">
        <div className="container-main grid grid-cols-2 gap-4 py-8 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-serif text-2xl font-bold text-primary sm:text-3xl">{s.value}</p>
              <p className="mt-1 text-xs text-txt-secondary sm:text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why advertise */}
      <section className="container-main py-12 sm:py-14">
        <h2 className="flex items-center gap-3 font-serif text-headline-sm font-bold text-txt-primary sm:text-headline-md">
          <span className="block h-7 w-[3px] rounded-full bg-secondary" />
          Mengapa Beriklan di Lensaplus?
        </h2>
        <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map((w) => (
            <div key={w.title} className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-light text-primary">
                <w.icon size={20} />
              </div>
              <h3 className="mt-4 font-bold text-txt-primary">{w.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-txt-secondary">{w.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Packages */}
      <section id="paket" className="bg-surface-lowest py-12 sm:py-14">
        <div className="container-main">
          <h2 className="flex items-center gap-3 font-serif text-headline-sm font-bold text-txt-primary sm:text-headline-md">
            <span className="block h-7 w-[3px] rounded-full bg-secondary" />
            Paket Kerjasama
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-txt-secondary">
            Tarif indikatif. Harga final menyesuaikan durasi, jumlah materi, dan target kampanye —
            dibahas melalui formulir di bawah.
          </p>
          <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {PACKAGES.map((p) => (
              <div
                key={p.title}
                className="flex flex-col rounded-xl border border-border bg-surface p-6 shadow-card"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary-light text-secondary">
                  <p.icon size={22} />
                </div>
                <h3 className="mt-4 text-lg font-bold text-txt-primary">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-txt-secondary">{p.desc}</p>
                <ul className="mt-4 space-y-2">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2 text-sm text-txt-secondary">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 border-t border-border pt-4">
                  <span className="text-xl font-bold text-primary">{p.price}</span>
                  <span className="text-sm text-txt-muted"> {p.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Banner slot catalog */}
      <section className="container-main py-12 sm:py-14">
        <h2 className="flex items-center gap-3 font-serif text-headline-sm font-bold text-txt-primary sm:text-headline-md">
          <span className="block h-7 w-[3px] rounded-full bg-secondary" />
          Posisi &amp; Ukuran Banner
        </h2>
        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-surface-lowest text-txt-secondary">
              <tr>
                <th className="px-4 py-3 font-semibold">Posisi</th>
                <th className="px-4 py-3 font-semibold">Ukuran</th>
                <th className="px-4 py-3 font-semibold">Keterangan</th>
                <th className="px-4 py-3 text-right font-semibold">Tarif / bulan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slotOrder.map((slot) => (
                <tr key={slot} className="bg-surface">
                  <td className="px-4 py-3 font-semibold text-txt-primary">{slotLabels[slot]}</td>
                  <td className="px-4 py-3 font-mono text-xs text-txt-secondary">
                    {slotSpecs[slot]?.ratio}
                  </td>
                  <td className="px-4 py-3 text-txt-secondary">{slotSpecs[slot]?.desc}</td>
                  <td className="px-4 py-3 text-right font-semibold text-primary">
                    {DISPLAY_PRICES[slot] ?? "Hubungi"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-txt-muted">
          Format materi: gambar (JPG/PNG), GIF animasi, atau kode HTML. Diskon tersedia untuk
          kontrak 3/6/12 bulan.
        </p>
      </section>

      {/* Inquiry form */}
      <section id="formulir" className="bg-surface-lowest py-12 sm:py-16">
        <div className="container-main">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <h2 className="font-serif text-headline-sm font-bold text-txt-primary sm:text-headline-md">
                Siap Beriklan?
              </h2>
              <p className="mt-3 text-txt-secondary">
                Kirim permintaan Anda dan tim pemasaran Lensaplus akan menghubungi Anda dengan
                <strong className="text-txt-primary"> media kit lengkap</strong> berisi data audiens
                terbaru (Google Analytics) serta penawaran tarif yang sesuai kebutuhan.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Respons 1–2 hari kerja",
                  "Media kit + data traffic GA terverifikasi",
                  "Tarif fleksibel sesuai anggaran",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm text-txt-secondary">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-txt-secondary">
                Atau email langsung:{" "}
                <a href="mailto:redaksi@lensaplus.com" className="font-semibold text-primary hover:underline">
                  redaksi@lensaplus.com
                </a>
              </p>
            </div>
            <AdInquiryForm />
          </div>
        </div>
      </section>
    </div>
  );
}
