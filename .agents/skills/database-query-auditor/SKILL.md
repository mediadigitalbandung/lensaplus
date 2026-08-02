---
name: database-query-auditor
description: Mengaudit efisiensi query Prisma ORM & PostgreSQL 16, deteksi N+1 problem, optimasi indeks database, serta pengelolaan advisory lock pada cron job Lensaplus.
---

# 🗄️ Database Query Auditor Agent — Operational Manual

Dokumentasi ini adalah panduan kerja tingkat lanjut untuk **Database Query Auditor Agent** dalam mengaudit efisiensi kueri PostgreSQL 16, pemeliharaan Prisma ORM 5.22, optimasi indeks, dan manajemen *advisory lock*.

---

## 🎯 Aturan Kueri Database Utama (Core Directives)

1. **Pencegahan N+1 Query Problem:**
   - DILARANG melakukan pemanggilan Prisma kueri di dalam perulangan `map()` atau `for` untuk mengambil relasi kategori/penulis.
   - Gunakan gabungan `select` atau `include` dalam 1 kueri utama:
     ```typescript
     const articles = await prisma.article.findMany({
       where: { status: "PUBLISHED" },
       select: {
         id: true,
         title: true,
         slug: true,
         author: { select: { name: true, avatar: true } },
         category: { select: { name: true, slug: true } },
       },
       orderBy: { publishedAt: "desc" },
       take: 20,
     });
     ```

2. **Pengelolaan Advisory Lock Cron Job (`src/lib/cron-lock.ts`):**
   - Setiap cron job otomatisasi (seperti `/api/cron/auto-article`, `/api/cron/publish`, `/api/cron/seo-submit`) WAJIB menggunakan advisory lock PostgreSQL agar tidak terjadi bentrokan eksekusi ganda:
     ```typescript
     const acquired = await tryAdvisoryLock(LOCK_ID);
     if (!acquired) {
       return NextResponse.json({ skipped: true, reason: "Lock acquired by another process" });
     }
     try {
       // Jalankan tugas cron
     } finally {
       await releaseAdvisoryLock(LOCK_ID);
     }
     ```

3. **Memory Caching Layer (`getCached`):**
   - Kueri frekuensi tinggi (seperti daftar kategori, berita beranda, dan trending) WAJIB dibungkus dengan memori cache `getCached(key, ttlMs, fn)` di `src/lib/cache.ts`.

---

## 🔍 Checklist Audit Indeks Database (`prisma/schema.prisma`)

- [ ] **Indeks Tabel Article:**
  - `@@index([status, publishedAt])`
  - `@@index([categoryId, publishedAt])`
  - `@@index([slug])`
  - `@@index([viewCount])`
- [ ] **Indeks Tabel Sorotan:**
  - `@@index([createdAt])`
  - `@@index([slug])`
- [ ] **Indeks Tabel CourtSchedule:**
  - `@@index([courtName, trialDate])`
