export interface EconomicIndicator {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "stable";
  unit?: string;
  source: string;
  asOf: string;
}

export const EKO_BANDUNG_INDICATORS: EconomicIndicator[] = [
  {
    label: "Inflasi YoY Bandung",
    value: "2.85",
    unit: "%",
    change: "-0.12",
    trend: "down",
    source: "BPS Jawa Barat",
    asOf: "Maret 2026",
  },
  {
    label: "PDRB Kota Bandung",
    value: "Rp 312",
    unit: "Triliun",
    change: "+5.2%",
    trend: "up",
    source: "BPS Jawa Barat",
    asOf: "2025",
  },
  {
    label: "UMK Kota Bandung 2026",
    value: "Rp 4.420.000",
    source: "Pergub Jabar 2025",
    asOf: "1 Januari 2026",
  },
  {
    label: "Tingkat Pengangguran Terbuka",
    value: "8.42",
    unit: "%",
    change: "-0.31",
    trend: "down",
    source: "BPS Jawa Barat",
    asOf: "Februari 2026",
  },
  {
    label: "Penduduk Bandung Raya",
    value: "8.7",
    unit: "Juta jiwa",
    source: "BPS Jawa Barat",
    asOf: "2024 (proyeksi)",
  },
  {
    label: "Pertumbuhan Ekonomi Jabar",
    value: "5.1",
    unit: "%",
    change: "+0.3",
    trend: "up",
    source: "BPS Jawa Barat",
    asOf: "Q4 2025",
  },
];

export const EKO_BANDUNG_SECTORS = [
  { name: "Industri Pengolahan", contribution: 28.5, color: "#3b82f6" },
  { name: "Perdagangan", contribution: 22.3, color: "#10b981" },
  { name: "Transportasi & Pergudangan", contribution: 14.1, color: "#f59e0b" },
  { name: "Konstruksi", contribution: 9.8, color: "#ef4444" },
  { name: "Akomodasi & Makanan", contribution: 7.2, color: "#8b5cf6" },
  { name: "Lainnya", contribution: 18.1, color: "#6b7280" },
];

export const EKO_BANDUNG_COMPANIES = [
  { name: "PT Bank BJB Tbk", ticker: "BJBR", sector: "KEUANGAN" },
  { name: "PT Inti Bandung", ticker: null, sector: "TEKNOLOGI" },
  { name: "PT Pindad", ticker: null, sector: "MANUFAKTUR" },
  { name: "PT Pos Indonesia", ticker: null, sector: "TRANSPORTASI" },
  { name: "PT Telkom Indonesia (HQ Bandung)", ticker: "TLKM", sector: "TELEKOMUNIKASI" },
];
