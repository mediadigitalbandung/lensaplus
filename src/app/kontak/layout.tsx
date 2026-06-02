import { Metadata } from "next";
import { organizationJsonLd } from "@/lib/seo/json-ld";

export const metadata: Metadata = {
  title: "Hubungi Kami",
  description: "Hubungi redaksi Kartawarta untuk pertanyaan, masukan, kerjasama iklan, atau laporan berita. Kami siap melayani Anda.",
  alternates: { canonical: "/kontak" },
  openGraph: {
    title: "Hubungi Kami — Kartawarta",
    description: "Hubungi redaksi Kartawarta untuk pertanyaan, masukan, kerjasama iklan, atau laporan berita.",
    type: "website",
  },
};

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";

export default function KontakLayout({ children }: { children: React.ReactNode }) {
  // ContactPage JSON-LD whose `about` is the publisher Organization (carries
  // email + PostalAddress + editorial contactPoint) — a transparency signal
  // for Google on the contact page.
  const { "@context": _ctx, ...orgNode } = organizationJsonLd() as Record<string, unknown>;
  void _ctx;
  const contactJsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Hubungi Kami — Kartawarta",
    url: `${SITE_URL}/kontak`,
    about: orgNode,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }}
      />
      {children}
    </>
  );
}
