/**
 * One-shot seed: 10 emiten + 10 regulasi + 6 pejabat + 5 market events.
 * Idempotent — safe to re-run (uses upsert / skip-on-exist).
 *
 * Run on VPS: `node tools/seed-content.mjs`
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const companies = [
  { ticker: "BBRI", name: "PT Bank Rakyat Indonesia (Persero) Tbk", shortName: "BRI", sector: "KEUANGAN", description: "Bank pemerintah terbesar di Indonesia, fokus segmen UMKM dan ritel.", founded: 1895, marketCap: 850_000_000_000_000n, website: "https://bri.co.id", hq: "Jakarta", employees: 130000 },
  { ticker: "BMRI", name: "PT Bank Mandiri (Persero) Tbk", shortName: "Mandiri", sector: "KEUANGAN", description: "Bank pemerintah hasil merger 4 bank, salah satu terbesar di Indonesia.", founded: 1998, marketCap: 750_000_000_000_000n, website: "https://bankmandiri.co.id", hq: "Jakarta", employees: 39000 },
  { ticker: "BBCA", name: "PT Bank Central Asia Tbk", shortName: "BCA", sector: "KEUANGAN", description: "Bank swasta terbesar di Indonesia, pelopor digital banking.", founded: 1955, marketCap: 1300_000_000_000_000n, website: "https://bca.co.id", hq: "Jakarta", employees: 25000 },
  { ticker: "BBNI", name: "PT Bank Negara Indonesia (Persero) Tbk", shortName: "BNI", sector: "KEUANGAN", description: "Bank pemerintah dengan jaringan internasional terluas.", founded: 1946, marketCap: 200_000_000_000_000n, website: "https://bni.co.id", hq: "Jakarta", employees: 27000 },
  { ticker: "BJBR", name: "PT Bank Pembangunan Daerah Jawa Barat dan Banten Tbk", shortName: "Bank BJB", sector: "KEUANGAN", description: "Bank pembangunan daerah Jawa Barat. Kantor pusat di Bandung.", founded: 1961, marketCap: 16_000_000_000_000n, website: "https://bankbjb.co.id", hq: "Bandung", employees: 6500 },
  { ticker: "TLKM", name: "PT Telkom Indonesia (Persero) Tbk", shortName: "Telkom", sector: "TELEKOMUNIKASI", description: "BUMN telekomunikasi terbesar Indonesia. Headquartered di Bandung.", founded: 1965, marketCap: 350_000_000_000_000n, website: "https://telkom.co.id", hq: "Bandung", employees: 22000 },
  { ticker: "ASII", name: "PT Astra International Tbk", shortName: "Astra", sector: "OTHER", description: "Konglomerat dengan portfolio otomotif (Toyota, Daihatsu), agribisnis, alat berat, jasa keuangan.", founded: 1957, marketCap: 220_000_000_000_000n, website: "https://astra.co.id", hq: "Jakarta", employees: 195000 },
  { ticker: "GOTO", name: "PT GoTo Gojek Tokopedia Tbk", shortName: "GoTo", sector: "TEKNOLOGI", description: "Hasil merger Gojek + Tokopedia. Super-app ride-hailing, e-commerce, payment.", founded: 2021, marketCap: 80_000_000_000_000n, website: "https://gotocompany.com", hq: "Jakarta", employees: 6500 },
  { ticker: "ICBP", name: "PT Indofood CBP Sukses Makmur Tbk", shortName: "Indofood CBP", sector: "KONSUMER", description: "Produsen mi instan Indomie, FMCG terbesar Indonesia.", founded: 1990, marketCap: 130_000_000_000_000n, website: "https://indofoodcbp.com", hq: "Jakarta", employees: 75000 },
  { ticker: "ANTM", name: "PT Aneka Tambang Tbk", shortName: "Antam", sector: "PERTAMBANGAN", description: "BUMN pertambangan emas, nikel, bauksit. Anggota MIND ID holding.", founded: 1968, marketCap: 35_000_000_000_000n, website: "https://antam.com", hq: "Jakarta", employees: 4500 },
];

const regulations = [
  { type: "UU", number: "27/2022", year: 2022, title: "Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi", shortTitle: "UU PDP", topic: "Privasi & Data", description: "Mengatur pelindungan data pribadi, hak subjek data, kewajiban pengendali, sanksi pelanggaran.", enactedAt: new Date("2022-10-17"), effectiveAt: new Date("2024-10-17"), issuedBy: "Pemerintah RI", status: "ENACTED", sourceUrl: "https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022" },
  { type: "UU", number: "12/2022", year: 2022, title: "Undang-Undang Nomor 12 Tahun 2022 tentang Tindak Pidana Kekerasan Seksual", shortTitle: "UU TPKS", topic: "HAM & Pidana", description: "Mengatur 9 jenis TPKS, hak korban, perlindungan saksi, restitusi.", enactedAt: new Date("2022-05-09"), issuedBy: "Pemerintah RI", status: "ENACTED", sourceUrl: "https://peraturan.bpk.go.id/Details/207944" },
  { type: "UU", number: "11/2020", year: 2020, title: "Undang-Undang Nomor 11 Tahun 2020 tentang Cipta Kerja", shortTitle: "UU Cipta Kerja", topic: "Ketenagakerjaan & Investasi", description: "Omnibus law mencakup ketenagakerjaan, perpajakan, kemudahan berusaha. Sebagian putusan MK.", enactedAt: new Date("2020-11-02"), issuedBy: "Pemerintah RI", status: "AMENDED", sourceUrl: "https://peraturan.bpk.go.id/Details/149750" },
  { type: "UU", number: "13/2003", year: 2003, title: "Undang-Undang Nomor 13 Tahun 2003 tentang Ketenagakerjaan", shortTitle: "UU Ketenagakerjaan", topic: "Ketenagakerjaan", description: "Dasar hukum ketenagakerjaan Indonesia. Sebagian diubah oleh UU Cipta Kerja.", enactedAt: new Date("2003-03-25"), issuedBy: "Pemerintah RI", status: "AMENDED", sourceUrl: "https://peraturan.bpk.go.id/Details/43013" },
  { type: "UU", number: "23/2014", year: 2014, title: "Undang-Undang Nomor 23 Tahun 2014 tentang Pemerintahan Daerah", shortTitle: "UU Pemda", topic: "Pemerintahan", description: "Mengatur pemerintahan daerah, otonomi, urusan pemerintahan konkuren.", enactedAt: new Date("2014-09-30"), issuedBy: "Pemerintah RI", status: "AMENDED", sourceUrl: "https://peraturan.bpk.go.id/Details/38685" },
  { type: "UU", number: "14/2008", year: 2008, title: "Undang-Undang Nomor 14 Tahun 2008 tentang Keterbukaan Informasi Publik", shortTitle: "UU KIP", topic: "Pemerintahan & Transparansi", description: "Hak masyarakat memperoleh informasi publik dari Badan Publik.", enactedAt: new Date("2008-04-30"), issuedBy: "Pemerintah RI", status: "ENACTED", sourceUrl: "https://peraturan.bpk.go.id/Details/39226" },
  { type: "UU", number: "25/2009", year: 2009, title: "Undang-Undang Nomor 25 Tahun 2009 tentang Pelayanan Publik", shortTitle: "UU Pelayanan Publik", topic: "Pemerintahan", description: "Standar pelayanan publik, hak warga, kewajiban penyelenggara.", enactedAt: new Date("2009-07-18"), issuedBy: "Pemerintah RI", status: "ENACTED", sourceUrl: "https://peraturan.bpk.go.id/Details/38748" },
  { type: "UU", number: "8/1981", year: 1981, title: "Undang-Undang Nomor 8 Tahun 1981 tentang Hukum Acara Pidana", shortTitle: "KUHAP", topic: "Hukum Acara Pidana", description: "Acara pidana Indonesia: penyidikan, penuntutan, pemeriksaan sidang, banding, kasasi.", enactedAt: new Date("1981-12-31"), issuedBy: "Pemerintah RI", status: "ENACTED", sourceUrl: "https://peraturan.bpk.go.id/Details/47266" },
  { type: "UU", number: "1/2023", year: 2023, title: "Undang-Undang Nomor 1 Tahun 2023 tentang Kitab Undang-Undang Hukum Pidana", shortTitle: "KUHP Baru", topic: "Hukum Pidana", description: "KUHP baru menggantikan WvS warisan kolonial. Berlaku Januari 2026.", enactedAt: new Date("2023-01-02"), effectiveAt: new Date("2026-01-02"), issuedBy: "Pemerintah RI", status: "ENACTED", sourceUrl: "https://peraturan.bpk.go.id/Details/234935" },
  { type: "UU", number: "1/2024", year: 2024, title: "Undang-Undang Nomor 1 Tahun 2024 tentang Perubahan Kedua atas UU 11/2008 ITE", shortTitle: "UU ITE Revisi 2024", topic: "Teknologi & Pidana", description: "Revisi UU ITE: perubahan pasal pencemaran nama baik, ujaran kebencian, hoaks.", enactedAt: new Date("2024-01-02"), issuedBy: "Pemerintah RI", status: "ENACTED", sourceUrl: "https://peraturan.bpk.go.id/Details/249264" },
];

const officials = [
  { slug: "gubernur-jawa-barat", name: "Gubernur Jawa Barat", position: "Gubernur Jawa Barat", institution: "Pemerintah Provinsi Jawa Barat", level: "PROVINSI", region: "Jawa Barat", status: "AKTIF", bio: "Pejabat yang memimpin Pemprov Jabar. 27 kabupaten/kota, ekonomi, pendidikan, kesehatan, infrastruktur Jabar.", websiteUrl: "https://jabarprov.go.id" },
  { slug: "wali-kota-bandung", name: "Wali Kota Bandung", position: "Wali Kota Bandung", institution: "Pemerintah Kota Bandung", level: "KOTA_KABUPATEN", region: "Kota Bandung", status: "AKTIF", bio: "Wali Kota Bandung memimpin Pemkot Bandung. Penduduk ~2.5 juta jiwa, ibu kota Provinsi Jawa Barat.", websiteUrl: "https://bandung.go.id" },
  { slug: "bupati-bandung", name: "Bupati Bandung", position: "Bupati Bandung", institution: "Pemerintah Kabupaten Bandung", level: "KOTA_KABUPATEN", region: "Kabupaten Bandung", status: "AKTIF", bio: "Bupati Kabupaten Bandung memimpin Pemkab Bandung. Ibu kota Soreang.", websiteUrl: "https://bandungkab.go.id" },
  { slug: "wali-kota-cimahi", name: "Wali Kota Cimahi", position: "Wali Kota Cimahi", institution: "Pemerintah Kota Cimahi", level: "KOTA_KABUPATEN", region: "Kota Cimahi", status: "AKTIF", bio: "Wali Kota Cimahi memimpin Pemkot Cimahi. Bagian dari Bandung Raya.", websiteUrl: "https://cimahikota.go.id" },
  { slug: "bupati-bandung-barat", name: "Bupati Bandung Barat", position: "Bupati Bandung Barat", institution: "Pemerintah Kabupaten Bandung Barat", level: "KOTA_KABUPATEN", region: "Kabupaten Bandung Barat", status: "AKTIF", bio: "Bupati Kabupaten Bandung Barat. Ibu kota Ngamprah.", websiteUrl: "https://bandungbaratkab.go.id" },
  { slug: "ridwan-kamil", name: "Ridwan Kamil", fullName: "Mochamad Ridwan Kamil, ST., M.U.D.", position: "Mantan Gubernur Jawa Barat (2018-2023)", institution: "Pemerintah Provinsi Jawa Barat", level: "PROVINSI", region: "Jawa Barat", status: "PURNA", termStart: new Date("2018-09-05"), termEnd: new Date("2023-09-05"), bio: "Arsitek, akademisi ITB, Wali Kota Bandung 2013-2018, Gubernur Jawa Barat 2018-2023. Aktif media sosial, tokoh politik nasional.", education: "ITB (Arsitektur), University of California Berkeley (M.U.D.)", career: "Arsitek profesional → Wali Kota Bandung → Gubernur Jabar → Politisi nasional", twitterHandle: "ridwankamil", instagramHandle: "ridwankamil" },
];

async function main() {
  let companyCount = 0;
  for (const c of companies) {
    await prisma.publicCompany.upsert({ where: { ticker: c.ticker }, update: {}, create: c });
    companyCount++;
  }
  console.log(`✓ ${companyCount} emiten upserted`);

  let regCount = 0;
  for (const r of regulations) {
    await prisma.regulation.upsert({
      where: { type_number_year: { type: r.type, number: r.number, year: r.year } },
      update: {},
      create: r,
    });
    regCount++;
  }
  console.log(`✓ ${regCount} regulasi upserted`);

  let officialCount = 0;
  for (const o of officials) {
    await prisma.publicOfficial.upsert({ where: { slug: o.slug }, update: {}, create: o });
    officialCount++;
  }
  console.log(`✓ ${officialCount} pejabat upserted`);

  // Market events — no unique key, dedupe by title
  const now = Date.now();
  const days = (n) => new Date(now + n * 24 * 60 * 60 * 1000);
  const events = [
    { type: "EARNINGS", ticker: "BBRI", companyName: "PT Bank Rakyat Indonesia (Persero) Tbk", title: "Release Laporan Keuangan Q1 2026 BBRI", description: "Bank BRI rilis laporan kuartal 1 2026 mencakup pendapatan bunga, NPL, dan laba bersih.", scheduledAt: days(7) },
    { type: "RUPS", ticker: "BMRI", companyName: "PT Bank Mandiri (Persero) Tbk", title: "RUPS Tahunan Bank Mandiri 2026", description: "Rapat Umum Pemegang Saham Tahunan Bank Mandiri 2026.", scheduledAt: days(14) },
    { type: "EARNINGS", ticker: "TLKM", companyName: "PT Telkom Indonesia (Persero) Tbk", title: "Release Laporan Keuangan Q1 2026 TLKM", description: "Telkom Indonesia rilis laporan kuartal 1 2026 termasuk IndiHome, Telkomsel, dan B2B.", scheduledAt: days(10) },
    { type: "DIVIDEND", ticker: "BBCA", companyName: "PT Bank Central Asia Tbk", title: "Pengumuman Dividen Final 2025 BBCA", description: "Bank Central Asia mengumumkan dividen final tahun buku 2025.", scheduledAt: days(21) },
    { type: "IPO", companyName: "Emiten Baru Sektor Teknologi", title: "IPO Upcoming Sektor Teknologi 2026", description: "IPO startup teknologi Indonesia di papan utama BEI.", scheduledAt: days(30) },
  ];

  let eventCount = 0;
  for (const e of events) {
    const exists = await prisma.marketEvent.findFirst({ where: { title: e.title } });
    if (!exists) {
      await prisma.marketEvent.create({ data: e });
      eventCount++;
    }
  }
  console.log(`✓ ${eventCount} market events created (skipped duplicates)`);

  console.log("");
  console.log("=== Final counts ===");
  console.log("public_companies:", await prisma.publicCompany.count());
  console.log("regulations:     ", await prisma.regulation.count());
  console.log("public_officials:", await prisma.publicOfficial.count());
  console.log("market_events:   ", await prisma.marketEvent.count());
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
