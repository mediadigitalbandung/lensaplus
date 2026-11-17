/**
 * GET  /api/social/settings  — return { global, instagram, facebook, threads, telegram, threadsAppId }.
 * PUT  /api/social/settings  — body { scope: "global"|"instagram"|"facebook"|"threads"|"telegram", data: {...} }
 * Auth: SUPER_ADMIN
 *
 * Access tokens / bot tokens are encrypted at rest via `encryptSecret` and
 * returned masked on both GET and PUT.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  errorResponse,
  logAudit,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { decryptSecret, encryptSecret } from "@/lib/crypto-secrets";

export const dynamic = "force-dynamic";

function maskToken(t: string | null | undefined): string | null {
  if (!t) return null;
  if (t.length <= 8) return "***";
  return `${t.slice(0, 4)}...${t.slice(-4)}`;
}

function safeMaskStoredToken(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    const plaintext = decryptSecret(stored);
    return maskToken(plaintext);
  } catch {
    return "••••••••????";
  }
}

function isPlaceholderToken(val: string): boolean {
  if (!val) return true;
  if (val === "(tidak berubah)" || val === "***") return true;
  if (val.includes("...")) return true;
  if (val.startsWith("••••••••")) return true;
  return false;
}

function sanitizeRowForResponse<
  T extends { accessToken?: string | null; botToken?: string | null },
>(row: T): Record<string, unknown> {
  const clone = { ...row } as Record<string, unknown>;
  if ("accessToken" in clone) {
    clone.accessToken = safeMaskStoredToken(row.accessToken);
    clone.hasAccessToken = Boolean(row.accessToken);
  }
  if ("botToken" in clone) {
    clone.botToken = safeMaskStoredToken(row.botToken);
    clone.hasBotToken = Boolean(row.botToken);
  }
  return clone;
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

async function getOrCreateSingletons() {
  const [globalRow, igRow, fbRow, threadsRow] = await Promise.all([
    prisma.socialMediaSettings.findUnique({ where: { id: "global" } }).then(
      (r) => r ?? prisma.socialMediaSettings.create({ data: { id: "global" } }),
    ),
    prisma.instagramSettings.findUnique({ where: { id: "global" } }).then(
      (r) => r ?? prisma.instagramSettings.create({ data: { id: "global" } }),
    ),
    prisma.facebookSettings.findUnique({ where: { id: "global" } }).then(
      (r) => r ?? prisma.facebookSettings.create({ data: { id: "global" } }),
    ),
    prisma.threadsSettings.findUnique({ where: { id: "global" } }).then(
      (r) => r ?? prisma.threadsSettings.create({ data: { id: "global" } }),
    ),
  ]);
  return { global: globalRow, instagram: igRow, facebook: fbRow, threads: threadsRow };
}

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"]);
    const settings = await getOrCreateSingletons();

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
      threadsAppId: process.env.THREADS_APP_ID || process.env.NEXT_PUBLIC_THREADS_APP_ID || null,
      instagram: {
        ...settings.instagram,
        accessToken: safeMaskStoredToken(settings.instagram.accessToken),
        hasAccessToken: Boolean(settings.instagram.accessToken),
      },
      facebook: {
        ...settings.facebook,
        accessToken: safeMaskStoredToken(settings.facebook.accessToken),
        hasAccessToken: Boolean(settings.facebook.accessToken),
      },
      threads: {
        ...settings.threads,
        accessToken: safeMaskStoredToken(settings.threads.accessToken),
        hasAccessToken: Boolean(settings.threads.accessToken),
      },
      telegram: {
        enabled: telegram?.enabled ?? false,
        chatId: telegram?.chatId ?? null,
        botToken: safeMaskStoredToken(telegram?.botToken),
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
  autoPublishReels: z.boolean().optional(),
  reelDurationSec: z.number().int().min(3).max(60).optional(),
  reelDefaultBgmUrl: z.string().nullable().optional(),
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

async function prepareAccessTokenFields(
  rawToken: string | null | undefined,
  rawExpiresAt: string | null | undefined,
  checkMetaExpiry: boolean,
): Promise<Record<string, unknown>> {
  const fields: Record<string, unknown> = {};
  if (rawToken === null) {
    fields.accessToken = null;
    fields.tokenExpiresAt = null;
    return fields;
  }
  if (rawToken !== undefined) {
    const trimmed = rawToken.trim();
    if (!isPlaceholderToken(trimmed)) {
      fields.accessToken = encryptSecret(trimmed);
      if (rawExpiresAt !== undefined) {
        fields.tokenExpiresAt = rawExpiresAt ? new Date(rawExpiresAt) : null;
      } else if (checkMetaExpiry) {
        fields.tokenExpiresAt = await getMetaTokenExpiry(trimmed);
      }
      return fields;
    }
  }
  if (rawExpiresAt !== undefined) {
    fields.tokenExpiresAt = rawExpiresAt ? new Date(rawExpiresAt) : null;
  }
  return fields;
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN"]);
    const body = await req.json();
    const parsed = putSchema.parse(body);

    let updatedRow: Record<string, unknown>;

    if (parsed.scope === "global") {
      const data = globalSchema.parse(parsed.data);
      updatedRow = (await prisma.socialMediaSettings.upsert({
        where: { id: "global" },
        update: data,
        create: { id: "global", ...data },
      })) as unknown as Record<string, unknown>;
    } else if (parsed.scope === "instagram") {
      const { accessToken, tokenExpiresAt, ...rest } = instagramSchema.parse(parsed.data);
      const tokenFields = await prepareAccessTokenFields(accessToken, tokenExpiresAt, true);
      const prepared = { ...rest, ...tokenFields };
      const row = await prisma.instagramSettings.upsert({
        where: { id: "global" },
        update: prepared,
        create: { id: "global", ...prepared },
      });
      updatedRow = sanitizeRowForResponse(row);
    } else if (parsed.scope === "facebook") {
      const { accessToken, tokenExpiresAt, ...rest } = facebookSchema.parse(parsed.data);
      const tokenFields = await prepareAccessTokenFields(accessToken, tokenExpiresAt, true);
      const prepared = { ...rest, ...tokenFields };
      const row = await prisma.facebookSettings.upsert({
        where: { id: "global" },
        update: prepared,
        create: { id: "global", ...prepared },
      });
      updatedRow = sanitizeRowForResponse(row);
    } else if (parsed.scope === "threads") {
      const { accessToken, tokenExpiresAt, ...rest } = threadsSchema.parse(parsed.data);
      const tokenFields = await prepareAccessTokenFields(accessToken, tokenExpiresAt, false);
      const prepared = { ...rest, ...tokenFields };
      const row = await prisma.threadsSettings.upsert({
        where: { id: "global" },
        update: prepared,
        create: { id: "global", ...prepared },
      });
      updatedRow = sanitizeRowForResponse(row);
    } else if (parsed.scope === "telegram") {
      const data = telegramSchema.parse(parsed.data);
      const prepared: Record<string, unknown> = {};
      if (data.chatId !== undefined) prepared.chatId = data.chatId;
      if (data.enabled !== undefined) prepared.enabled = data.enabled;
      if (data.botToken === null) {
        prepared.botToken = null;
      } else if (data.botToken !== undefined) {
        const trimmed = data.botToken.trim();
        if (!isPlaceholderToken(trimmed)) {
          prepared.botToken = encryptSecret(trimmed);
        }
      }
      const row = await prisma.telegramSettings.upsert({
        where: { id: "global" },
        update: prepared,
        create: { id: "global", ...prepared },
      });
      updatedRow = sanitizeRowForResponse(row);
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
