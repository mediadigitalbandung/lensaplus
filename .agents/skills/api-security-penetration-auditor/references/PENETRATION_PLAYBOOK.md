# Lensaplus API Security & Penetration Audit Playbook

Dokumen ini memuat standar pengujian penetrasi dan proteksi rute API `/api/*` untuk **API Security & Penetration Auditor Agent**.

---

## 1. Otentikasi Cron Endpoints (`Authorization: Bearer ${CRON_SECRET}`)

Seluruh rute cron otomatisasi wajib menguji header otentikasi Bearer:
```typescript
import { verifyCronSecret } from "@/lib/cron-lock";

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized cron access" }, { status: 401 });
  }
  // Jalankan logika cron
}
```

---

## 2. Penangkalan Attack Vectors

- **SQL Injection (SQLi):** Memastikan seluruh kueri database menggunakan Prisma ORM safe parameterization.
- **Cross-Site Scripting (XSS):** Sanitasi input komentar dan buletin email via `sanitizeHtml()`.
- **Server-Side Request Forgery (SSRF):** Membatasi domain target scraper hanya ke daftar outlet berita terverifikasi.
- **Rate Limiting (Anti-Brute Force):** Membatasi frekuensi request pada rute sensitif maks 10 request / menit per IP.
