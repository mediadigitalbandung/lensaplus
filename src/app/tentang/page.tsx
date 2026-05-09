import { Metadata } from "next";
import { Shield, Eye, Users, Award } from "lucide-react";

export const metadata: Metadata = {
  title: "Tentang Kami",
  description: "Kartawarta - Media hukum digital terpercaya untuk wilayah Bandung dan sekitarnya.",
};

export default function TentangPage() {
  return (
    <div className="bg-surface min-h-screen">
      <div className="container-main py-8 sm:py-10 lg:py-12 2xl:py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="flex items-center gap-3 font-serif text-headline-sm font-bold text-txt-primary sm:text-headline-md lg:text-headline-lg">
            <span className="block h-8 w-[3px] rounded-full bg-primary" />
            Tentang Kami
          </h1>

          <div className="mt-8 space-y-6 font-serif text-[17px] leading-relaxed text-txt-secondary">
            <p>
              <strong className="text-txt-primary">Kartawarta</strong> adalah media digital yang berfokus pada pemberitaan
              hukum di wilayah Bandung Raya dan Jawa Barat. Didirikan dengan visi menjadi sumber informasi
              hukum yang terpercaya, akurat, dan berimbang bagi masyarakat.
            </p>
            <p>
              Kami percaya bahwa akses terhadap informasi yang berkualitas adalah hak setiap warga negara.
              Melalui jurnalisme investigatif dan analisis mendalam, kami berusaha menyajikan berita yang
              tidak hanya informatif, tetapi juga edukatif.
            </p>
            <p>
              Tim redaksi kami terdiri dari jurnalis berpengalaman yang memiliki latar belakang pendidikan hukum
              dan jurnalistik. Setiap artikel yang kami terbitkan melalui proses verifikasi ketat untuk memastikan
              keakuratan dan keberimbangan informasi.
            </p>
          </div>

          {/* Values */}
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            {[
              { icon: Shield, title: "Akurat & Terverifikasi", desc: "Setiap berita melalui proses fact-checking dan verifikasi sumber sebelum dipublikasikan." },
              { icon: Eye, title: "Transparan", desc: "Kami terbuka terhadap koreksi dan selalu mencantumkan sumber informasi dalam setiap artikel." },
              { icon: Users, title: "Berimbang", desc: "Kami menyajikan berita dari berbagai perspektif tanpa memihak salah satu pihak." },
              { icon: Award, title: "Profesional", desc: "Tim redaksi mematuhi Kode Etik Jurnalistik dan Pedoman Pemberitaan Media Siber." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-[12px] border border-border bg-surface p-6">
                  <Icon size={24} className="text-primary" />
                  <h3 className="mt-3 font-bold text-txt-primary">{item.title}</h3>
                  <p className="mt-1 text-sm text-txt-secondary">{item.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Contact */}
          <div className="mt-12 rounded-[12px] border border-border bg-surface-secondary p-6">
            <h2 className="text-lg font-bold text-txt-primary">Informasi Kontak</h2>
            <div className="mt-3 space-y-2 text-sm text-txt-secondary">
              <p><strong className="text-txt-primary">Alamat Redaksi:</strong> Bandung, Jawa Barat, Indonesia</p>
              <p><strong className="text-txt-primary">Email:</strong> redaksi@kartawarta.com</p>
              <p><strong className="text-txt-primary">Website:</strong> kartawarta.com</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
