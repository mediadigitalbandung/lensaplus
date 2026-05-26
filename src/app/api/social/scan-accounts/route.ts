import { NextRequest } from "next/server";
import { requireRole, successResponse, errorResponse } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN"]);
    const body = await req.json().catch(() => ({}));
    let token = body.accessToken;

    // If no token is provided, or if it is empty/placeholder, read the saved token from DB
    if (!token || token === "(tidak berubah)" || token.includes("...")) {
      const igSettings = await prisma.instagramSettings.findUnique({
        where: { id: "global" },
      });
      token = igSettings?.accessToken;
    }

    if (!token) {
      return successResponse({
        success: false,
        error: "Access token tidak ditemukan. Harap masukkan Access Token terlebih dahulu.",
      });
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
      const res = await fetch(GRAPH_URL);
      const data = await res.json();
      
      if (data && Array.isArray(data.data)) {
        for (const page of data.data) {
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
      const debugRes = await fetch(DEBUG_URL);
      const debugData = await debugRes.json();
      
      const granularScopes = debugData?.data?.granular_scopes || [];
      const pageIdsSet = new Set<string>();

      for (const gs of granularScopes) {
        if ((gs.scope === "pages_show_list" || gs.scope === "pages_read_engagement") && Array.isArray(gs.target_ids)) {
          for (const pid of gs.target_ids) {
            pageIdsSet.add(pid);
          }
        }
      }

      for (const pid of pageIdsSet) {
        if (!accountsMap.has(pid)) {
          // Fetch the page details directly
          const PAGE_URL = `https://graph.facebook.com/v21.0/${pid}?fields=instagram_business_account{id,username,name},name,access_token&access_token=${encodeURIComponent(token)}`;
          const pageRes = await fetch(PAGE_URL);
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
