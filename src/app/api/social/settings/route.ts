/**
 * GET  /api/social/settings  — return { global, instagram, facebook } singletons.
 * PUT  /api/social/settings  — body { scope: "global"|"instagram"|"facebook", data: {...} }
/**
 * GET  /api/social/settings  — return { global, instagram, facebook } singletons.
 * PUT  /api/social/settings  — body { scope: "global"|"instagram"|"facebook", data: {...} }
 * Auth: SUPER_ADMIN
 *
 * Access tokens are returned masked on GET.
 */

import { NextRequest } from "next/server";
import { execSync } from "child_process";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  errorResponse,
  logAudit,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { getAllSocialSettings } from "@/lib/social/orchestrator";

export const dynamic = "force-dynamic";

function maskToken(t: string | null | undefined): string | null {
  if (!t) return null;
  if (t.length <= 8) return "***";
  return `${t.slice(0, 4)}...${t.slice(-4)}`;
}

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

async function getMetaTokenExpiry(token: string): Promise<Date | null> {
  try {
    const url = `${GRAPH_BASE}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      console.warn(`[getMetaTokenExpiry] debug_token API returned HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    const expiresAtUnix = json?.data?.expires_at ?? 0;
    if (expiresAtUnix === 0) return null; // Never expires
    return new Date(expiresAtUnix * 1000);
  } catch (e) {
    console.error("[getMetaTokenExpiry] Error debugging token:", e);
    return null;
  }
}

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"]);
    let settings;
    try {
      settings = await getAllSocialSettings();
    } catch (dbErr) {
      console.warn("[settings API] DB query failed, attempting auto-migration (db push)...", dbErr);
      try {
        execSync("npx prisma db push --accept-data-loss", { stdio: "inherit" });
        settings = await getAllSocialSettings();
      } catch (migrationErr) {
        console.error("[settings API] Auto-migration failed:", migrationErr);
        throw dbErr;
      }
    }

    // Telegram lives in its own table; fetch separately and tolerate the table
    // not existing yet (pre-migration) by falling back to defaults.
    let telegram: { enabled: boolean; chatId: string | null; botToken: string | null } | null = null;
    try {
      telegram = await prisma.telegramSettings.findUnique({ where: { id: "global" } });
    } catch {
      telegram = null;
    }

    return successResponse({
      global: settings.global,
      instagram: {
        ...settings.instagram,
        accessToken: maskToken(settings.instagram.accessToken),
        hasAccessToken: Boolean(settings.instagram.accessToken),
      },
      facebook: {
        ...settings.facebook,
        accessToken: maskToken(settings.facebook.accessToken),
        hasAccessToken: Boolean(settings.facebook.accessToken),
      },
      threads: {
        ...settings.threads,
        accessToken: maskToken(settings.threads.accessToken),
        hasAccessToken: Boolean(settings.threads.accessToken),
      },
      telegram: {
        enabled: telegram?.enabled ?? false,
        chatId: telegram?.chatId ?? null,
        botToken: maskToken(telegram?.botToken),
        hasBotToken: Boolean(telegram?.botToken),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

const globalSchema = z.object({
  draftMode: z.boolean().optional(),
  autoPublishIG: z.boolean().optional(),
  autoPublishFB: z.boolean().optional(),
  autoPublishTwitter: z.boolean().optional(),
  autoPublishThreads: z.boolean().optional(),
  defaultHashtags: z.string().nullable().optional(),
  defaultCTA: z.string().nullable().optional(),
  captionTemplate: z.string().nullable().optional(),
  liveSyndicateTelegram: z.boolean().optional(),
  liveSyndicateThreads: z.boolean().optional(),
  liveSyndicateHighlightsOnly: z.boolean().optional(),
});

const telegramSchema = z.object({
  botToken: z.string().nullable().optional(),
  chatId: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
});

const instagramSchema = z.object({
  accessToken: z.string().nullable().optional(),
  igUserId: z.string().nullable().optional(),
  templateDefaultId: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  captionMaxLen: z.number().int().optional(),
  hashtagCount: z.number().int().optional(),
  tokenExpiresAt: z.string().datetime().nullable().optional(),
});

const facebookSchema = z.object({
  accessToken: z.string().nullable().optional(),
  pageId: z.string().nullable().optional(),
  postMode: z.enum(["link", "photo", "both"]).optional(),
  templateDefaultId: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  tokenExpiresAt: z.string().datetime().nullable().optional(),
});

const threadsSchema = z.object({
  accessToken: z.string().nullable().optional(),
  threadsUserId: z.string().nullable().optional(),
  templateDefaultId: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  tokenExpiresAt: z.string().datetime().nullable().optional(),
});

const putSchema = z.object({
  scope: z.enum(["global", "instagram", "facebook", "threads", "telegram"]),
  data: z.record(z.unknown()),
});

export async function PUT(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN"]);
    const body = await req.json();
    const parsed = putSchema.parse(body);

    let updatedRow: unknown;

    if (parsed.scope === "global") {
      const data = globalSchema.parse(parsed.data);
      updatedRow = await prisma.socialMediaSettings.upsert({
        where: { id: "global" },
        update: data,
        create: { id: "global", ...data },
      });
    } else if (parsed.scope === "instagram") {
      const data = instagramSchema.parse(parsed.data);
      let tokenExpiresAt = data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : data.tokenExpiresAt;
      if (data.accessToken && data.accessToken !== "(tidak berubah)" && !data.accessToken.includes("...")) {
        tokenExpiresAt = await getMetaTokenExpiry(data.accessToken);
      }
      const prepared = {
        ...data,
        tokenExpiresAt,
      };
      updatedRow = await prisma.instagramSettings.upsert({
        where: { id: "global" },
        update: prepared,
        create: { id: "global", ...prepared },
      });
    } else if (parsed.scope === "facebook") {
      const data = facebookSchema.parse(parsed.data);
      let tokenExpiresAt = data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : data.tokenExpiresAt;
      if (data.accessToken && data.accessToken !== "(tidak berubah)" && !data.accessToken.includes("...")) {
        tokenExpiresAt = await getMetaTokenExpiry(data.accessToken);
      }
      const prepared = {
        ...data,
        tokenExpiresAt,
      };
      updatedRow = await prisma.facebookSettings.upsert({
        where: { id: "global" },
        update: prepared,
        create: { id: "global", ...prepared },
      });
    } else if (parsed.scope === "threads") {
      const data = threadsSchema.parse(parsed.data);
      let tokenExpiresAt = data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : data.tokenExpiresAt;
      if (data.accessToken && data.accessToken !== "(tidak berubah)" && !data.accessToken.includes("...")) {
        tokenExpiresAt = await getMetaTokenExpiry(data.accessToken);
      }
      const prepared = {
        ...data,
        tokenExpiresAt,
      };
      updatedRow = await prisma.threadsSettings.upsert({
        where: { id: "global" },
        update: prepared,
        create: { id: "global", ...prepared },
      });
    } else if (parsed.scope === "telegram") {
      const data = telegramSchema.parse(parsed.data);
      const prepared: Record<string, unknown> = {};
      if (data.chatId !== undefined) prepared.chatId = data.chatId;
      if (data.enabled !== undefined) prepared.enabled = data.enabled;
      // Only overwrite the bot token when a genuine new value is supplied —
      // a masked echo ("1234...cdef") or the "(tidak berubah)" sentinel keeps
      // the stored token; an explicit null clears it.
      if (data.botToken === null) {
        prepared.botToken = null;
      } else if (
        data.botToken &&
        !data.botToken.includes("...") &&
        data.botToken !== "(tidak berubah)"
      ) {
        prepared.botToken = data.botToken;
      }
      updatedRow = await prisma.telegramSettings.upsert({
        where: { id: "global" },
        update: prepared,
        create: { id: "global", ...prepared },
      });
    } else {
      throw new ApiError("Unknown scope", 400);
    }

    await logAudit(
      session.user.id,
      "UPDATE",
      "social_settings",
      parsed.scope,
      `Updated ${parsed.scope} settings`,
    );

    return successResponse(updatedRow);
  } catch (err) {
    return errorResponse(err);
  }
}
