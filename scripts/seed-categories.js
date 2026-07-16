const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const sampleArticles = {
  "Hukum Perdata": [
    { title: "Sengketa Warisan Rp 50 Miliar di Bandung: Ahli Waris Gugat Akta Notaris Palsu", excerpt: "Lensaplus, BANDUNG — Sidang gugatan perdata terkait sengketa warisan senilai Rp 50 miliar di PN Bandung memasuki tahap pembuktian." },
    { title: "PN Bandung Putuskan Ganti Rugi Rp 2,3 Miliar dalam Kasus Wanprestasi Kontrak Proyek", excerpt: "Lensaplus, BANDUNG — Majelis Hakim PN Bandung mengabulkan gugatan wanprestasi dan memerintahkan tergugat membayar ganti rugi." },
    { title: "Mediasi Sengketa Tanah di Lembang Berhasil, Kedua Pihak Sepakat Damai", excerpt: "Lensaplus, BANDUNG — Sengketa kepemilikan tanah seluas 5 hektar di kawasan Lembang berhasil diselesaikan melalui mediasi." },
    { title: "Gugatan Class Action Konsumen terhadap Developer Perumahan di Bandung Timur Dikabulkan", excerpt: "Lensaplus, BANDUNG — PN Bandung mengabulkan sebagian gugatan class action yang diajukan 120 konsumen perumahan." },
    { title: "Arbitrase BANI Selesaikan Sengketa Bisnis Senilai Rp 15 Miliar antara Dua Perusahaan Bandung", excerpt: "Lensaplus, BANDUNG — Badan Arbitrase Nasional Indonesia cabang Bandung menyelesaikan sengketa kontrak kerjasama." },
    { title: "Kasus Perceraian di PA Bandung Meningkat 23% Selama 2026, Faktor Ekonomi Dominan", excerpt: "Lensaplus, BANDUNG — Pengadilan Agama Bandung mencatat peningkatan kasus perceraian yang signifikan sepanjang tahun 2026." },
  ],
  "HAM": [
    { title: "Komnas HAM Investigasi Dugaan Pelanggaran Hak Buruh di Kawasan Industri Bandung", excerpt: "Lensaplus, BANDUNG — Tim Komnas HAM melakukan investigasi ke beberapa pabrik di kawasan industri Bandung terkait dugaan pelanggaran." },
    { title: "LBH Bandung: 156 Kasus Penggusuran Paksa Terjadi di Jabar Sepanjang 2026", excerpt: "Lensaplus, BANDUNG — Lembaga Bantuan Hukum Bandung merilis data penggusuran paksa yang terjadi di wilayah Jawa Barat." },
    { title: "Sidang Kasus Kekerasan Aparat terhadap Demonstran Mahasiswa di Bandung Dimulai", excerpt: "Lensaplus, BANDUNG — Persidangan kasus kekerasan oleh oknum aparat terhadap mahasiswa saat demonstrasi akhirnya dimulai." },
    { title: "YLBHI Desak Pemerintah Ratifikasi Konvensi Anti Penghilangan Paksa", excerpt: "Lensaplus, JAKARTA — Yayasan Lembaga Bantuan Hukum Indonesia mendesak pemerintah untuk segera meratifikasi konvensi PBB." },
    { title: "Forum HAM Jabar Gelar Diskusi Publik: Kebebasan Berpendapat di Era Digital", excerpt: "Lensaplus, BANDUNG — Forum HAM Jawa Barat menggelar diskusi publik membahas tantangan kebebasan berpendapat di era digital." },
    { title: "Kasus Diskriminasi Pekerja Disabilitas di Bandung Masuk Tahap Penyelidikan", excerpt: "Lensaplus, BANDUNG — Komnas HAM resmi membuka penyelidikan atas dugaan diskriminasi terhadap pekerja disabilitas." },
  ],
  "Hukum Bisnis": [
    { title: "OJK Jabar Cabut Izin Usaha Fintech Ilegal yang Beroperasi di Bandung", excerpt: "Lensaplus, BANDUNG — Otoritas Jasa Keuangan wilayah Jawa Barat mencabut izin usaha tiga perusahaan fintech ilegal." },
    { title: "KPPU Selidiki Dugaan Kartel Harga Bahan Bangunan di Bandung Raya", excerpt: "Lensaplus, BANDUNG — Komisi Pengawas Persaingan Usaha membuka penyelidikan dugaan praktek kartel di industri bahan bangunan." },
    { title: "Sengketa Merek Dagang UMKM Bandung vs Korporasi Besar Dimenangkan Pengusaha Lokal", excerpt: "Lensaplus, BANDUNG — Pengadilan Niaga pada PN Surabaya memenangkan gugatan UMKM asal Bandung dalam sengketa merek dagang." },
    { title: "PN Bandung Proses Kepailitan PT Properti Bandung Selatan, Aset Rp 200 Miliar Disita", excerpt: "Lensaplus, BANDUNG — Pengadilan Niaga pada PN Bandung memproses permohonan kepailitan terhadap perusahaan properti." },
    { title: "Perlindungan Hukum Startup Digital Bandung: Tantangan HKI di Silicon Valley Jabar", excerpt: "Lensaplus, BANDUNG — Startup digital di Bandung menghadapi tantangan perlindungan hak kekayaan intelektual." },
    { title: "Asosiasi Advokat Bandung Gelar Workshop Hukum Merger dan Akuisisi untuk Pengacara Muda", excerpt: "Lensaplus, BANDUNG — PERADI cabang Bandung menggelar workshop intensif mengenai aspek hukum merger dan akuisisi." },
  ],
  "Hukum Lingkungan": [
    { title: "Gugatan Warga Dayeuhkolot terhadap Pabrik Pencemar Sungai Citarum Masuk Persidangan", excerpt: "Lensaplus, BANDUNG — Gugatan warga Dayeuhkolot terhadap tiga pabrik yang diduga mencemari Sungai Citarum mulai disidangkan." },
    { title: "KLHK Jatuhkan Sanksi Administratif pada 5 Perusahaan Pencemar di Bandung Barat", excerpt: "Lensaplus, BANDUNG — Kementerian Lingkungan Hidup dan Kehutanan menjatuhkan sanksi pada lima perusahaan di Bandung Barat." },
    { title: "PN Bandung Kabulkan Gugatan Citizen Lawsuit Terkait Polusi Udara Kota Bandung", excerpt: "Lensaplus, BANDUNG — Majelis Hakim PN Bandung mengabulkan gugatan warga negara terkait kualitas udara Kota Bandung." },
    { title: "Kasus Illegal Logging di Hutan Lindung Bandung Utara: 3 Tersangka Ditahan", excerpt: "Lensaplus, BANDUNG — Polda Jabar menahan tiga tersangka kasus pembalakan liar di kawasan hutan lindung Bandung Utara." },
    { title: "Analisis Hukum: Efektivitas Perda Pengelolaan Sampah Kota Bandung Tahun 2024", excerpt: "Lensaplus, BANDUNG — Pakar hukum lingkungan menganalisis efektivitas implementasi Peraturan Daerah pengelolaan sampah." },
    { title: "Walhi Jabar Dorong Penerapan Strict Liability dalam Kasus Pencemaran Lingkungan", excerpt: "Lensaplus, BANDUNG — Wahana Lingkungan Hidup Indonesia Jawa Barat mendorong penerapan prinsip pertanggungjawaban mutlak." },
  ],
  "Ketenagakerjaan": [
    { title: "PHK Massal 2.000 Pekerja Pabrik Tekstil Majalaya: Serikat Buruh Gugat ke PHI", excerpt: "Lensaplus, BANDUNG — Serikat Pekerja mengajukan gugatan ke Pengadilan Hubungan Industrial Bandung atas PHK massal." },
    { title: "Upah Minimum Kota Bandung 2027 Jadi Polemik, Buruh Ancam Mogok Kerja", excerpt: "Lensaplus, BANDUNG — Penetapan UMK Bandung 2027 menuai protes dari kalangan buruh yang menilai kenaikan tidak memadai." },
    { title: "PN Bandung Putuskan Outsourcing Illegal di Pabrik Garmen, Pekerja Harus Diangkat Tetap", excerpt: "Lensaplus, BANDUNG — Pengadilan memutuskan praktek outsourcing ilegal dan memerintahkan pengangkatan pekerja tetap." },
    { title: "BPJS Ketenagakerjaan Bandung Proses Klaim 340 Pekerja Korban Kecelakaan Kerja", excerpt: "Lensaplus, BANDUNG — BPJS Ketenagakerjaan cabang Bandung memproses ratusan klaim kecelakaan kerja sepanjang Q1 2026." },
    { title: "Kasus Pekerja Anak di Sentra Industri Cimahi: Disnaker Turun Tangan", excerpt: "Lensaplus, CIMAHI — Dinas Ketenagakerjaan Kota Cimahi melakukan inspeksi mendadak ke sentra industri rumahan." },
    { title: "Pelatihan Hukum Ketenagakerjaan untuk Serikat Buruh se-Bandung Raya Digelar FSPMI", excerpt: "Lensaplus, BANDUNG — Federasi Serikat Pekerja Metal Indonesia menggelar pelatihan aspek hukum ketenagakerjaan." },
  ],
  "Opini": [
    { title: "Opini: Reformasi Peradilan Indonesia Masih Jauh dari Harapan Masyarakat", excerpt: "Sistem peradilan Indonesia masih menghadapi tantangan besar dalam mewujudkan keadilan yang sesungguhnya." },
    { title: "Opini: Mengapa Omnibus Law Perlu Direvisi Demi Kepentingan Rakyat Kecil?", excerpt: "UU Cipta Kerja perlu ditinjau ulang untuk memastikan keseimbangan antara kemudahan investasi dan perlindungan pekerja." },
    { title: "Opini: Tantangan Penegakan Hukum Siber di Indonesia — Antara Regulasi dan Realitas", excerpt: "Penegakan hukum di dunia siber Indonesia menghadapi gap antara aturan yang ada dan dinamika teknologi." },
    { title: "Opini: Independensi Hakim di Era Politik Identitas — Sebuah Refleksi Kritis", excerpt: "Independensi lembaga peradilan semakin diuji di tengah menguatnya politik identitas dalam kehidupan berbangsa." },
    { title: "Opini: Pentingnya Legal Literacy untuk Masyarakat Urban Bandung", excerpt: "Kesadaran hukum masyarakat urban Bandung masih rendah, padahal literasi hukum kunci pemberdayaan warga." },
  ],
  "Infografis": [
    { title: "Infografis: Peta Sebaran Kasus Korupsi di Jawa Barat 2024-2026", excerpt: "Data visual sebaran kasus korupsi yang ditangani KPK dan Kejaksaan di wilayah Jawa Barat." },
    { title: "Infografis: Alur Proses Peradilan Pidana di Indonesia dari A sampai Z", excerpt: "Panduan visual lengkap alur proses peradilan pidana mulai dari laporan hingga eksekusi putusan." },
    { title: "Infografis: Perbandingan UMK 10 Kota Besar di Jawa Barat Tahun 2026", excerpt: "Visualisasi perbandingan Upah Minimum Kota di sepuluh kota/kabupaten terbesar di Jawa Barat." },
    { title: "Infografis: Statistik Kasus HAM di Indonesia dalam 5 Tahun Terakhir", excerpt: "Data visual perkembangan kasus pelanggaran HAM yang dilaporkan dan diselesaikan dalam 5 tahun." },
    { title: "Infografis: Struktur Lembaga Peradilan di Indonesia — Dari MA hingga PN", excerpt: "Visualisasi hierarki dan struktur kelembagaan peradilan di Indonesia beserta kewenangannya." },
  ],
};

async function main() {
  // Get author
  const author = await prisma.user.findFirst({ where: { role: "SENIOR_JOURNALIST" } });
  if (!author) {
    console.error("No journalist found. Run setup first.");
    return;
  }

  let total = 0;

  for (const [categoryName, articles] of Object.entries(sampleArticles)) {
    const category = await prisma.category.findFirst({ where: { name: categoryName } });
    if (!category) {
      console.log(`Category "${categoryName}" not found, skipping.`);
      continue;
    }

    // Check existing count
    const existing = await prisma.article.count({ where: { categoryId: category.id } });
    if (existing >= 6) {
      console.log(`"${categoryName}" already has ${existing} articles, skipping.`);
      continue;
    }

    for (const art of articles) {
      const slug = art.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 80);

      const exists = await prisma.article.findFirst({ where: { slug } });
      if (exists) continue;

      // Random date in March 2026
      const day = Math.floor(Math.random() * 20) + 5;
      const publishedAt = new Date(2026, 2, day, Math.floor(Math.random() * 12) + 7);

      await prisma.article.create({
        data: {
          title: art.title,
          slug,
          excerpt: art.excerpt,
          content: `<p>${art.excerpt}</p><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.</p><h2>Kronologi Kasus</h2><p>Berdasarkan informasi yang dihimpun, kasus ini bermula dari laporan yang masuk ke instansi terkait pada awal tahun 2026. Pihak berwenang kemudian melakukan penyelidikan mendalam.</p><blockquote>"Kami berkomitmen untuk menyelesaikan kasus ini sesuai dengan ketentuan hukum yang berlaku," ujar narasumber.</blockquote><p>Proses hukum diharapkan dapat memberikan keadilan bagi semua pihak yang terlibat dalam perkara ini.</p>`,
          status: "PUBLISHED",
          verificationLabel: "VERIFIED",
          readTime: Math.floor(Math.random() * 5) + 3,
          viewCount: Math.floor(Math.random() * 400) + 100,
          publishedAt,
          authorId: author.id,
          categoryId: category.id,
        },
      });
      total++;
    }
    console.log(`✓ "${categoryName}" — ${articles.length} articles seeded`);
  }

  console.log(`\nDone! ${total} articles created.`);
  await prisma.$disconnect();
}

main().catch(console.error);
