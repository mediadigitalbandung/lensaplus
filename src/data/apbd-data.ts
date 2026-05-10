export interface APBDItem {
  sector: string;
  amount: number; // dalam triliun rupiah
  color: string;
  description?: string;
}

export interface APBDYear {
  region: string;
  year: number;
  totalAmount: number; // total APBD triliun
  source: string;
  items: APBDItem[];
}

export const APBD_DATA: APBDYear[] = [
  {
    region: "Kota Bandung",
    year: 2026,
    totalAmount: 8.45,
    source: "Perda APBD 2026 / DPRD Bandung",
    items: [
      {
        sector: "Pendidikan",
        amount: 2.31,
        color: "#3b82f6",
        description: "Pendidikan dasar, PAUD, beasiswa, infrastruktur sekolah",
      },
      {
        sector: "Infrastruktur",
        amount: 1.78,
        color: "#10b981",
        description: "Jalan, drainase, taman, bangunan publik",
      },
      {
        sector: "Kesehatan",
        amount: 1.42,
        color: "#ef4444",
        description: "Puskesmas, RSUD, BPJS subsidi, vaksinasi",
      },
      {
        sector: "Sosial & Pemberdayaan",
        amount: 0.89,
        color: "#f59e0b",
        description: "Bansos, pemberdayaan UMKM, koperasi",
      },
      {
        sector: "Pemerintahan & Aparatur",
        amount: 1.05,
        color: "#6b7280",
        description: "Gaji ASN, tunjangan, operasional dinas",
      },
      {
        sector: "Lingkungan & Sampah",
        amount: 0.45,
        color: "#22c55e",
        description: "PD Kebersihan, taman kota, IPAL",
      },
      {
        sector: "Lainnya",
        amount: 0.55,
        color: "#a855f7",
        description: "Cadangan, transfer, lainnya",
      },
    ],
  },
  {
    region: "Kabupaten Bandung",
    year: 2026,
    totalAmount: 6.21,
    source: "Perda APBD 2026 / DPRD Kab Bandung",
    items: [
      { sector: "Pendidikan", amount: 1.82, color: "#3b82f6" },
      { sector: "Infrastruktur", amount: 1.56, color: "#10b981" },
      { sector: "Kesehatan", amount: 1.08, color: "#ef4444" },
      { sector: "Sosial & Pemberdayaan", amount: 0.62, color: "#f59e0b" },
      { sector: "Pemerintahan & Aparatur", amount: 0.78, color: "#6b7280" },
      { sector: "Lingkungan & Sampah", amount: 0.20, color: "#22c55e" },
      { sector: "Lainnya", amount: 0.15, color: "#a855f7" },
    ],
  },
];
