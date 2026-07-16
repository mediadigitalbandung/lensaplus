/**
 * Comment spam filter — combines a fast local heuristic with optional
 * Akismet check (when AKISMET_API_KEY is set).
 *
 * Strategy:
 *   1. Heuristics first — keyword denylist, link density, ALL CAPS, repeated
 *      chars. Catches ~70% of spam at zero cost.
 *   2. Akismet — only call when heuristics didn't already mark spam, to
 *      conserve free-tier quota (~10k/day for personal/non-commercial use).
 *
 * Returns:
 *   "spam"   — definitely spam, reject silently (or save w/ isApproved:false + flag)
 *   "review" — looks suspicious, save unapproved + flag for human moderation
 *   "ok"     — passes both checks
 */

const SPAM_KEYWORDS = [
  // SEO spam
  "viagra",
  "cialis",
  "casino",
  "poker",
  "slot gacor",
  "judi online",
  "pinjol",
  "pinjaman online",
  "agen togel",
  "togel hari ini",
  "buy followers",
  "cheap loans",
  // Crypto spam
  "free bitcoin",
  "crypto airdrop",
  "1xbet",
  // Generic
  "click here",
  "buy now",
  "limited offer",
];

interface SpamCheckInput {
  content: string;
  authorName: string;
  authorEmail: string;
  ip?: string;
  userAgent?: string;
  url?: string;
}

interface SpamCheckResult {
  verdict: "spam" | "review" | "ok";
  reason?: string;
}

function heuristicCheck(input: SpamCheckInput): SpamCheckResult {
  const text = `${input.authorName} ${input.content}`.toLowerCase();

  // Hard denylist — known spam terms.
  const matched = SPAM_KEYWORDS.find((kw) => text.includes(kw));
  if (matched) return { verdict: "spam", reason: `keyword:${matched}` };

  // Link density — > 2 URLs in a short comment is almost always spam.
  const urls = (input.content.match(/https?:\/\/\S+/gi) || []).length;
  if (urls > 2) return { verdict: "spam", reason: `urls:${urls}` };
  if (urls > 0 && input.content.length < 100) {
    return { verdict: "spam", reason: "short-with-link" };
  }

  // ALL CAPS shouting — > 70% caps in messages > 30 chars.
  if (input.content.length > 30) {
    const letters = input.content.replace(/[^a-zA-Z]/g, "");
    const caps = letters.replace(/[^A-Z]/g, "").length;
    if (letters.length > 0 && caps / letters.length > 0.7) {
      return { verdict: "review", reason: "shouting" };
    }
  }

  // Repeated character spam — "aaaaaaa", "!!!!!!!!".
  if (/(.)\1{8,}/.test(input.content)) {
    return { verdict: "spam", reason: "repeated-chars" };
  }

  // Suspicious author name patterns.
  if (/^(admin|root|support|test|spam)$/i.test(input.authorName.trim())) {
    return { verdict: "review", reason: "suspicious-name" };
  }

  return { verdict: "ok" };
}

/**
 * Hit Akismet REST API. Free for non-commercial; paid otherwise.
 * Set AKISMET_API_KEY + AKISMET_BLOG_URL (e.g. https://lensaplus.com).
 */
async function akismetCheck(input: SpamCheckInput): Promise<SpamCheckResult> {
  const key = process.env.AKISMET_API_KEY;
  const blog = process.env.AKISMET_BLOG_URL || "https://lensaplus.com";
  if (!key) return { verdict: "ok" }; // Akismet not configured — skip silently.

  try {
    const params = new URLSearchParams({
      blog,
      user_ip: input.ip || "0.0.0.0",
      user_agent: input.userAgent || "",
      comment_type: "comment",
      comment_author: input.authorName,
      comment_author_email: input.authorEmail,
      comment_content: input.content,
      ...(input.url ? { permalink: input.url } : {}),
    });
    const res = await fetch(
      `https://${key}.rest.akismet.com/1.1/comment-check`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Lensaplus/2.0 | Akismet/1.0",
        },
        body: params.toString(),
        // 5s timeout — don't block comment submit on a slow Akismet
        signal: AbortSignal.timeout(5000),
      },
    );
    const text = (await res.text()).trim();
    const proTip = res.headers.get("x-akismet-pro-tip");
    if (text === "true") {
      return {
        verdict: proTip === "discard" ? "spam" : "review",
        reason: `akismet:${proTip || "spam"}`,
      };
    }
    return { verdict: "ok" };
  } catch (e) {
    // Network error — fail open (allow comment), but log.
    console.warn("Akismet check failed", e);
    return { verdict: "ok" };
  }
}

/**
 * Run heuristic first; only escalate to Akismet if heuristic passes (saves
 * quota). Returns the more severe verdict.
 */
export async function checkSpam(input: SpamCheckInput): Promise<SpamCheckResult> {
  const heuristic = heuristicCheck(input);
  if (heuristic.verdict === "spam") return heuristic;

  const akismet = await akismetCheck(input);
  if (akismet.verdict === "spam") return akismet;
  if (heuristic.verdict === "review" || akismet.verdict === "review") {
    return {
      verdict: "review",
      reason: heuristic.reason || akismet.reason,
    };
  }
  return { verdict: "ok" };
}
