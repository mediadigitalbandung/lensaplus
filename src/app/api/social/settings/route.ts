/**
 * GET  /api/social/settings  — return { global, instagram, facebook } singletons.
 * PUT  /api/social/settings  — body { scope: "global"|"instagram"|"facebook", data: {...} }
 * Auth: SUPER_ADMIN
 *
 * Access tokens are returned masked on GET.
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
import { getAllSocialSettings } from "@/lib/social/orchestrator";

export const dynamic = "force-dynamic";

function maskToken(t: string | null | undefined): string | null {
  if (!t) return null;
  if (t.length <= 8) return "***";
  return `${t.slice(0, 4)}...${t.slice(-4)}`;
}

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"]);
    const settings = await getAllSocialSettings();

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
  defaultHashtags: z.string().nullable().optional(),
  defaultCTA: z.string().nullable().optional(),
  captionTemplate: z.string().nullable().optional(),
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
  postMode: z.enum(["link", "photo"]).optional(),
  templateDefaultId: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  tokenExpiresAt: z.string().datetime().nullable().optional(),
});

const putSchema = z.object({
  scope: z.enum(["global", "instagram", "facebook"]),
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
      const prepared = {
        ...data,
        tokenExpiresAt: data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : data.tokenExpiresAt,
      };
      updatedRow = await prisma.instagramSettings.upsert({
        where: { id: "global" },
        update: prepared,
        create: { id: "global", ...prepared },
      });
    } else if (parsed.scope === "facebook") {
      const data = facebookSchema.parse(parsed.data);
      const prepared = {
        ...data,
        tokenExpiresAt: data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : data.tokenExpiresAt,
      };
      updatedRow = await prisma.facebookSettings.upsert({
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
