import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pedoman Media Siber",
  description: "Pedoman pemberitaan media siber Lensaplus.",
};

export default function PedomanMediaPage() {
  return (
    <div className="bg-surface min-h-screen">
      <div className="container-main py-12">
        <div className="mx-auto max-w-3xl">
          <h1 className="flex items-center gap-3 text-lg font-bold text-txt-primary sm:text-xl sm:text-2xl lg:text-3xl">
            <span className="block h-8 w-[3px] rounded-full bg-secondary" />
            Pedoman Media Siber
          </h1>

          <div className="mt-8 space-y-6 font-serif text-[17px] leading-relaxed text-txt-secondary">
            <p>
              Lensaplus sebagai media siber mematuhi <strong className="text-txt-primary">Pedoman Pemberitaan Media Siber</strong> yang
              ditetapkan oleh Dewan Pers Indonesia. Berikut adalah prinsip-prinsip yang kami terapkan:
            </p>

            <h2 className="!mt-10 text-lg font-bold text-txt-primary sm:text-xl">1. Verifikasi dan Keberimbangan</h2>
            <p>
              Setiap berita yang dipublikasikan wajib melalui proses verifikasi fakta. Kami menggunakan sistem
              label verifikasi (Terverifikasi, Belum Diverifikasi, Opini, Koreksi) untuk memberikan transparansi
              kepada pembaca tentang status setiap artikel.
            </p>

            <h2 className="!mt-8 text-lg font-bold text-txt-primary sm:text-xl">2. Pencantuman Sumber</h2>
            <p>
              Setiap artikel berita wajib mencantumkan minimal satu sumber yang dapat diverifikasi. Informasi
              narasumber (nama, jabatan, institusi) dicantumkan di bagian bawah setiap artikel.
            </p>

            <h2 className="!mt-8 text-lg font-bold text-txt-primary sm:text-xl">3. Hak Jawab dan Koreksi</h2>
            <p>
              Kami menyediakan mekanisme hak jawab bagi pihak yang merasa dirugikan oleh pemberitaan.
              Koreksi dan klarifikasi dipublikasikan secara transparan dan dapat diakses oleh publik.
              Permohonan hak jawab atau koreksi dapat diajukan melalui email{" "}
              <a href="mailto:redaksi@lensaplus.com" className="text-primary hover:underline">redaksi@lensaplus.com</a>{" "}
              atau formulir pada halaman{" "}
              <a href="/kontak" className="text-primary hover:underline">Kontak</a> dengan subjek
              &quot;Koreksi Berita&quot;. Redaksi menindaklanjuti setiap permohonan dalam waktu wajar dan
              memuat koreksi pada artikel terkait.
            </p>

            <h2 className="!mt-8 text-lg font-bold text-txt-primary sm:text-xl">4. Anti-Hoax</h2>
            <p>
              Kami menerapkan checklist jurnalistik yang harus dipenuhi sebelum artikel dipublikasikan,
              termasuk pengecekan judul tidak clickbait, ketersediaan sumber, keberimbangan perspektif,
              dan ketiadaan unsur SARA.
            </p>

            <h2 className="!mt-8 text-lg font-bold text-txt-primary sm:text-xl">5. Pelaporan Publik</h2>
            <p>
              Pembaca dapat melaporkan berita yang dianggap tidak akurat, mengandung hoax, SARA, atau
              pencemaran nama baik melalui tombol &quot;Laporkan Berita Ini&quot; yang tersedia di setiap artikel.
              Setiap laporan akan ditinjau oleh tim redaksi.
            </p>

            <h2 className="!mt-8 text-lg font-bold text-txt-primary sm:text-xl">6. Perlindungan Hak Cipta</h2>
            <p>
              Seluruh konten yang dipublikasikan di Lensaplus dilindungi hak cipta.
              Pengutipan diperbolehkan dengan mencantumkan sumber dan link ke artikel asli.
              Sistem kami secara otomatis menyertakan informasi atribusi penulis ketika konten disalin.
            </p>

            <h2 className="!mt-8 text-lg font-bold text-txt-primary sm:text-xl">7. Perlindungan Privasi</h2>
            <p>
              Kami tidak mempublikasikan identitas korban kekerasan seksual, identitas anak di bawah umur
              yang menjadi pelaku kejahatan, dan informasi pribadi yang tidak relevan dengan kepentingan publik.
            </p>

            <div className="mt-10 rounded-lg border border-primary/20 bg-primary-light p-4">
              <p className="text-sm text-primary-dark">
                Pedoman ini mengacu pada Peraturan Dewan Pers Nomor 1/Peraturan-DP/III/2012 tentang
                Pedoman Pemberitaan Media Siber. Lihat juga{" "}
                <a href="/kode-etik" className="font-medium underline">Kode Etik Jurnalistik</a> yang kami patuhi.
              </p>
              <p className="mt-2 text-xs text-primary-dark/80">Terakhir diperbarui: Juni 2026.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
