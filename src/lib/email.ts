import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { decryptSecret, isSensitiveKey } from "@/lib/crypto-secrets";

// ---------------------------------------------------------------------------
// CRIT-12: async client factory — reads SystemSetting first, env as fallback.
// Cached by key so key rotation in panel is picked up on next call.
// ---------------------------------------------------------------------------
let _cachedClient: { client: Resend; key: string } | null = null;

async function getResendClient(): Promise<Resend | null> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "resend_api_key" },
    });
    let key: string | undefined;
    if (setting?.value && setting.value.trim().length > 0) {
      const raw = setting.value.trim();
      key = isSensitiveKey("resend_api_key") ? decryptSecret(raw) : raw;
    }
    key = key || process.env.RESEND_API_KEY;
    if (!key) return null;
    if (_cachedClient?.key === key) return _cachedClient.client;
    const client = new Resend(key);
    _cachedClient = { client, key };
    return client;
  } catch {
    // Fallback to env on any DB error
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    if (_cachedClient?.key === key) return _cachedClient.client;
    const client = new Resend(key);
    _cachedClient = { client, key };
    return client;
  }
}

async function getFromEmail(): Promise<string> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "notification_email_from" },
    });
    if (setting?.value && setting.value.trim().length > 0) return setting.value.trim();
  } catch { /* ignore */ }
  return process.env.EMAIL_FROM || "Kartawarta <noreply@kartawarta.com>";
}

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Kartawarta";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";

// ---------------------------------------------------------------------------
// CRIT-15: baseTemplate uses navy #002045 + primary-light #e8edf3, rounded-md
// ---------------------------------------------------------------------------
function baseTemplate(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f7f7f8;font-family:'Work Sans',system-ui,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
      <div style="text-align:center;margin-bottom:24px;">
        <h2 style="margin:0;color:#002045;font-size:18px;">${APP_NAME}</h2>
      </div>
      <h1 style="margin:0 0 16px;font-size:20px;color:#1c1c1e;">${title}</h1>
      ${body}
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;">
        <a href="${APP_URL}" style="color:#002045;font-size:12px;text-decoration:none;">${APP_NAME}</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// sendEmail — backward-compatible signature (to, subject, html).
// Also exported as object form for CRIT-11 cron usage.
// ---------------------------------------------------------------------------
export async function sendEmail(
  toOrOpts: string | { to: string; subject: string; html: string },
  subject?: string,
  html?: string,
): Promise<{ ok: boolean; id?: string; reason?: string; error?: string }> {
  let to: string, subj: string, body: string;
  if (typeof toOrOpts === "object") {
    to = toOrOpts.to;
    subj = toOrOpts.subject;
    body = toOrOpts.html;
  } else {
    to = toOrOpts;
    subj = subject!;
    body = html!;
  }

  const client = await getResendClient();
  if (!client) {
    console.error("[email] No Resend API key configured (SystemSetting + env both empty)");
    return { ok: false, reason: "NO_KEY" };
  }
  try {
    const from = await getFromEmail();
    const result = await client.emails.send({ from, to, subject: subj, html: body });
    if ((result as { error?: unknown })?.error) {
      const e = (result as { error: unknown }).error;
      const msg = typeof e === "string" ? e : (e as { message?: string })?.message || JSON.stringify(e);
      console.error("[email] send error:", msg);
      return { ok: false, reason: "SEND_FAIL", error: msg };
    }
    return { ok: true, id: (result as { data?: { id?: string } })?.data?.id };
  } catch (e) {
    console.error("[email] send fail:", e);
    return { ok: false, reason: "SEND_FAIL", error: String(e) };
  }
}

export async function sendVerificationEmail(to: string, name: string, link: string) {
  const safeName = (name || "").replace(/[<>]/g, "");
  const html = baseTemplate("Verifikasi Email Anda", `
    <p style="color:#6b7280;line-height:1.6;">Halo${safeName ? ` <strong style="color:#1c1c1e;">${safeName}</strong>` : ""}, konfirmasi bahwa alamat email ini benar milik Anda untuk mengamankan akun ${APP_NAME} Anda.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${link}" style="display:inline-block;background:#002045;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">Verifikasi Email</a>
    </div>
    <p style="color:#9ca3af;font-size:12px;line-height:1.6;">Tautan berlaku 24 jam. Jika tombol tidak berfungsi, salin URL ini ke browser:<br><span style="color:#002045;word-break:break-all;">${link}</span></p>
    <p style="color:#9ca3af;font-size:12px;line-height:1.6;">Jika Anda tidak merasa membuat akun ini, abaikan email ini.</p>
  `);
  return sendEmail(to, `Verifikasi email Anda — ${APP_NAME}`, html);
}

export async function sendArticleApprovedEmail(to: string, articleTitle: string, articleSlug: string) {
  // articleSlug retained for future deep-link use
  void articleSlug;
  const html = baseTemplate("Artikel Anda Disetujui!", `
    <p style="color:#6b7280;line-height:1.6;">Artikel <strong style="color:#1c1c1e;">"${articleTitle}"</strong> telah disetujui oleh editor dan siap untuk dipublikasikan.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/panel/artikel" style="display:inline-block;background:#002045;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">Lihat di Panel</a>
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
      <a href="${APP_URL}/panel/artikel" style="display:inline-block;background:#002045;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">Revisi Artikel</a>
    </div>
  `);
  await sendEmail(to, `Artikel Ditolak: ${articleTitle}`, html);
}

export async function sendArticlePublishedEmail(to: string, articleTitle: string, articleSlug: string) {
  const html = baseTemplate("Artikel Anda Dipublikasikan!", `
    <p style="color:#6b7280;line-height:1.6;">Selamat! Artikel <strong style="color:#1c1c1e;">"${articleTitle}"</strong> telah dipublikasikan dan dapat dibaca oleh publik.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/berita/${articleSlug}" style="display:inline-block;background:#002045;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">Baca Artikel</a>
    </div>
  `);
  await sendEmail(to, `Artikel Dipublikasikan: ${articleTitle}`, html);
}

export async function sendNewReviewEmail(to: string, articleTitle: string, authorName: string) {
  const html = baseTemplate("Artikel Baru untuk Direview", `
    <p style="color:#6b7280;line-height:1.6;">Artikel <strong style="color:#1c1c1e;">"${articleTitle}"</strong> dari <strong>${authorName}</strong> telah diajukan untuk review.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/panel/artikel" style="display:inline-block;background:#002045;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">Review Sekarang</a>
    </div>
  `);
  await sendEmail(to, `Review Baru: ${articleTitle}`, html);
}
