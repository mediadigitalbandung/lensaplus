# Monetization & Ad Placement Specifications

Dokumen ini memuat dimensi slot iklan, zona iklan, dan pelacakan CTR untuk **Monetization & Ads Specialist Agent**.

---

## 1. Spesifikasi Dimensi Slot Iklan (`BannerAd.tsx`)

| Nama Slot | Ukuran Desktop | Ukuran Mobile | Posisi Halaman |
|---|---|---|---|
| **Header Leaderboard** | 728x90 px | 320x50 px | Di atas Ticker berita beranda |
| **Between Sections** | 728x90 px | 300x250 px | Di antara blok kategori berita |
| **Sidebar Sticky Ad** | 300x250 px | 300x250 px | Sidebar kanan artikel berita |
| **In-Article Inline** | 728x90 px | 300x250 px | Setelah paragraf ke-3 & ke-5 artikel |
| **Popup Ad** | 600x400 px | 320x400 px | Modal dialog promosi mitra |
| **Floating Footer Ad** | 728x90 px | 320x50 px | Menempel di bagian bawah layar |

---

## 2. Parameter Audit Impresi & CTR (`/panel/iklan`)

- **Status Field:** `ACTIVE`, `PAUSED`, `EXPIRED`.
- **CTR Formula:** `(Total Clicks / Total Impressions) * 100%`.
- **Target CTR:** > 1.8% untuk slot Native Ad dan Sidebar Sticky Ad.
