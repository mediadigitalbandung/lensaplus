export const dynamic = "force-static";

import Link from "next/link";
import { Metadata } from "next";
import {
  ChevronRight,
  MapPin,
  Phone,
  Clock,
  Building2,
  ExternalLink,
} from "lucide-react";
import { courtLocations } from "@/data/court-locations";

export const metadata: Metadata = {
  title: "Lokasi Pengadilan",
  description:
    "Direktori pengadilan utama di Bandung dan sekitarnya — alamat, kontak, jam operasional, dan tautan peta.",
  openGraph: {
    title: "Lokasi Pengadilan - Kartawarta",
    description: "Direktori pengadilan utama di wilayah Bandung.",
    type: "website",
  },
  alternates: { canonical: "/lokasi" },
};

const TYPE_LABEL: Record<string, string> = {
  PN: "Pengadilan Negeri",
  PA: "Pengadilan Agama",
  PT: "Pengadilan Tinggi",
  PTUN: "PTUN",
  PTA: "Pengadilan Tinggi Agama",
  TIPIKOR: "Tipikor",
  MIL: "Pengadilan Militer",
  MA: "Mahkamah Agung",
};

export default function LokasiIndexPage() {
  return (
    <div className="bg-surface min-h-screen">
      <div className="container-main py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-txt-muted">
          <Link href="/" className="hover:text-primary">Beranda</Link>
          <ChevronRight size={14} />
          <span className="font-medium text-txt-primary">Lokasi</span>
        </nav>

        <div className="mb-8 max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="block h-7 w-[3px] rounded-full bg-primary" />
            <h1 className="flex items-center gap-2 text-xl font-bold text-txt-primary sm:text-2xl lg:text-3xl">
              <Building2 size={22} className="text-primary" />
              Direktori Lokasi Pengadilan
            </h1>
          </div>
          <p className="mt-3 text-sm text-on-surface-variant">
            Daftar pengadilan utama di Bandung dan wilayah sekitarnya beserta alamat, kontak,
            jam operasional, dan tautan peta. Data dirangkum dari sumber publik — silakan
            konfirmasi ulang ke pengadilan terkait sebelum berkunjung.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courtLocations.map((c) => (
            <article
              key={c.slug}
              className="group flex h-full flex-col rounded-[12px] border border-border bg-surface-container-lowest p-5 shadow-card transition-all hover:border-primary/40 hover:shadow-card-hover hover:-translate-y-0.5"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="inline-block rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                  {TYPE_LABEL[c.type] ?? c.type}
                </span>
                <span className="text-xs text-on-surface-variant">{c.city}</span>
              </div>
              <Link href={`/lokasi/${c.slug}`}>
                <h2 className="font-serif text-title-lg leading-snug text-on-surface group-hover:text-primary transition-colors">
                  {c.name}
                </h2>
              </Link>
              <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">
                {c.description}
              </p>
              <div className="mt-4 space-y-2 text-sm text-on-surface-variant">
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-primary" />
                  <span className="line-clamp-2">{c.address}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Phone size={14} className="mt-0.5 shrink-0 text-primary" />
                  <span>{c.phone}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Clock size={14} className="mt-0.5 shrink-0 text-primary" />
                  <span>{c.hours}</span>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                <Link
                  href={`/lokasi/${c.slug}`}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Detail &rarr;
                </Link>
                <a
                  href={c.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
                >
                  <ExternalLink size={12} />
                  Maps
                </a>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-[12px] border border-dashed border-border bg-surface-container-low p-6 text-sm text-on-surface-variant">
          <strong className="text-on-surface">Catatan:</strong> data alamat &amp; nomor telepon
          dirangkum dari sumber publik (situs Mahkamah Agung dan situs masing-masing pengadilan).
          Jam operasional dapat berubah pada hari libur nasional. Untuk koreksi data, silakan{" "}
          <Link href="/kontak" className="text-primary hover:underline">hubungi redaksi</Link>.
        </div>
      </div>
    </div>
  );
}
