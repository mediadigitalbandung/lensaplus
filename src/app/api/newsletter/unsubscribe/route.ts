import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { escapeHtml } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com";

/**
 * GET /api/newsletter/unsubscribe?token=...
 * Renders a confirmation page with a POST form so email security scanners
 * prefetching GET links cannot accidentally unsubscribe users.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = (searchParams.get("token") || "").trim();
  if (!token) {
    return NextResponse.redirect(`${SITE_URL}/newsletter?status=invalid-token`);
  }

  const sub = await prisma.newsletterSubscriber.findUnique({
    where: { token },
    select: { id: true, email: true, unsubscribedAt: true },
  });
  if (!sub) {
    return NextResponse.redirect(`${SITE_URL}/newsletter?status=invalid-token`);
  }
  if (sub.unsubscribedAt) {
    return NextResponse.redirect(`${SITE_URL}/newsletter?status=unsubscribed`);
  }

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Konfirmasi Berhenti Berlangganan — Lensaplus</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #FAF9F6; color: #1C1917; margin: 0; padding: 32px 16px; }
    .card { max-width: 480px; margin: 40px auto; background: #ffffff; border: 1px solid #e7e5e4; border-radius: 12px; padding: 28px; }
    h1 { font-size: 20px; margin: 0 0 12px; color: #2E1065; }
    p { font-size: 14px; line-height: 1.6; color: #57534E; margin: 0 0 20px; }
    button { background: #2E1065; color: #ffffff; border: 0; border-radius: 8px; padding: 12px 20px; font-size: 14px; font-weight: 600; cursor: pointer; }
    button:hover { opacity: 0.92; }
    a { color: #2E1065; font-size: 13px; margin-left: 14px; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Berhenti Berlangganan Newsletter?</h1>
    <p>Konfirmasi bahwa Anda ingin berhenti menerima ringkasan berita mingguan Lensaplus untuk <strong>${escapeHtml(sub.email)}</strong>.</p>
    <form method="POST" action="/api/newsletter/unsubscribe">
      <input type="hidden" name="token" value="${escapeHtml(token)}" />
      <button type="submit">Ya, Berhenti Berlangganan</button>
      <a href="${escapeHtml(SITE_URL)}">Kembali ke Beranda</a>
    </form>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

/**
 * POST /api/newsletter/unsubscribe
 * Performs the actual unsubscribe mutation. Supports:
 *  - HTML form submission (`token` in form-urlencoded body)
 *  - RFC 8058 One-Click (`List-Unsubscribe=One-Click` with `?token=...`)
 *  - JSON body (`{ token }`)
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  let token = (url.searchParams.get("token") || "").trim();
  let isOneClick = false;
  let wantsJson = false;

  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    wantsJson = true;
    const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
    if (!token && typeof body?.token === "string") {
      token = body.token.trim();
    }
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text().catch(() => "");
    const form = new URLSearchParams(text);
    if (!token) {
      token = (form.get("token") || "").trim();
    }
    if (form.get("List-Unsubscribe") === "One-Click") {
      isOneClick = true;
    }
  }

  if (!token) {
    if (wantsJson || isOneClick) {
      return NextResponse.json({ success: false, error: "Invalid token" }, { status: 400 });
    }
    return NextResponse.redirect(`${SITE_URL}/newsletter?status=invalid-token`, 303);
  }

  const sub = await prisma.newsletterSubscriber.findUnique({ where: { token } });
  if (!sub) {
    if (wantsJson || isOneClick) {
      return NextResponse.json({ success: false, error: "Invalid token" }, { status: 404 });
    }
    return NextResponse.redirect(`${SITE_URL}/newsletter?status=invalid-token`, 303);
  }

  if (!sub.unsubscribedAt) {
    await prisma.newsletterSubscriber.update({
      where: { id: sub.id },
      data: { unsubscribedAt: new Date() },
    });
  }

  if (isOneClick) {
    return new NextResponse("unsubscribed", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  if (wantsJson) {
    return NextResponse.json({ success: true, status: "unsubscribed" });
  }
  return NextResponse.redirect(`${SITE_URL}/newsletter?status=unsubscribed`, 303);
}
