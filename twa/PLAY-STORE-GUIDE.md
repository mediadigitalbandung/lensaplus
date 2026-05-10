# Kartawarta — Submit ke Google Play Store via TWA

Panduan lengkap menerbitkan Kartawarta ke Play Store sebagai **Trusted Web Activity (TWA)** — wrapper Android untuk PWA. Tetap satu codebase (Next.js).

---

## Apa itu TWA & kenapa pakai pendekatan ini

- **TWA = Trusted Web Activity**: Chrome Custom Tab versi premium yang menampilkan PWA Anda fullscreen tanpa URL bar, terlihat persis seperti app native.
- **Codebase tetap satu** — yang Anda submit ke Play Store hanya wrapper APK ~1MB. Kontennya tetap dari kartawarta.com.
- **Update content** = push commit ke web. Tidak perlu submit update APK setiap kali ada fitur baru.
- **Update APK** hanya kalau wrapper logic berubah (jarang).
- **Zero "Unsafe app blocked"** karena Google sign + verify TWA APK Anda.

---

## Prasyarat (one-time setup)

### 1. Google Play Console Account ($25 sekali)
- Buka https://play.google.com/console/signup
- Bayar $25 USD via kartu kredit / debit
- Verify identitas (KTP / passport)
- ⏱ Approval ~1-3 hari kerja

### 2. Install Tooling Lokal
```bash
# Java JDK 17+
# Windows: download dari https://adoptium.net/temurin/releases/?version=17
# Verifikasi:
java -version

# Node.js 18+ (sudah ada — Anda pakai untuk Next.js)
node -v

# Bubblewrap CLI (Google's official TWA generator)
npm install -g @bubblewrap/cli

# Verifikasi
bubblewrap --version
```

### 3. Android SDK (Bubblewrap install otomatis kalau belum ada)
Bubblewrap akan tanya saat first run dan auto-download Android SDK + build tools (~1.5GB). Cukup ikuti prompt.

---

## Phase A — Generate APK / AAB

### Langkah A1: Initialize Bubblewrap project
```bash
cd /c/Users/Owen/Documents/Aureon/Kartawarta/Kartawarta/twa
bubblewrap init --manifest=https://kartawarta.com/manifest.json
```

Bubblewrap akan tanya beberapa input:
- **Package name**: `com.kartawarta.app` (sudah di twa-manifest.json — ketik ulang sama persis)
- **App name**: `Kartawarta`
- **Launcher name**: `Kartawarta`
- **App version**: `1.0.0`
- **Display mode**: `standalone`
- **Status bar color**: `#002045`
- **Splash background**: `#ffffff`
- **Icon URL**: `https://kartawarta.com/icons/icon-512.png`
- **Maskable icon URL**: `https://kartawarta.com/icons/icon-512-maskable.png`
- **Signing key location**: `./android.keystore`
- **Signing key alias**: `android`
- **Keystore password**: pilih yang aman (16+ karakter), **CATAT BAIK-BAIK** — kalau hilang, Anda gak bisa update APK lagi selamanya. Backup ke password manager + cloud encrypted storage.
- **Key password**: bisa sama dengan keystore password.

Output: folder `twa/` akan punya:
- `android.keystore` — **KEEP SECRET**, jangan commit ke git
- `app/` — Android project
- `twa-manifest.json` — sudah di-update Bubblewrap

### Langkah A2: Get SHA-256 fingerprint dari keystore
```bash
keytool -list -v -keystore android.keystore -alias android
```
Masukkan keystore password. Cari baris `SHA256:` — copy seluruh fingerprint (format `XX:XX:XX:...`, 64 hex chars dengan colons).

### Langkah A3: Update assetlinks.json
```bash
# Generate file lengkap
bubblewrap fingerprint generateAssetLinks
```
Bubblewrap akan generate `assetlinks.json` dengan format yang benar. Replace isi file `/public/.well-known/assetlinks.json` di repo Kartawarta dengan yang ini.

Atau manual — replace existing file dengan:
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.kartawarta.app",
      "sha256_cert_fingerprints": ["XX:XX:XX:..."]
    }
  }
]
```

Commit & push & deploy:
```bash
cd /c/Users/Owen/Documents/Aureon/Kartawarta/Kartawarta
git add public/.well-known/assetlinks.json
git commit -m "fix(twa): add Play Store assetlinks for com.kartawarta.app"
git push origin master
```

### Langkah A4: Build AAB (Android App Bundle — format Play Store butuh)
```bash
cd /c/Users/Owen/Documents/Aureon/Kartawarta/Kartawarta/twa
bubblewrap build
```
Output: `app-release-bundle.aab` dan `app-release-signed.apk` di folder `twa/`.

⏱ Build pertama: ~5-10 menit (Gradle download dependencies). Build berikutnya: ~1-2 menit.

### Langkah A5: Test APK di device sebelum submit
Install via ADB ke Android phone Anda:
```bash
# Enable Developer Options → USB Debugging di phone
# Connect via USB
adb install app-release-signed.apk
```

Buka app — harus:
- ✅ Buka langsung ke kartawarta.com fullscreen, **tanpa URL bar**
- ✅ Status bar warna navy
- ✅ Splash screen putih dengan logo
- ✅ Long-press icon → 4 shortcut (Berita Terkini, Hukum, Bisnis, Cari)

Kalau masih muncul URL bar — `assetlinks.json` belum verified. Cek:
```bash
adb shell pm get-app-links com.kartawarta.app
```
Harus `verified`. Kalau `legacy_failure`, deploy `assetlinks.json` belum live atau format salah.

---

## Phase B — Submit ke Play Console

### Langkah B1: Create app di Play Console
1. Buka https://play.google.com/console
2. Klik **Create app**
3. Isi:
   - **App name**: Kartawarta
   - **Default language**: Indonesian (id-ID)
   - **App or game**: App
   - **Free or paid**: Free
   - **Declarations**: tick semua box (developer policy, US export laws)

### Langkah B2: Setup Store Listing
**Main Store Listing** menu kiri:
- **App name**: Kartawarta
- **Short description** (max 80 char):
  > Berita digital Bandung — bisnis, ekonomi, hukum, politik. Terverifikasi Dewan Pers.
- **Full description** (max 4000 char):
  ```
  Kartawarta adalah portal berita digital terpercaya untuk Bandung dan Jawa Barat.
  
  📰 LIPUTAN HARIAN
  Berita terbaru bisnis, ekonomi, pemerintahan, hukum, olahraga, hiburan, teknologi, kesehatan, pendidikan, dan peristiwa lokal.
  
  ✅ TERVERIFIKASI DEWAN PERS
  Setiap artikel diverifikasi redaksi profesional dengan label VERIFIED, sumber tercantum, dan kebijakan koreksi yang transparan.
  
  ⚖️ MEDIA HUKUM REGIONAL
  Liputan mendalam putusan pengadilan, regulasi, advokasi, dan analisis hukum dari Bandung dan Jawa Barat.
  
  📊 BACA NYAMAN
  - Hemat data — fitur offline untuk artikel yang sudah dibaca
  - Push notification berita penting
  - Bookmark artikel favorit
  - Cari berita berdasarkan kategori, tag, atau topik
  
  🏛️ TOPIC CLUSTER
  Hub khusus untuk topik penting: Bank BJB, RUPST 2026, Susi Pudjiastuti, dan lainnya.
  
  📅 JADWAL SIDANG
  Pantau jadwal sidang pengadilan di Bandung dan sekitarnya.
  
  💌 NEWSLETTER MINGGUAN
  Berita pilihan editor langsung ke email Anda setiap Senin pagi.
  
  Kunjungi kami di https://kartawarta.com
  ```
- **App icon**: upload `twa/playstore-assets/icon-512.png`
- **Feature graphic**: upload `twa/playstore-assets/feature-graphic.png`
- **Phone screenshots** (min 2, max 8): upload screenshot asli dari device (1080×1920 portrait). Saran konten:
  1. Homepage / hero carousel
  2. Detail artikel dengan featured image
  3. Topic Cluster Bank BJB
  4. Section Berita Terkini
  5. Sorotan box
- **App category**: News & Magazines
- **Tags**: News, Indonesia, Bandung, Hukum
- **Email**: hello@kartawarta.com (atau email Anda)
- **Website**: https://kartawarta.com
- **Privacy policy URL**: https://kartawarta.com/privasi

### Langkah B3: Upload Bundle ke Internal Testing
1. Menu kiri → **Testing → Internal testing**
2. Klik **Create new release**
3. **App bundles**: drag `twa/app-release-bundle.aab` ke upload zone
4. **Release name**: auto (versi 1)
5. **Release notes**: 
   ```
   id-ID: Versi pertama Kartawarta — portal berita digital Bandung & Jawa Barat. Liputan bisnis, ekonomi, hukum, politik, olahraga, dan peristiwa lokal terverifikasi.
   ```
6. Klik **Save → Review release → Start rollout to Internal testing**

### Langkah B4: Add yourself sebagai tester
1. Menu **Testers** tab
2. Email lists → Create email list → tambah email Anda
3. Save → klik link "Copy link" → buka di browser HP Android Anda
4. Akan redirect ke Play Store, install Kartawarta dari sana
5. Test semua flow

### Langkah B5: Lengkapi compliance forms (REQUIRED sebelum production)
Menu kiri → **Policy** → isi semua section:

**Privacy Policy**:
- URL: `https://kartawarta.com/privasi` (sudah ada di site Anda)

**App access**:
- "All functionality is available without restrictions" (kalau publik bisa baca semua)

**Ads**:
- Pilih "Yes, my app contains ads" (Anda punya banner ad)

**Content rating**:
- Klik **Start questionnaire**
- Email: email Anda
- Category: News
- Jawab: tidak ada konten violence/sexual/gambling/illegal substances/etc
- Submit → dapat rating IARC (biasanya "Everyone" atau "Teen")

**Target audience**:
- Age: 18+ atau 13+ (untuk berita serius, recommend 13+)
- Designed for children: No

**News apps declaration**:
- Are you a news publisher? **Yes**
- Provide details: nama redaksi, alamat, badan hukum, link Dewan Pers verification

**Data safety**:
Klik **Start** → answer questionnaire:
- Does your app collect or share any user data? **Yes**
- Data types collected:
  - Personal info: Email (untuk newsletter & komentar)
  - App activity: Page views, search history (analytics)
  - Device IDs: untuk analytics
- Sharing: Tidak (data tidak dijual ke third party)
- Encryption in transit: Yes (HTTPS)
- Users can request data deletion: Yes (lewat /kontak)

**Government apps**: No.

**COVID-19 contact tracing**: No.

### Langkah B6: Submit untuk Production Review
Setelah Internal Testing OK + semua compliance form filled:
1. Menu **Production**
2. **Create new release**
3. Promote dari Internal Testing release (bisa langsung pakai bundle yang sama)
4. **Countries / regions**: pilih Indonesia (atau worldwide kalau mau)
5. **Save → Send for review**

⏱ **Review time**: 1-7 hari (biasanya 2-3 hari untuk first submit). Kalau ada issue, Google email Anda dengan detail yang harus difix.

### Langkah B7: Setelah approved
- App live di Play Store
- Search "Kartawarta" akan muncul
- Direct URL: `https://play.google.com/store/apps/details?id=com.kartawarta.app`

---

## Phase C — Update aplikasi di kemudian hari

**Update konten** (artikel, fitur, layout, dll):
- Cukup `git push` ke master → CI deploy ke kartawarta.com
- TWA users akan langsung lihat versi baru (karena app cuma wrapper, kontent dari web)
- **Tidak perlu** submit ulang ke Play Store

**Update wrapper** (sangat jarang — biasanya cuma kalau ganti package name, signing, atau add fitur native baru):
```bash
cd twa
bubblewrap update                    # update wrapper version
# Edit twa-manifest.json: increment appVersionCode
bubblewrap build                     # generate AAB baru
# Upload AAB ke Play Console → Production → New release
```

---

## Aset yang sudah saya siapkan

| File | Lokasi | Status |
|---|---|---|
| TWA manifest template | `twa/twa-manifest.json` | ✅ Ready (Bubblewrap akan baca ini) |
| App icon 512×512 | `twa/playstore-assets/icon-512.png` | ✅ Ready |
| Feature graphic 1024×500 | `twa/playstore-assets/feature-graphic.png` | ✅ Ready (auto-generated dari logo + brand) |
| Phone screenshots | `twa/playstore-assets/phone-screenshot-*.png` | ⚠️ Placeholder — **GANTI dengan screenshot asli** |
| Generation script | `tools/gen-playstore-assets.mjs` | ✅ Re-runnable |
| `assetlinks.json` template | `public/.well-known/assetlinks.json` | ⚠️ Update setelah Anda generate keystore (Phase A3) |

---

## Yang harus Anda kerjakan manual

### Sekarang (sebelum mulai)
1. ☐ Bayar $25 USD untuk Play Console account → tunggu approval 1-3 hari
2. ☐ Install Java JDK 17+ + Bubblewrap CLI di laptop Anda
3. ☐ Pikirkan keystore password yang aman + tempat backup-nya (password manager + cloud encrypted)

### Setelah Play Console approved
4. ☐ Run `bubblewrap init` (Phase A1) — buat keystore + Android project
5. ☐ Update `assetlinks.json` dengan SHA-256 dari keystore (Phase A3) → push ke production
6. ☐ Build AAB (`bubblewrap build`)
7. ☐ Test di device Anda (Phase A5)
8. ☐ Ganti placeholder screenshots dengan screenshot asli (5 minimal, paling bagus 8)
9. ☐ Create app di Play Console + isi store listing (Phase B1-B2)
10. ☐ Upload AAB ke Internal Testing (Phase B3-B4)
11. ☐ Isi semua compliance form (Phase B5)
12. ☐ Submit ke Production review (Phase B6)
13. ☐ Tunggu 2-7 hari → app live di Play Store

### Total waktu Anda:
- **Active work**: ~3-4 jam (split jadi 2-3 sesi)
- **Wait time**: $25 approval (1-3 hari) + Production review (2-7 hari)
- **Total dari payment ke app live**: ~1 minggu

---

## Troubleshooting umum

**"Bubblewrap init fails — JDK version error"**
Bubblewrap butuh JDK 17. Kalau Anda punya JDK 11, install ulang ke 17 (atau pakai SDKMAN/jenv).

**"App muncul URL bar walau sudah install"**
`assetlinks.json` belum verified. Pastikan:
- File dapat diakses publik: `curl https://kartawarta.com/.well-known/assetlinks.json`
- SHA-256 fingerprint **persis sama** (case-sensitive, dengan semua colons)
- Sudah deploy ke production sebelum install APK
- Restart app setelah deploy

**"Play Console reject — privacy policy missing/invalid"**
URL `https://kartawarta.com/privasi` harus accessible publik (tidak login-walled), berbahasa Indonesia (atau English), dan menjelaskan:
- Data apa yang dikumpulkan
- Untuk apa
- Disimpan berapa lama
- Cara user request delete

**"Reject — sensitive permissions not justified"**
TWA standar gak butuh permission sensitif (camera/location/contacts). Kalau Bubblewrap auto-add, edit `twa/app/src/main/AndroidManifest.xml` hapus yang gak perlu.

**"Stuck di review > 7 hari"**
- Kontak Google Play Support via Console
- Biasanya cuma butuh follow-up email

---

## Tips bonus

### Branding lebih kuat di Play Store
- Phone screenshots dengan **caption text overlay** (mis. "Berita Terverifikasi Dewan Pers", "Liputan Mendalam") jauh lebih convert daripada raw screenshot
- Tool gratis: bikin di Figma / Canva, export 1080×1920

### Install conversion booster
- Setelah app live, tambahin link "Install di Play Store" di footer Kartawarta — boost install rate dari pembaca website existing

### Localization (kalau mau Bahasa Inggris juga)
- Play Console support per-language listings
- Useful kalau target ekspor ke pembaca diaspora Indonesia

---

Kalau ada step yang stuck atau output bubblewrap error, kirim screenshot/log — saya bantu debug.
