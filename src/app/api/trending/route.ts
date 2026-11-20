import { successResponse } from "@/lib/api-utils";

export const revalidate = 7200; // 2 hours

// Indonesian keywords to detect local trends
const ID_KEYWORDS = /indonesia|jakarta|bandung|surabaya|jawa|timnas|pssi|persib|persija|liga\s?1|piala|bola|rupiah|ihsg|saham|dpr|mpr|presiden|menteri|jokowi|prabowo|kpk|polri|tni|pilkada|pemilu|gubernur|bupati|walikota|bpjs|pertamina|pln|garuda|telkom|bca|bri|mandiri|kominfo|kemenko|kemenkes|kemendikbud|mui|nu|muhammadiyah|lebaran|ramadan|idul|haji|umkm|ojk|bi\s|bank indonesia|mahkamah|sidang|hukum|korupsi|narkoba|tsunami|gempa|banjir|bmkg|gunung|merapi|cuaca|kebakaran|hutan/i;

// Known international/irrelevant keywords to exclude
const INTL_KEYWORDS = /nba|nfl|premier league|champions league|la liga|bundesliga|serie a|ligue 1|cricket|ipl|nhl|mlb|trump|biden|putin|ukraine|russia|china|israel|palestine|gaza|nato|eu\b|brexit|elon musk|tesla|spacex|nasa|oscar|grammy|emmy|super bowl|world cup|euro 2|copa america|wimbledon|us open|australian open|french open|bollywood|hollywood|kpop|blackpink|bts\b|taylor swift|drake|beyonce|kanye|kardashian|royal family|king charles|pope|vatican|olympics 20|fifa|uefa|afc asian|nba draft|f1 grand prix|formula 1|motogp (?!mandalika)|ufc\b|wwe\b|boxing|pga|lpga|masters|super league|eredivisie|antwerp|ried|lueders|macau|khaleej|kholood|al-|fc\b(?!.*indonesia)/i;

function isIndonesianTrend(tag: string): boolean {
  // Reject international keywords first
  if (INTL_KEYWORDS.test(tag)) return false;
  // Accept if matches Indonesian keywords
  if (ID_KEYWORDS.test(tag)) return true;
  // Accept if contains Indonesian language words
  if (/yang|dan|dari|untuk|dengan|dalam|ini|itu|baru|hari|kasus|soal|tentang|harga|berita|hasil|jadwal|cara|daftar|lowongan|resmi|terbaru/i.test(tag)) return true;
  // Reject everything else (all-latin generic terms are likely international)
  return false;
}

// Category detection
const CAT_KEYWORDS: Record<string, RegExp> = {
  "Hukum": /hukum|kpk|korupsi|sidang|pengadilan|jaksa|hakim|polisi|kriminal|pidana|perdata|mahkamah/i,
  "Bisnis": /saham|ihsg|rupiah|bank|ekonomi|bisnis|investasi|fintech|startup|emas|bbm|pertamina|ojk/i,
  "Olahraga": /timnas|liga|bola|sepak|badminton|moto|gp|olimpiade|persib|persija|piala|pssi|atlet/i,
  "Hiburan": /film|konser|musik|artis|drama|netflix|idol|viral|tiktok|selebriti|dangdut/i,
  "Kesehatan": /covid|vaksin|rumah sakit|kesehatan|penyakit|obat|dokter|bpjs|stunting/i,
  "Teknologi": /ai\b|tech|google|apple|samsung|android|iphone|digital|cyber|internet|satelit|5g/i,
  "Politik": /presiden|dpr|menteri|pilkada|pemilu|partai|pemerintah|kebijakan|gubernur|jokowi|prabowo/i,
  "Lingkungan": /banjir|gempa|cuaca|iklim|kebakaran|tsunami|gunung|bmkg|deforestasi/i,
};

function categorize(tag: string): string | null {
  for (const [cat, re] of Object.entries(CAT_KEYWORDS)) {
    if (re.test(tag)) return cat;
  }
  return null;
}

export async function GET() {
  try {
    const googleRes = await fetch(
      "https://trends.google.com/trending/rss?geo=ID",
      {
        signal: AbortSignal.timeout(10_000),
        next: { revalidate: 7200 },
      }
    );

    if (!googleRes.ok) return successResponse(getFallbackTags());

    const xml = await googleRes.text();
    const itemTitles = xml.match(/<item>\s*<title>(.*?)<\/title>/g);

    if (!itemTitles || itemTitles.length === 0) {
      return successResponse(getFallbackTags());
    }

    const rawTrends = itemTitles
      .map((t) => t.replace(/<item>\s*<title>/, "").replace(/<\/title>/, "")
        .replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&quot;/g, '"').trim())
      .filter((t) => t.length > 0 && t.length <= 40);

    // Filter: only Indonesian trends
    const filtered = rawTrends.filter(isIndonesianTrend);

    // If not enough Indonesian trends, pad with fallback
    const final = filtered.length >= 5 ? filtered : [...filtered, ...getFallbackTags().map((t) => t.label)];
    const unique = Array.from(new Set(final));

    const tags = unique.slice(0, 15).map((label, i) => ({
      label,
      category: categorize(label),
      href: `/search?q=${encodeURIComponent(label)}`,
      hot: i < 3,
    }));

    return successResponse(tags);
  } catch {
    return successResponse(getFallbackTags());
  }
}

function getFallbackTags() {
  return [
    { label: "Pilkada 2026", category: "Politik", href: "/search?q=pilkada+2026", hot: true },
    { label: "Timnas Indonesia", category: "Olahraga", href: "/search?q=timnas+indonesia", hot: true },
    { label: "IHSG Hari Ini", category: "Bisnis", href: "/search?q=IHSG", hot: true },
    { label: "Harga BBM", category: "Bisnis", href: "/search?q=harga+bbm", hot: false },
    { label: "KPK", category: "Hukum", href: "/search?q=KPK", hot: false },
    { label: "Kurs Rupiah", category: "Bisnis", href: "/search?q=kurs+rupiah", hot: false },
    { label: "Liga 1 Indonesia", category: "Olahraga", href: "/search?q=liga+1", hot: false },
    { label: "Harga Emas", category: "Bisnis", href: "/search?q=harga+emas", hot: false },
    { label: "IKN Nusantara", category: "Politik", href: "/search?q=IKN", hot: false },
    { label: "Cuaca Ekstrem", category: "Lingkungan", href: "/search?q=cuaca+ekstrem", hot: false },
    { label: "Film Indonesia", category: "Hiburan", href: "/search?q=film+indonesia", hot: false },
    { label: "BPJS Kesehatan", category: "Kesehatan", href: "/search?q=BPJS", hot: false },
  ];
}
