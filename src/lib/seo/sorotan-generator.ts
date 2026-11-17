/**
 * Sorotan generator — produces 9 re-framed perspectives per article by
 * delegating to `callAI()`. Each angle is a different reader entry-point so
 * a single news story covers multiple angles; readers always land back on the
 * main article via the prominent "Lanjut baca artikel lengkap" CTA at the end
 * of every sorotan page.
 *
 * Each sorotan is 300–500 words, saved to the `Sorotan` model with
 * `indexStatus: "pending"` and slug `{article-slug}-{angle-lowercase}`.
 */

import { SorotanAngle } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { callAI } from "@/lib/ai-client";
import { invalidateCachePrefix } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { cleanAILongText } from "@/lib/sanitize";

// ANGLES = angle yang aktif diproduksi oleh generator. FAQ legacy enum
// value tetap valid untuk read tapi tidak digenerate baru.
export const ANGLES: SorotanAngle[] = [
  "KRONOLOGI",
  "ANALISIS",
  "DAMPAK",
  "LATAR_BELAKANG",
  "PROFIL",
  "REAKSI",
  "HUKUM",
  "EKONOMI",
  "PROYEKSI",
];

export const SOROTAN_ANGLE_COUNT = ANGLES.length;

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
    "Rangkum artikel berikut dari sudut HUKUM — pasal, regulasi, prosedur peradilan, atau aspek legal yang relevan. Tulis 300–500 kata bahasa Indonesia. Sudut ini wajib akurat: hanya sebut UU/pasal/putusan yang DISEBUT di artikel sumber. Kalau artikel tidak menyebut detail hukum spesifik, fokus pada implikasi hukum umum yang dapat ditarik dari peristiwa.",
  EKONOMI:
    "Rangkum artikel berikut dari sudut EKONOMI — angka, transaksi, kerugian/keuntungan, sektor industri, dampak fiskal/moneter. Tulis 300–500 kata bahasa Indonesia. Hanya gunakan angka dan klaim ekonomi yang ada di artikel. Kalau artikel tidak punya sudut ekonomi langsung, fokus pada implikasi ekonomi tidak langsung dari peristiwa.",
  PROYEKSI:
    "Rangkum artikel berikut dari sudut PROYEKSI — apa yang mungkin terjadi setelah peristiwa ini, langkah selanjutnya, agenda publik, kemungkinan keputusan/sidang/regulasi berikutnya. Tulis 300–500 kata bahasa Indonesia. Tetap berbasis fakta artikel — proyeksi yang masuk akal saja, hindari spekulasi liar.",
  // FAQ — legacy value, no longer generated. ANGLE_PROMPTS satisfied via
  // Record<SorotanAngle> type by including a stub. ANGLES array doesn't
  // include FAQ, so this prompt is never actually used at runtime.
  FAQ: "",
};

const SYSTEM_PROMPT =
  "Kamu adalah editor senior Lensaplus — media berita digital nasional Indonesia dengan fokus berita umum, politik, hukum, pemerintahan, bisnis, ekonomi, olahraga, hiburan, teknologi, dan peristiwa Nusantara. Tugasmu menulis ringkasan sudut-pandang (sorotan) yang akurat, profesional, dan tidak menambah fakta baru. Output hanya teks artikel (tanpa judul, tanpa markdown header, tanpa list bullet kecuali ditulis dalam prosa).";

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

const ANGLE_CONCURRENCY = 3;
const ARTICLE_QUEUE_CONCURRENCY = 2;

const inFlightByArticle = new Map<string, Promise<GenerateSorotanResult>>();
const queuedArticleIds = new Set<string>();
const pendingArticleQueue: string[] = [];
let activeQueueWorkers = 0;
const idleWaiters: Array<() => void> = [];

type SingleAngleOutcome =
  | { id: string; angle: SorotanAngle }
  | { skippedDuplicate: true; angle: SorotanAngle }
  | { error: string; angle: SorotanAngle };

function isPrismaUniqueError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

async function generateSingleAngle(
  article: { id: string; slug: string; title: string; content: string; excerpt: string | null },
  angle: SorotanAngle,
): Promise<SingleAngleOutcome> {
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

    const content = cleanAILongText(result.text);
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
    if (isPrismaUniqueError(err)) {
      return { skippedDuplicate: true, angle };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg, angle };
  }
}

async function runGenerateSorotan(
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
      status: true,
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

  // Bound per-article AI concurrency so batch/auto creation does not burst 9
  // simultaneous LLM calls per article and trip provider 429 rate limits.
  const angleQueue = [...missingAngles];
  const outcomes: SingleAngleOutcome[] = [];
  const workerCount = Math.min(ANGLE_CONCURRENCY, angleQueue.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (angleQueue.length > 0) {
        const angle = angleQueue.shift();
        if (!angle) break;
        outcomes.push(await generateSingleAngle(article, angle));
      }
    }),
  );

  for (const r of outcomes) {
    if ("id" in r) {
      result.created += 1;
      result.sorotanIds.push(r.id);
    } else if ("skippedDuplicate" in r) {
      result.skipped += 1;
    } else {
      result.errors.push(`${r.angle}: ${r.error}`);
    }
  }

  if (result.created > 0 && article.status === "PUBLISHED") {
    try {
      invalidateCachePrefix("home:");
    } catch {
      /* ignore cache errors */
    }
    try {
      revalidatePath("/");
      revalidatePath("/sorotan");
    } catch {
      /* revalidatePath is a no-op outside a Next.js request context */
    }
  }

  return result;
}

/**
 * Generate all missing sorotan (up to 9 active angles) for an article.
 * Concurrent calls for the same articleId share one in-flight run.
 */
export async function generateSorotan(
  articleId: string,
): Promise<GenerateSorotanResult> {
  const existing = inFlightByArticle.get(articleId);
  if (existing) return existing;

  const promise = runGenerateSorotan(articleId).finally(() => {
    inFlightByArticle.delete(articleId);
  });
  inFlightByArticle.set(articleId, promise);
  return promise;
}

/**
 * Wrapper for use in publish/create chains: fire `generateSorotan` only if
 * the article doesn't yet have all 9 active angles. Errors are swallowed —
 * never block caller.
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

function notifyIdleIfDone(): void {
  if (activeQueueWorkers === 0 && pendingArticleQueue.length === 0) {
    while (idleWaiters.length > 0) {
      const resolve = idleWaiters.shift();
      resolve?.();
    }
  }
}

function pumpSorotanQueue(): void {
  while (
    activeQueueWorkers < ARTICLE_QUEUE_CONCURRENCY &&
    pendingArticleQueue.length > 0
  ) {
    const nextId = pendingArticleQueue.shift();
    if (!nextId) break;
    activeQueueWorkers++;
    void (async () => {
      try {
        await generateSorotanIfMissing(nextId);
      } catch (err) {
        console.error("[sorotan-queue] unexpected failure:", nextId, err);
      } finally {
        queuedArticleIds.delete(nextId);
        activeQueueWorkers--;
        pumpSorotanQueue();
        notifyIdleIfDone();
      }
    })();
  }
  notifyIdleIfDone();
}

/**
 * Enqueue non-blocking Sorotan generation for a newly created or updated
 * article. Deduplicates pending/running article IDs and bounds background
 * concurrency so bulk imports/scrapes cannot saturate AI providers or delay
 * HTTP responses.
 */
export function enqueueSorotanGeneration(articleId: string): void {
  if (!articleId || queuedArticleIds.has(articleId)) return;
  queuedArticleIds.add(articleId);
  pendingArticleQueue.push(articleId);
  // Schedule pumping on microtask so synchronous test mocks/setups complete cleanly.
  queueMicrotask(pumpSorotanQueue);
}

/**
 * Wait until all queued/active background Sorotan jobs finish. Useful in tests
 * and graceful maintenance scripts.
 */
export function flushSorotanQueue(): Promise<void> {
  if (activeQueueWorkers === 0 && pendingArticleQueue.length === 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    idleWaiters.push(resolve);
  });
}
