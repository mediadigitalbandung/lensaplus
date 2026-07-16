import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — Lensaplus",
  description:
    "Kebijakan privasi Lensaplus sesuai UU No. 27/2022 tentang Pelindungan Data Pribadi — informasi lengkap mengenai pengumpulan, penggunaan, retensi, dan hak subjek data.",
};

const SECTION_HEADING =
  "mb-3 border-l-[3px] border-primary pl-3 text-xl font-bold text-on-surface";

const TABLE_TH = "px-3 py-2 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider";
const TABLE_TD = "px-3 py-2 text-sm text-on-surface align-top";

export default function PrivasiPage() {
  return (
    <div className="container-main py-12">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <h1 className="text-3xl font-bold text-on-surface font-serif">
          Kebijakan Privasi
        </h1>
        <div className="mt-2 h-1 w-16 bg-primary" />
        <p className="mt-4 text-sm text-on-surface-variant">
          Terakhir diperbarui: 8 Mei 2026
        </p>
        <p className="mt-4 text-sm text-on-surface-variant">
          Dokumen ini berlaku sesuai{" "}
          <strong>UU No. 27/2022 tentang Pelindungan Data Pribadi (UU PDP)</strong>.
          Dengan mengakses atau menggunakan lensaplus.com, Anda menyetujui
          pengumpulan dan penggunaan data sebagaimana dijelaskan di bawah ini.
        </p>

        <nav
          aria-label="Daftar isi"
          className="mt-8 rounded-sm border border-border-default bg-surface-container p-5 text-sm"
        >
          <p className="mb-3 font-semibold text-on-surface">Daftar Isi</p>
          <ol className="list-decimal ml-5 space-y-1 text-primary">
            {[
              "Pendahuluan & Dasar Hukum",
              "Data yang Kami Kumpulkan",
              "Tujuan Pengolahan",
              "Dasar Hukum Pemrosesan",
              "Periode Penyimpanan (Retensi)",
              "Pihak Ketiga & Transfer Lintas-Negara",
              "Hak Subjek Data (DSR)",
              "Keamanan Data",
              "Cookie",
              "Anak Bawah Umur",
              "Perubahan Kebijakan",
              "Kontak & DPO",
            ].map((title, i) => (
              <li key={i}>
                <a href={`#section-${i + 1}`} className="hover:underline">
                  {title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10 font-serif text-[17px] leading-relaxed text-on-surface">

          {/* 1 */}
          <section id="section-1">
            <h2 className={SECTION_HEADING}>1. Pendahuluan &amp; Dasar Hukum</h2>
            <p>
              <strong>Lensaplus</strong> adalah platform media berita digital untuk
              Kota Bandung dan Indonesia (fokus bisnis, ekonomi, pemerintahan, hukum,
              dan topik general lain seperti olahraga, hiburan, teknologi) yang
              dioperasikan oleh redaksi Lensaplus. Kebijakan ini menetapkan cara
              kami mengumpulkan, menggunakan, menyimpan, dan melindungi data pribadi
              sesuai:
            </p>
            <ul className="ml-6 mt-3 list-disc space-y-2">
              <li>
                <strong>UU No. 27/2022 tentang Pelindungan Data Pribadi (UU PDP)</strong>{" "}
                — khususnya Pasal 5–9 (hak subjek data), Pasal 16 (kewajiban pengendali),
                Pasal 20–21 (dasar hukum pemrosesan), dan Pasal 56 (transfer lintas-negara).
              </li>
              <li>UU No. 40/1999 tentang Pers</li>
              <li>UU No. 11/2008 jo. UU No. 19/2016 tentang Informasi dan Transaksi Elektronik (UU ITE)</li>
            </ul>
            <p className="mt-3">
              Ruang lingkup: seluruh pengguna lensaplus.com, termasuk pembaca
              umum, komentator, jurnalis dan kontributor yang memiliki akun, serta
              pengirim newsletter, form kontak, dan form laporan.
            </p>
          </section>

          {/* 2 */}
          <section id="section-2">
            <h2 className={SECTION_HEADING}>2. Data yang Kami Kumpulkan</h2>
            <ul className="ml-6 mt-2 list-disc space-y-3">
              <li>
                <strong>Akun jurnalis/kontributor:</strong> nama lengkap, email,
                password (di-hash bcrypt), avatar, bio, nomor kartu pers, organisasi
                pers, pendidikan, pengalaman, alamat, nomor telepon.
              </li>
              <li>
                <strong>Komentar publik:</strong> nama tampilan, email (tidak
                dipublikasikan), isi komentar, IP address (untuk anti-spam).
              </li>
              <li>
                <strong>Newsletter:</strong> alamat email dan IP saat sign-up (untuk
                audit abuse).
              </li>
              <li>
                <strong>Form Kontak:</strong> nama, email, subjek, isi pesan.
              </li>
              <li>
                <strong>Form Laporan:</strong> alasan laporan, email (opsional), IP
                address.
              </li>
              <li>
                <strong>Polling:</strong> IP address dan fingerprint browser untuk
                mencegah duplikasi suara. Tidak ditautkan ke identitas.
              </li>
              <li>
                <strong>Audit log keamanan:</strong> IP address dan user ID untuk
                keperluan forensik keamanan sistem.
              </li>
              <li>
                <strong>Cookie sesi:</strong> token sesi NextAuth (httpOnly, Secure,
                SameSite=Lax) — lihat Bagian 9.
              </li>
            </ul>
            <p className="mt-3">
              Pembaca yang hanya menelusuri situs <em>tanpa</em> membuat akun atau
              berinteraksi tidak kami kumpulkan data identifikasinya secara langsung.
              Analitik bersifat agregat server-side tanpa client-side tracker.
            </p>
          </section>

          {/* 3 */}
          <section id="section-3">
            <h2 className={SECTION_HEADING}>3. Tujuan Pengolahan</h2>
            <ul className="ml-6 mt-2 list-disc space-y-2">
              <li>
                <strong>Operasional editorial:</strong> autentikasi, manajemen peran,
                workflow artikel (draft → review → publikasi), moderasi komentar.
              </li>
              <li>
                <strong>Komunikasi layanan:</strong> notifikasi editorial per email
                (status artikel, komentar disetujui, newsletter).
              </li>
              <li>
                <strong>Keamanan platform:</strong> rate-limiting, deteksi abuse,
                forensik insiden, dedup suara polling.
              </li>
              <li>
                <strong>Analitik:</strong> statistik kunjungan agregat (server-side;
                tidak ada pelacakan perilaku individu).
              </li>
              <li>
                <strong>SEO & distribusi:</strong> pengiriman URL artikel ke Google
                Indexing API, IndexNow (Bing), dan meta-data ke Google Search Console.
              </li>
              <li>
                <strong>Publikasi konten editorial:</strong> konten artikel
                (teks/gambar) dipublikasikan ke Instagram dan Facebook melalui Meta
                Graph API atas keputusan editorial.
              </li>
              <li>
                <strong>Kewajiban hukum:</strong> memenuhi kewajiban berdasarkan
                UU Pers, UU ITE, dan perintah otoritas yang berwenang.
              </li>
            </ul>
          </section>

          {/* 4 */}
          <section id="section-4">
            <h2 className={SECTION_HEADING}>4. Dasar Hukum Pemrosesan</h2>
            <p>
              Sesuai <strong>UU PDP Pasal 20–21</strong>, kami memproses data dengan
              dasar hukum berikut:
            </p>
            <ul className="ml-6 mt-3 list-disc space-y-2">
              <li>
                <strong>Persetujuan (Pasal 21):</strong> berlangganan newsletter,
                pengiriman form kontak, pengiriman komentar.
              </li>
              <li>
                <strong>Pelaksanaan kontrak (Pasal 20 ayat 1):</strong> pembuatan dan
                pengelolaan akun jurnalis, autentikasi login.
              </li>
              <li>
                <strong>Kepentingan sah (Pasal 20 ayat 2 huruf c):</strong> IP pada
                audit log untuk forensik keamanan, IP pada suara polling untuk dedup,
                IP pada komentar untuk anti-spam.
              </li>
              <li>
                <strong>Kewajiban hukum (Pasal 20 ayat 2 huruf b):</strong> penyimpanan
                log sesuai UU ITE, pemenuhan permintaan otoritas penegak hukum.
              </li>
            </ul>
          </section>

          {/* 5 */}
          <section id="section-5">
            <h2 className={SECTION_HEADING}>5. Periode Penyimpanan (Retensi)</h2>
            <p>
              Sesuai <strong>UU PDP Pasal 16 ayat 2 huruf e</strong>, data tidak
              disimpan lebih lama dari yang diperlukan untuk tujuan pemrosesannya.
              Jadwal retensi konkret:
            </p>
            <div className="mt-4 overflow-x-auto rounded-sm border border-border-default">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-container">
                  <tr>
                    <th className={TABLE_TH}>Kategori Data</th>
                    <th className={TABLE_TH}>Periode Penyimpanan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {[
                    ["Akun pengguna (jurnalis/kontributor)", "Selama akun aktif + 30 hari setelah deaktivasi"],
                    ["Komentar publik", "Sampai artikel induk dihapus (cascade)"],
                    ["Laporan konten", "90 hari setelah status RESOLVED atau DISMISSED"],
                    ["Pesan form kontak", "180 hari setelah pesan dibaca"],
                    ["Audit log keamanan", "12 bulan"],
                    ["IP suara polling", "Di-anonimkan 30 hari setelah polling ditutup"],
                    ["Data newsletter (email)", "Sampai unsubscribe + 6 bulan retention"],
                  ].map(([cat, period]) => (
                    <tr key={cat}>
                      <td className={TABLE_TD}>{cat}</td>
                      <td className={TABLE_TD}>{period}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-base">
              Penghapusan otomatis dijalankan oleh <em>cron job</em>{" "}
              <code className="rounded-lg bg-surface-container px-1 py-0.5 text-sm font-mono">
                retention-purge
              </code>{" "}
              yang berjalan mingguan di server.
            </p>
          </section>

          {/* 6 */}
          <section id="section-6">
            <h2 className={SECTION_HEADING}>
              6. Pihak Ketiga &amp; Transfer Lintas-Negara
            </h2>
            <p>
              Sesuai <strong>UU PDP Pasal 56</strong>, kami mengungkapkan transfer
              data ke luar negeri sebagai berikut. Seluruh vendor dipilih berdasarkan
              komitmen perlindungan data yang setara (Standard Contractual Clauses /
              Data Processing Agreement):
            </p>
            <div className="mt-4 overflow-x-auto rounded-sm border border-border-default">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-container">
                  <tr>
                    <th className={TABLE_TH}>Vendor</th>
                    <th className={TABLE_TH}>Negara</th>
                    <th className={TABLE_TH}>Data yang Dikirim</th>
                    <th className={TABLE_TH}>Tujuan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {[
                    ["Cloudflare", "AS/Global", "Request log, cache konten", "CDN, anti-DDoS, proteksi WAF"],
                    ["Cloudflare Turnstile", "AS/Global", "Token challenge", "Anti-bot pada form publik"],
                    ["Anthropic Claude", "AS", "Teks konten artikel", "AI paraphrase, draft, ringkasan editorial"],
                    ["DeepSeek", "Tiongkok", "Teks konten artikel (fallback)", "AI fallback saat Claude tidak tersedia"],
                    ["Resend", "AS", "Email + nama (transaksional)", "Notifikasi editorial, newsletter"],
                    ["Google Search Console", "AS", "URL artikel + statistik", "Monitoring SEO"],
                    ["Google Analytics 4 (server-side)", "AS", "Event agregat (tanpa PII)", "Analitik kunjungan"],
                    ["Google AdSense", "AS", "Cookie iklan, pengenal cookie, alamat IP, interaksi iklan", "Penayangan, pengukuran & personalisasi iklan"],
                    ["Google Indexing API", "AS", "URL artikel", "Submission ke Google Search"],
                    ["Meta Graph (Instagram + Facebook)", "AS", "Gambar, caption, URL artikel", "Auto-publish konten editorial"],
                    ["Bing IndexNow", "Global", "URL artikel", "Submission ke Bing Search"],
                    ["Hostinger VPS", "Global (EU/Asia)", "Seluruh data primer", "Hosting infrastruktur utama"],
                  ].map(([vendor, country, data, purpose]) => (
                    <tr key={vendor}>
                      <td className={`${TABLE_TD} font-medium`}>{vendor}</td>
                      <td className={TABLE_TD}>{country}</td>
                      <td className={TABLE_TD}>{data}</td>
                      <td className={TABLE_TD}>{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-base">
              Tidak ada data yang dikirim ke negara lain di luar daftar di atas.
              Transfer ke AS tunduk pada mekanisme Standard Contractual Clauses (SCC)
              atau Data Processing Agreement (DPA) masing-masing vendor. Transfer ke
              Tiongkok (DeepSeek) hanya mencakup teks konten artikel yang telah
              melalui review editorial — bukan data identitas pengguna.
            </p>
          </section>

          {/* 7 */}
          <section id="section-7">
            <h2 className={SECTION_HEADING}>7. Hak Subjek Data (DSR)</h2>
            <p>
              Sesuai <strong>UU PDP Pasal 5–9</strong>, Anda memiliki hak-hak
              berikut atas data pribadi Anda:
            </p>
            <ul className="ml-6 mt-3 list-disc space-y-3">
              <li>
                <strong>Akses data (Pasal 5):</strong> Pengguna terautentikasi dapat
                mengunduh salinan data mereka dalam format JSON melalui{" "}
                <code className="rounded-lg bg-surface-container px-1 py-0.5 text-sm font-mono">
                  GET /api/users/me/export
                </code>
                .
              </li>
              <li>
                <strong>Rektifikasi (Pasal 6):</strong> Edit profil kapan saja di{" "}
                <Link
                  href="/panel/profil"
                  className="text-primary underline hover:text-primary-dark"
                >
                  /panel/profil
                </Link>
                .
              </li>
              <li>
                <strong>Penghapusan / Right to Erasure (Pasal 7):</strong> Hapus akun
                via{" "}
                <Link
                  href="/panel/profil"
                  className="text-primary underline hover:text-primary-dark"
                >
                  /panel/profil
                </Link>{" "}
                — proses soft-delete disertai scrub PII. Untuk komentar atau data
                lain, hubungi DPO.
              </li>
              <li>
                <strong>Pembatasan pemrosesan (Pasal 8):</strong> Ajukan permintaan
                ke DPO via email (lihat Bagian 12).
              </li>
              <li>
                <strong>Portabilitas data (Pasal 5):</strong> Sama dengan hak akses —
                format JSON yang dapat diunduh dan diimpor ke sistem lain.
              </li>
              <li>
                <strong>Keberatan (Pasal 9):</strong> Opt-out newsletter via tautan
                unsubscribe di setiap email. Keberatan atas pemrosesan lainnya melalui
                DPO.
              </li>
              <li>
                <strong>Tidak menjadi subjek keputusan otomatis:</strong> Konten yang
                dibuat dengan bantuan AI diberi label{" "}
                <code className="rounded-lg bg-surface-container px-1 py-0.5 text-sm font-mono">
                  isAutoGenerated
                </code>{" "}
                dan wajib melalui review editorial manual sebelum dipublikasikan.
                Tidak ada keputusan yang berdampak hukum atau signifikan yang
                dilakukan secara otomatis.
              </li>
            </ul>
            <p className="mt-3 text-base">
              Respons atas permintaan DSR akan diberikan dalam <strong>30 hari kerja</strong>{" "}
              sejak permintaan diterima, sesuai batas waktu yang ditentukan UU PDP.
            </p>
          </section>

          {/* 8 */}
          <section id="section-8">
            <h2 className={SECTION_HEADING}>8. Keamanan Data</h2>
            <ul className="ml-6 mt-2 list-disc space-y-2">
              <li>Password di-hash menggunakan bcrypt dengan 12 salt rounds.</li>
              <li>Sesi JWT dengan masa berlaku 24 jam, single-device.</li>
              <li>Seluruh komunikasi menggunakan HTTPS — HTTP dialihkan otomatis.</li>
              <li>
                Rate-limiting aktif pada endpoint publik (komentar, kontak, laporan,
                polling).
              </li>
              <li>
                Konten yang dikirim pengguna di-sanitize HTML sebelum disimpan ke
                basis data.
              </li>
              <li>
                Kredensial API eksternal (kunci API vendor) dienkripsi saat disimpan
                menggunakan{" "}
                <code className="rounded-lg bg-surface-container px-1 py-0.5 text-sm font-mono">
                  SETTINGS_ENCRYPTION_KEY
                </code>
                , dan hanya dapat dibaca oleh SUPER_ADMIN.
              </li>
              <li>
                Seluruh aksi administratif dan mutasi data sensitif dicatat ke
                AuditLog.
              </li>
            </ul>
            <p className="mt-3">
              Meskipun kami menerapkan langkah-langkah keamanan yang wajar, tidak ada
              sistem transmisi data melalui internet yang dapat dijamin aman sepenuhnya.
            </p>
          </section>

          {/* 9 */}
          <section id="section-9">
            <h2 className={SECTION_HEADING}>9. Cookie</h2>
            <p>
              Lensaplus menggunakan <strong>cookie esensial</strong> untuk operasional
              situs, serta <strong>cookie iklan pihak ketiga</strong> (Google AdSense)
              yang dijelaskan pada bagian di bawah. Cookie esensial yang kami gunakan:
            </p>
            <ul className="ml-6 mt-3 list-disc space-y-2">
              <li>
                <code className="rounded-lg bg-surface-container px-1 py-0.5 text-sm font-mono">
                  __Secure-next-auth.session-token
                </code>{" "}
                — token sesi login (httpOnly, Secure, SameSite=Lax).
              </li>
              <li>
                <code className="rounded-lg bg-surface-container px-1 py-0.5 text-sm font-mono">
                  __Host-next-auth.csrf-token
                </code>{" "}
                — perlindungan CSRF (httpOnly, Secure).
              </li>
            </ul>
            <p className="mt-3">
              Analitik kunjungan kami jalankan secara server-side tanpa menyuntikkan
              script pelacak analitik ke browser Anda.
            </p>

            <h3 className="mt-5 font-bold text-txt-primary">
              Cookie Iklan Pihak Ketiga (Google AdSense)
            </h3>
            <p className="mt-2">
              Lensaplus menampilkan iklan melalui <strong>Google AdSense</strong>.
              Untuk menayangkan iklan, Google dan mitra (vendor pihak ketiga) menggunakan
              cookie — termasuk cookie <strong>DoubleClick/DART</strong> — guna menayangkan
              iklan berdasarkan kunjungan Anda ke situs ini dan situs lain di internet.
              Cookie ini dapat memproses pengenal cookie dan alamat IP untuk pengukuran
              dan personalisasi iklan.
            </p>
            <ul className="ml-6 mt-3 list-disc space-y-2">
              <li>
                Anda dapat menonaktifkan iklan yang dipersonalisasi melalui{" "}
                <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Setelan Iklan Google
                </a>.
              </li>
              <li>
                Anda dapat menonaktifkan cookie vendor pihak ketiga lain di{" "}
                <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  aboutads.info
                </a>{" "}
                atau{" "}
                <a href="https://www.youronlinechoices.eu" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  youronlinechoices.eu
                </a>.
              </li>
              <li>
                Selengkapnya tentang bagaimana Google menggunakan data saat Anda memakai
                situs mitranya:{" "}
                <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Teknologi Iklan Google
                </a>.
              </li>
            </ul>
            <p className="mt-3">
              Bagi pengunjung di Wilayah Ekonomi Eropa (EEA) dan Inggris (UK), iklan yang
              dipersonalisasi hanya ditayangkan setelah memperoleh persetujuan (consent)
              sesuai GDPR.
            </p>
          </section>

          {/* 10 */}
          <section id="section-10">
            <h2 className={SECTION_HEADING}>10. Anak Bawah Umur</h2>
            <p>
              Layanan Lensaplus tidak ditujukan untuk anak-anak di bawah usia 13
              tahun. Pembuatan akun jurnalis atau kontributor mensyaratkan nomor kartu
              pers yang secara prosedural mengonfirmasi usia dewasa (minimal 18 tahun).
              Apabila kami mendapati bahwa data anak di bawah umur telah dikumpulkan
              tanpa persetujuan orang tua, kami akan segera menghapus data tersebut.
            </p>
          </section>

          {/* 11 */}
          <section id="section-11">
            <h2 className={SECTION_HEADING}>11. Perubahan Kebijakan</h2>
            <p>
              Kami berhak memperbarui kebijakan privasi ini. Tanggal pembaruan
              terakhir dicantumkan di bagian atas dokumen ini. Perubahan yang bersifat
              material akan diumumkan melalui:
            </p>
            <ul className="ml-6 mt-2 list-disc space-y-1">
              <li>Email kepada seluruh subscriber newsletter aktif.</li>
              <li>Banner pengumuman di halaman utama lensaplus.com.</li>
            </ul>
            <p className="mt-3">
              Penggunaan situs setelah tanggal berlaku perubahan merupakan persetujuan
              Anda terhadap kebijakan yang diperbarui.
            </p>
          </section>

          {/* 12 */}
          <section id="section-12">
            <h2 className={SECTION_HEADING}>12. Kontak &amp; DPO</h2>
            <p>
              Untuk pertanyaan, permintaan DSR, atau keluhan terkait kebijakan privasi
              ini, hubungi Data Protection Officer (DPO) Lensaplus:
            </p>
            <div className="mt-4 rounded-sm border border-border-default bg-surface-container p-6">
              <div className="space-y-2 text-base">
                <p>
                  <strong>Lensaplus — Redaksi Media Berita Digital Bandung</strong>
                </p>
                <p>
                  <strong>Email DPO:</strong>{" "}
                  <a
                    href="mailto:privasi@lensaplus.com"
                    className="text-primary underline hover:text-primary-dark"
                  >
                    privasi@lensaplus.com
                  </a>
                </p>
                <p>
                  <strong>Alamat:</strong> Bandung, Jawa Barat, Indonesia
                </p>
                <p className="text-sm text-on-surface-variant mt-3">
                  Permintaan akan ditangani dalam 30 hari kerja sesuai ketentuan
                  UU PDP No. 27/2022.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
