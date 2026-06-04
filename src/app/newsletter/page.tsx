import type { Metadata } from "next";
import NewsletterForm from "./NewsletterForm";

export const metadata: Metadata = {
  title: "Newsletter — Kartawarta",
  description:
    "Berlangganan newsletter mingguan Kartawarta — kabar hukum, investigasi, dan analisis pilihan dari Bandung. Gratis, sekali seminggu, mudah berhenti.",
  alternates: { canonical: "/newsletter" },
};

export default async function NewsletterPage({ searchParams: searchParamsPromise }: {
  searchParams: Promise<{ status?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const status = searchParams.status;
  const messages: Record<string, { tone: "success" | "error" | "info"; title: string; body: string }> = {
    confirmed: {
      tone: "success",
      title: "Langganan aktif",
      body: "Terima kasih. Anda akan menerima berita pilihan setiap Senin pagi.",
    },
    "already-confirmed": {
      tone: "info",
      title: "Sudah terdaftar",
      body: "Email ini sudah berlangganan. Tidak perlu konfirmasi ulang.",
    },
    unsubscribed: {
      tone: "info",
      title: "Berlangganan dihentikan",
      body: "Anda tidak akan menerima newsletter lagi. Anda bisa berlangganan kembali kapan saja.",
    },
    "invalid-token": {
      tone: "error",
      title: "Tautan tidak valid",
      body: "Tautan kedaluwarsa atau salah. Silakan daftar ulang di bawah.",
    },
  };
  const banner = status ? messages[status] : null;

  return (
    <div className="bg-surface min-h-screen">
      <div className="container-main py-12 sm:py-16">
        <div className="max-w-2xl mx-auto">
          <span className="inline-block rounded-full bg-primary-light px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            Newsletter
          </span>
          <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold text-txt-primary tracking-tight font-serif leading-tight">
            Kabar hukum Bandung, langsung ke kotak masuk Anda.
          </h1>
          <p className="mt-4 text-lg text-txt-secondary leading-relaxed">
            Setiap Senin pagi, kami kirim 8 laporan terbaik pekan ini — putusan, investigasi,
            wawancara, dan analisis dari redaksi Kartawarta. Gratis. Tidak ada spam. Mudah berhenti.
          </p>

          {banner && (
            <div
              className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
                banner.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : banner.tone === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-blue-200 bg-blue-50 text-blue-800"
              }`}
            >
              <p className="font-semibold">{banner.title}</p>
              <p className="mt-0.5 opacity-90">{banner.body}</p>
            </div>
          )}

          <div className="mt-8 rounded-xl border border-border bg-surface-secondary/40 p-6 sm:p-8">
            <NewsletterForm source="page" />
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg bg-surface p-4 border border-border">
              <p className="font-bold text-txt-primary">8 berita pilihan</p>
              <p className="mt-1 text-txt-muted text-xs">Kurasi redaksi, bukan algoritma.</p>
            </div>
            <div className="rounded-lg bg-surface p-4 border border-border">
              <p className="font-bold text-txt-primary">Sekali seminggu</p>
              <p className="mt-1 text-txt-muted text-xs">Senin pagi, 07.00 WIB.</p>
            </div>
            <div className="rounded-lg bg-surface p-4 border border-border">
              <p className="font-bold text-txt-primary">Mudah berhenti</p>
              <p className="mt-1 text-txt-muted text-xs">Satu klik di footer email.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
