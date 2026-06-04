# Anti-Scraping — Konfigurasi Cloudflare (langkah dashboard)

Lapisan aplikasi sudah live (lihat commit `63b5be0` + `476637e`):
API JSON publik metadata-only, rate-limit app-layer, robots.txt blokir AI bot,
dan honeypot `/api/trap`. **Tapi penegak sebenarnya ada di edge Cloudflare** —
karena rate-limit/ban app bersifat in-memory (reset tiap deploy) dan tidak
melindungi halaman HTML `/berita/[slug]` (yang memang harus bisa dibaca Google).

Kartawarta sudah berada di belakang Cloudflare. Login ke
**dash.cloudflare.com → pilih zona `kartawarta.com`**, lalu lakukan berikut.
Semua aman untuk SEO: Googlebot/Bingbot/preview-share TIDAK terpengaruh.

---

## 1. Bots (1 klik) — Security → Bots
- **Bot Fight Mode**: ON. (Menantang traffic otomatis; verified bot seperti
  Googlebot otomatis dikecualikan.)
- **Block AI Scrapers and Crawlers**: ON (kalau tersedia di paket Anda).
  Memblokir GPTBot/CCBot/ClaudeBot/dll di edge — pelengkap robots.txt.

## 2. Rate Limiting Rule — Security → WAF → Rate limiting rules → Create rule
Ini lever anti-scraping-massal utama.
- **Name:** `Anti-scrape read throttle`
- **If incoming requests match** (Edit expression / "Expression Preview"):
  ```
  (starts_with(http.request.uri.path, "/api/") or starts_with(http.request.uri.path, "/berita/") or starts_with(http.request.uri.path, "/sorotan/") or http.request.uri.path eq "/search") and not cf.client.bot
  ```
  > `and not cf.client.bot` mengecualikan bot terverifikasi (Googlebot dsb).
  > Field `cf.client.bot` ada di paket Pro+. Di paket Free, hapus bagian itu —
  > ambang 100/menit cukup tinggi sehingga Googlebot normal jarang kena, dan
  > Bot Fight Mode sudah mengecualikan verified bot.
- **Rate:** requests exceed **100** per **1 minute**
- **Counting characteristics:** **IP** (centang juga JA4 bila ada)
- **Then take action:** **Managed Challenge** (atau Block)
- **Duration / mitigation timeout:** **10 minutes**

## 3. Custom Rule — tantang User-Agent mencurigakan
Security → WAF → Custom rules → Create rule
- **Name:** `Challenge bad user-agents`
- **Expression:**
  ```
  (http.user_agent eq "") or (lower(http.user_agent) contains "python-requests") or (lower(http.user_agent) contains "scrapy") or (lower(http.user_agent) contains "go-http-client") or (lower(http.user_agent) contains "node-fetch") or (lower(http.user_agent) contains "httpclient") or (lower(http.user_agent) contains "java/") or (lower(http.user_agent) contains "axios")
  ```
- **Action:** **Managed Challenge** (jangan Block — supaya tak salah-tembak;
  kalau ada layanan monitoring uptime yang pakai UA ini, whitelist IP-nya dulu).
- Sengaja TIDAK menyertakan `curl`/`wget` (sering dipakai monitor) dan TIDAK
  menyentuh `facebookexternalhit`/`Twitterbot`/`Googlebot` (preview & Search aman).

## 4. Honeypot `/api/trap` → blok IP site-wide
App sudah mem-ban IP yang menyentuh `/api/trap` dari endpoint JSON selama 6 jam.
Untuk **blok penuh di edge** (termasuk halaman HTML), pakai SALAH SATU:

**Opsi A — sederhana (Custom Rule, blok request ke trap):**
- Security → WAF → Custom rules → Create rule
- **Expression:** `http.request.uri.path eq "/api/trap"`
- **Action:** **Block**
- Catatan: ini hanya memblok request KE `/api/trap`, belum mem-ban IP-nya di
  halaman lain. Nilai utamanya: mencegah trap di-abuse + memunculkan IP di log
  Security Events untuk Anda blok manual (IP Access Rules → Block).

**Opsi B — ban IP otomatis site-wide (Cloudflare Worker, advanced):**
Worker yang menulis IP penyentuh `/api/trap` ke sebuah **KV namespace**, lalu
mengecek KV di setiap request dan memblok bila cocok. Minta saya buatkan
skripnya kalau mau menempuh ini (butuh Workers + KV diaktifkan).

---

## Yang TIDAK boleh dilakukan (agar SEO/AdSense aman)
- Jangan blokir `Googlebot`, `Bingbot`, `facebookexternalhit`, `Twitterbot`,
  `WhatsApp`, `LinkedInBot` — Search, Google News, dan preview-share butuh mereka.
- Jangan pasang Managed Challenge global ke `/` untuk semua pengunjung (merusak
  pembaca + AdSense). Selalu batasi via ekspresi (path/rate/UA) seperti di atas.
- Jangan Block (pakai Managed Challenge) untuk aturan berbasis User-Agent —
  UA mudah dipalsukan dan rentan false-positive.

## Verifikasi
- Security → **Events**: pantau rule mana yang memicu, sesuaikan ambang.
- Uji sebagai pembaca biasa (browser) — tak boleh kena challenge.
- `curl https://kartawarta.com/api/articles` berulang cepat → harus kena 429
  (app-layer) lalu Managed Challenge (CF) setelah >100/menit.
