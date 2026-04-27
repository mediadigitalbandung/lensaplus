# SEO Setup — Kartawarta

Panduan setup eksternal yang **tidak bisa dikerjakan dari kode**: Google Indexing API, Bing Webmaster, Yandex, social profile URLs untuk Knowledge Graph.

Audit infrastruktur SEO Kartawarta sendiri sudah lengkap (sitemap, news-sitemap, robots, JSON-LD, OG, IndexNow, dynamic OG image, Sorotan, dst). Yang dokumentasi ini cover adalah **konfigurasi pihak ketiga** yang membutuhkan login akun masing-masing.

---

## 1. Google Search Console (verify ownership)

Verifikasi sudah ada di kode (`<meta name="google-site-verification" content="aOYlnEshfJKwCD4v8OePC3vgPACRIRt2bO5s9dziFj0" />`).

**Action:**
1. Buka https://search.google.com/search-console
2. Add property → URL prefix: `https://kartawarta.com`
3. Pilih method **HTML tag** → token harus match `aOYlnEshfJKwCD4v8OePC3vgPACRIRt2bO5s9dziFj0` (sudah live di production)
4. Klik Verify
5. Setelah verified, **submit sitemaps:**
   - `https://kartawarta.com/sitemap.xml`
   - `https://kartawarta.com/news-sitemap.xml`

---

## 2. Google Indexing API (auto-submit saat publish)

Tanpa setup ini, setiap artikel yang publish **gagal** submit ke Google Indexing — error log: `"Google Indexing not configured (missing google_credentials_json)"`.

### Step-by-step

1. **Buat Google Cloud Project**
   - https://console.cloud.google.com/projectcreate
   - Project name: `kartawarta-seo` (bebas)

2. **Aktifkan Indexing API**
   - https://console.cloud.google.com/apis/library/indexing.googleapis.com
   - Klik **Enable**

3. **Buat Service Account**
   - https://console.cloud.google.com/iam-admin/serviceaccounts
   - Create Service Account
   - Name: `kartawarta-indexer`
   - Role: skip (tidak perlu untuk Indexing API)
   - Klik **Done**

4. **Generate JSON key**
   - Klik service account yang baru dibuat
   - Tab **Keys** → Add Key → Create new key → Type **JSON** → Create
   - File JSON otomatis di-download. Buka, copy seluruh isinya.

5. **Tambahkan service account ke GSC sebagai Owner**
   - Catat `client_email` dari JSON (format: `kartawarta-indexer@kartawarta-seo.iam.gserviceaccount.com`)
   - Buka https://search.google.com/search-console
   - Pilih property `kartawarta.com` → Settings → Users and permissions
   - **Add user** → email = `client_email` → permission **Owner**
   - **Penting:** harus **Owner**, bukan Full/Restricted, agar Indexing API bisa submit URL.

6. **Paste credentials ke /panel/pengaturan Kartawarta**
   - Login sebagai SUPER_ADMIN
   - Buka `/panel/pengaturan`
   - Cari section **AI / Integration / Google**
   - Field **`google_credentials_json`** → paste seluruh isi JSON file
   - Save

7. **Verify via dashboard**
   - Buka `/panel/seo`
   - Klik **Test Credentials** — harus return ✓

8. **Quota:** 200 URL/hari (free). Cukup untuk media skala kecil-menengah. Kalau perlu lebih, request quota increase di Google Cloud Console.

---

## 3. Bing Webmaster Tools (opsional tapi recommended)

IndexNow sudah jalan otomatis (Bing membaca pings). Verifikasi domain di BWT memberi akses ke insight + crawl stats.

1. https://www.bing.com/webmasters
2. Add a site → `https://kartawarta.com`
3. Pilih method **Meta tag** → copy token (format: `0123ABC456...`)
4. Edit `.env` di VPS:
   ```bash
   ssh root@145.79.15.99 'cd /var/www/kartawarta && echo "BING_VERIFICATION=PASTE_TOKEN_HERE" >> .env && pm2 restart kartawarta'
   ```
5. Klik Verify di BWT — meta tag akan auto-emit ke `<head>` setelah pm2 restart
6. Submit sitemaps yang sama dengan GSC

---

## 4. Yandex Webmaster (opsional, kalau target market relevan)

1. https://webmaster.yandex.com
2. Add site → ambil token verification
3. Edit `.env`:
   ```bash
   ssh root@145.79.15.99 'cd /var/www/kartawarta && echo "YANDEX_VERIFICATION=PASTE_TOKEN" >> .env && pm2 restart kartawarta'
   ```

---

## 5. Social Profile URLs untuk Knowledge Graph

Schema.org `NewsMediaOrganization.sameAs` — biar Google SERP bisa surface social profile cards Kartawarta.

Ada 2 cara isi:

### Cara A — bulk (recommended)

```bash
ssh root@145.79.15.99 'cd /var/www/kartawarta && cat >> .env << EOF
KARTAWARTA_SOCIAL_URLS=https://twitter.com/kartawarta,https://www.facebook.com/kartawarta,https://www.instagram.com/kartawarta,https://www.linkedin.com/company/kartawarta,https://www.youtube.com/@kartawarta,https://www.tiktok.com/@kartawarta
EOF
pm2 restart kartawarta'
```

### Cara B — individual env vars

```bash
KARTAWARTA_TWITTER_URL=https://twitter.com/kartawarta
KARTAWARTA_FACEBOOK_URL=https://www.facebook.com/kartawarta
KARTAWARTA_INSTAGRAM_URL=https://www.instagram.com/kartawarta
KARTAWARTA_LINKEDIN_URL=https://www.linkedin.com/company/kartawarta
KARTAWARTA_YOUTUBE_URL=https://www.youtube.com/@kartawarta
KARTAWARTA_TIKTOK_URL=https://www.tiktok.com/@kartawarta
```

Sesuaikan dengan handle yang **benar-benar dipakai**. Profile yang tidak ada cukup hilangkan baris-nya.

---

## 6. Verify hasil

```bash
# Sitemap reachable
curl -sI https://kartawarta.com/sitemap.xml

# Bing meta (after .env + restart)
curl -s https://kartawarta.com | grep msvalidate.01

# Yandex meta
curl -s https://kartawarta.com | grep yandex-verification

# Google Indexing API working — buka /panel/seo, klik Test Credentials

# sameAs di JSON-LD
curl -s https://kartawarta.com | grep -o '"sameAs":\[[^]]*\]'
```

Atau jalankan automated audit:

```bash
npm run test:e2e -- seo-audit.spec.ts
```

---

## Reference

- Google Indexing API docs: https://developers.google.com/search/apis/indexing-api/v3/using-api
- IndexNow spec: https://www.indexnow.org/documentation
- schema.org NewsArticle: https://schema.org/NewsArticle
- schema.org NewsMediaOrganization: https://schema.org/NewsMediaOrganization
