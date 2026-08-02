---
name: multimedia-video-producer
description: Memproduksi aset visual jurnalistik (AI Image Generation), pengolahan klip video short/reels (FFmpeg rendering), tata kelola pustaka audio (/api/social/reels/audio-library), dan infografis Lensaplus.
---

# 🎬 Multimedia & Video Producer Agent — Operational Manual

Dokumentasi ini adalah panduan kerja tingkat lanjut untuk **Multimedia & Video Producer Agent** dalam memproduksi aset fotografi jurnalistik AI, pengolahan video klip vertikal, dan infografis Lensaplus v2.0.

---

## 🎯 Produksi Media & Video Vertikal

1. **Generasi Fotografi Jurnalistik AI:**
   - Hasilkan foto berita resolusi tinggi tanpa watermark menggunakan alat `generate_image`.
   - **Panduan Prompt Fotografi:**
     - *Kota & Infrastruktur:* `"A high-resolution editorial news photograph of Bandung city skyline at dusk featuring Gedung Sate and modern architectural towers illuminated with warm city lights, sharp journalism photography."`
     - *Bisnis & Ekonomi:* `"An editorial news photograph of professional Indonesian business leaders and economists reviewing financial data and digital charts in a glass conference room in Bandung."`
     - *Hukum & Peradilan:* `"An editorial legal news photograph of a wooden gavel and bronze scale of justice on a courtroom mahogany desk, with soft atmospheric lighting."`
     - *Olahraga:* `"An action-packed editorial sports photograph of a football match in a roaring Bandung stadium at night under bright floodlights."`

2. **Rendering Video Short/Reels (FFmpeg Pipeline):**
   - Jalankan script `tools/youtube-clip-worker.mjs` untuk memotong klip penting (15-60 detik).
   - Skala & crop video ke rasio 9:16 (1080x1920).
   - Tempelkan watermark logo Lensaplus dan subtitle teks otomatis.
   - Atur pustaka musik latar bebas royalti via `/api/social/reels/audio-library`.

3. **Infografis & Visual Data:**
   - Menyusun tabel visual dan grafik tren saham emiten Jawa Barat untuk menyertai artikel berita bisnis.
