import type { Metadata } from "next";
import Link from "next/link";
import {
  Smartphone,
  Apple,
  Download,
  Chrome,
  ShieldCheck,
  Wifi,
  Bell,
  Bookmark,
  Zap,
  CheckCircle2,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Unduh Aplikasi Kartawarta",
  description:
    "Pasang aplikasi Kartawarta di HP Anda — Android, iPhone, atau desktop. Berita digital Bandung kapan saja, hemat data, bisa offline. Gratis tanpa app store.",
  alternates: { canonical: "/unduh" },
};

export default function UnduhPage() {
  return (
    <div className="bg-surface min-h-screen">
      <div className="container-main py-10 sm:py-16">
        {/* Hero */}
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <span className="inline-block rounded-full bg-primary-light px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            Aplikasi
          </span>
          <h1 className="mt-4 font-serif text-3xl sm:text-5xl font-extrabold text-txt-primary tracking-tight leading-tight">
            Pasang Kartawarta di HP Anda
          </h1>
          <p className="mt-4 text-lg text-txt-secondary leading-relaxed">
            Berita Bandung kapan saja, hemat data, bisa baca offline. Tanpa
            iklan tambahan, tanpa permintaan data pribadi yang berlebihan.
            Gratis selamanya.
          </p>
        </div>

        {/* Benefits */}
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12 sm:mb-16">
          {[
            { icon: Zap, label: "Lebih cepat", hint: "Loading instan dari home screen" },
            { icon: Wifi, label: "Bisa offline", hint: "Artikel dibaca tetap tersimpan" },
            { icon: Bell, label: "Notifikasi", hint: "Berita penting langsung ke layar" },
            { icon: Bookmark, label: "Tanpa iklan ekstra", hint: "Iklan sama dengan situs" },
          ].map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.label}
                className="rounded-2xl border border-border bg-surface p-4 text-center shadow-card"
              >
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
                  <Icon size={18} />
                </div>
                <p className="mt-2.5 text-sm font-bold text-txt-primary">{b.label}</p>
                <p className="mt-1 text-[11px] text-txt-muted">{b.hint}</p>
              </div>
            );
          })}
        </div>

        {/* Install per platform */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Android Chrome */}
          <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/40 to-surface p-6 shadow-card">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Smartphone size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-txt-primary">Android</h2>
                <p className="text-[11px] text-txt-muted">Chrome / Edge / Brave</p>
              </div>
              <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Termudah
              </span>
            </div>
            <ol className="space-y-2.5 text-sm text-txt-secondary">
              <Step n={1}>Buka kartawarta.com di Chrome</Step>
              <Step n={2}>
                Tap menu ⋮ pojok kanan atas → <b className="text-txt-primary">"Pasang aplikasi"</b> /
                "Add to Home screen"
              </Step>
              <Step n={3}>Konfirmasi → ikon Kartawarta muncul di home screen</Step>
              <Step n={4}>Tap ikon → langsung fullscreen tanpa browser</Step>
            </ol>
            <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <CheckCircle2 size={12} className="inline mr-1 -mt-0.5" />
              Tidak perlu download — semua otomatis lewat Chrome.
            </div>
          </div>

          {/* iPhone Safari */}
          <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50/40 to-surface p-6 shadow-card">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <Apple size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-txt-primary">iPhone &amp; iPad</h2>
                <p className="text-[11px] text-txt-muted">Safari (wajib)</p>
              </div>
            </div>
            <ol className="space-y-2.5 text-sm text-txt-secondary">
              <Step n={1}>Buka kartawarta.com di <b className="text-txt-primary">Safari</b> (bukan Chrome — iOS hanya support PWA dari Safari)</Step>
              <Step n={2}>Tap ikon Share di bawah (kotak dengan panah ke atas)</Step>
              <Step n={3}>Scroll & tap <b className="text-txt-primary">"Add to Home Screen"</b></Step>
              <Step n={4}>Tap "Add" → ikon muncul di home screen</Step>
            </ol>
            <div className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
              <CheckCircle2 size={12} className="inline mr-1 -mt-0.5" />
              Push notifikasi tersedia mulai iOS 16.4 (Maret 2023+).
            </div>
          </div>

          {/* Desktop */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                <Chrome size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-txt-primary">Desktop</h2>
                <p className="text-[11px] text-txt-muted">Windows / Mac / Linux</p>
              </div>
            </div>
            <ol className="space-y-2.5 text-sm text-txt-secondary">
              <Step n={1}>Buka kartawarta.com di Chrome / Edge</Step>
              <Step n={2}>
                Klik ikon <b className="text-txt-primary">"Install"</b> di address bar (sebelah bookmark)
              </Step>
              <Step n={3}>Atau menu ⋮ → "Install Kartawarta..."</Step>
              <Step n={4}>App muncul di Start Menu / Launchpad / Apps</Step>
            </ol>
            <div className="mt-4 rounded-lg bg-purple-50 px-3 py-2 text-xs text-purple-800">
              <CheckCircle2 size={12} className="inline mr-1 -mt-0.5" />
              Buka dari taskbar, multi-window, fullscreen.
            </div>
          </div>
        </div>

        {/* APK fallback (opsional, kalau user pengen file APK) */}
        <div className="max-w-4xl mx-auto mt-10 rounded-2xl border border-border bg-surface-secondary/40 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Download size={22} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-txt-primary">
                Pengguna mahir: Unduh file APK
              </h3>
              <p className="mt-1 text-sm text-txt-secondary leading-relaxed">
                Untuk Anda yang lebih nyaman install dari file APK (mis. tanpa Chrome,
                atau ROM custom). File APK ini di-build menggunakan Trusted Web Activity
                resmi Google — sama seperti app yang akan kami terbitkan di Play Store.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <a
                  href="/downloads/kartawarta.apk"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-dark transition-colors"
                  download
                >
                  <Download size={16} /> Unduh APK (~2 MB)
                </a>
                <span className="text-xs text-txt-muted">
                  Versi 1.0.0 · diperbarui otomatis dari web
                </span>
              </div>
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-semibold text-txt-primary">
                  Cara install APK manual
                </summary>
                <ol className="mt-3 space-y-2 text-txt-secondary list-decimal list-inside">
                  <li>Download file APK ke HP Android (atau transfer dari komputer)</li>
                  <li>Buka file → Android akan minta izin "Install unknown apps" → izinkan untuk browser/file manager</li>
                  <li>Tap "Install" → tunggu beberapa detik</li>
                  <li>Buka Kartawarta dari home screen / app drawer</li>
                </ol>
                <p className="mt-3 text-xs text-txt-muted">
                  ⚠️ Pesan "Pemindaian Play Protect" mungkin muncul karena APK belum lewat Play Store —
                  tap "Tetap install" / "Install anyway". Aman karena APK ditandatangani oleh kami
                  dan terverifikasi via{" "}
                  <Link href="/.well-known/assetlinks.json" className="underline">
                    Digital Asset Links
                  </Link>{" "}
                  ke domain kartawarta.com.
                </p>
              </details>
            </div>
          </div>
        </div>

        {/* Trust signals */}
        <div className="max-w-4xl mx-auto mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <TrustCard icon={ShieldCheck} title="Terverifikasi Dewan Pers" body="Media resmi dengan kode etik jurnalistik" />
          <TrustCard icon={CheckCircle2} title="Tanpa data berlebih" body="Hanya yang perlu untuk fitur — privasi terjaga" />
          <TrustCard icon={Wifi} title="Hemat data" body="Cache cerdas, hanya download yang baru" />
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto mt-12 sm:mt-16">
          <h2 className="font-serif text-2xl font-bold text-txt-primary mb-5">
            Pertanyaan Umum
          </h2>
          <div className="space-y-3">
            <Faq q="Kenapa belum ada di Play Store?" a="Sedang dalam proses submission. Sementara ini, Anda bisa install langsung dari Chrome (tap menu → 'Pasang aplikasi') — sama saja dengan app Play Store, hanya tanpa lewat store." />
            <Faq q="Aman tidak install dari luar Play Store?" a="Aman. APK kami ditandatangani digital dan terverifikasi via Digital Asset Links ke domain kartawarta.com — sama dengan standar app Play Store. Anda bisa cek hash APK kami sebelum install." />
            <Faq q="Berapa besar ukurannya?" a="Hanya ~2 MB untuk APK. Konten (artikel, gambar) di-stream dari kartawarta.com, jadi gak makan storage besar." />
            <Faq q="Bisa update otomatis?" a="Ya. Karena kontennya dari web, setiap kali kami update artikel/fitur, Anda langsung dapat tanpa perlu update app." />
            <Faq q="Bedanya dengan buka kartawarta.com di browser?" a="App: fullscreen tanpa URL bar, splash screen Kartawarta, ikon di home screen, push notification, dan halaman yang sudah dibaca tetap bisa diakses offline." />
            <Faq q="Apakah collect data saya?" a="Hanya yang perlu untuk fitur (mis. preferensi font, bookmark di local device, email kalau langganan newsletter). Tidak ada tracking iklan pihak ketiga di luar yang sudah ada di website." />
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary">
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

function TrustCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <Icon size={20} className="mx-auto text-primary mb-2" />
      <p className="text-sm font-bold text-txt-primary">{title}</p>
      <p className="mt-1 text-xs text-txt-muted">{body}</p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-border bg-surface px-4 py-3 hover:border-primary/30 transition-colors">
      <summary className="cursor-pointer text-sm font-semibold text-txt-primary list-none flex items-center justify-between gap-3">
        <span>{q}</span>
        <span className="text-txt-muted text-xs group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <p className="mt-2 text-sm text-txt-secondary leading-relaxed">{a}</p>
    </details>
  );
}
