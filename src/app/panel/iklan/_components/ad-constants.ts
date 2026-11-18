export const slotLabels: Record<string, string> = {
  HEADER: "Header Banner",
  SIDEBAR: "Sidebar",
  IN_ARTICLE: "Dalam Artikel",
  FOOTER: "Footer",
  BETWEEN_SECTIONS: "Antar Seksi",
  POPUP: "Pop-up",
  FLOATING_BOTTOM: "Floating Bottom",
};

export const slotSpecs: Record<string, { width: number; height: number; ratio: string; desc: string }> = {
  HEADER: { width: 728, height: 90, ratio: "728 x 90 px", desc: "Leaderboard — tampil di atas halaman" },
  SIDEBAR: { width: 300, height: 250, ratio: "300 x 250 px", desc: "Medium Rectangle — sidebar kanan" },
  IN_ARTICLE: { width: 728, height: 90, ratio: "728 x 90 px", desc: "Leaderboard — di tengah artikel" },
  FOOTER: { width: 728, height: 90, ratio: "728 x 90 px", desc: "Leaderboard — di bawah halaman" },
  BETWEEN_SECTIONS: { width: 970, height: 250, ratio: "970 x 250 px", desc: "Billboard — antar seksi homepage" },
  POPUP: { width: 600, height: 400, ratio: "600 x 400 px", desc: "Large Rectangle — pop-up overlay" },
  FLOATING_BOTTOM: { width: 728, height: 90, ratio: "728 x 90 px", desc: "Leaderboard — floating di bawah" },
};

export const typeLabels: Record<string, string> = {
  IMAGE: "Gambar",
  HTML: "Kode HTML",
};
