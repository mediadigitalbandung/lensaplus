/**
 * GET/POST /api/cron/newsletter-digest
 *
 * Sends a weekly digest of the top articles from the last 7 days to all
 * confirmed, non-unsubscribed subscribers. Idempotent per subscriber per
 * digest week — `lastSentAt` prevents double-send if cron fires twice.
 *
 * Protected by `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Recommend invocation: every Monday at 07:00 WIB:
 *   0 0 * * 1 curl -sH "Authorization: Bearer $CRON_SECRET" https://lensaplus.com/api/cron/newsletter-digest
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, verifyCronSecret, logAudit } from "@/lib/api-utils";
import { sendEmail } from "@/lib/email";
import { trackCron } from "@/lib/cron-tracker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com";

async function handler(req: NextRequest) {
  try {
    verifyCronSecret(req);
  } catch (e) {
    return errorResponse(e);
  }

  // Pull top 8 articles from the last 7 days, ordered by views.
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const articles = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { gte: weekAgo },
    },
    orderBy: [{ viewCount: "desc" }, { publishedAt: "desc" }],
    take: 8,
    select: {
      title: true,
      slug: true,
      excerpt: true,
      featuredImage: true,
      publishedAt: true,
      category: { select: { name: true } },
    },
  });

  if (articles.length === 0) {
    return successResponse({ sent: 0, skipped: "no-articles" });
  }

  // Render the digest body (one HTML, reused per subscriber with their
  // unique unsubscribe footer appended).
  const articleListHtml = articles
    .map((a) => {
      const url = `${SITE_URL}/berita/${a.slug}?utm_source=newsletter&utm_medium=email&utm_campaign=weekly-digest`;
      const img = a.featuredImage
        ? `<img src="${a.featuredImage}" alt="" width="120" height="80" style="display:block;border-radius:6px;object-fit:cover;" />`
        : "";
      return `
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:20px;">
          <tr>
            <td valign="top" style="width:120px;padding-right:14px;">${img}</td>
            <td valign="top">
              <p style="margin:0 0 4px 0;font-size:11px;color:#74777f;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${a.category.name}</p>
              <a href="${url}" style="color:#002045;text-decoration:none;">
                <h3 style="margin:0 0 6px 0;font-size:16px;line-height:1.3;font-weight:700;color:#002045;">${a.title}</h3>
              </a>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#44474e;">${(a.excerpt || "").slice(0, 120)}${a.excerpt && a.excerpt.length > 120 ? "..." : ""}</p>
            </td>
          </tr>
        </table>
      `;
    })
    .join("");

  // Don't re-send to subscribers who got this week's digest already.
  const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: {
      confirmedAt: { not: null },
      unsubscribedAt: null,
      OR: [
        { lastSentAt: null },
        { lastSentAt: { lt: sevenDaysAgo } },
      ],
    },
    select: { id: true, email: true, token: true },
    take: 5000, // safety cap
  });

  let sent = 0;
  const failures: string[] = [];

  for (const sub of subscribers) {
    const unsubUrl = `${SITE_URL}/api/newsletter/unsubscribe?token=${sub.token}`;
    const html = `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#191c1d;">
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-bottom:2px solid #002045;padding-bottom:12px;margin-bottom:24px;">
          <tr>
            <td style="font-family:Georgia,serif;font-size:24px;font-weight:800;color:#002045;letter-spacing:-0.5px;">Lensaplus</td>
            <td align="right" style="font-size:12px;color:#74777f;">Pekanan · ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</td>
          </tr>
        </table>
        <h2 style="font-family:Georgia,serif;color:#002045;margin:0 0 8px 0;font-size:22px;">Berita Pilihan Pekan Ini</h2>
        <p style="margin:0 0 24px 0;color:#44474e;font-size:14px;">${articles.length} laporan terverifikasi dari Bandung dan sekitarnya.</p>
        ${articleListHtml}
        <hr style="margin:32px 0;border:0;border-top:1px solid #c4c6d0;">
        <p style="font-size:11px;color:#74777f;line-height:1.6;text-align:center;">
          Email ini dikirim ke ${sub.email} karena Anda berlangganan newsletter Lensaplus.<br>
          <a href="${unsubUrl}" style="color:#74777f;text-decoration:underline;">Berhenti berlangganan</a>
          &middot;
          <a href="${SITE_URL}" style="color:#74777f;text-decoration:underline;">Kunjungi situs</a>
        </p>
      </div>
    `;
    try {
      await sendEmail(sub.email, "Pekan Ini di Lensaplus", html);
      await prisma.newsletterSubscriber.update({
        where: { id: sub.id },
        data: { lastSentAt: new Date() },
      });
      sent++;
    } catch (e) {
      failures.push(`${sub.email}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Audit log (best-effort)
  try {
    await logAudit(
      null,
      "CRON_NEWSLETTER_DIGEST",
      "newsletter_subscriber",
      "system",
      JSON.stringify({ sent, candidates: subscribers.length, articleCount: articles.length, failures: failures.length }),
    );
  } catch {
    // swallow
  }

  return successResponse({
    sent,
    candidates: subscribers.length,
    articleCount: articles.length,
    failures,
  });
}

export async function GET(req: NextRequest) {
  try { return await trackCron("newsletter-digest", () => handler(req)); } catch (e) { return errorResponse(e); }
}

export async function POST(req: NextRequest) {
  try { return await trackCron("newsletter-digest", () => handler(req)); } catch (e) { return errorResponse(e); }
}
