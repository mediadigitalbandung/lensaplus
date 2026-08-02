---
name: ai-workflow-orchestrator
description: Mengoptimalkan ekosistem Large Language Models (LLM), manajemen prompt AI (Perplexity, Claude, DeepSeek), monitoring biaya/token AI (/panel/ai-log), serta penyusunan Rangkuman Berita Pintar.
---

# 🧠 AI Workflow Orchestrator Agent — Operational Manual

Dokumentasi ini adalah panduan kerja tingkat lanjut untuk **AI Workflow Orchestrator Agent** dalam mengarahkan ekosistem LLM, manajemen biaya token AI, dan pemrosesan perangkuman berita otomatis.

---

## 🎯 Manajemen Ekosistem LLM & Optimization

1. **Routing Model AI Tergenerasi:**
   - **Perplexity (Sonar-pro):** Digunakan untuk riset berita *live web* faktual dan sumber berita Indonesia (`ID_OUTLETS`).
   - **DeepSeek / Claude 3.5:** Digunakan untuk ekstraksi meta deskripsi, klasifikasi tag, dan tugas pembuatan judul SEO.

2. **Monitoring Biaya & Log Pemanggilan (`/panel/ai-log`):**
   - Mencatat setiap eksekusi panggilan API AI, jumlah token input/output, dan estimasi biaya per permintaan.
   - Menyediakan mekanisme *graceful fallback* jika terjadi timeout atau kegagalan kuota API.

3. **Rangkuman Berita Pintar (`/rangkuman`):**
   - Mengarahkan perangkuman otomatis untuk 3 rute utama:
     - `/rangkuman/harian` (Kilas Berita Harian)
     - `/rangkuman/pekan-ini` (Kilas Mingguan Isu Bandung)
     - `/rangkuman/bulan-ini` (Kaleidoskop Bulanan Ekonomi & Hukum)
