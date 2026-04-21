import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM || "Kartawarta <noreply@kartawarta.com>";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Kartawarta";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";

function baseTemplate(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f7f7f8;font-family:'Inter',system-ui,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
      <div style="text-align:center;margin-bottom:24px;">
        <h2 style="margin:0;color:#00AA13;font-size:18px;">${APP_NAME}</h2>
      </div>
      <h1 style="margin:0 0 16px;font-size:20px;color:#1c1c1e;">${title}</h1>
      ${body}
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;">
        <a href="${APP_URL}" style="color:#00AA13;font-size:12px;text-decoration:none;">${APP_NAME}</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) return; // Skip if no API key configured
  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
  } catch {
    // Email is non-critical — fail silently
  }
}

export async function sendArticleApprovedEmail(to: string, articleTitle: string, articleSlug: string) {
  const html = baseTemplate("Artikel Anda Disetujui!", `
    <p style="color:#6b7280;line-height:1.6;">Artikel <strong style="color:#1c1c1e;">"${articleTitle}"</strong> telah disetujui oleh editor dan siap untuk dipublikasikan.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/panel/artikel" style="display:inline-block;background:#00AA13;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600;">Lihat di Panel</a>
    </div>
  `);
  await sendEmail(to, `Artikel Disetujui: ${articleTitle}`, html);
}

export async function sendArticleRejectedEmail(to: string, articleTitle: string, reviewNote?: string) {
  const html = baseTemplate("Artikel Anda Ditolak", `
    <p style="color:#6b7280;line-height:1.6;">Artikel <strong style="color:#1c1c1e;">"${articleTitle}"</strong> ditolak oleh editor.</p>
    ${reviewNote ? `<div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;border-radius:8px;margin:16px 0;"><p style="margin:0;color:#991b1b;font-size:14px;"><strong>Catatan editor:</strong> ${reviewNote}</p></div>` : ""}
    <p style="color:#6b7280;line-height:1.6;">Silakan revisi dan ajukan kembali.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/panel/artikel" style="display:inline-block;background:#00AA13;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600;">Revisi Artikel</a>
    </div>
  `);
  await sendEmail(to, `Artikel Ditolak: ${articleTitle}`, html);
}

export async function sendArticlePublishedEmail(to: string, articleTitle: string, articleSlug: string) {
  const html = baseTemplate("Artikel Anda Dipublikasikan!", `
    <p style="color:#6b7280;line-height:1.6;">Selamat! Artikel <strong style="color:#1c1c1e;">"${articleTitle}"</strong> telah dipublikasikan dan dapat dibaca oleh publik.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/berita/${articleSlug}" style="display:inline-block;background:#00AA13;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600;">Baca Artikel</a>
    </div>
  `);
  await sendEmail(to, `Artikel Dipublikasikan: ${articleTitle}`, html);
}

export async function sendNewReviewEmail(to: string, articleTitle: string, authorName: string) {
  const html = baseTemplate("Artikel Baru untuk Direview", `
    <p style="color:#6b7280;line-height:1.6;">Artikel <strong style="color:#1c1c1e;">"${articleTitle}"</strong> dari <strong>${authorName}</strong> telah diajukan untuk review.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/panel/artikel" style="display:inline-block;background:#00AA13;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600;">Review Sekarang</a>
    </div>
  `);
  await sendEmail(to, `Review Baru: ${articleTitle}`, html);
}
