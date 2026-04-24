import { NextRequest } from "next/server";
import { z } from "zod";
import { purgeCache, purgeEverything } from "@/lib/cloudflare/purge";
import {
  requireRole,
  successResponse,
  errorResponse,
  logAudit,
} from "@/lib/api-utils";

const PurgeBodySchema = z.union([
  z.object({ urls: z.array(z.string().url()).min(1).max(30) }),
  z.object({ everything: z.literal(true) }),
]);

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN"]);

    const body = await req.json();
    const parsed = PurgeBodySchema.parse(body);

    let result;
    let detail: string;

    if ("everything" in parsed) {
      result = await purgeEverything();
      detail = `Cloudflare purge everything — success=${result.success}${result.error ? `, error=${result.error}` : ""}`;
    } else {
      result = await purgeCache(parsed.urls);
      detail = `Cloudflare purge ${parsed.urls.length} URL(s) — success=${result.success}${result.error ? `, error=${result.error}` : ""}`;
    }

    await logAudit(
      session.user.id,
      "CACHE_PURGE",
      "cloudflare",
      "manual",
      detail
    );

    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
