/**
 * POST /api/ai/test
 * Test AI provider connectivity by issuing a tiny prompt.
 * Body: { provider?: "anthropic" | "deepseek" }
 *   - If provider is set: tests only that provider (force).
 *   - If omitted: tests both providers separately and returns per-provider status.
 *
 * Auth: SUPER_ADMIN
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

const bodySchema = z.object({
  provider: z.enum(["anthropic", "deepseek"]).optional(),
});

interface ProviderResult {
  success: boolean;
  provider: "anthropic" | "deepseek";
  response?: string;
  durationMs?: number;
  error?: string;
}

async function runOne(
  provider: "anthropic" | "deepseek",
): Promise<ProviderResult> {
  try {
    const result = await callAI({
      feature: "test",
      userPrompt: "Reply with one short word: OK",
      maxTokens: 10,
      forceProvider: provider,
    });
    return {
      success: true,
      provider,
      response: result.text,
      durationMs: result.durationMs,
    };
  } catch (err) {
    return {
      success: false,
      provider,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN"]);
    const raw = await req.json().catch(() => ({}));
    const { provider } = bodySchema.parse(raw || {});

    if (provider) {
      const r = await runOne(provider);
      return successResponse(r);
    }

    // No provider given — test both
    const [anthropic, deepseek] = await Promise.all([
      runOne("anthropic"),
      runOne("deepseek"),
    ]);

    return successResponse({
      success: anthropic.success || deepseek.success,
      results: { anthropic, deepseek },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
