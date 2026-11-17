import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  errorResponse,
  logAudit,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { encryptSecret } from "@/lib/crypto-secrets";

export const dynamic = "force-dynamic";

const REDIRECT_URI = process.env.THREADS_REDIRECT_URI || "https://lensaplus.com/";

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN"]);
    const body = await req.json().catch(() => ({}));
    const { code } = body;

    if (!code || typeof code !== "string") {
      throw new ApiError("Kode otorisasi wajib disertakan.", 400);
    }

    const clientId = process.env.THREADS_APP_ID;
    const clientSecret = process.env.THREADS_APP_SECRET;
    if (!clientId || !clientSecret) {
      throw new ApiError(
        "THREADS_APP_ID dan THREADS_APP_SECRET belum dikonfigurasi di environment server.",
        500,
      );
    }

    console.log("[threads-exchange] Starting exchange for Threads code:", code.slice(0, 10) + "...");

    // 1. Exchange authorization code for short-lived token
    const exchangeRes = await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
        code: code.trim(),
      }).toString(),
    });

    const exchangeJson = await exchangeRes.json();
    if (!exchangeRes.ok) {
      throw new ApiError(
        exchangeJson.error?.message || "Gagal menukarkan kode otorisasi Threads.",
        exchangeRes.status
      );
    }

    const shortLivedToken = exchangeJson.access_token;
    const threadsUserId = exchangeJson.user_id;

    // 2. Exchange short-lived token for 60-day long-lived token
    const longLivedParams = new URLSearchParams({
      grant_type: "th_exchange_token",
      client_secret: clientSecret,
      access_token: String(shortLivedToken),
    });
    const longLivedRes = await fetch(
      `https://graph.threads.net/access_token?${longLivedParams.toString()}`,
      { method: "GET" },
    );
    const longLivedJson = await longLivedRes.json();

    if (!longLivedRes.ok) {
      throw new ApiError(
        longLivedJson.error?.message || "Gagal memperpanjang token Threads menjadi long-lived.",
        longLivedRes.status
      );
    }

    const longLivedToken = String(longLivedJson.access_token || "");
    if (!longLivedToken) {
      throw new ApiError("Threads tidak mengembalikan long-lived access token.", 502);
    }
    const encryptedToken = encryptSecret(longLivedToken);
    const expiresInSeconds = longLivedJson.expires_in || 5184000; // default 60 days
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    // 3. Save to database (encrypted at rest)
    const updatedSettings = await prisma.threadsSettings.upsert({
      where: { id: "global" },
      update: {
        accessToken: encryptedToken,
        threadsUserId: String(threadsUserId),
        enabled: true,
        tokenExpiresAt: expiresAt,
      },
      create: {
        id: "global",
        accessToken: encryptedToken,
        threadsUserId: String(threadsUserId),
        enabled: true,
        tokenExpiresAt: expiresAt,
      },
    });

    // Enable autoPublishThreads in global SocialMediaSettings
    await prisma.socialMediaSettings.upsert({
      where: { id: "global" },
      update: { autoPublishThreads: true },
      create: { id: "global", autoPublishThreads: true },
    });

    await logAudit(
      session.user.id,
      "UPDATE",
      "social_settings",
      "threads",
      `Connected Threads account: ${threadsUserId}`
    );

    return successResponse({
      success: true,
      threadsUserId: updatedSettings.threadsUserId,
      enabled: updatedSettings.enabled,
      tokenExpiresAt: expiresAt,
    });
  } catch (err) {
    console.error("[threads-exchange] Exchange failed error:", err);
    return errorResponse(err);
  }
}
