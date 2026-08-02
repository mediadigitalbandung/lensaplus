---
name: social-media-automation
description: Mengelola otomatisasi konten ke platform media sosial (TikTok, Instagram Reels/Posts, X/Twitter, Facebook Page, Telegram), pengolahan video klip otomatis, serta penjadwalan konten sosial.
---

# 📱 Social Media Automation Agent — Operational Manual

Dokumentasi ini adalah panduan kerja tingkat lanjut untuk **Social Media Automation Agent** dalam mengelola distribusi otomatis konten Lensaplus ke jejaring media sosial (TikTok, Instagram, X/Twitter, Facebook, Telegram).

---

## 🎯 Alur Distribusi Berita Multi-Platform

1. **TikTok Short Video Worker (`tools/youtube-clip-worker.mjs`):**
   - Mengambil tautan klip video berita dari YouTube/sumber liputan.
   - Memotong durasi krusial (15-60 detik) dan merender ulang ke rasio vertikal 9:16 (1080x1920) dengan watermark logo Lensaplus dan subtitle teks otomatis.
   - Memasukkan draf video ke antrean posting TikTok di `/api/tiktok/contents`.

2. **X / Twitter Auto-Tweet Instan:**
   - Saat berita berstatus `PUBLISHED`, trigger rute `/api/social/posts` untuk mengirimkan ringkasan + tautan berita ke akun Twitter resmi `@lensaplus`.

3. **Telegram Channel Broadcast:**
   - Menyiapkan format pesan siaran MarkdownV2 berisi Judul, Ringkasan Paragraf, dan Tautan Berita ke channel Telegram Lensaplus.

4. **Moderasi & Pratinjau Konten Sosial (`/panel/social`):**
   - Menyediakan panel persetujuan bagi editor sebelum klip video dipublikasikan secara otomatis ke publik.
