import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Transparansi Anggaran & APBD",
  description:
    "Data alokasi APBD Kota Bandung, Pemerintah Provinsi Jawa Barat, dan APBN nasional — disajikan interaktif untuk transparansi publik.",
  openGraph: {
    title: "Transparansi Anggaran & APBD - Lensaplus",
    description:
      "Ringkasan postur dan rincian belanja APBD Bandung Raya, Jawa Barat, dan APBN.",
    type: "website",
  },
  alternates: { canonical: "/anggaran" },
};

export default function AnggaranLayout({ children }: { children: ReactNode }) {
  return children;
}
