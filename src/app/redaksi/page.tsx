export const dynamic = "force-dynamic";

import Image from "next/image";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Susunan Redaksi",
  description: "Susunan redaksi Kartawarta.",
};

export default async function RedaksiPage() {
  const members = await prisma.redaksiMember.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
  });

  return (
    <div className="bg-surface min-h-screen">
      <div className="container-main py-8 sm:py-10 lg:py-12 2xl:py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="flex items-center gap-3 font-serif text-headline-sm font-bold text-txt-primary sm:text-headline-md lg:text-headline-lg">
            <span className="block h-8 w-[3px] rounded-full bg-primary" />
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

          <div className="mt-8 rounded-lg border border-border bg-surface-secondary p-5">
            <p className="text-sm text-txt-muted">
              Susunan redaksi ini akan diperbarui seiring dengan perkembangan organisasi.
              Untuk informasi lebih lanjut, silakan hubungi{" "}
              <a href="mailto:redaksi@kartawarta.com" className="text-primary hover:underline">
                redaksi@kartawarta.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
