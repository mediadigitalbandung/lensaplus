# Kartawarta — Load / Stress Test Tool (lokal)

Alat **uji beban** untuk mengukur kapasitas & ketahanan situs **milik sendiri**.
Ini bukan alat DDoS: berjalan di `127.0.0.1` saja, butuh centang otorisasi, dan
concurrency/durasi dibatasi.

## Cara pakai

```bash
node loadtest/server.mjs
# lalu buka http://127.0.0.1:8787 di browser
```

1. Isi **Target URL** (default `http://localhost:3000`).
2. Atur **Concurrency**, **Durasi**, **Ramp-up**, dan opsional **Batas RPS**.
3. Centang pernyataan otorisasi → klik **Mulai Uji Beban**.
4. Lihat metrik live: RPS, jumlah selesai/gagal, latensi p50/p95/p99/max, dan
   breakdown status code. Klik **Stop** kapan saja.

## Membaca hasil

- **429** banyak → rate-limit Anda **aktif** (bagus — proteksi anti-abuse jalan).
- **5xx / error / timeout** naik → server mulai kewalahan di beban itu.
- **Latensi p95/p99 melonjak** → titik degradasi mulai terlihat.

## Etika & keamanan

- Uji **situs sendiri / yang Anda berwenang** saja.
- **Jangan** banjiri situs **produksi** di hosting bersama (Hostinger): bisa
  menjatuhkan situs untuk pembaca asli & melanggar ToS → akun disuspend.
- Disarankan: jalankan `npm run dev` lalu uji `http://localhost:3000`, atau pakai
  staging. Ke produksi cukup beban kecil untuk memverifikasi rate-limit.

Batas pengaman bawaan: concurrency ≤ 500, durasi ≤ 300 dtk, timeout 15 dtk/req.
