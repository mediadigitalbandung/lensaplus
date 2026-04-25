/**
 * POST /api/tags/research
 * Get AI-suggested SEO keywords for a topic.
 *
 * Body: { topic: string }
 * Returns: { suggestions: string[], provider, raw? }
 *
 * Auth: EDITOR+
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import {
  errorResponse,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { callAI } from "@/lib/ai-client";

export const dynamic = "force-dynamic";

const EDITOR_ROLES = ["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"] as const;

const bodySchema = z.object({
  topic: z.string().min(2, "Topik minimal 2 karakter").max(255),
});

/**
 * Try hard to extract a JSON array of strings from a possibly fenced LLM response.
 */
function parseSuggestions(text: string): string[] {
  if (!text) return [];

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();

  // Try direct JSON parse
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((x) => typeof x === "string")
        .map((x: string) => x.trim())
        .filter((x) => x.length > 0);
    }
  } catch {
    /* fall through */
  }

  // Try to find a JSON array substring
  const arrMatch = cleaned.match(/\[[\s\S]*?\]/);
  if (arrMatch) {
    try {
      const parsed = JSON.parse(arrMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((x) => typeof x === "string")
          .map((x: string) => x.trim())
          .filter((x) => x.length > 0);
      }
    } catch {
      /* fall through */
    }
  }

  // Last resort — split on newlines / bullets / commas
  const fallback = cleaned
    .split(/\r?\n|,/)
    .map((line) =>
      line
        .replace(/^[\s\-*\d.)]+/, "")
        .replace(/^["']|["']$/g, "")
        .trim(),
    )
    .filter((x) => x.length > 1 && x.length <= 80);

  return Array.from(new Set(fallback)).slice(0, 12);
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole([...EDITOR_ROLES]);
    const raw = await req.json();
    const { topic } = bodySchema.parse(raw);

    const userPrompt = `Suggest 8-12 SEO keywords for Indonesian legal news topic: ${topic}. Return strictly a JSON array of strings (no prose, no markdown), e.g. ["keyword1", "keyword2", ...]. Each keyword 2-5 words, lowercase, in Bahasa Indonesia.`;

    const result = await callAI({
      feature: "tag_research",
      userPrompt,
      maxTokens: 400,
      temperature: 0.6,
      userId: session.user.id,
    });

    const suggestions = parseSuggestions(result.text);

    return successResponse({
      suggestions,
      provider: result.provider,
      raw: suggestions.length === 0 ? result.text : undefined,
      durationMs: result.durationMs,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
