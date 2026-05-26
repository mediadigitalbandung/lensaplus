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

    // Call Meta Graph API to list connected pages and their Instagram accounts
    const GRAPH_URL = `https://graph.facebook.com/v21.0/me/accounts?fields=instagram_business_account{id,username,name},name,access_token&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(GRAPH_URL);
    const data = await res.json();

    if (data.error) {
      return successResponse({
        success: false,
        error: `Gagal mengambil data dari Meta: ${data.error.message} (Code: ${data.error.code})`,
      });
    }

    const pages = data.data || [];
    const accounts: Array<{
      pageId: string;
      pageName: string;
      pageAccessToken: string;
      instagramId?: string;
      instagramUsername?: string;
      instagramName?: string;
    }> = [];

    for (const page of pages) {
      if (page.instagram_business_account) {
        accounts.push({
          pageId: page.id,
          pageName: page.name,
          pageAccessToken: page.access_token,
          instagramId: page.instagram_business_account.id,
          instagramUsername: page.instagram_business_account.username,
          instagramName: page.instagram_business_account.name,
        });
      } else {
        accounts.push({
          pageId: page.id,
          pageName: page.name,
          pageAccessToken: page.access_token,
        });
      }
    }

    return successResponse({
      success: true,
      accounts,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
