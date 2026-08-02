# Social Media Automation Specifications

Dokumen ini memuat spesifikasi format video TikTok, auto-tweet X, siaran Telegram, dan posting Instagram/Facebook untuk **Social Media Automation Agent**.

---

## 1. Short Video Worker Specs (TikTok & Reels)

- **Input Video:** YouTube URL / Local MP4 (1080p).
- **Output Aspect Ratio:** 9:16 (1080x1920).
- **Watermark:** Logo Lensaplus pojok kanan atas (`opacity: 0.85`).
- **Subtitle:** Subtitle teks otomatis Bahasa Indonesia di bagian tengah bawah.
- **Worker Script:** `tools/youtube-clip-worker.mjs`

---

## 2. Format Auto-Post X / Twitter

```text
🚨 [BREAKING NEWS] Pemkot Bandung Resmi Terbitkan Perda Pengelolaan Infrastruktur Digital 2026

Simak ulasan lengkap dan dampaknya bagi warga Bandung:
https://lensaplus.com/berita/pemkot-bandung-perda-digital-2026

#Lensaplus #Bandung #BeritaBandung #JawaBarat
```

---

## 3. Format Telegram Broadcast Channel

```markdown
*POLITIK & PEMERINTAHAN BANDUNG*
*Pemkot Bandung Resmi Terbitkan Perda Pengelolaan Infrastruktur Digital 2026*

Pemerintah Kota Bandung bersama DPRD menyepakati rancangan peraturan daerah terkait perluasan infrastruktur internet publik dan pusat data hukum digital.

[Baca Selengkapnya di Lensaplus](https://lensaplus.com/berita/pemkot-bandung-perda-digital-2026)
```
