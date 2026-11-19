import { NextRequest } from "next/server";
import { ApiError, requireRole, successResponse, errorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const META_FETCH_TIMEOUT_MS = 15_000;

function isMaskedOrPlaceholderToken(raw: string): boolean {
  if (!raw) return true;
  if (raw === "(tidak berubah)") return true;
  if (raw.includes("...")) return true;
  if (raw.startsWith("••••••••") || /^\*+$/.test(raw)) return true;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN"]);
    const body = await req.json().catch(() => ({}));
    let token = typeof body.accessToken === "string" ? body.accessToken.trim() : "";

    // Security (HIGH-02): NEVER decrypt or return previously stored DB tokens.
    // The admin must explicitly paste a fresh Meta User Access Token to scan pages.
    if (isMaskedOrPlaceholderToken(token)) {
      throw new ApiError(
        "Harap masukkan Access Token Meta baru secara eksplisit sebelum melakukan scan akun.",
        400,
      );
    }

    // Exchange short-lived token for long-lived token if App ID & Secret are available
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (appId && appSecret) {
      try {
        console.log("[scan-accounts] Found META_APP_ID and META_APP_SECRET. Exchanging token for a long-lived one...");
        const EXCHANGE_URL = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(token)}`;
        const exchangeRes = await fetch(EXCHANGE_URL, {
          signal: AbortSignal.timeout(META_FETCH_TIMEOUT_MS),
        });
        const exchangeData = await exchangeRes.json();
        if (exchangeData.access_token) {
          token = exchangeData.access_token;
          console.log("[scan-accounts] Successfully exchanged for long-lived User Access Token.");
        } else if (exchangeData.error) {
          console.warn("[scan-accounts] Token exchange returned error from Meta:", exchangeData.error);
        } else {
          console.warn("[scan-accounts] Token exchange response did not contain access_token.");
        }
      } catch (exchangeErr) {
        console.error("[scan-accounts] Token exchange failed:", exchangeErr);
      }
    }

    const accountsMap = new Map<string, {
      pageId: string;
      pageName: string;
      pageAccessToken: string;
      instagramId?: string;
      instagramUsername?: string;
      instagramName?: string;
    }>();

    // 1. Try traditional me/accounts
    try {
      const GRAPH_URL = `https://graph.facebook.com/v21.0/me/accounts?fields=instagram_business_account{id,username,name},name,access_token&access_token=${encodeURIComponent(token)}`;
      const res = await fetch(GRAPH_URL, {
        signal: AbortSignal.timeout(META_FETCH_TIMEOUT_MS),
      });
      const data = await res.json();

      if (data && Array.isArray(data.data)) {
        for (const page of data.data) {
          if (typeof page?.id !== "string" || !page.id) continue;
          accountsMap.set(page.id, {
            pageId: page.id,
            pageName: page.name,
            pageAccessToken: page.access_token || token,
            instagramId: page.instagram_business_account?.id,
            instagramUsername: page.instagram_business_account?.username,
            instagramName: page.instagram_business_account?.name,
          });
        }
      }
    } catch (e) {
      console.error("me/accounts failed:", e);
    }

    // 2. Fallback / Enhancement: Debug Token and fetch pages directly by ID
    // This is incredibly useful for custom apps in Development Mode where /me/accounts returns empty.
    try {
      const DEBUG_URL = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`;
      const debugRes = await fetch(DEBUG_URL, {
        signal: AbortSignal.timeout(META_FETCH_TIMEOUT_MS),
      });
      const debugData = await debugRes.json();

      const granularScopes = debugData?.data?.granular_scopes || [];
      const pageIdsSet = new Set<string>();

      for (const gs of granularScopes) {
        if ((gs.scope === "pages_show_list" || gs.scope === "pages_read_engagement") && Array.isArray(gs.target_ids)) {
          for (const pid of gs.target_ids) {
            if (typeof pid === "string" && /^\d+$/.test(pid)) {
              pageIdsSet.add(pid);
            }
          }
        }
      }

      for (const pid of pageIdsSet) {
        if (!accountsMap.has(pid)) {
          // Fetch the page details directly
          const PAGE_URL = `https://graph.facebook.com/v21.0/${pid}?fields=instagram_business_account{id,username,name},name,access_token&access_token=${encodeURIComponent(token)}`;
          const pageRes = await fetch(PAGE_URL, {
            signal: AbortSignal.timeout(META_FETCH_TIMEOUT_MS),
          });
          const page = await pageRes.json();
          if (page && page.id && !page.error) {
            accountsMap.set(pid, {
              pageId: page.id,
              pageName: page.name,
              pageAccessToken: page.access_token || token,
              instagramId: page.instagram_business_account?.id,
              instagramUsername: page.instagram_business_account?.username,
              instagramName: page.instagram_business_account?.name,
            });
          }
        }
      }
    } catch (e) {
      console.error("Token debug fallback failed:", e);
    }

    const accounts = Array.from(accountsMap.values());

    if (accounts.length === 0) {
      return successResponse({
        success: false,
        accounts: [],
        error: "Tidak ditemukan Facebook Page atau akun Instagram terhubung di bawah token ini.",
      });
    }

    return successResponse({
      success: true,
      accounts,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
