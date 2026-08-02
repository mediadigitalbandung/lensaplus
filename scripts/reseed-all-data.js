require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Restoring all articles, content, categories, and dashboard data...");

  // 1. Users
  const adminPass = await bcrypt.hash("admin1234", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@lensaplus.com" },
    update: { password: adminPass, isActive: true },
    create: {
      email: "admin@lensaplus.com",
      password: adminPass,
      name: "Super Admin",
      role: "SUPER_ADMIN",
      bio: "Administrator Lensaplus",
      isActive: true,
    },
  });

  const journalistPass = await bcrypt.hash("Jurnalis@2026!", 12);
  const jurnalis = await prisma.user.upsert({
    where: { email: "jurnalis@lensaplus.com" },
    update: { isActive: true },
    create: {
      email: "jurnalis@lensaplus.com",
      password: journalistPass,
      name: "Ahmad Fauzi",
      role: "SENIOR_JOURNALIST",
      bio: "Jurnalis Senior Lensaplus liputan Hukum & Pemerintahan Kota Bandung.",
      specialization: "Hukum & Publik",
      isActive: true,
    },
  });

  // 2. Categories
  const categoriesData = [
    { name: "Hukum", slug: "hukum", description: "Berita hukum, peradilan, dan regulasi Kota Bandung", order: 1 },
    { name: "Bisnis & Ekonomi", slug: "bisnis-ekonomi", description: "Berita bisnis, bursa emiten, dan APBD Jawa Barat", order: 2 },
    { name: "Olahraga", slug: "olahraga", description: "Berita olahraga daerah dan Persib Bandung", order: 3 },
    { name: "Pemerintahan", slug: "pemerintahan", description: "Kebijakan Pemkot Bandung & Pemprov Jawa Barat", order: 4 },
    { name: "Teknologi", slug: "teknologi", description: "Inovasi digital, startup, dan smart city Bandung", order: 5 },
    { name: "Opini", slug: "opini", description: "Analisis pakar dan kolom pandangan publik", order: 6 },
  ];

  const categoryMap = {};
  for (const cat of categoriesData) {
    const created = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
    categoryMap[cat.slug] = created.id;
  }

  // 3. Articles
  const articlesData = [
    {
      title: "Pemkot Bandung dan DPRD Resmi Sahkan Perda Pengelolaan Infrastruktur Digital 2026",
      slug: "pemkot-bandung-sahkan-perda-infrastruktur-digital-2026",
      excerpt: "Pemerintah Kota Bandung bersama DPRD menyepakati perluasan jaringan fiber optik publik dan pusat data hukum digital untuk mendukung transparansi publik.",
      content: `<p>BANDUNG — Pemerintah Kota Bandung bersama Dewan Perwakilan Rakyat Daerah (DPRD) resmi menandatangani Peraturan Daerah (Perda) Pengelolaan Infrastruktur Digital 2026 dalam sidang paripurna di Gedung DPRD Kota Bandung.</p><h2>Penguatan Jaringan Internet Publik</h2><p>Perda ini menjadi payung hukum penataan kabel serat optik bawah tanah (*utility ducting*) serta perluasan titik Wi-Fi gratis untuk kawasan publik dan tempat ibadah di 30 kecamatan se-Kota Bandung.</p><blockquote>"Langkah ini penting untuk memastikan seluruh warga Kota Bandung mendapatkan akses informasi hukum dan layanan publik secara berkeadilan," ujar Wali Kota Bandung dalam pidato sambutannya.</blockquote><h2>Integrasi Pusat Data Peradilan</h2><p>Selain infrastruktur fisik, Perda ini juga mengamanatkan pengintegrasian direktori peradilan lokal dengan layanan direktori hukum terpadu guna mempermudah akses bantuan hukum bagi masyarakat kurang mampu.</p>`,
      featuredImage: "/uploads/demo/hero-bandung.png",
      status: "PUBLISHED",
      verificationLabel: "VERIFIED",
      readTime: 4,
      viewCount: 1420,
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      authorId: jurnalis.id,
      categoryId: categoryMap["pemerintahan"],
      seoTitle: "Pemkot Bandung Sahkan Perda Infrastruktur Digital 2026",
      seoDescription: "Pemkot dan DPRD Bandung resmi menerbitkan Perda Digital 2026 untuk jaringan fiber optik publik.",
    },
    {
      title: "Emiten Jawa Barat Bukukan Pertumbuhan Laba Bersih Kuantum Kuartal II 2026",
      slug: "emiten-jawa-barat-pertumbuhan-laba-bersih-kuartal-ii-2026",
      excerpt: "Sejumlah emiten berbasis di Jawa Barat mencatatkan kenaikan kinerja keuangan positif disokong oleh pemulihan ekonomi daerah dan ekspansi kredit UMKM.",
      content: `<p>BANDUNG — Pergerakan saham emiten kawasan Jawa Barat menunjukkan tren menguat signifikan pada penutupan perdagangan bursa pekan ini.</p><h2>Peningkatan Kredit Perbankan Daerah</h2><p>Analis pasar modal mencatat pertumbuhan penyaluran kredit produktif kepada sektor Usaha Mikro, Kecil, dan Menengah (UMKM) menjadi pendorong utama capaian laba bersih emiten perbankan daerah.</p><blockquote>"Indikator ekonomi makro Jawa Barat yang solid memberi dorongan kepercayaan bagi para investor domestik maupun asing," terang analis keuangan Lensaplus.</blockquote>`,
      featuredImage: "/uploads/demo/bisnis-ekonomi.png",
      status: "PUBLISHED",
      verificationLabel: "VERIFIED",
      readTime: 3,
      viewCount: 890,
      publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      authorId: jurnalis.id,
      categoryId: categoryMap["bisnis-ekonomi"],
      seoTitle: "Emiten Jawa Barat Catat Laba Bersih Positif Kuartal II 2026",
      seoDescription: "Emiten perbankan dan industri Jawa Barat menunjukkan kinerja keuangan menguat.",
    },
    {
      title: "Pengadilan Negeri Bandung Gelar Sidang Perdana Gugatan Perdata Aset Daerah",
      slug: "pn-bandung-sidang-perdana-gugatan-perdata-aset-daerah",
      excerpt: "Majelis Hakim Pengadilan Negeri Bandung memimpin sidang pembacaan gugatan sengketa lahan fasilitas umum di kawasan Bandung Timur.",
      content: `<p>BANDUNG — Majelis Hakim Pengadilan Negeri (PN) Bandung menggelar sidang perdata perkara sengketa kepemilikan lahan fasilitas umum di kawasan Arcamanik, Kota Bandung.</p><h2>Pembacaan Materi Gugatan</h2><p>Kuasa hukum penggugat membacakan petitum yang memohon agar pengadilan menetapkan status quo atas lahan seluas 2.500 meter persegi tersebut hingga proses pembuktian selesai.</p><blockquote>"Kami meyakini bukti sertifikat hak milik yang diproduksi klien kami sah dan mengikat secara hukum," tegas kuasa hukum penggugat usai persidangan.</blockquote>`,
      featuredImage: "/uploads/demo/hukum-court.png",
      status: "PUBLISHED",
      verificationLabel: "VERIFIED",
      readTime: 5,
      viewCount: 1120,
      publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
      authorId: jurnalis.id,
      categoryId: categoryMap["hukum"],
      seoTitle: "PN Bandung Pimpin Sidang Perdana Gugatan Sengketa Aset",
      seoDescription: "Sidang perdata sengketa lahan fasilitas umum digelar di PN Bandung.",
    },
    {
      title: "Stadion Gelora Bandung Lautan Api Siap Gelar Laga Sengit Liga 1 Indonesia",
      slug: "stadion-gbla-siap-gelar-laga-sengit-liga-1-indonesia",
      excerpt: "Panitia pelaksana memastikan Stadion GBLA telah memenuhi seluruh standar keamanan dan sistem tiket digital jelang pertandingan akhir pekan.",
      content: `<p>BANDUNG — Stadion Gelora Bandung Lautan Api (GBLA) dipastikan 100% siap menggelar laga lanjutan Liga 1 Indonesia pekan ini.</p><h2>Pemeriksaan Fasilitas Keamanan</h2><p>Petugas gabungan telah mengecek kesiapan pintu masuk facial recognition, kamera CCTV di setiap tribun, serta alur evakuasi darurat.</p><blockquote>"Keselamatan penonton adalah prioritas nomor satu. Seluruh personel pengamanan disiagakan dengan standar ketat," ulas ketua panitia pelaksana laga.</blockquote>`,
      featuredImage: "/uploads/demo/olahraga-stadium.png",
      status: "PUBLISHED",
      verificationLabel: "VERIFIED",
      readTime: 3,
      viewCount: 2350,
      publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      authorId: jurnalis.id,
      categoryId: categoryMap["olahraga"],
      seoTitle: "Stadion GBLA Siap Gelar Laga Sengit Liga 1",
      seoDescription: "Panpel pastikan Stadion GBLA Bandung siap menyambut suporter dengan keamanan tinggi.",
    },
  ];

  for (const art of articlesData) {
    await prisma.article.upsert({
      where: { slug: art.slug },
      update: art,
      create: art,
    });
  }

  // 4. Polling Pembaca
  const poll = await prisma.poll.upsert({
    where: { id: "poll-bandung-digital-2026" },
    update: {},
    create: {
      id: "poll-bandung-digital-2026",
      question: "Apakah Anda setuju dengan alokasi anggaran APBD untuk penataan kabel internet bawah tanah di Bandung?",
      isActive: true,
      categoryId: categoryMap["pemerintahan"],
      options: {
        create: [
          { label: "Sangat Setuju (Kota Lebih Rapi & Aman)" },
          { label: "Setuju dengan Syarat Berjalan Tepat Waktu" },
          { label: "Kurang Setuju (Lebih Baik Prioritas Perbaikan Jalan)" },
        ],
      },
    },
  });

  console.log("✨ All content, articles, categories, and polling data successfully restored!");
}

main()
  .catch((e) => {
    console.error("❌ Reseed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
