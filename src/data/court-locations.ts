/**
 * Direktori pengadilan utama di wilayah Bandung.
 *
 * Data referensi publik (Mahkamah Agung, situs masing-masing pengadilan).
 * Beberapa nomor telepon / jam operasional bersifat indikatif — user dapat
 * mengubah via Edit langsung di file ini ketika sudah memverifikasi.
 */

export interface CourtLocation {
  slug: string;
  name: string;
  shortName: string;
  type: "PN" | "PA" | "PT" | "PTUN" | "PTA" | "MIL" | "TIPIKOR" | "MA";
  address: string;
  city: string;
  phone: string;
  email?: string;
  website?: string;
  hours: string;
  mapsUrl: string;
  latLng?: { lat: number; lng: number };
  description: string;
  jurisdiction: string;
}

export const courtLocations: CourtLocation[] = [
  {
    slug: "pn-bandung",
    name: "Pengadilan Negeri Bandung",
    shortName: "PN Bandung",
    type: "PN",
    address: "Jl. LL. RE. Martadinata No.74-80, Citarum, Kec. Bandung Wetan, Kota Bandung, Jawa Barat 40115",
    city: "Kota Bandung",
    phone: "(022) 4203846",
    email: "info@pn-bandung.go.id",
    website: "https://www.pn-bandung.go.id",
    hours: "Senin-Kamis 08:00-16:30, Jumat 08:00-17:00",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Pengadilan+Negeri+Bandung",
    description:
      "Pengadilan tingkat pertama yang mengadili perkara perdata, pidana umum, dan perkara lain di wilayah hukum Kota Bandung.",
    jurisdiction: "Wilayah hukum Kota Bandung dan sekitarnya.",
  },
  {
    slug: "pn-bale-bandung",
    name: "Pengadilan Negeri Bale Bandung",
    shortName: "PN Bale Bandung",
    type: "PN",
    address: "Jl. Jaksa Naranata No.1, Baleendah, Kabupaten Bandung, Jawa Barat 40375",
    city: "Kabupaten Bandung",
    phone: "(022) 5940176",
    email: "info@pn-balebandung.go.id",
    website: "https://www.pn-balebandung.go.id",
    hours: "Senin-Kamis 08:00-16:30, Jumat 08:00-17:00",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Pengadilan+Negeri+Bale+Bandung",
    description:
      "Pengadilan negeri yang mengadili perkara di wilayah hukum Kabupaten Bandung dan Kabupaten Bandung Barat.",
    jurisdiction: "Wilayah hukum Kabupaten Bandung dan Bandung Barat.",
  },
  {
    slug: "pa-bandung",
    name: "Pengadilan Agama Bandung",
    shortName: "PA Bandung",
    type: "PA",
    address: "Jl. Soekarno-Hatta No.714, Jatisari, Buahbatu, Kota Bandung, Jawa Barat 40286",
    city: "Kota Bandung",
    phone: "(022) 7506015",
    email: "info@pa-bandung.go.id",
    website: "https://www.pa-bandung.go.id",
    hours: "Senin-Kamis 08:00-16:30, Jumat 08:00-17:00",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Pengadilan+Agama+Bandung",
    description:
      "Mengadili perkara perdata khusus bagi yang beragama Islam: perceraian, waris, hibah, wasiat, hingga ekonomi syariah.",
    jurisdiction: "Wilayah hukum Kota Bandung.",
  },
  {
    slug: "pt-bandung",
    name: "Pengadilan Tinggi Jawa Barat",
    shortName: "PT Bandung",
    type: "PT",
    address: "Jl. Surapati No.47, Sukaluyu, Cibeunying Kaler, Kota Bandung, Jawa Barat 40123",
    city: "Kota Bandung",
    phone: "(022) 7271694",
    email: "info@pt-bandung.go.id",
    website: "https://www.pt-bandung.go.id",
    hours: "Senin-Kamis 08:00-16:30, Jumat 08:00-17:00",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Pengadilan+Tinggi+Bandung",
    description:
      "Pengadilan tingkat banding untuk perkara perdata dan pidana se-Provinsi Jawa Barat.",
    jurisdiction: "Seluruh Provinsi Jawa Barat.",
  },
  {
    slug: "ptun-bandung",
    name: "Pengadilan Tata Usaha Negara Bandung",
    shortName: "PTUN Bandung",
    type: "PTUN",
    address: "Jl. Diponegoro No.34, Citarum, Bandung Wetan, Kota Bandung, Jawa Barat 40115",
    city: "Kota Bandung",
    phone: "(022) 4220097",
    email: "info@ptun-bandung.go.id",
    website: "https://www.ptun-bandung.go.id",
    hours: "Senin-Kamis 08:00-16:30, Jumat 08:00-17:00",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=PTUN+Bandung",
    description:
      "Mengadili sengketa tata usaha negara antara warga dengan pejabat pemerintah di wilayah Jawa Barat.",
    jurisdiction: "Seluruh Provinsi Jawa Barat.",
  },
  {
    slug: "pta-bandung",
    name: "Pengadilan Tinggi Agama Bandung",
    shortName: "PTA Bandung",
    type: "PTA",
    address: "Jl. Soekarno-Hatta No.714, Jatisari, Buahbatu, Kota Bandung, Jawa Barat 40286",
    city: "Kota Bandung",
    phone: "(022) 7563918",
    email: "info@pta-bandung.go.id",
    website: "https://www.pta-bandung.go.id",
    hours: "Senin-Kamis 08:00-16:30, Jumat 08:00-17:00",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Pengadilan+Tinggi+Agama+Bandung",
    description:
      "Pengadilan tingkat banding untuk perkara agama (perdata Islam) se-Provinsi Jawa Barat.",
    jurisdiction: "Seluruh Provinsi Jawa Barat.",
  },
  {
    slug: "pn-tipikor-bandung",
    name: "Pengadilan Tindak Pidana Korupsi Bandung",
    shortName: "Tipikor Bandung",
    type: "TIPIKOR",
    address: "Jl. LL. RE. Martadinata No.74-80, Citarum, Bandung Wetan, Kota Bandung, Jawa Barat 40115",
    city: "Kota Bandung",
    phone: "(022) 4203846",
    website: "https://www.pn-bandung.go.id",
    hours: "Senin-Kamis 08:00-16:30, Jumat 08:00-17:00",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Pengadilan+Tipikor+Bandung",
    description:
      "Pengadilan khusus yang menyatu dengan PN Bandung untuk mengadili perkara tindak pidana korupsi di wilayah Jawa Barat.",
    jurisdiction: "Seluruh Provinsi Jawa Barat.",
  },
  {
    slug: "dilmil-ii-09-bandung",
    name: "Pengadilan Militer II-09 Bandung",
    shortName: "Dilmil II-09 Bandung",
    type: "MIL",
    address: "Jl. Aceh No.66, Babakan Ciamis, Sumur Bandung, Kota Bandung, Jawa Barat 40117",
    city: "Kota Bandung",
    phone: "(022) 4205207",
    hours: "Senin-Kamis 08:00-15:30, Jumat 08:00-16:00",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Pengadilan+Militer+Bandung",
    description:
      "Mengadili perkara pidana yang dilakukan oleh anggota TNI dan pihak yang dipersamakan dengan prajurit.",
    jurisdiction: "Wilayah Jawa Barat dan sekitarnya.",
  },
];

export function getCourtLocationBySlug(slug: string): CourtLocation | undefined {
  return courtLocations.find((c) => c.slug === slug);
}
