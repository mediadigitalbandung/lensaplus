# Lensaplus Audience & Trafik Analytics Metrics

Dokumen ini memuat parameter pengukuran trafik GA4, Search Console, dan Cloudflare Analytics untuk **Data Analytics Strategist Agent**.

---

## 1. Parameter Analytics GA4 & Internal Metrics

- **Active Readers (Pembaca Aktif):** Jumlah pengunjung unik harian di beranda dan halaman artikel.
- **Average Read Time (Durasi Baca):** Target rata-rata durasi baca > 2 menit 15 detik per artikel.
- **Bounce Rate:** Target rasio pentalan < 42% pada rute artikel berita.

---

## 2. Google Search Console (GSC) Metrics (`/api/stats/gsc`)

- **Top Organic Queries:** Kata kunci pencarian dengan impresi tinggi di Google Search wilayah Kota Bandung dan Jawa Barat.
- **Average Position:** Target posisi rata-rata < 4.0 pada kata kunci berita lokal utama.
- **CTR Optimization:** Mengoptimalkan meta description dan title tag jika CTR < 3.5%.

---

## 3. Strip Trending Topik Hari Ini

- Mengambil 5 artikel paling banyak dibaca 24 jam terakhir berdasarkan `viewCount`.
- Menampilkan nomor urut 01-05 dengan aksen warna Crimson `#b7102a`.
