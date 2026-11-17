# SOP Desain Antarmuka Lensaplus — *Editorial Authority*

> **Dokumen Standar Baku Desain (Design SOP)** untuk seluruh halaman publik (`src/app/**`), komponen UI (`src/components/**`), dan panel redaksi (`/panel/*`).
> Wajib dipatuhi oleh seluruh developer maupun AI agent sebelum menulis atau mengubah UI apa pun.

---

## 1. Filosofi Visual: Editorial Typographic Discipline

Lensaplus adalah media berita digital nasional berstandar jurnalistik tinggi. Kewibawaan media lahir dari:
- **Tipografi yang tegas dan terbaca** (judul serif/geometris yang kuat, body teks yang nyaman),
- **Ruang putih (*whitespace*) yang lega**,
- **Garis batas tipis (`border-border`) dan garis aksen editorial (`border-l-4 border-primary`)**,
- **Hierarki informasi yang jernih** tanpa ornamen visual yang ramai atau dekoratif berlebihan.

Sebaliknya, tampilan yang penuh kotak ikon warna-warni, taburan ikon di setiap baris teks, dan label teks ber-highlight warna pastel akan membuat situs terlihat seperti template dashboard generik — **bukan** media berita otoritatif.

---

## 2. Tiga Aturan Emas (Wajib & Tidak Bisa Ditawar)

### Aturan #1 — Dilarang Keras Icon dengan Background Lingkaran atau Persegi

Jangan pernah membungkus icon (`lucide-react` atau inline `<svg>`) di dalam kontainer berbentuk lingkaran (`rounded-full`) maupun persegi/kotak (`rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`) yang memiliki background warna solid, tint pastel, maupun gradien.

**❌ SALAH:**
```tsx
// Icon dalam kotak persegi berwarna
<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
  <Scale size={18} />
</div>

// Icon dalam lingkaran berwarna
<div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
  <AlertTriangle className="h-8 w-8 text-red-600" />
</div>

// Icon di dalam chip tombol berlatar lingkaran
<span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
  <Link2 size={10} />
</span>
```

**✅ BENAR:**
```tsx
// Tampilkan icon secara polos/telanjang (bare icon) bila memang diperlukan
<AlertTriangle className="h-9 w-9 text-red-600" />
<Bookmark size={16} className="text-on-surface-variant hover:text-primary" />

// Untuk section header, hapus kotak icon — pakai garis aksen editorial atau teks saja
<h2 className="font-serif text-headline-sm sm:text-headline-md text-on-surface border-l-4 border-primary pl-3">
  Berita Terkini
</h2>
```

**Klarifikasi pengecualian (bukan icon box):**
1. **Avatar Identitas / Foto Profil / Monogram Huruf:** Lingkaran atau kotak berisi foto profil (`<img>`) atau huruf inisial orang/emiten (mis. inisial penulis `"R"`, kode ticker `"BBCA"`) adalah avatar identitas, bukan simbol icon UI.
2. **Logo Brand Utama (`<Logo />`):** Emblem lensa hitam di Header/Footer/Login adalah logomark resmi brand Lensaplus.
3. **Tombol Carousel/Modal di Atas Media:** Icon panah navigasi (`ChevronLeft`/`ChevronRight`), `Play`, atau tutup (`X`) di atas foto/video tetap **tanpa** kontainer lingkaran/persegi berwarna — gunakan warna kontras + `drop-shadow` yang jelas di atas overlay gelap.

---

### Aturan #2 — Penggunaan Icon Harus Minimal (Jangan Kebanyakan)

Jangan menaruh icon secara berlebihan atau hanya sebagai pemanis (*decorative clutter*). Jika teks sudah cukup jelas menjelaskan konteks, **hapus icon-nya**.

**❌ DILARANG:**
1. **Icon pada judul halaman (`<h1>`) dan judul section (`<h2>`/`<h3>`):** Misal `<Flame /> Berita Terkini`, `<Sparkles /> Pilihan Editor`, `<BookOpen /> Rangkuman Pintar`, `<Layers /> Desk Sorotan`, `<Compass /> Telusuri Topik`, `<Users /> Pejabat Publik`, `<Scale /> Regulasi`, `<MessageCircle /> Komentar`, atau icon box pada `SectionHeader` dashboard.
2. **Icon jam (`<Clock />`) dan mata (`<Eye />`) berulang-ulang pada daftar artikel:** Tampilkan waktu terbit dan jumlah baca dalam format teks bersih dengan pemisah `·` atau `/` (mis. `Redaksi Lensaplus · 2j lalu · 1.240 dilihat`).
3. **Icon pada setiap kartu kategori, item navigasi daftar, atau baris metadata:** Misal memetakan 12 kategori ke 12 icon di beranda/footer (`/topik`, `categoryIconMap`), atau memberi icon pada setiap item tautan di sidebar/daftar regulasi/kalender emiten.
4. **Icon pada setiap kartu KPI statistik atau daftar fitur:** Gunakan tipografi angka yang kuat, garis aksen atas tipis, dan label yang jelas tanpa harus memasang ikon di setiap kartu.

**✅ DIPERBOLEHKAN (Hanya Untuk Fungsi UI Nyata):**
- **Kontrol antarmuka tanpa teks atau ikon aksi universal:** `Menu` (hamburger mobile), `X` (tutup modal/drawer), `Search` (di dalam input pencarian), `ChevronLeft`/`ChevronRight`/`ArrowLeft` (navigasi slider/pagination/back), `Play`/`Pause` (pemutar video/carousel), `Eye`/`EyeOff` (toggle visibilitas password).
- **Aksi toolbar & tabel admin:** `Bookmark`, `Share2`, `Printer`, `Download`, `Edit`, `Trash2`, `Plus`, `RefreshCw` pada tombol aksi fungsional (maksimal 1 icon per tombol, jangan dobel dengan icon di label/judul).
- **Indikator status kritis / loading:** `Loader2` (`animate-spin`) saat proses async, `AlertTriangle` pada dialog konfirmasi berbahaya atau halaman error boundary.
- **Prinsip uji cepat:** Sebelum menambah icon, tanya: *"Apakah pengguna gagal paham atau gagal klik jika icon ini dihapus?"* Jika jawabannya tidak, **jangan pakai icon**.

---

### Aturan #3 — Dilarang Text dengan Background Highlight Warna

Jangan memberi blok background warna highlight (pastel, tint transparan, maupun solid pill/chip) di belakang **teks label, kategori, tag, sudut pandang (angle), status, persentase perubahan, tautan teks ("Lihat Semua"), hasil highlight pencarian (`<mark>`), atau kotak catatan/callout**.

**❌ SALAH:**
```tsx
// Kategori / label pakai pill warna
<span className="rounded-full bg-primary/5 px-3 py-1 text-xs font-bold text-primary">
  Bisnis & Ekonomi
</span>

// Badge warna-warni (rainbow) untuk angle / regulasi / pejabat
<span className="rounded-full bg-blue-50 text-blue-700 border-blue-200 px-2.5 py-1">
  Kronologi
</span>

// Tautan "Lihat Semua" diberi highlight pill
<Link href="/berita" className="rounded-full bg-primary/5 px-4 py-2 text-primary">
  Lihat Semua
</Link>

// Highlight kata kunci pencarian pakai latar warna
<mark className="bg-primary-light text-primary px-0.5">{keyword}</mark>

// Kotak catatan / Baca Juga / alert pakai background tint warna
<div className="rounded-lg bg-primary-light/40 border-l-4 border-primary p-4">...</div>
```

**✅ BENAR (Standar Pengganti Editorial):**

| Jenis Elemen | Standar Pengganti Bebas Highlight |
|---|---|
| **Kategori / Eyebrow / Sub-label** | Teks polos uppercase dengan warna langsung: `<span className="text-[11px] font-bold uppercase tracking-widest text-secondary">Bisnis & Ekonomi</span>` |
| **Kategori & Verified di Hero Foto** | Jangan tempel stiker/pill di atas foto. Taruh di blok teks tepat di atas judul: `BISNIS & EKONOMI · TERVERIFIKASI` dalam teks bersih. |
| **Sudut Pandang (Sorotan) / Jenis** | Teks uppercase berwarna langsung (`text-[11px] font-bold uppercase tracking-wider text-secondary` atau `text-primary`), tanpa blok warna di belakang teks. |
| **Tag (`#topik`) & Chip Netral** | Teks berwarna `text-primary hover:underline` atau border netral tipis tanpa isi highlight warna (`border border-border bg-transparent text-on-surface-variant hover:border-primary hover:text-primary`). |
| **Status (`Aktif`, `Berlaku`, `Draft`, `Menunggu`, `Error`)** | Teks uppercase tegas dengan warna semantik (`text-emerald-700`, `text-amber-700`, `text-red-700`, `text-txt-muted`) — opsional ditambah titik status kecil (`h-2 w-2 rounded-full`) untuk `LIVE` tanpa memblok teks dengan warna. |
| **Tautan Sekunder (`Lihat Semua`, `Jelajahi`)** | Teks link bersih `text-label-md font-bold uppercase tracking-wider text-primary hover:text-primary-dark` (di area gelap: `text-white/85 hover:text-secondary`). |
| **Tab Filter Aktif (`Terbaru` / `Semua` / Kategori)** | Garis bawah aktif (`border-b-2 border-primary text-primary font-bold`) atau tombol outline bersih (`border border-primary text-primary font-semibold bg-white` vs `border border-border text-txt-secondary`), bukan pill warna pastel. |
| **Angka Perubahan Pasar (`+1.25%`)** | Teks monospace berwarna (`text-emerald-600` / `text-red-600`) di atas kartu putih berborder netral — tidak dibungkus kotak `bg-emerald-50` atau `bg-red-50`. |
| **Highlight Pencarian (`<mark>`)** | `<mark className="bg-transparent font-bold text-primary underline decoration-primary/50 underline-offset-2">` |
| **Blok `Baca Juga` / Catatan / Alert Form** | Gunakan garis aksen vertikal kiri (`border-l-4 border-primary pl-4 py-2 bg-transparent`) atau kartu putih berborder (`border border-border border-l-4 border-l-red-600 bg-white px-4 py-3 text-red-700`) tanpa warna latar pastel. |

**Pengecualian:**
- **Tombol Aksi Utama (`<button>` / CTA utama)** seperti `.btn-primary` (`Masuk`, `Simpan`, `Kirim`, `Langganan`, `Lihat Berita Lainnya`), `.btn-urgent`, dan aksi destruktif tetap menggunakan fill warna solid karena merupakan tombol perintah interaktif, bukan highlight teks.
- **Teks Overlay Wajib di atas Foto** (jika ada komponen slider yang meletakkan judul langsung di atas foto): gunakan gradient scrim gelap (`bg-gradient-to-t from-black/90 ...`) sehingga teks putih terbaca tanpa perlu menempel kotak highlight warna di belakang label kategorinya.

---

## 3. Token Desain Resmi (`tailwind.config.ts` & `src/app/globals.css`)

Selalu gunakan token semantik dari `tailwind.config.ts`, jangan hardcode warna hex atau kelas warna acak (seperti `bg-blue-50`, `bg-purple-100`, `bg-amber-50` untuk dekorasi):
- **Surface:** `bg-surface` (`#FAF9F6`), `bg-surface-container-lowest` (`#ffffff`), `bg-surface-container-low` (`#F5F4F0`)
- **Brand:** `primary` (`#2E1065`), `secondary` (`#10B981`), `tertiary` (`#F43F5E`) — catatan: gunakan kelas token `text-primary`, `bg-primary`, `border-primary`, dll.
- **Text:** `text-on-surface` (`#1C1917`), `text-on-surface-variant` (`#57534E`), `text-txt-primary`, `text-txt-secondary`, `text-txt-muted`
- **Border:** `border-border`, `border-stone-200`
- **Font:** `font-serif` (heading & judul berita) dan `font-sans` (teks isi & antarmuka)
- **Light-mode only:** Jangan gunakan modifier `dark:*`.

---

## 4. Checklist Audit Pra-Commit (Wajib Lolos)

Sebelum menyelesaikan perubahan UI atau membuat PR/commit, pastikan seluruh poin ini terpenuhi:

1. **Zero Icon Boxes:** Tidak ada `flex h-* w-* items-center justify-center rounded-* bg-*` yang membungkus komponen icon `lucide-react` atau `<svg>` simbol.
2. **Minimal Icon Discipline:**
   - Tidak ada icon di `<h1>`, `<h2>`/`<h3>` section header, timestamp (`Clock`), maupun counter view (`Eye`) yang berulang di daftar artikel.
   - Tidak ada peta icon dekoratif per kategori/fitur di halaman indeks atau beranda.
3. **Zero Text Highlight Backgrounds:**
   - Tidak ada kategori, label, tag, badge status, sudut pandang, tautan `"Lihat Semua"`, atau `<mark>` yang memakai `bg-primary/5`, `bg-primary/10`, `bg-primary-light`, `bg-secondary/10`, `bg-emerald-50`, `bg-blue-50`, `bg-amber-50`, `bg-yellow-50`, `bg-red-50`, `bg-purple-50`, atau `bg-stone-100` di belakang teks.
   - `.badge-*` tidak memakai highlight pastel di belakang teks.
4. **Verifikasi Teknis:**
   - `npx tsc --noEmit` lulus dengan 0 error.
   - `npm run build` lulus tanpa error.
   - `npm test` seluruh unit test lulus.
