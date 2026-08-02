# Lensaplus Schema.org & SEO Microdata Reference

Dokumen ini memuat struktur JSON-LD Schema.org dan spesifikasi payload IndexNow untuk **SEO Automation Specialist Agent**.

---

## 1. Schema.org `NewsMediaOrganization` (Halaman Utama)

```json
{
  "@context": "https://schema.org",
  "@type": "NewsMediaOrganization",
  "@id": "https://lensaplus.com/#organization",
  "name": "Lensaplus",
  "alternateName": "Lensaplus Bandung",
  "url": "https://lensaplus.com",
  "logo": {
    "@type": "ImageObject",
    "url": "https://lensaplus.com/lensaplus-icon.png",
    "width": 512,
    "height": 512
  },
  "description": "Portal berita digital Bandung — bisnis, ekonomi, pemerintahan, hukum, olahraga, hiburan, dan teknologi.",
  "publishingPrinciples": "https://lensaplus.com/pedoman-media",
  "ethicsPolicy": "https://lensaplus.com/kode-etik",
  "areaServed": [
    { "@type": "City", "name": "Bandung" },
    { "@type": "AdministrativeArea", "name": "Jawa Barat" },
    { "@type": "Country", "name": "Indonesia" }
  ]
}
```

---

## 2. Schema.org `NewsArticle` (Halaman Berita)

```json
{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://lensaplus.com/berita/slug-artikel"
  },
  "headline": "Judul Berita Utama",
  "image": ["https://lensaplus.com/uploads/demo/hero-bandung.png"],
  "datePublished": "2026-08-03T00:00:00Z",
  "dateModified": "2026-08-03T00:00:00Z",
  "author": {
    "@type": "Person",
    "name": "Redaksi Lensaplus",
    "url": "https://lensaplus.com/penulis/redaksi"
  },
  "publisher": {
    "@id": "https://lensaplus.com/#organization"
  },
  "description": "Ringkasan berita singkat."
}
```

---

## 3. Payload Protocol IndexNow (`src/lib/seo-auto.ts`)

```json
{
  "host": "lensaplus.com",
  "key": "INDEXNOW_KEY_VALUE",
  "keyLocation": "https://lensaplus.com/INDEXNOW_KEY_VALUE.txt",
  "urlList": [
    "https://lensaplus.com/berita/slug-artikel-baru"
  ]
}
```
