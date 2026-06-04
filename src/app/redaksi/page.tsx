export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { Metadata } from "next";
import { ShieldCheck, Building2, MapPin, BookOpen, Mail } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Susunan Redaksi",
  description:
    "Susunan redaksi, legalitas, dan verifikasi Dewan Pers Kartawarta — media berita digital Bandung.",
};

export default async function RedaksiPage() {
  const [members, dewanPersSetting] = await Promise.all([
    prisma.redaksiMember.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    }),
    prisma.systemSetting
      .findUnique({ where: { key: "kta_dewan_pers_number" } })
      .catch(() => null),
  ]);

  // Publisher legalitas — Dewan Pers SK from settings (shared with the press
  // card), legal entity details from env (same source as the Organization
  // JSON-LD). Every field renders only when set — never fabricated.
  const dewanPersNumber = (dewanPersSetting?.value || "").trim();
  const legalName = process.env.NEXT_PUBLIC_PUBLISHER_LEGAL_NAME || "";
  const street = process.env.NEXT_PUBLIC_PUBLISHER_STREET || "";
  const postal = process.env.NEXT_PUBLIC_PUBLISHER_POSTAL || "";
  const founding = process.env.NEXT_PUBLIC_PUBLISHER_FOUNDING || "";
  const addressLine = [street, "Bandung, Jawa Barat", postal]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="bg-surface min-h-screen">
      <div className="container-main py-8 sm:py-10 lg:py-12 2xl:py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="flex items-center gap-3 font-serif text-headline-sm font-bold text-txt-primary sm:text-headline-md lg:text-headline-lg">
            <span className="block h-8 w-[3px] rounded-full bg-secondary" />
            Susunan Redaksi
          </h1>

          <p className="mt-6 text-txt-secondary">
            Berikut susunan redaksi Kartawarta yang bertanggung jawab atas
            seluruh proses produksi dan distribusi konten.
          </p>

          {members.length === 0 ? (
            <div className="mt-8 rounded-lg border-2 border-dashed border-border py-12 text-center">
              <p className="text-txt-muted">Susunan redaksi akan segera diperbarui.</p>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 rounded-lg border border-border bg-surface p-5"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white overflow-hidden">
                    {item.photo ? (
                      <Image src={item.photo} alt={item.name} width={48} height={48} className="h-12 w-12 object-cover" />
                    ) : (
                      item.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                      {item.position}
                    </p>
                    <p className="font-bold text-txt-primary">{item.name}</p>
                    {item.desc && <p className="text-sm text-txt-muted">{item.desc}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Verifikasi & Legalitas — masthead transparency block that news
              platforms (Google News, BaBe, Kurio) inspect before approval. */}
          <div className="mt-10">
            <h2 className="flex items-center gap-3 font-serif text-headline-sm font-bold text-txt-primary sm:text-headline-md">
              <span className="block h-7 w-[3px] rounded-full bg-secondary" />
              Verifikasi &amp; Legalitas
            </h2>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface p-5">
                <div className="flex items-center gap-2 text-primary">
                  <ShieldCheck size={20} />
                  <h3 className="font-bold text-txt-primary">Terverifikasi Dewan Pers</h3>
                </div>
                <p className="mt-2 text-sm text-txt-secondary">
                  Kartawarta tunduk pada Kode Etik Jurnalistik dan Pedoman Pemberitaan
                  Media Siber yang ditetapkan Dewan Pers.
                </p>
                {dewanPersNumber && (
                  <p className="mt-3 text-sm text-txt-primary">
                    <span className="text-txt-muted">No. SK Dewan Pers:</span>{" "}
                    <span className="font-semibold">{dewanPersNumber}</span>
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-border bg-surface p-5">
                <div className="flex items-center gap-2 text-primary">
                  <Building2 size={20} />
                  <h3 className="font-bold text-txt-primary">Penerbit</h3>
                </div>
                <p className="mt-2 text-sm text-txt-primary">
                  {legalName || "Kartawarta"}
                  {founding && (
                    <span className="text-txt-muted"> · berdiri {founding}</span>
                  )}
                </p>
                <p className="mt-2 flex items-start gap-1.5 text-sm text-txt-secondary">
                  <MapPin size={14} className="mt-0.5 shrink-0" />
                  {addressLine}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2.5">
              <Link href="/pedoman-media" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-txt-primary hover:border-primary/40">
                <BookOpen size={15} /> Pedoman Media Siber
              </Link>
              <Link href="/kode-etik" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-txt-primary hover:border-primary/40">
                <BookOpen size={15} /> Kode Etik Jurnalistik
              </Link>
              <Link href="/privasi" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-txt-primary hover:border-primary/40">
                <BookOpen size={15} /> Kebijakan Privasi
              </Link>
            </div>
          </div>

          <div className="mt-8 rounded-lg border border-border bg-surface-secondary p-5">
            <p className="flex items-start gap-2 text-sm text-txt-muted">
              <Mail size={16} className="mt-0.5 shrink-0 text-primary" />
              <span>
                Untuk pengaduan pemberitaan, hak jawab, atau koreksi, hubungi{" "}
                <a href="mailto:redaksi@kartawarta.com" className="text-primary hover:underline">
                  redaksi@kartawarta.com
                </a>
                . Setiap masukan ditindaklanjuti sesuai mekanisme Dewan Pers.
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
