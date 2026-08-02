# Lensaplus "Editorial Authority" Design System Tokens

Dokumen ini berisi spesifikasi lengkap token warna, kelas utilitas Tailwind CSS, dan sistem tipografi untuk **UI/UX Designer Agent**.

---

## 1. Token Warna (Color Tokens)

| Token Name | Color Hex | Tailwind Class | Penggunaan Utama |
|---|---|---|---|
| **Navy Primary** | `#002045` | `bg-primary` / `text-primary` | Header, Footer, Tombol Utama, Badge Kategori |
| **Primary Dark** | `#001530` | `bg-[#001530]` | Latar Belakang Section Sorotan & Bedah Isu |
| **Crimson Secondary** | `#b7102a` | `bg-secondary` / `text-secondary` | Aksen Breaking News, Pilihan Redaksi, Ticker |
| **Surface Light** | `#fcf8f8` | `bg-surface` | Latar Belakang Utama Halaman Beranda & Berita |
| **Surface Container** | `#f3f4f6` | `bg-surface-secondary` | Latar Belakang Sekat Kartu & Card Container |
| **Verified Emerald** | `#059669` | `bg-emerald-600` | Badge Status Berita `VERIFIED` |

---

## 2. Tipografi (Typography)

- **Judul Berita & Headline (Serif):**
  - Font Family: `Playfair Display`, `Merriweather`, serif.
  - Class Name: `font-serif`
  - Sizes: `text-headline-lg` (32px), `text-headline-md` (24px), `text-title-lg` (20px).

- **Antarmuka & Paragraf (Sans-serif):**
  - Font Family: `Inter`, sans-serif.
  - Class Name: `font-sans`
  - Body Sizes: `text-body-md` (16px), `text-body-sm` (14px), `text-label-sm` (12px).

---

## 3. Komponen Layout Responsif

```tsx
/* Hero Editorial Grid: 6-3-3 Column Breakdown */
<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
  <div className="lg:col-span-6 flex flex-col">
    {/* Spotlight utama 16:10 */}
  </div>
  <div className="lg:col-span-3 flex flex-col gap-6 lg:border-x">
    {/* Pilihan Redaksi 3 kolom */}
  </div>
  <div className="lg:col-span-3 flex flex-col gap-6">
    {/* Terhangat 3 kolom */}
  </div>
</div>
```
