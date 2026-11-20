import { Metadata } from "next";
import UntukAndaClient from "./UntukAndaClient";

export const metadata: Metadata = {
  title: "Untuk Anda — Berita Pilihan Berdasarkan Bacaan | Lensaplus",
  description:
    "Rekomendasi artikel berdasarkan kategori yang Anda paling sering baca. Privacy-respecting — cookie 30 hari, tanpa login.",
  robots: { index: false }, // jangan index karena content per-user
  alternates: { canonical: "/untuk-anda" },
};

export default function UntukAndaPage() {
  return <UntukAndaClient />;
}
