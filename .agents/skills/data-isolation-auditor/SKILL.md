---
name: data-isolation-auditor
description: Mengaudit isolasi basis data, pemisahan entitas multi-tenant, pemisahan direktori server VPS, proteksi zero-cross-tenant-leak, dan sanitasi data Lensaplus dari Kartawarta.
---

# 🛡️ Data Isolation & Infrastructure Guardian Agent — Operational Manual

Dokumentasi ini adalah manual operasional untuk **Data Isolation & Infrastructure Guardian Agent** dalam mengaudit dan menjamin pemisahan 100% secara fisik, logis, direktori, basis data, serta infrastruktur server antara **Lensaplus** dan **Kartawarta**.

---

## 🏛️ System Isolation Architecture (100% Independent)

| Lapisan Sistem | 📰 **Lensaplus Platform** | 📰 **Kartawarta Platform** | Status Penguncian |
|---|---|---|---|
| **Direktori Kode VPS** | `/var/www/lensaplus/` | `/var/www/kartawarta/` | 100% Fisik Terpisah |
| **Pustaka Media (Uploads)** | `/var/www/lensaplus/public/uploads/` | `/var/www/kartawarta/public/uploads/` | 100% Storage Terpisah |
| **PostgreSQL 16 DB** | `postgresql://...:5432/lensaplus` | `postgresql://...:5432/kartawarta` | 100% Database Terpisah |
| **PM2 Process ID** | `lensaplus` (ID: 1, Port: 3002) | `kartawarta` (ID: 3, Port: 3000) | 100% Process Terpisah |
| **Domain & SSL Nginx** | `lensaplus.com` (Port 3002 proxy) | `kartawarta.com` (Port 3000 proxy) | 100% Web Server Terpisah |
| **Akun Administrator** | `admin` / `admin@lensaplus.com` | `admin@kartawarta.com` | 100% User Auth Terpisah |

---

## 🎯 Core Isolation Directives

1. **Physical Directory & Storage Isolation:**
   - Seluruh source code, aset gambar, file `.env`, dependensi `node_modules`, serta file build `.next` Lensaplus WAJIB berada di direktori `/var/www/lensaplus/`.
   - Dilarang keras mengaitkan link simbolik (*symlink*) atau berbagi folder media dengan `/var/www/kartawarta/`.

2. **Logical & Physical Database Separation:**
   - Aplikasi Lensaplus WAJIB terhubung secara eksklusif ke basis data PostgreSQL `lensaplus`.
   - Dilarang keras berbagi koneksi database PostgreSQL atau mengakses tabel aplikasi lain (`kartawarta`).

3. **Zero External Brand & Content Leak:**
   - Seluruh tabel database (`articles`, `categories`, `users`, `comments`, `sorotan`, `polls`, `system_settings`) WAJIB 100% bebas dari referensi atau jejak kata brand luar.
   - Pemindaian rutin dapat dieksekusi melalui:
     ```bash
     node scripts/audit-data-isolation.js
     node scripts/recheck-databases.js
     ```

---

## 📋 Standard Verification Playbook

1. **Verifikasi Jalur Direktori Server VPS:**
   - Eksekusi pengecekan direktori di server VPS:
     ```bash
     ssh root@145.79.15.99 "ls -d /var/www/lensaplus /var/www/kartawarta"
     ```

2. **Verifikasi Lingkungan Lingkungan (`.env`):**
   - Pastikan variabel `DATABASE_URL` pada server VPS mengarah ke database masing-masing:
     - **Lensaplus:** `/var/www/lensaplus/.env` -> `DATABASE_URL=".../lensaplus"`
     - **Kartawarta:** `/var/www/kartawarta/.env` -> `DATABASE_URL=".../kartawarta"`

3. **Pembersihan Otomatis Kebocoran String:**
   - Jalankan sanitasi otomatis jika ditemukan sisa string lama:
     ```bash
     node scripts/sanitize-db-brand.js
     ```
