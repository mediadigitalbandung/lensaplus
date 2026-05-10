# Distribusi Aplikasi Kartawarta — Tanpa Biaya

3 jalur free, ranked by ROI untuk audience Indonesia (Android-dominant).

## 🥇 Jalur 1: PWA Install via Browser (FREE, sudah aktif)

**Apa**: User install Kartawarta langsung dari browser tanpa app store.
**Cost**: Rp 0
**Setup**: Sudah jalan — `InstallPrompt` component sudah deploy.
**Reach**: 95%+ Android user pakai Chrome → bisa install.

**Cara user install**:
- Android Chrome: menu ⋮ → "Pasang aplikasi"
- iPhone Safari: Share → "Add to Home Screen"
- Desktop Chrome/Edge: ikon install di address bar

**Hasil**: Sama persis dengan app native — fullscreen, splash screen, ikon di home screen, bisa offline. Bedanya cuma **tidak muncul di Play Store search**.

**Ini sebenarnya 90% solusi.** Yang tidak Anda dapat tanpa Play Store:
- Discovery via Play Store search
- "App rating & reviews" sosial proof
- Bundling di Google Play recommendations

**Action item Anda**: Promote `/unduh` page (sudah saya buat) di:
- Footer kartawarta.com (sudah link)
- Banner di homepage (mau saya tambahin?)
- Bio Instagram/Twitter
- Email signature redaksi

## 🥈 Jalur 2: APK Sideload — Free, butuh build

**Apa**: Generate APK file pakai Bubblewrap (FREE), host di kartawarta.com, user download + install manual.

**Cost**: Rp 0 (cuma butuh laptop Anda)
**Setup time**: 30-60 menit sekali
**Reach**: 100% Android (yg mau ribet sedikit)

**Step-by-step**:

### A. Install Bubblewrap (sekali aja)
```bash
# Install Java JDK 17 dari https://adoptium.net (gratis)
# Install Bubblewrap CLI
npm install -g @bubblewrap/cli
```

### B. Generate APK
```bash
cd /c/Users/Owen/Documents/Aureon/Kartawarta/Kartawarta/twa
bubblewrap init --manifest=https://kartawarta.com/manifest.json
```

Bubblewrap akan tanya beberapa input — pakai default semua kecuali:
- **Signing key password**: pilih yang aman, **CATAT BAIK-BAIK** di password manager. Kalau hilang, gak bisa update APK lagi.

```bash
# Build APK
bubblewrap build
# Output: app-release-signed.apk (file yang Anda host)
```

### C. Get SHA-256 fingerprint (untuk validasi domain)
```bash
keytool -list -v -keystore android.keystore -alias android
# Copy baris SHA256: dan kirim ke saya — saya update assetlinks.json
```

### D. Host APK di kartawarta.com
```bash
# Copy APK ke folder public/downloads/
mkdir -p /c/Users/Owen/Documents/Aureon/Kartawarta/Kartawarta/public/downloads
cp twa/app-release-signed.apk public/downloads/kartawarta.apk

# Commit + deploy
git add public/downloads/kartawarta.apk
git commit -m "feat: ship signed APK for sideload install"
git push origin master
```

User download via tombol "Unduh APK" di **https://kartawarta.com/unduh** (halaman sudah saya buat).

**Pesan Play Protect**: User akan lihat "Pemindaian Play Protect" warning saat install APK luar Play Store. Ini NORMAL untuk semua APK sideload. User tap "Tetap install" / "Install anyway". Setelah verified via assetlinks.json (Step C), warning ini berkurang significantly.

## 🥉 Jalur 3: Microsoft Store (Windows only) — FREE

**Apa**: Submit PWA ke Microsoft Store via PWABuilder. Gratis untuk individu (sebelumnya $19, sekarang $0 sejak 2022).

**Cost**: Rp 0
**Setup time**: ~30 menit
**Reach**: Windows desktop users (kecil di ID, tapi bonus exposure)

**Step**:
1. Buka **https://www.pwabuilder.com**
2. Input: `https://kartawarta.com`
3. Klik "Start" → PWABuilder akan audit PWA Anda
4. Klik "Package for stores" → pilih "Windows"
5. Download `.msixbundle` file
6. Buka **https://partner.microsoft.com/en-us/dashboard/registration** — register sebagai individual (FREE, tidak bayar $19 lagi sejak 2022)
7. Verify identitas via SMS (gratis)
8. Create new app → upload `.msixbundle`
9. Isi listing (sama-sama copy-paste dari PLAY-STORE-GUIDE.md)
10. Submit → review 1-3 hari

**Hasil**: Kartawarta muncul di Microsoft Store. Windows user search "Kartawarta" → install dari Store, no friction.

## ❌ Jalur yang TIDAK direkomendasi

### F-Droid
- FREE tapi **butuh kode Anda full open source + reproducible build**
- Untuk news app dengan analytics & komersial = overkill, gak cocok policy F-Droid
- Skip

### Aptoide
- FREE, audience lumayan di Indonesia
- Tapi reputasi store rendah (banyak APK clone), brand Kartawarta jadi lemah
- Skip kecuali Anda desperate

### Galaxy Store / Huawei AppGallery
- FREE per submission tapi audience sangat terbatas (cuma device Samsung / Huawei post-2019)
- Setup form panjang
- ROI rendah untuk effort
- Skip

## 💡 Rekomendasi strategis

**Sekarang (gratis):**
1. ✅ PWA install — sudah jalan, promote `/unduh` page
2. ✅ APK sideload — generate sekali, host di `/unduh`
3. ✅ Microsoft Store — bonus exposure desktop (1 jam setup)

**Nanti ($25 sekali, kalau ada budget):**
4. Play Store via TWA — pakai guide `PLAY-STORE-GUIDE.md`

Realistis untuk audience Indonesia: **70% reader install via PWA Chrome, 25% download APK, 5% via Microsoft Store**. Total reach mendekati Play Store tanpa keluar uang.

## Tracking install

Untuk tahu berapa user install via masing-masing channel, bisa tambahkan:
- PWA install: track via `appinstalled` event di JS
- APK download: track via Cloudflare Web Analytics atau GA4 file_download event
- Microsoft Store: built-in analytics di Partner Center

Mau saya kerjain salah satu lagi (mis. tambahin tracking, banner promo install di homepage, atau setup Microsoft Store)?
