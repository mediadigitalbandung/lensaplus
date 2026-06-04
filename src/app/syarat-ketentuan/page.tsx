import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan",
  description: "Syarat dan ketentuan penggunaan platform Kartawarta.",
};

export default function SyaratKetentuanPage() {
  return (
    <div className="container-main py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-txt-primary">Syarat & Ketentuan</h1>
        <div className="mt-2 h-1 w-16 bg-primary" />
        <p className="mt-4 text-sm text-txt-muted">
          Terakhir diperbarui: 1 Januari 2026
        </p>

        <div className="mt-8 space-y-8 font-serif text-[17px] leading-relaxed text-txt-secondary">
          <p>
            Dengan mengakses dan menggunakan situs <strong>Kartawarta</strong>, Anda
            menyetujui dan terikat oleh syarat dan ketentuan berikut. Jika Anda tidak menyetujui
            ketentuan ini, mohon untuk tidak menggunakan layanan kami.
          </p>

          {/* Ketentuan Umum */}
          <section>
            <h2 className="mb-3 border-l-[3px] border-primary pl-3 text-xl font-bold text-txt-primary">1. Ketentuan Umum</h2>
            <ul className="ml-6 list-disc space-y-2">
              <li>
                Kartawarta adalah platform media digital yang menyajikan berita dan
                informasi hukum di wilayah Bandung dan sekitarnya.
              </li>
              <li>
                Layanan kami tersedia untuk semua pengguna tanpa memandang usia, namun konten
                tertentu mungkin memerlukan kebijaksanaan pembaca.
              </li>
              <li>
                Kami berhak mengubah, memodifikasi, atau menghentikan layanan kapan saja tanpa
                pemberitahuan sebelumnya.
              </li>
              <li>
                Pengguna yang mendaftar akun bertanggung jawab untuk menjaga kerahasiaan informasi
                login mereka.
              </li>
            </ul>
          </section>

          {/* Penggunaan Konten */}
          <section>
            <h2 className="mb-3 border-l-[3px] border-primary pl-3 text-xl font-bold text-txt-primary">2. Penggunaan Konten</h2>
            <ul className="ml-6 list-disc space-y-2">
              <li>
                Seluruh konten yang tersedia di situs ini ditujukan untuk keperluan informasi dan
                edukasi publik.
              </li>
              <li>
                Pengguna diperbolehkan membagikan tautan artikel melalui media sosial atau platform
                lain dengan tetap mencantumkan sumber.
              </li>
              <li>
                Pengguna tidak diperbolehkan menyalin, mereproduksi, atau mendistribusikan konten
                secara utuh tanpa izin tertulis dari redaksi.
              </li>
              <li>
                Pengutipan sebagian konten diperbolehkan untuk keperluan akademis, jurnalistik,
                atau ulasan dengan mencantumkan kredit yang layak.
              </li>
              <li>
                Konten tidak boleh digunakan untuk tujuan komersial tanpa persetujuan tertulis dari
                Kartawarta.
              </li>
            </ul>
          </section>

          {/* Hak Cipta */}
          <section>
            <h2 className="mb-3 border-l-[3px] border-primary pl-3 text-xl font-bold text-txt-primary">3. Hak Cipta</h2>
            <p>
              Seluruh konten yang dipublikasikan di Kartawarta, termasuk namun tidak
              terbatas pada artikel, foto, grafis, video, dan desain, dilindungi oleh hukum hak
              cipta Republik Indonesia.
            </p>
            <ul className="ml-6 mt-3 list-disc space-y-2">
              <li>
                Hak cipta atas konten dimiliki oleh Kartawarta dan/atau pembuat konten
                yang bersangkutan.
              </li>
              <li>
                Pelanggaran hak cipta dapat dikenakan sanksi sesuai Undang-Undang Nomor 28 Tahun
                2014 tentang Hak Cipta.
              </li>
              <li>
                Jika Anda menemukan konten di situs kami yang melanggar hak cipta Anda, silakan
                hubungi redaksi untuk proses penanganan.
              </li>
            </ul>
          </section>

          {/* Komentar & Interaksi */}
          <section>
            <h2 className="mb-3 border-l-[3px] border-primary pl-3 text-xl font-bold text-txt-primary">4. Komentar & Interaksi</h2>
            <p>Pengguna yang memberikan komentar atau berinteraksi di platform wajib:</p>
            <ul className="ml-6 mt-2 list-disc space-y-2">
              <li>Menggunakan bahasa yang sopan dan tidak mengandung unsur SARA, ujaran kebencian,
                atau ancaman kekerasan.</li>
              <li>Tidak menyebarkan informasi palsu, hoaks, atau konten yang menyesatkan.</li>
              <li>Tidak melakukan spam, promosi tidak sah, atau menyebarkan tautan berbahaya.</li>
              <li>Menghormati privasi orang lain dan tidak mengungkapkan data pribadi pihak ketiga.</li>
              <li>Bertanggung jawab penuh atas setiap konten yang mereka unggah atau bagikan.</li>
            </ul>
            <p className="mt-3">
              Redaksi berhak menghapus komentar yang melanggar ketentuan di atas tanpa
              pemberitahuan sebelumnya dan dapat memblokir akun yang berulang kali melanggar.
            </p>
          </section>

          {/* Pelaporan Konten */}
          <section>
            <h2 className="mb-3 border-l-[3px] border-primary pl-3 text-xl font-bold text-txt-primary">5. Pelaporan Konten</h2>
            <p>
              Kami menyediakan mekanisme bagi pembaca untuk melaporkan konten yang dianggap tidak
              akurat, melanggar hukum, atau bertentangan dengan kode etik jurnalistik.
            </p>
            <ul className="ml-6 mt-2 list-disc space-y-2">
              <li>
                Laporan dapat diajukan melalui fitur pelaporan yang tersedia di setiap halaman
                artikel atau melalui email ke redaksi.
              </li>
              <li>
                Setiap laporan akan ditinjau oleh tim redaksi dalam waktu yang wajar.
              </li>
              <li>
                Jika laporan terbukti valid, redaksi akan melakukan koreksi, klarifikasi, atau
                pencabutan artikel sesuai prosedur yang berlaku.
              </li>
              <li>
                Pelapor akan mendapatkan respons atas laporan mereka melalui email yang dicantumkan
                saat pelaporan.
              </li>
            </ul>
          </section>

          {/* Batasan Tanggung Jawab */}
          <section>
            <h2 className="mb-3 border-l-[3px] border-primary pl-3 text-xl font-bold text-txt-primary">6. Batasan Tanggung Jawab</h2>
            <ul className="ml-6 list-disc space-y-2">
              <li>
                Kartawarta berusaha menyajikan informasi yang akurat dan terkini, namun
                tidak menjamin bahwa seluruh konten bebas dari kesalahan.
              </li>
              <li>
                Konten yang dipublikasikan bersifat informatif dan tidak dimaksudkan sebagai nasihat
                hukum profesional. Untuk permasalahan hukum spesifik, pembaca disarankan untuk
                berkonsultasi dengan profesional hukum.
              </li>
              <li>
                Kami tidak bertanggung jawab atas kerugian langsung maupun tidak langsung yang
                timbul dari penggunaan informasi di situs ini.
              </li>
              <li>
                Tautan ke situs pihak ketiga yang mungkin terdapat dalam artikel kami tidak
                menunjukkan dukungan atau tanggung jawab kami terhadap konten situs tersebut.
              </li>
              <li>
                Kami tidak bertanggung jawab atas gangguan layanan yang disebabkan oleh faktor di
                luar kendali kami, termasuk namun tidak terbatas pada gangguan teknis, serangan
                siber, atau bencana alam.
              </li>
            </ul>
          </section>

          {/* Perubahan Ketentuan */}
          <section>
            <h2 className="mb-3 border-l-[3px] border-primary pl-3 text-xl font-bold text-txt-primary">7. Perubahan Ketentuan</h2>
            <p>
              Kartawarta berhak mengubah syarat dan ketentuan ini kapan saja.
              Perubahan akan berlaku efektif setelah dipublikasikan di halaman ini.
            </p>
            <p className="mt-3">
              Dengan terus menggunakan layanan kami setelah perubahan diterbitkan, Anda dianggap
              telah menyetujui syarat dan ketentuan yang diperbarui.
            </p>
            <p className="mt-3">
              Kami menyarankan Anda untuk meninjau halaman ini secara berkala untuk mengetahui
              perubahan terbaru.
            </p>
          </section>

          {/* Kontak */}
          <div className="mt-8 rounded-lg bg-surface-secondary p-6">
            <h2 className="text-lg font-bold text-txt-primary">Hubungi Kami</h2>
            <p className="mt-2 text-sm text-txt-secondary">
              Jika Anda memiliki pertanyaan mengenai syarat dan ketentuan ini, silakan hubungi:
            </p>
            <div className="mt-3 space-y-1 text-sm text-txt-secondary">
              <p><strong>Email:</strong> redaksi@kartawarta.com</p>
              <p><strong>Alamat:</strong> Bandung, Jawa Barat, Indonesia</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
