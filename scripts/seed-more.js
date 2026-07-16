const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const moreArticles = {
  "Hukum Perdata": [
    { title: "Sengketa Kepemilikan Ruko di Braga Bandung Berlarut 3 Tahun, Hakim Perintahkan Eksekusi", excerpt: "Lensaplus, BANDUNG — Sengketa kepemilikan ruko bersejarah di Jalan Braga akhirnya mendapatkan putusan eksekusi." },
    { title: "Gugatan Perbuatan Melawan Hukum: Warga Bandung Tuntut Rumah Sakit Rp 1,5 Miliar", excerpt: "Lensaplus, BANDUNG — Pasien mengajukan gugatan PMH terhadap rumah sakit atas dugaan malpraktik medis." },
    { title: "PN Bandung Tolak Gugatan Pembatalan Perjanjian Jual Beli Tanah di Dago", excerpt: "Lensaplus, BANDUNG — Majelis Hakim menolak gugatan pembatalan perjanjian jual beli tanah seluas 800 meter persegi." },
    { title: "Kasus Fidusia: Debitur di Bandung Gugat Balik Perusahaan Leasing atas Penarikan Sepihak", excerpt: "Lensaplus, BANDUNG — Debitur mengajukan gugatan balik terhadap perusahaan leasing yang menarik kendaraan secara sepihak." },
    { title: "Mediasi Wajib di PN Bandung Berhasil Selesaikan 45% Perkara Perdata Semester I 2026", excerpt: "Lensaplus, BANDUNG — Program mediasi wajib di PN Bandung menunjukkan tingkat keberhasilan yang signifikan." },
    { title: "Sengketa Hak Cipta Batik Bandung: Pengrajin Lokal Menang Lawan Produsen Besar", excerpt: "Lensaplus, BANDUNG — Pengrajin batik tradisional Bandung memenangkan gugatan hak cipta melawan produsen tekstil besar." },
    { title: "PN Bandung Gelar Sidang Perdana Gugatan Ganti Rugi Kecelakaan Tol Purbaleunyi", excerpt: "Lensaplus, BANDUNG — Sidang perdana gugatan ganti rugi korban kecelakaan di Tol Purbaleunyi dimulai hari ini." },
    { title: "Notaris di Bandung Digugat Klien atas Dugaan Akta Palsu Senilai Rp 8 Miliar", excerpt: "Lensaplus, BANDUNG — Seorang notaris menghadapi gugatan perdata dari klien yang merasa dirugikan akta yang dibuat." },
    { title: "Putusan Kasasi MA Kuatkan Hak Waris Anak Angkat dalam Kasus Keluarga Bandung", excerpt: "Lensaplus, BANDUNG — Mahkamah Agung menguatkan putusan yang mengakui hak waris anak angkat dalam sengketa keluarga." },
  ],
  "Hukum Tata Negara": [
    { title: "MK Tolak Uji Materi Pasal Kontroversial UU Pemilu yang Diajukan Akademisi Bandung", excerpt: "Lensaplus, BANDUNG — Mahkamah Konstitusi memutuskan menolak permohonan uji materi yang diajukan dosen hukum UNPAD." },
    { title: "DPRD Jabar Sahkan Perda Baru tentang Perlindungan Lingkungan Hidup Berkelanjutan", excerpt: "Lensaplus, BANDUNG — DPRD Provinsi Jawa Barat mengesahkan Peraturan Daerah baru tentang lingkungan hidup." },
    { title: "Gugatan Sengketa Kewenangan Antara Pemkot Bandung dan Pemprov Jabar Masuk MK", excerpt: "Lensaplus, BANDUNG — Sengketa kewenangan pengelolaan kawasan strategis antara dua level pemerintahan diajukan ke MK." },
    { title: "Akademisi UNPAD Kritisi Proses Legislasi DPR yang Dinilai Tidak Partisipatif", excerpt: "Lensaplus, BANDUNG — Guru Besar Hukum Tata Negara UNPAD mengkritisi minimnya partisipasi publik dalam proses legislasi." },
    { title: "Putusan MK soal Ambang Batas Presiden: Implikasi untuk Pilpres 2029", excerpt: "Lensaplus, JAKARTA — Putusan MK terkait presidential threshold berimplikasi signifikan terhadap kontestasi politik mendatang." },
    { title: "Forum Konstitusi Bandung Gelar Seminar Nasional: Checks and Balances Pasca Pemilu", excerpt: "Lensaplus, BANDUNG — Forum Konstitusi Bandung menggelar seminar membahas mekanisme checks and balances." },
    { title: "Perda Kota Bandung tentang Transparansi Anggaran Diuji Materi ke MA", excerpt: "Lensaplus, BANDUNG — Peraturan Daerah Kota Bandung tentang transparansi APBD diajukan judicial review ke Mahkamah Agung." },
    { title: "Pakar HTN Bandung: Revisi UU MD3 Berpotensi Melemahkan Fungsi Pengawasan DPR", excerpt: "Lensaplus, BANDUNG — Pakar Hukum Tata Negara dari ITB menilai revisi UU MD3 berpotensi melemahkan fungsi DPR." },
    { title: "KPU Jabar Konsultasi Hukum ke MK Terkait Aturan Pencalonan Kepala Daerah Independen", excerpt: "Lensaplus, BANDUNG — KPU Jawa Barat berkonsultasi mengenai mekanisme pencalonan independen dalam pilkada." },
    { title: "Judicial Review UU ASN: Pegawai Honorer Jabar Ajukan Permohonan ke MK", excerpt: "Lensaplus, BANDUNG — Ribuan pegawai honorer di Jawa Barat mengajukan uji materi UU ASN ke Mahkamah Konstitusi." },
    { title: "Diskusi Publik: Masa Depan Otonomi Daerah Pasca Putusan MK tentang Pilkada Langsung", excerpt: "Lensaplus, BANDUNG — Diskusi publik membahas implikasi putusan MK terhadap pelaksanaan otonomi daerah di Indonesia." },
  ],
  "HAM": [
    { title: "Amnesty International Soroti Kondisi Tahanan di Lapas Sukamiskin Bandung", excerpt: "Lensaplus, BANDUNG — Amnesty International Indonesia menyoroti kondisi overcrowding di Lembaga Pemasyarakatan Sukamiskin." },
    { title: "Kasus Penyiksaan Tahanan di Polrestabes Bandung: Propam Polda Jabar Turun Tangan", excerpt: "Lensaplus, BANDUNG — Divisi Profesi dan Pengamanan Polda Jabar menyelidiki dugaan penyiksaan tahanan." },
    { title: "LBH Bandung Dampingi 78 Korban Penggusuran Tamansari Ajukan Gugatan ke PTUN", excerpt: "Lensaplus, BANDUNG — LBH Bandung mendampingi warga korban penggusuran Tamansari mengajukan gugatan ke PTUN Bandung." },
    { title: "Komnas Perempuan Investigasi Kasus Kekerasan Berbasis Gender di Pesantren Jabar", excerpt: "Lensaplus, BANDUNG — Komnas Perempuan membuka investigasi atas laporan kekerasan di beberapa pesantren di Jawa Barat." },
    { title: "Workshop HAM untuk Aparat Pemerintah Daerah se-Bandung Raya Digelar Kemenkumham", excerpt: "Lensaplus, BANDUNG — Kemenkumham menggelar workshop peningkatan kapasitas HAM bagi pejabat pemerintah daerah." },
    { title: "Kontras Desak Pembentukan Pengadilan HAM Ad Hoc untuk Kasus Penembakan Mahasiswa", excerpt: "Lensaplus, JAKARTA — KontraS mendesak pembentukan pengadilan HAM ad hoc untuk mengadili kasus penembakan mahasiswa." },
    { title: "Forum Masyarakat Adat Jabar Tuntut Pengakuan Hak Ulayat di Kawasan Bandung Selatan", excerpt: "Lensaplus, BANDUNG — Forum masyarakat adat menuntut pengakuan hak ulayat atas tanah di kawasan Bandung Selatan." },
    { title: "Klinik Hukum HAM UNPAD Berikan Bantuan Hukum Gratis untuk 200 Warga Marginal", excerpt: "Lensaplus, BANDUNG — Klinik Hukum HAM Fakultas Hukum UNPAD memberikan bantuan hukum gratis kepada warga marginal." },
    { title: "Peringatan Hari HAM Internasional: Aksi Damai Ribuan Warga Bandung di Gedung Sate", excerpt: "Lensaplus, BANDUNG — Ribuan warga Bandung menggelar aksi damai memperingati Hari HAM Internasional di depan Gedung Sate." },
  ],
  "Hukum Bisnis": [
    { title: "Kasus Penipuan Investasi Bodong di Bandung: 500 Korban Rugi Rp 30 Miliar", excerpt: "Lensaplus, BANDUNG — Polda Jabar mengungkap kasus investasi bodong yang merugikan ratusan korban di wilayah Bandung." },
    { title: "PN Bandung Proses PKPU Perusahaan Retail Besar yang Gagal Bayar Supplier", excerpt: "Lensaplus, BANDUNG — Pengadilan Niaga memproses permohonan PKPU terhadap perusahaan retail yang gagal bayar." },
    { title: "Hukum E-Commerce: Marketplace Digugat Konsumen Bandung atas Produk Palsu", excerpt: "Lensaplus, BANDUNG — Konsumen asal Bandung menggugat platform marketplace atas kerugian pembelian produk palsu." },
    { title: "Workshop Hukum Kontrak Internasional untuk Eksportir UMKM Bandung", excerpt: "Lensaplus, BANDUNG — Dinas Perdagangan Kota Bandung menggelar workshop tentang aspek hukum kontrak ekspor-impor." },
    { title: "KPPU Putuskan Denda Rp 5 Miliar untuk Perusahaan Bandung yang Lakukan Persaingan Tidak Sehat", excerpt: "Lensaplus, BANDUNG — KPPU menjatuhkan denda terhadap perusahaan yang terbukti melakukan praktek monopoli." },
    { title: "Sengketa Franchise Restoran Terkenal di Bandung: Franchisee Tuntut Ganti Rugi", excerpt: "Lensaplus, BANDUNG — Pemilik franchise restoran menggugat franchisor atas pemutusan kontrak sepihak." },
    { title: "Perlindungan Data Konsumen: Bank di Bandung Didenda OJK atas Kebocoran Data Nasabah", excerpt: "Lensaplus, BANDUNG — OJK menjatuhkan sanksi denda terhadap bank yang mengalami insiden kebocoran data nasabah." },
    { title: "Asosiasi Pengusaha Bandung Minta Revisi Perda Pajak Daerah yang Memberatkan UMKM", excerpt: "Lensaplus, BANDUNG — Asosiasi pengusaha mengajukan keberatan terhadap besaran pajak daerah yang dinilai memberatkan." },
    { title: "Kasus Insider Trading: Mantan Direktur Perusahaan Bandung Divonis 4 Tahun Penjara", excerpt: "Lensaplus, BANDUNG — Pengadilan menjatuhkan vonis penjara terhadap mantan direktur yang terbukti melakukan insider trading." },
  ],
  "Hukum Lingkungan": [
    { title: "Pencemaran Sungai Cikapundung Memburuk: Walhi Jabar Layangkan Somasi ke Pemkot", excerpt: "Lensaplus, BANDUNG — Walhi Jawa Barat melayangkan somasi kepada Pemerintah Kota Bandung terkait pencemaran Cikapundung." },
    { title: "Warga Rancaekek Menang Gugatan Perdata terhadap Pabrik Pencemar Air Sumur", excerpt: "Lensaplus, BANDUNG — Warga Rancaekek memenangkan gugatan perdata terhadap pabrik yang mencemari sumber air." },
    { title: "KLHK Tetapkan Status Darurat Lingkungan di Kawasan Industri Cimahi", excerpt: "Lensaplus, CIMAHI — Kementerian LHK menetapkan status darurat lingkungan di kawasan industri Cimahi akibat pencemaran." },
    { title: "Sidang Kasus Tambang Ilegal di Bandung Barat: Terdakwa Divonis 6 Tahun", excerpt: "Lensaplus, BANDUNG — Pengadilan menjatuhkan vonis 6 tahun penjara terhadap pelaku penambangan ilegal di Bandung Barat." },
    { title: "AMDAL Proyek Tol Bandung-Garut Digugat Warga: Dinilai Tidak Libatkan Masyarakat", excerpt: "Lensaplus, BANDUNG — Warga terdampak menggugat proses AMDAL proyek pembangunan jalan tol Bandung-Garut." },
    { title: "Hakim Lingkungan Bersertifikat di PN Bandung Tangani 12 Kasus Baru Semester Ini", excerpt: "Lensaplus, BANDUNG — PN Bandung mencatat peningkatan kasus lingkungan yang ditangani hakim bersertifikat lingkungan." },
    { title: "Program Restorasi Sungai Citarum Harum: Aspek Hukum Penegakan yang Masih Lemah", excerpt: "Lensaplus, BANDUNG — Analisis hukum menunjukkan penegakan regulasi dalam program Citarum Harum masih perlu diperkuat." },
    { title: "Izin Lingkungan Hotel Baru di Punclut Dicabut PTUN Bandung atas Gugatan Warga", excerpt: "Lensaplus, BANDUNG — PTUN Bandung mencabut izin lingkungan pembangunan hotel di kawasan konservasi Punclut." },
    { title: "Diskusi Akademis: Penerapan Prinsip Polluter Pays di Hukum Lingkungan Indonesia", excerpt: "Lensaplus, BANDUNG — Fakultas Hukum UNPAD menggelar diskusi tentang penerapan prinsip pencemar membayar." },
  ],
  "Ketenagakerjaan": [
    { title: "Mogok Kerja Ribuan Buruh Pabrik Sepatu di Cibaduyut: Tuntut Upah Layak", excerpt: "Lensaplus, BANDUNG — Ribuan buruh pabrik sepatu di sentra industri Cibaduyut melakukan aksi mogok kerja." },
    { title: "PHI Bandung Putuskan Perusahaan Wajib Bayar Pesangon Rp 3,2 Miliar ke 150 Pekerja", excerpt: "Lensaplus, BANDUNG — Pengadilan Hubungan Industrial memutuskan perusahaan wajib membayar pesangon pekerja yang di-PHK." },
    { title: "Kasus Pelecehan Seksual di Tempat Kerja Bandung: Pelaku Divonis 5 Tahun", excerpt: "Lensaplus, BANDUNG — Pengadilan menjatuhkan vonis lima tahun penjara terhadap pelaku pelecehan seksual di tempat kerja." },
    { title: "Disnaker Bandung Temukan 30 Perusahaan Langgar Ketentuan K3 Selama Inspeksi", excerpt: "Lensaplus, BANDUNG — Inspeksi mendadak Dinas Ketenagakerjaan menemukan pelanggaran keselamatan kerja di 30 perusahaan." },
    { title: "Serikat Pekerja Garmen Bandung Desak Pemerintah Ratifikasi Konvensi ILO 190", excerpt: "Lensaplus, BANDUNG — Serikat pekerja industri garmen mendesak pemerintah meratifikasi konvensi ILO tentang kekerasan di tempat kerja." },
    { title: "Gig Worker Bandung Bentuk Serikat: Tuntut Status Hubungan Kerja yang Jelas", excerpt: "Lensaplus, BANDUNG — Pekerja gig economy di Bandung membentuk serikat untuk memperjuangkan status hubungan kerja." },
    { title: "PN Bandung Kabulkan Gugatan TKI Asal Jabar yang Dirugikan Agen Penempatan Ilegal", excerpt: "Lensaplus, BANDUNG — Pengadilan mengabulkan gugatan TKI yang dirugikan oleh agen penempatan tenaga kerja ilegal." },
    { title: "Pelatihan Negosiasi Serikat Pekerja: Strategi Perundingan PKB yang Efektif", excerpt: "Lensaplus, BANDUNG — Konfederasi serikat pekerja menggelar pelatihan strategi perundingan perjanjian kerja bersama." },
    { title: "Survei: 60% Pekerja Informal Bandung Tidak Terlindungi Jaminan Sosial Ketenagakerjaan", excerpt: "Lensaplus, BANDUNG — Hasil survei menunjukkan mayoritas pekerja informal di Bandung belum memiliki BPJS Ketenagakerjaan." },
  ],
  "Hukum Pidana": [
    { title: "Kejati Jabar Tahan Mantan Pejabat Pemkot Bandung Tersangka Korupsi Dana Hibah", excerpt: "Lensaplus, BANDUNG — Kejaksaan Tinggi Jawa Barat menahan mantan pejabat yang menjadi tersangka korupsi dana hibah." },
    { title: "Sidang Kasus Narkoba Jaringan Internasional di PN Bandung: 5 Terdakwa Dituntut Mati", excerpt: "Lensaplus, BANDUNG — Jaksa menuntut hukuman mati terhadap lima terdakwa kasus penyelundupan narkoba jaringan internasional." },
    { title: "Polrestabes Bandung Ungkap Sindikat Pemalsuan Dokumen: 8 Tersangka Diamankan", excerpt: "Lensaplus, BANDUNG — Polrestabes Bandung berhasil mengungkap sindikat pemalsuan dokumen resmi pemerintah." },
  ],
  "Berita Bandung": [
    { title: "Walikota Bandung Resmikan Gedung Pengadilan Baru di Kawasan Gedebage", excerpt: "Lensaplus, BANDUNG — Walikota Bandung meresmikan gedung pengadilan baru yang akan melayani warga Bandung Timur." },
    { title: "Bantuan Hukum Gratis untuk Warga Miskin Bandung Diperluas ke 30 Kelurahan", excerpt: "Lensaplus, BANDUNG — Program bantuan hukum gratis untuk warga miskin diperluas cakupannya ke 30 kelurahan." },
    { title: "Festival Hukum Rakyat Bandung 2026: Edukasi Hukum Lewat Seni dan Budaya", excerpt: "Lensaplus, BANDUNG — Festival Hukum Rakyat menghadirkan edukasi hukum melalui pendekatan seni dan budaya Sunda." },
  ],
  "Opini": [
    { title: "Opini: Urgensi Pembentukan Pengadilan Khusus Lingkungan di Jawa Barat", excerpt: "Peningkatan kasus lingkungan di Jabar menuntut pembentukan pengadilan khusus yang menangani sengketa lingkungan." },
    { title: "Opini: Digitalisasi Peradilan Indonesia — Peluang dan Tantangan e-Court", excerpt: "Sistem e-Court membawa harapan baru bagi efisiensi peradilan, namun tantangan implementasi masih besar." },
    { title: "Opini: Perlindungan Hukum bagi Whistleblower Korupsi Masih Sangat Lemah", excerpt: "Indonesia membutuhkan penguatan perlindungan hukum bagi pelapor tindak pidana korupsi yang masih minim." },
    { title: "Opini: Mengapa Restorative Justice Penting untuk Sistem Peradilan Pidana Indonesia", excerpt: "Pendekatan keadilan restoratif dapat menjadi solusi alternatif bagi overcrowding lapas di Indonesia." },
    { title: "Opini: Peran Media dalam Menjaga Prinsip Praduga Tak Bersalah di Era Viral", excerpt: "Media massa perlu menjaga prinsip praduga tak bersalah di tengah budaya trial by media di era digital." },
    { title: "Opini: Hukum Adat Sunda dan Relevansinya dalam Sistem Hukum Modern Indonesia", excerpt: "Nilai-nilai hukum adat Sunda masih relevan dan dapat diintegrasikan dalam sistem hukum nasional." },
    { title: "Opini: Evaluasi Kritis terhadap Kinerja KPK di Bawah Kepemimpinan Baru", excerpt: "Kinerja KPK di bawah pimpinan baru perlu dievaluasi secara objektif berdasarkan capaian penegakan hukum." },
    { title: "Opini: Masa Depan Profesi Advokat Indonesia di Era Artificial Intelligence", excerpt: "Perkembangan AI menantang profesi advokat untuk beradaptasi dan menemukan peran baru dalam ekosistem hukum." },
    { title: "Opini: Pentingnya Pendidikan Anti-Korupsi Sejak Dini di Sekolah-sekolah Bandung", excerpt: "Pendidikan anti-korupsi perlu dimulai sejak bangku sekolah untuk membangun generasi yang berintegritas." },
  ],
  "Infografis": [
    { title: "Infografis: Timeline Kasus Korupsi Terbesar di Jawa Barat Sepanjang Sejarah", excerpt: "Visualisasi kronologis kasus-kasus korupsi terbesar yang pernah terjadi di Provinsi Jawa Barat." },
    { title: "Infografis: Perbandingan Anggaran Penegakan Hukum 5 Provinsi Terbesar di Pulau Jawa", excerpt: "Data visual perbandingan alokasi anggaran penegakan hukum di provinsi-provinsi besar di Pulau Jawa." },
    { title: "Infografis: Profil 10 Hakim Agung Pilihan DPR Periode 2024-2029", excerpt: "Visualisasi profil, latar belakang, dan rekam jejak hakim agung yang terpilih di periode terbaru." },
    { title: "Infografis: Panduan Lengkap Hak-Hak Tersangka dan Terdakwa di Indonesia", excerpt: "Panduan visual mengenai hak-hak yang dimiliki tersangka dan terdakwa menurut KUHAP." },
    { title: "Infografis: Data Kasus Kekerasan Berbasis Gender di Jawa Barat 2024-2026", excerpt: "Visualisasi data kasus kekerasan berbasis gender yang dilaporkan dan ditangani di wilayah Jawa Barat." },
    { title: "Infografis: Peta Pos Bantuan Hukum Gratis di Seluruh Kota Bandung", excerpt: "Peta lokasi pos-pos bantuan hukum gratis yang dapat diakses warga Kota Bandung." },
    { title: "Infografis: Alur Pengajuan Praperadilan — Syarat, Prosedur, dan Biaya", excerpt: "Panduan visual lengkap tata cara pengajuan praperadilan mulai dari syarat hingga putusan." },
    { title: "Infografis: Perbandingan Sistem Peradilan Indonesia dengan Negara ASEAN", excerpt: "Visualisasi perbandingan struktur dan mekanisme peradilan Indonesia dengan negara-negara ASEAN lainnya." },
    { title: "Infografis: Statistik Kinerja Pengadilan Negeri Bandung Tahun 2025", excerpt: "Data visual kinerja PN Bandung meliputi jumlah perkara masuk, diputus, dan sisa perkara." },
    { title: "Infografis: Dampak Ekonomi Korupsi terhadap Pembangunan Infrastruktur Bandung", excerpt: "Visualisasi dampak kerugian negara akibat korupsi terhadap proyek pembangunan infrastruktur Kota Bandung." },
  ],
};

async function main() {
  const author = await prisma.user.findFirst({ where: { role: "SENIOR_JOURNALIST" } });
  if (!author) { console.error("No journalist found."); return; }

  let total = 0;

  for (const [categoryName, articles] of Object.entries(moreArticles)) {
    const category = await prisma.category.findFirst({ where: { name: categoryName } });
    if (!category) { console.log(`"${categoryName}" not found, skipping.`); continue; }

    for (const art of articles) {
      const slug = art.title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 80);
      const exists = await prisma.article.findFirst({ where: { slug } });
      if (exists) continue;

      const day = Math.floor(Math.random() * 20) + 5;
      const publishedAt = new Date(2026, 2, day, Math.floor(Math.random() * 12) + 7);

      await prisma.article.create({
        data: {
          title: art.title, slug, excerpt: art.excerpt,
          content: `<p>${art.excerpt}</p><h2>Detail Perkara</h2><p>Perkara ini menarik perhatian publik luas karena menyangkut kepentingan masyarakat. Para pihak yang terlibat telah memberikan keterangan resmi kepada media.</p><blockquote>"Kami akan menempuh jalur hukum yang tersedia untuk mendapatkan keadilan," ujar kuasa hukum penggugat.</blockquote><p>Sidang lanjutan dijadwalkan akan digelar pekan depan dengan agenda pemeriksaan saksi ahli.</p>`,
          status: "PUBLISHED", verificationLabel: "VERIFIED",
          readTime: Math.floor(Math.random() * 5) + 3,
          viewCount: Math.floor(Math.random() * 400) + 100,
          publishedAt, authorId: author.id, categoryId: category.id,
        },
      });
      total++;
    }
    const count = await prisma.article.count({ where: { categoryId: category.id } });
    console.log(`✓ "${categoryName}" — now has ${count} articles`);
  }

  console.log(`\nDone! ${total} new articles created.`);
  await prisma.$disconnect();
}

main().catch(console.error);
