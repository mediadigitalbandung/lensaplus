# Lensaplus QA & Security Audit Checklist

Dokumen ini memuat daftar periksa keamanan OWASP Top 10 dan prosedur audit QA untuk **QA & Security Auditor Agent**.

---

## 1. Perlindungan Input & Anti-XSS

- **Sanitasi HTML Rich-Text:**
  Setiap konten HTML yang dimasukkan oleh editor TipTap WAJIB disanitasi menggunakan `sanitizeHtml` (`DOMPurify`) sebelum disimpan ke database Prisma.
  ```typescript
  import { sanitizeHtml } from "@/lib/sanitize";
  const cleanHtml = sanitizeHtml(rawContent);
  ```

---

## 2. Autentikasi & Autorisasi (RBAC & 2FA)

- **Role-Based Access Control (RBAC):**
  - Rute `/panel/*` dilindungi middleware dan sesi NextAuth.
  - Peran pengguna:
    - `SUPER_ADMIN`: Akses penuh ke seluruh fitur dan pengaturan sistem.
    - `CHIEF_EDITOR`: Hak publikasi, penetapan sorotan, dan otorisasi berita.
    - `SENIOR_JOURNALIST` & `EDITOR`: Hak penulisan draf dan perbaikan konten.
- **Two-Factor Authentication (2FA TOTP):**
  - Rahasia TOTP disimpan terenkripsi di tabel pengguna.
  - Sesi login meminta token 6 digit authenticator jika 2FA diaktifkan.

---

## 3. Audit Log Transparansi (`logAudit`)

Setiap tindakan pengubahan data penting WAJIB mencatat entri `AuditLog`:
```typescript
await logAudit({
  userId: session.user.id,
  action: "PUBLISH_ARTICLE",
  target: article.id,
  details: { title: article.title },
});
```

---

## 4. Automated Build & Typecheck Verification

Eksekusi rutin verifikasi build:
```powershell
npx tsc --noEmit
npm run build
```
