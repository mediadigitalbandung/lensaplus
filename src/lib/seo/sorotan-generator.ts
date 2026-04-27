/**
 * Sorotan generator — produces 10 re-framed perspectives per article by
 * delegating to `callAI()`. Each angle is a different reader entry-point so
 * a single news story can rank for 10 long-tail SEO queries; readers always
 * land back on the main article via the prominent "Lanjut baca artikel
 * lengkap" CTA at the end of every sorotan page.
 *
 * Each sorotan is 300–500 words, saved to the `Sorotan` model with
 * `indexStatus: "pending"` and slug `{article-slug}-{angle-lowercase}`.
 */

import { SorotanAngle } from "@prisma/client";
import { callAI } from "@/lib/ai-client";
import { prisma } from "@/lib/prisma";

const ANGLES: SorotanAngle[] = [
  "KRONOLOGI",
  "ANALISIS",
  "DAMPAK",
  "LATAR_BELAKANG",
  "PROFIL",
  "REAKSI",
  "HUKUM",
  "EKONOMI",
  "PROYEKSI",
  "FAQ",
];

const ANGLE_LABEL: Record<SorotanAngle, string> = {
  KRONOLOGI: "Kronologi",
  ANALISIS: "Analisis",
  DAMPAK: "Dampak",
  LATAR_BELAKANG: "Latar Belakang",
  PROFIL: "Profil Tokoh",
  REAKSI: "Reaksi",
  HUKUM: "Sudut Hukum",
  EKONOMI: "Sudut Ekonomi",
  PROYEKSI: "Proyeksi",
  FAQ: "Tanya Jawab",
};

const ANGLE_PROMPTS: Record<SorotanAngle, string> = {
  KRONOLOGI:
    "Rangkum artikel berikut dari sudut KRONOLOGI waktu — urutan peristiwa dari awal ke akhir. Tulis 300–500 kata bahasa Indonesia yang alami, paragraf dengan lead kuat, tanpa mengulang kata-per-kata artikel asli. Fokus: urutan kejadian, konteks temporal, perubahan dari waktu ke waktu. Jangan mengarang fakta baru.",
  ANALISIS:
    "Rangkum artikel berikut dari sudut ANALISIS — apa penyebab, apa implikasinya, apa yang belum terjawab. Tulis 300–500 kata bahasa Indonesia yang alami, gaya op-ed ringan, paragraf dengan thesis yang jelas. Jangan mengarang fakta baru; hanya analisa yang dapat ditarik dari isi artikel.",
  DAMPAK:
    "Rangkum artikel berikut dari sudut DAMPAK — siapa yang terpengaruh, bagaimana pengaruhnya, apa yang mungkin berubah. Tulis 300–500 kata bahasa Indonesia yang alami, paragraf dengan fokus pada stakeholder dan konsekuensi praktis. Jangan mengarang fakta baru.",
  LATAR_BELAKANG:
    "Rangkum artikel berikut dari sudut LATAR BELAKANG — konteks historis, kebijakan, atau peristiwa yang membuat berita ini relevan sekarang. Tulis 300–500 kata bahasa Indonesia yang alami. Fokus: kondisi sebelum peristiwa, faktor pemicu, kerangka regulasi/sejarah. Hanya gunakan informasi yang tersirat atau eksplisit di artikel; jangan menambah fakta baru di luar konteks.",
  PROFIL:
    "Rangkum artikel berikut dari sudut PROFIL TOKOH — sosok-sosok kunci yang disebut di artikel: jabatan, peran, kontribusi mereka dalam peristiwa ini. Tulis 300–500 kata bahasa Indonesia. Kalau ada beberapa tokoh, susun per paragraf. Jangan mengarang biografi; hanya ulang-bahas detail yang ada di artikel.",
  REAKSI:
    "Rangkum artikel berikut dari sudut REAKSI — bagaimana publik, pakar, atau pihak terkait merespons peristiwa ini. Tulis 300–500 kata bahasa Indonesia. Kutip-ulang reaksi yang ada di artikel (parafrase, bukan copy). Kalau artikel tidak menyebut reaksi konkret, sajikan reaksi yang lazim untuk peristiwa serupa berdasarkan konteks artikel — tetap netral, jangan mengada-ada.",
  HUKUM:
    "Rangkum artikel berikut dari sudut HUKUM — pasal, regulasi, prosedur peradilan, atau aspek legal yang relevan. Tulis 300–500 kata bahasa Indonesia. Kartawarta adalah media hukum, jadi sudut ini wajib akurat: hanya sebut UU/pasal/putusan yang DISEBUT di artikel sumber. Kalau artikel tidak menyebut detail hukum spesifik, fokus pada implikasi hukum umum yang dapat ditarik dari peristiwa.",
  EKONOMI:
    "Rangkum artikel berikut dari sudut EKONOMI — angka, transaksi, kerugian/keuntungan, sektor industri, dampak fiskal/moneter. Tulis 300–500 kata bahasa Indonesia. Hanya gunakan angka dan klaim ekonomi yang ada di artikel. Kalau artikel tidak punya sudut ekonomi langsung, fokus pada implikasi ekonomi tidak langsung dari peristiwa.",
  PROYEKSI:
    "Rangkum artikel berikut dari sudut PROYEKSI — apa yang mungkin terjadi setelah peristiwa ini, langkah selanjutnya, agenda publik, kemungkinan keputusan/sidang/regulasi berikutnya. Tulis 300–500 kata bahasa Indonesia. Tetap berbasis fakta artikel — proyeksi yang masuk akal saja, hindari spekulasi liar.",
  FAQ:
    "Susun FAQ singkat (5-7 pertanyaan) untuk pembaca yang baru tahu kasus ini, berbasis artikel berikut. Format: pertanyaan diawali dengan baris dengan tanda tanya, lalu jawaban 2-4 kalimat. Total 300-500 kata bahasa Indonesia. Pertanyaan yang umum: apa yang terjadi, siapa yang terlibat, kapan, di mana, mengapa, apa dampaknya, apa langkah selanjutnya. Jangan mengarang jawaban yang tidak ada di artikel.",
};

const SYSTEM_PROMPT =
  "Kamu adalah editor senior media hukum Indonesia (Kartawarta). Tugasmu menulis ringkasan sudut-pandang (sorotan) yang akurat, profesional, dan tidak menambah fakta baru. Output hanya teks artikel (tanpa judul, tanpa markdown header, tanpa list bullet kecuali ditulis dalam prosa).";

export interface GenerateSorotanResult {
  articleId: string;
  created: number;
  skipped: number;
  errors: string[];
  sorotanIds: string[];
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveTitle(article: { title: string }, angle: SorotanAngle): string {
  return `${ANGLE_LABEL[angle]}: ${article.title}`;
}

async function generateSingleAngle(
  article: { id: string; slug: string; title: string; content: string; excerpt: string | null },
  angle: SorotanAngle,
): Promise<{ id: string; angle: SorotanAngle } | { error: string; angle: SorotanAngle }> {
  const sourceText = stripHtml(article.content);
  // Trim context to ~6000 chars to keep prompt under model limits.
  const context = sourceText.length > 6000 ? sourceText.slice(0, 6000) : sourceText;

  const userPrompt = `${ANGLE_PROMPTS[angle]}

JUDUL ARTIKEL: ${article.title}
${article.excerpt ? `RINGKASAN ARTIKEL: ${article.excerpt}\n` : ""}
ISI ARTIKEL:
${context}`;

  try {
    const result = await callAI({
      feature: "sorotan",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1200,
      temperature: 0.65,
      articleTitle: article.title,
    });

    const content = result.text.trim();
    if (content.length < 200) {
      return { error: `Content too short (${content.length} chars)`, angle };
    }

    const slug = `${article.slug}-${angle.toLowerCase()}`;
    const sorotan = await prisma.sorotan.create({
      data: {
        slug,
        articleId: article.id,
        angle,
        title: deriveTitle(article, angle),
        content,
        indexStatus: "pending",
      },
    });
    return { id: sorotan.id, angle };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg, angle };
  }
}

/**
 * Generate all missing sorotan (up to 3) for an article.
 * Angles that already exist are skipped.
 */
export async function generateSorotan(
  articleId: string,
): Promise<GenerateSorotanResult> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      slug: true,
      title: true,
      content: true,
      excerpt: true,
      sorotan: { select: { angle: true } },
    },
  });

  if (!article) {
    return {
      articleId,
      created: 0,
      skipped: 0,
      errors: ["Article not found"],
      sorotanIds: [],
    };
  }

  const existingAngles = new Set(article.sorotan.map((s) => s.angle));
  const missingAngles = ANGLES.filter((a) => !existingAngles.has(a));

  const result: GenerateSorotanResult = {
    articleId,
    created: 0,
    skipped: existingAngles.size,
    errors: [],
    sorotanIds: [],
  };

  if (missingAngles.length === 0) {
    return result;
  }

  const settled = await Promise.all(
    missingAngles.map((angle) => generateSingleAngle(article, angle)),
  );

  for (const r of settled) {
    if ("id" in r) {
      result.created += 1;
      result.sorotanIds.push(r.id);
    } else {
      result.errors.push(`${r.angle}: ${r.error}`);
    }
  }

  return result;
}

/**
 * Wrapper for use in publish chains: fire `generateSorotan` only if the article
 * doesn't yet have all 3 angles. Errors are swallowed — never block caller.
 */
export async function generateSorotanIfMissing(articleId: string): Promise<void> {
  try {
    const count = await prisma.sorotan.count({ where: { articleId } });
    if (count >= ANGLES.length) return;
    await generateSorotan(articleId);
  } catch {
    // swallow — non-blocking SEO enrichment
  }
}
