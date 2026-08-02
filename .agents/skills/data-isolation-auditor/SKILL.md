---
name: data-isolation-auditor
description: Mengaudit isolasi basis data, pemisahan entitas multi-tenant, proteksi zero-cross-tenant-leak, dan sanitasi data Lensaplus dari brand luar.
---

# 🛡️ Data Isolation & Multi-Tenant Auditor Agent — Operational Manual

Dokumentasi ini adalah manual operasional untuk **Data Isolation & Multi-Tenant Auditor Agent** dalam mengaudit pemisahan basis data PostgreSQL, isolasi data dashboard Lensaplus v2.0, serta pencegahan total terhadap kebocoran atau tumpang tindih data dengan aplikasi/brand lain (seperti Kartawarta).

---

## 🎯 Core Isolation Objectives

1. **Physical & Logical Database Separation:**
   - Aplikasi Lensaplus WAJIB terhubung secara eksklusif ke basis data tersendiri (`DATABASE_URL=".../lensaplus"`).
   - Dilarang keras berbagi koneksi database PostgreSQL atau menggunakan nama database aplikasi lain (`kartawarta`).

2. **Zero External Brand & Content Leak:**
   - Seluruh tabel database (`articles`, `categories`, `users`, `comments`, `sorotan`, `polls`, `system_settings`) WAJIB 100% bebas dari referensi atau jejak kata brand luar.
   - Eksekusi pemindaian rutin dengan script audit otomatis:
     ```bash
     node scripts/audit-data-isolation.js
     ```

3. **Dashboard Stats Isolation:**
   - Statistik pengunjung, jumlah artikel, analitik internal, dan log audit di halaman `/panel/*` hanya boleh mengambil data yang berasal dari basis data `lensaplus`.

---

## 📋 Standard Audit Playbook

1. **Verifikasi File Lingkungan Lingkungan (`.env`):**
   - Pastikan variabel `DATABASE_URL` pada server VPS (`/var/www/lensaplus/.env`) mengarah ke database `lensaplus`:
     ```env
     DATABASE_URL="postgresql://kartawarta:a4de5524d4f27bdafb188aeee328b7b5@localhost:5432/lensaplus"
     ```

2. **Verifikasi Jumlah & Integritas Entitas Database:**
   - Eksekusi kueri pengecekan jumlah baris secara berkala di PostgreSQL VPS:
     ```sql
     SELECT COUNT(*) FROM articles;
     SELECT COUNT(*) FROM users;
     SELECT COUNT(*) FROM categories;
     ```

3. **Pembersihan Otomatis Kebocoran String:**
   - Jalankan sanitasi otomatis jika ditemukan sisa string lama:
     ```bash
     node scripts/sanitize-db-brand.js
     ```
