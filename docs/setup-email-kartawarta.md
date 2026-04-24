# Setup Email @kartawarta.com

Panduan lengkap untuk membuat dan menggunakan email `@kartawarta.com`.

---

## Arsitektur Email

```
Email masuk → Cloudflare Email Routing → Forward ke Gmail pribadi
Email keluar → Gmail "Send as" → Brevo SMTP → owen@kartawarta.com
```

**Service yang digunakan:**
- **Cloudflare Email Routing** (gratis) — terima email, forward ke Gmail
- **Brevo SMTP** (gratis, 300 email keluar/hari) — kirim email dari Gmail sebagai @kartawarta.com
- **Gmail** — interface email sehari-hari

---

## Cara 1: Buat Email dari Panel Admin (Otomatis)

1. Login ke `https://kartawarta.com/panel`
2. Klik **Email** di sidebar
3. Klik **Buat Email Baru**
4. Isi:
   - **Email Kartawarta:** nama (misal: `owen`) → jadi `owen@kartawarta.com`
   - **Forward ke:** email Gmail pribadi user
5. Klik **Buat Email**
6. User akan terima **email verifikasi dari Cloudflare** di Gmail → klik verify

> **Catatan:** Saat membuat user baru di menu **Pengguna**, email `namapertama@kartawarta.com` otomatis dibuat.

---

## Cara 2: Buat Email dari Cloudflare Dashboard (Manual)

1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com) → login
2. Pilih domain `kartawarta.com`
3. Klik **Email** → **Email Routing** → **Routing rules**
4. Klik **Create address**
5. Isi:
   - **Custom address:** nama (misal: `redaksi`)
   - **Destination:** email Gmail tujuan
6. Klik **Save**
7. Verifikasi email destination (jika baru pertama kali)

---

## Setup "Send As" di Gmail (Per User)

Agar user bisa **mengirim email** dari Gmail sebagai `nama@kartawarta.com`:

### Langkah 1: Buka Gmail Settings
1. Buka Gmail → klik **Settings (⚙️)** → **See all settings**
2. Klik tab **Accounts and Import**
3. Di bagian **"Send mail as"** → klik **"Add another email address"**

### Langkah 2: Isi Informasi Email
1. **Name:** Nama lengkap (misal: Owen Jacob)
2. **Email address:** `owen@kartawarta.com`
3. Centang **"Treat as an alias"**
4. Klik **Next Step**

### Langkah 3: Isi SMTP Server
| Field | Value |
|---|---|
| **SMTP Server** | `smtp-relay.brevo.com` |
| **Port** | `587` |
| **Username** | `a715cf001@smtp-brevo.com` |
| **Password** | `4UhR5vsHMc3PIqrD` |
| **Connection** | Secured connection using TLS |

5. Klik **Add Account**

### Langkah 4: Verifikasi
1. Gmail akan kirim kode verifikasi ke `nama@kartawarta.com`
2. Karena email forward ke Gmail, cek inbox
3. Masukkan kode atau klik link verifikasi
4. Selesai!

### Langkah 5: Set Default (Opsional)
1. Di Gmail Settings → **Accounts and Import**
2. "Send mail as" → klik **"make default"** di sebelah `nama@kartawarta.com`
3. Ubah **"When replying to a message"** → pilih **"Reply from the same address the message was sent to"**

---

## Akun & Kredensial

### Cloudflare
- **Dashboard:** https://dash.cloudflare.com
- **Email:** Mediadigitalbandung@gmail.com
- **Zone ID:** `7a9fce52f7bbb233211e8d22e24651ad`
- **Account ID:** `494132b6296be7c2ac78bf21446b3bda`
- **Fitur:** Email Routing, DNS, CDN, SSL

### Brevo (SMTP)
- **Dashboard:** https://app.brevo.com
- **Email:** owen@kartawarta.com
- **SMTP Server:** `smtp-relay.brevo.com`
- **Port:** `587`
- **Login:** `a715cf001@smtp-brevo.com`
- **Password:** `4UhR5vsHMc3PIqrD`
- **Limit:** 300 email keluar/hari (gratis)
- **Domain:** kartawarta.com (Authenticated ✅)

### DNS Records (Cloudflare)
Email-related DNS records yang sudah dikonfigurasi:
- **MX** → `route1.mx.cloudflare.net` (priority 53)
- **MX** → `route2.mx.cloudflare.net` (priority 78)
- **MX** → `route3.mx.cloudflare.net` (priority 63)
- **TXT** → `brevo-code:8c87835008d223dc067e68299b63cd4a`
- **CNAME** → `brevo1._domainkey` → `b1.kartawarta-com.dkim.brevo.com`
- **CNAME** → `brevo2._domainkey` → `b2.kartawarta-com.dkim.brevo.com`
- **TXT** → `_dmarc` → `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`
- **TXT** → SPF (Cloudflare auto)
- **TXT** → DKIM domainkey (Cloudflare auto)

---

## Email yang Sudah Dibuat

| Email | Forward ke | Status |
|---|---|---|
| owen@kartawarta.com | owenjacobn@gmail.com | ✅ Aktif |

---

## Limitasi

1. **Foto profil** — Gmail tidak support Gravatar. Foto profil email `@kartawarta.com` akan tampil sebagai default icon di Gmail. Untuk foto profil terpisah butuh Google Workspace (berbayar ~Rp 90rb/user/bulan).

2. **Email keluar** — Maksimal 300/hari via Brevo gratis. Cukup untuk kebutuhan redaksi.

3. **Email masuk** — Unlimited via Cloudflare Email Routing.

4. **"Send as" setup** — Harus dilakukan manual per user di Gmail masing-masing. Tidak bisa diotomasi.

5. **SMTP credentials** — Semua user pakai SMTP Brevo yang sama. Jika password SMTP perlu diganti, update di semua Gmail user.

---

## Troubleshooting

### Email masuk tidak diterima
- Cek Cloudflare Email Routing → **Activity Log**
- Pastikan destination email sudah **verified**
- Cek folder **Spam** di Gmail

### Email keluar masuk spam penerima
- Pastikan domain sudah **authenticated** di Brevo (DKIM + DMARC)
- Cek di Brevo → **Transactional** → **Logs** untuk status delivery

### "Send as" gagal di Gmail
- Pastikan SMTP credentials benar
- Gunakan port **587** dengan **TLS**
- Cek apakah Brevo account tidak suspended

### Email bounce
- Cek Cloudflare Email Routing → Activity Log → filter "Bounce"
- Pastikan alamat tujuan forward masih aktif

---

## Upgrade ke Google Workspace (Opsional)

Jika di masa depan butuh:
- Foto profil terpisah per email
- Google Drive, Calendar, Meet terintegrasi
- Admin console untuk manage semua user
- Unlimited email tanpa batasan

**Harga:** ~Rp 90.000/user/bulan (Starter plan)
**Cara:** Daftar di https://workspace.google.com dengan domain `kartawarta.com`

> `kartawarta@gmail.com` milik orang lain TIDAK mempengaruhi — Google Workspace menggunakan domain `kartawarta.com` yang kamu miliki.
