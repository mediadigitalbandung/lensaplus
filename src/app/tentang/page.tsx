import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tentang Kami",
  description:
    "Lensaplus — portal berita digital terpercaya: bisnis & ekonomi, pemerintahan, hukum, serta topik umum lainnya.",
};

export default function TentangPage() {
  return (
    <div className="bg-surface min-h-screen">
      <div className="container-main py-8 sm:py-10 lg:py-12 2xl:py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="flex items-center gap-3 font-serif text-headline-sm font-bold text-txt-primary sm:text-headline-md lg:text-headline-lg">
            <span className="block h-8 w-[3px] rounded-full bg-secondary" />
            Tentang Kami
          </h1>

          <div className="mt-8 space-y-6 font-serif text-[17px] leading-relaxed text-txt-secondary">
            <p>
              <strong className="text-txt-primary">Lensaplus</strong> adalah portal berita digital yang menyajikan
              beragam isu — dengan prioritas pada bisnis &amp; ekonomi,
              pemerintahan, dan hukum — di samping topik umum lain seperti olahraga, hiburan, dan teknologi.
              Kami berdiri dengan visi menjadi sumber informasi yang terpercaya, akurat, dan berimbang bagi masyarakat.
            </p>
            <p>
              Kami percaya bahwa akses terhadap informasi yang berkualitas adalah hak setiap warga negara.
              Melalui jurnalisme yang cermat dan analisis mendalam, kami berusaha menyajikan berita yang
              tidak hanya informatif, tetapi juga edukatif.
            </p>
            <p>
              Tim redaksi kami terdiri dari jurnalis berpengalaman dengan latar belakang jurnalistik. Setiap artikel
              yang kami terbitkan melalui proses verifikasi ketat untuk memastikan keakuratan dan keberimbangan informasi.
              Susunan redaksi selengkapnya dapat dilihat pada halaman{" "}
              <Link href="/redaksi" className="text-primary hover:underline">Redaksi</Link>.
            </p>
          </div>

          {/* Values */}
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            {[
              { title: "Akurat & Terverifikasi", desc: "Setiap berita melalui proses fact-checking dan verifikasi sumber sebelum dipublikasikan." },
              { title: "Transparan", desc: "Kami terbuka terhadap koreksi dan selalu mencantumkan sumber informasi dalam setiap artikel." },
              { title: "Berimbang", desc: "Kami menyajikan berita dari berbagai perspektif tanpa memihak salah satu pihak." },
              { title: "Profesional", desc: "Tim redaksi mematuhi Kode Etik Jurnalistik dan Pedoman Pemberitaan Media Siber." },
            ].map((item) => (
              <div key={item.title} className="rounded-lg border border-border border-t-2 border-t-primary/40 bg-surface p-6">
                <h3 className="font-bold text-txt-primary">{item.title}</h3>
                <p className="mt-1.5 text-sm text-txt-secondary">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Contact / publisher identity. Legal entity, full address, phone and
              founding year render only when their env vars are set — never with
              placeholder data. */}
          <div className="mt-12 rounded-lg border border-border bg-surface-secondary p-6">
            <h2 className="text-lg font-bold text-txt-primary">Informasi Penerbit &amp; Kontak</h2>
            <div className="mt-3 space-y-2 text-sm text-txt-secondary">
              {process.env.NEXT_PUBLIC_PUBLISHER_LEGAL_NAME && (
                <p>
                  <strong className="text-txt-primary">Penerbit:</strong>{" "}
                  {process.env.NEXT_PUBLIC_PUBLISHER_LEGAL_NAME}
                </p>
              )}
              <p>
                <strong className="text-txt-primary">Alamat Redaksi:</strong>{" "}
                {process.env.NEXT_PUBLIC_PUBLISHER_STREET
                  ? `${process.env.NEXT_PUBLIC_PUBLISHER_STREET}, `
                  : ""}
                Bandung, Jawa Barat
                {process.env.NEXT_PUBLIC_PUBLISHER_POSTAL
                  ? ` ${process.env.NEXT_PUBLIC_PUBLISHER_POSTAL}`
                  : ""}
                , Indonesia
              </p>
              <p><strong className="text-txt-primary">Email:</strong> redaksi@lensaplus.com</p>
              {process.env.NEXT_PUBLIC_PUBLISHER_PHONE && (
                <p>
                  <strong className="text-txt-primary">Telepon:</strong>{" "}
                  {process.env.NEXT_PUBLIC_PUBLISHER_PHONE}
                </p>
              )}
              <p><strong className="text-txt-primary">Website:</strong> lensaplus.com</p>
              {process.env.NEXT_PUBLIC_PUBLISHER_FOUNDING && (
                <p>
                  <strong className="text-txt-primary">Didirikan:</strong>{" "}
                  {process.env.NEXT_PUBLIC_PUBLISHER_FOUNDING}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
