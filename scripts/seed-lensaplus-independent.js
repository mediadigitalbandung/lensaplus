require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Initializing Lensaplus Independent Database (Zero Brand Overlap)...");

  // 1. Wipe current Lensaplus database tables cleanly
  const safeDelete = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✓ Cleared ${name}`);
    } catch (err) {
      console.log(`  - Skipped ${name}`);
    }
  };

  await safeDelete("Comment", () => prisma.comment.deleteMany({}));
  await safeDelete("Revision", () => prisma.revision.deleteMany({}));
  await safeDelete("Correction", () => prisma.correction.deleteMany({}));
  await safeDelete("Report", () => prisma.report.deleteMany({}));
  await safeDelete("Source", () => prisma.source.deleteMany({}));
  await safeDelete("ArticleTag", () => prisma.$executeRawUnsafe(`DELETE FROM "_ArticleToTag";`));
  await safeDelete("Article", () => prisma.article.deleteMany({}));
  await safeDelete("Sorotan", () => prisma.sorotan.deleteMany({}));
  await safeDelete("LiveBlogEntry", () => prisma.liveBlogEntry?.deleteMany({}));
  await safeDelete("LiveBlog", () => prisma.liveBlog?.deleteMany({}));
  await safeDelete("TikTokContent", () => prisma.tikTokContent?.deleteMany({}));
  await safeDelete("PollVote", () => prisma.pollVote?.deleteMany({}));
  await safeDelete("PollOption", () => prisma.pollOption?.deleteMany({}));
  await safeDelete("Poll", () => prisma.poll?.deleteMany({}));
  await safeDelete("AuditLog", () => prisma.auditLog?.deleteMany({}));
  await safeDelete("AiLog", () => prisma.aiLog?.deleteMany({}));
  await safeDelete("NewsletterSubscriber", () => prisma.newsletterSubscriber?.deleteMany({}));

  console.log("🧹 Lensaplus database wiped clean for independent content generation.");

  // 2. Users (Redaksi Lensaplus)
  const adminPass = await bcrypt.hash("admin1234", 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@lensaplus.com" },
    update: { password: adminPass, isActive: true },
    create: {
      email: "admin@lensaplus.com",
      password: adminPass,
      name: "Super Admin",
      role: "SUPER_ADMIN",
      bio: "Administrator Utama Platform Media Digital Lensaplus",
      isActive: true,
    },
  });

  const editorPass = await bcrypt.hash("Editor@2026!", 12);
  const editorKepala = await prisma.user.upsert({
    where: { email: "editor@lensaplus.com" },
    update: { password: editorPass, isActive: true },
    create: {
      email: "editor@lensaplus.com",
      password: editorPass,
      name: "Budi Santoso",
      role: "CHIEF_EDITOR",
      bio: "Editor Kepala Redaksi Lensaplus Bandung",
      specialization: "Editorial & Jurnalisme Investigasi",
      isActive: true,
    },
  });

  const jurnalisPass = await bcrypt.hash("Jurnalis@2026!", 12);
  const jurnalisHukum = await prisma.user.upsert({
    where: { email: "jurnalis.hukum@lensaplus.com" },
    update: { password: jurnalisPass, isActive: true },
    create: {
      email: "jurnalis.hukum@lensaplus.com",
      password: jurnalisPass,
      name: "Ahmad Fauzi",
      role: "SENIOR_JOURNALIST",
      bio: "Jurnalis Senior Liputan Hukum & Peradilan Pengadilan Negeri Bandung",
      specialization: "Hukum & Peradilan",
      isActive: true,
    },
  });

  const jurnalisBisnis = await prisma.user.upsert({
    where: { email: "jurnalis.bisnis@lensaplus.com" },
    update: { password: jurnalisPass, isActive: true },
    create: {
      email: "jurnalis.bisnis@lensaplus.com",
      password: jurnalisPass,
      name: "Citra Lestari",
      role: "JOURNALIST",
      bio: "Jurnalis Eksekutif Liputan Ekonomi, Bursa Emiten & APBD Jawa Barat",
      specialization: "Bisnis & Makroekonomi",
      isActive: true,
    },
  });

  const jurnalisOlahraga = await prisma.user.upsert({
    where: { email: "jurnalis.olahraga@lensaplus.com" },
    update: { password: jurnalisPass, isActive: true },
    create: {
      email: "jurnalis.olahraga@lensaplus.com",
      password: jurnalisPass,
      name: "Rahmat Hidayat",
      role: "JOURNALIST",
      bio: "Jurnalis Spesialis Olahraga Daerah & Persib Bandung",
      specialization: "Sepak Bola & Arena Olahraga",
      isActive: true,
    },
  });

  // 3. Categories
  const categoriesData = [
    { name: "Hukum", slug: "hukum", description: "Berita hukum, peradilan, dan regulasi Kota Bandung", order: 1 },
    { name: "Bisnis & Ekonomi", slug: "bisnis-ekonomi", description: "Berita bisnis, bursa emiten, dan APBD Jawa Barat", order: 2 },
    { name: "Olahraga", slug: "olahraga", description: "Berita olahraga daerah dan Persib Bandung", order: 3 },
    { name: "Pemerintahan", slug: "pemerintahan", description: "Kebijakan Pemkot Bandung & Pemprov Jawa Barat", order: 4 },
    { name: "Teknologi", slug: "tekno", description: "Inovasi digital, startup, dan smart city Bandung", order: 5 },
    { name: "Kesehatan", slug: "kesehatan", description: "Layanan medis, kesehatan publik, dan fasilitas RS Bandung", order: 6 },
    { name: "Lingkungan", slug: "lingkungan", description: "Isu ekologis, kebersihan kota, dan pengelolaan sampah Bandung", order: 7 },
    { name: "Opini", slug: "opini", description: "Analisis pakar dan kolom pandangan publik", order: 8 },
  ];

  const categoryMap = {};
  for (const cat of categoriesData) {
    let existing = await prisma.category.findFirst({
      where: { OR: [{ slug: cat.slug }, { name: cat.name }] },
    });
    if (!existing) {
      existing = await prisma.category.create({ data: cat });
    }
    categoryMap[cat.slug] = existing.id;
  }

  // 4. Unique Independent Articles for Lensaplus
  const articlesList = [
    {
      title: "Pemkot Bandung dan DPRD Resmi Sahkan Perda Penataan Ducting Kabel Fiber Optik 2026",
      slug: "pemkot-bandung-sahkan-perda-penataan-ducting-kabel-2026",
      excerpt: "Pemerintah Kota Bandung bersama DPRD menyepakati pembangunan saluran kabel bawah tanah terpadu untuk estetika kota dan keamanan warga.",
      content: `<p>BANDUNG — Pemerintah Kota Bandung bersama Dewan Perwakilan Rakyat Daerah (DPRD) secara resmi mengesahkan Peraturan Daerah (Perda) Penataan Saluran Kabel Bawah Tanah (*Utility Ducting*) dalam rapat paripurna di Balai Kota Bandung.</p><h2>Latar Belakang dan Kebijakan</h2><p>Langkah ini diambil guna menertibkan belantara kabel udara fiber optik yang membentang di 30 kecamatan di Kota Bandung. Proyek ini diprioritaskan pada ruas jalan protokol seperti Jalan Asia Afrika, Jalan Ir. H. Juanda (Dago), dan Jalan Soekarno-Hatta.</p><blockquote>"Perda ini memberikan kepastian hukum bagi operator telekomunikasi sekaligus mengembalikan keindahan estetika Kota Bandung," tegas juru bicara Pemkot Bandung dalam keterangan pers.</blockquote><h2>Tahapan Pelaksanaan Proyek</h2><p>Pembangunan infrastruktur terpadu ini dijadwalkan mulai bertahap pada kuartal ketiga 2026 dengan target penyelesaian seluas 120 kilometer jalur jalan utama.</p>`,
      featuredImage: "/uploads/demo/hero-bandung.png",
      status: "PUBLISHED",
      verificationLabel: "VERIFIED",
      readTime: 4,
      viewCount: 2450,
      publishedAt: new Date(Date.now() - 1 * 3600 * 1000),
      authorId: jurnalisHukum.id,
      categoryId: categoryMap["pemerintahan"],
      seoTitle: "Pemkot Bandung Sahkan Perda Ducting Kabel Fiber Optik 2026",
      seoDescription: "Pemkot dan DPRD Bandung resmi terbitkan Perda penataan kabel bawah tanah terpadu 2026.",
    },
    {
      title: "Emiten Manufaktur Jawa Barat Catat Lonjakan Ekspor Produk Tekstil Ramah Lingkungan",
      slug: "emiten-manufaktur-jabar-lonjakan-ekspor-tekstil-ramah-lingkungan",
      excerpt: "Kinerja emiten sektor manufaktur dan serat sintetis berbasis Jawa Barat menunjukkan pertumbuhan pendapatan signifikan pada semester pertama 2026.",
      content: `<p>BANDUNG — Pasar ekspor manufaktur Jawa Barat mencatatkan kinerja cemerlang seiring tingginya permintaan bahan baku tekstil ramah lingkungan dari pasar Eropa dan Amerika Utara.</p><h2>Peningkatan Volume Permintaan</h2><p>Berdasarkan data Badan Pusat Statistik (BPS) Jawa Barat, nilai ekspor komoditas manufaktur hijau melonjak 18,4% dibanding periode yang sama tahun sebelumnya.</p><blockquote>"Penggunaan teknologi daur ulang dan efisiensi energi solar panel di pabrik kawasan industri Kabupaten Bandung menjadi nilai tambah utama di bursa internasional," ujar analis pasar modal Lensaplus.</blockquote>`,
      featuredImage: "/uploads/demo/bisnis-ekonomi.png",
      status: "PUBLISHED",
      verificationLabel: "VERIFIED",
      readTime: 3,
      viewCount: 1680,
      publishedAt: new Date(Date.now() - 3 * 3600 * 1000),
      authorId: jurnalisBisnis.id,
      categoryId: categoryMap["bisnis-ekonomi"],
      seoTitle: "Emiten Manufaktur Jabar Catat Lonjakan Ekspor Tekstil 2026",
      seoDescription: "Ekspor tekstil ramah lingkungan emiten Jawa Barat melonjak 18,4% di pasar internasional.",
    },
    {
      title: "Majelis Hakim PN Bandung Gelar Sidang Kasus Sengketa Lahan Cibeunying Kaler",
      slug: "pn-bandung-gelar-sidang-sengketa-lahan-cibeunying-kaler",
      excerpt: "Pengadilan Negeri Bandung mendengarkan keterangan saksi ahli tata ruang dalam persidangan gugatan klaim kepemilikan aset daerah.",
      content: `<p>BANDUNG — Persidangan perkara sengketa lahan fasilitas umum seluas 3.200 meter persegi di Kecamatan Cibeunying Kaler kembali digelar di Pengadilan Negeri (PN) Bandung.</p><h2>Pemeriksaan Saksi Ahli</h2><p>Majelis Hakim mendengarkan kesaksian ahli pemetaan kadastral dari Universitas Padjadjaran yang memaparkan histori sertifikasi tanah sejak tahun 1982.</p><blockquote>"Kepastian hukum alas hak tanah harus didasarkan pada register resmi buku tanah di BPN Kota Bandung," ulas tim penasihat hukum di persidangan.</blockquote>`,
      featuredImage: "/uploads/demo/hukum-court.png",
      status: "PUBLISHED",
      verificationLabel: "VERIFIED",
      readTime: 5,
      viewCount: 1890,
      publishedAt: new Date(Date.now() - 6 * 3600 * 1000),
      authorId: jurnalisHukum.id,
      categoryId: categoryMap["hukum"],
      seoTitle: "PN Bandung Sidang Sengketa Lahan Cibeunying Kaler",
      seoDescription: "PN Bandung hadirkan saksi ahli dalam sidang sengketa aset di Cibeunying Kaler.",
    },
    {
      title: "Persib Bandung Optimistis Amankan Poin Penuh di Stadion GBLA Pekan Ini",
      slug: "persib-bandung-optimistis-amankan-poin-penuh-di-gbla",
      excerpt: "Pelatih kepala mengonfirmasi seluruh pilar utama berada dalam kondisi bugar jelang pertandingan kandang versus rival papan atas.",
      content: `<p>BANDUNG — Skuad Pangeran Biru Persib Bandung merampungkan sesi latihan taktik terakhir di Stadion Gelora Bandung Lautan Api (GBLA) dengan penuh percaya diri.</p><h2>Strategi Penyerangan Cepat</h2><p>Jajaran pelatih menekankan variasi serangan dari lini sayap serta penguasaan bola lini tengah guna membongkar pertahanan lawan.</p><blockquote>"Dukungan penuh bobotoh di stadion akan menjadi energi tambahan bagi kami untuk meraih kemenangan mutlak," ujar striker utama Persib.</blockquote>`,
      featuredImage: "/uploads/demo/olahraga-stadium.png",
      status: "PUBLISHED",
      verificationLabel: "VERIFIED",
      readTime: 3,
      viewCount: 3120,
      publishedAt: new Date(Date.now() - 9 * 3600 * 1000),
      authorId: jurnalisOlahraga.id,
      categoryId: categoryMap["olahraga"],
      seoTitle: "Persib Bandung Targetkan Poin Penuh di GBLA",
      seoDescription: "Persib Bandung siapkan taktik maksimal jelang laga kandang di Stadion GBLA.",
    },
    {
      title: "Digitalisasi Puskesmas Bandung: Antrean Online Berhasil Pangkas Waktu Tunggu Pasien",
      slug: "digitalisasi-puskesmas-bandung-pangkas-waktu-tunggu-pasien",
      excerpt: "Penerapan sistem rekam medis elektronik dan antrean digital di 80 Puskesmas Kota Bandung mendapat apresiasi dari warga.",
      content: `<p>BANDUNG — Program transformasi kesehatan digital yang diluncurkan Dinas Kesehatan Kota Bandung membuahkan hasil nyata dalam meningkatkan kualitas pelayanan masyarakat.</p><h2>Penurunan Waktu Tunggu</h2><p>Data evaluasi menunjukkan rata-rata waktu tunggu antrean pendaftaran pasien berkurang dari 45 menit menjadi kurang dari 12 menit.</p><blockquote>"Sistem terintegrasi ini memudahkan warga menjadwalkan pemeriksaan medis tanpa perlu mengantre sejak subuh," jelas Kepala Dinkes Kota Bandung.</blockquote>`,
      featuredImage: "/uploads/demo/hero-bandung.png",
      status: "PUBLISHED",
      verificationLabel: "VERIFIED",
      readTime: 4,
      viewCount: 1450,
      publishedAt: new Date(Date.now() - 12 * 3600 * 1000),
      authorId: jurnalisHukum.id,
      categoryId: categoryMap["kesehatan"],
      seoTitle: "Digitalisasi Puskesmas Bandung Pangkas Antrean Pasien",
      seoDescription: "Rekam medis elektronik dan antrean online di Puskesmas Bandung pangkas waktu tunggu.",
    },
    {
      title: "Inovasi Pengolahan Sampah Mandiri di TPS 3R Gedebage Raih Penghargaan Lingkungan",
      slug: "inovasi-pengolahan-sampah-tps3r-gedebage-raih-penghargaan",
      excerpt: "Fasilitas TPS 3R Gedebage berhasil mengolah 15 ton sampah organik per hari menjadi pupuk kompos berkualitas tinggi.",
      content: `<p>BANDUNG — Pengelolaan sampah berbasis komunitas di TPS 3R Gedebage, Kota Bandung, kembali mendapat pengakuan nasional berkat konsistensi menekan pembuangan sampah ke TPA.</p><h2>Konversi Organik Menjadi Kompos</h2><p>Dengan memanfaatkan mesin pencacah modern dan budidaya maggot BSF, tempat pengolahan ini mampu mengurangi volume sampah terbuang hingga 70%.</p><blockquote>"Kunci utamanya adalah pemilahan sejak dari pemukiman warga di tingkat RT dan RW," tutur ketua pengelola TPS 3R.</blockquote>`,
      featuredImage: "/uploads/demo/hero-bandung.png",
      status: "PUBLISHED",
      verificationLabel: "VERIFIED",
      readTime: 4,
      viewCount: 1290,
      publishedAt: new Date(Date.now() - 15 * 3600 * 1000),
      authorId: jurnalisBisnis.id,
      categoryId: categoryMap["lingkungan"],
      seoTitle: "Inovasi TPS 3R Gedebage Bandung Raih Penghargaan Lingkungan",
      seoDescription: "TPS 3R Gedebage Bandung sukses olah 15 ton sampah organik per hari jadi kompos.",
    },
  ];

  for (const art of articlesList) {
    await prisma.article.upsert({
      where: { slug: art.slug },
      update: art,
      create: art,
    });
  }

  // 5. Polling Pembaca Lensaplus
  await prisma.poll.upsert({
    where: { id: "poll-lensaplus-ducting-2026" },
    update: {},
    create: {
      id: "poll-lensaplus-ducting-2026",
      question: "Bagaimana tanggapan Anda terhadap percepatan proyek kabel serat optik bawah tanah di jalan protokol Bandung?",
      isActive: true,
      categoryId: categoryMap["pemerintahan"],
      options: {
        create: [
          { label: "Sangat Setuju (Kota Lebih Rapi & Aman)" },
          { label: "Setuju dengan Penataan Jadwal Pengerjaan" },
          { label: "Kurang Setuju (Perlu Prioritas Perbaikan Jalan Utama)" },
        ],
      },
    },
  });

  console.log("✨ Lensaplus Independent Database created successfully with 0 brand overlap!");
}

main()
  .catch((e) => {
    console.error("❌ Reseed Lensaplus Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
