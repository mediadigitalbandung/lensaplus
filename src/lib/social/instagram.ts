/**
 * Instagram publisher — wraps the two-step Meta Graph API v21 media create
 * + media_publish flow.
 *
 * Requires an Instagram **Business** account connected to a Facebook Page
 * and a long-lived access token with `instagram_basic`, `instagram_content_publish`,
 * `pages_read_engagement`.
 */

import type { PreparedPost, PublishResult } from "./types";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";
const TIMEOUT_MS = 60_000;

interface InstagramConfig {
  accessToken: string;
  igUserId: string;
}

interface GraphError {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

function mapErrorCode(code?: number): string {
  switch (code) {
    case 190:
      return "Access token expired or invalid (code 190). Regenerate a long-lived token.";
    case 100:
      return "Invalid parameter (code 100). Commonly: image_url not publicly reachable, or malformed caption.";
    case 368:
      return "Temporarily blocked by Meta spam filter (code 368). Reduce posting frequency.";
    case 10:
      return "Application does not have permission (code 10). Check Instagram API permissions.";
    case 200:
      return "Permission denied (code 200). The user/page may have revoked access.";
    case 9:
      return "Rate limit reached or temporary block (code 9). Meta says: User is performing too many actions. Please stop posting and wait a few hours to 24 hours for Meta to reset the limit.";
    default:
      return code ? `Meta Graph error code ${code}` : "Unknown Meta Graph error";
  }
}

async function graphRequest<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    if (!res.ok) {
      const err = (body as GraphError)?.error;
      const prefix = mapErrorCode(err?.code);
      const detail = err?.message || text.slice(0, 200);
      throw new Error(`${prefix} — ${detail}`);
    }
    return body as T;
  } finally {
    clearTimeout(timeout);
  }
}

export class InstagramPublisher {
  constructor(private config: InstagramConfig) {}

  /**
   * 2-step publish flow:
   * 1. POST /{igUserId}/media         → container creation_id
   * 2. POST /{igUserId}/media_publish → ig_media_id (externalId)
   */
  async publish(post: PreparedPost): Promise<PublishResult> {
    const { accessToken, igUserId } = this.config;
    if (!accessToken || !igUserId) {
      return { success: false, error: "Instagram not configured (missing accessToken or igUserId)" };
    }

    try {
      // Step 1: create media container.
      const createUrl = `${GRAPH_BASE}/${encodeURIComponent(igUserId)}/media`;
      const params: Record<string, string> = {
        image_url: post.imageUrl,
        access_token: accessToken,
      };
      if (post.mediaType === "STORIES") {
        params.media_type = "STORIES";
      } else {
        params.caption = post.caption;
      }
      const createBody = new URLSearchParams(params);
      const createRes = await graphRequest<{ id?: string }>(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: createBody.toString(),
      });
      if (!createRes.id) {
        return { success: false, error: "Instagram media container creation returned no id" };
      }

      // Wait for the container to finish processing (polling status_code)
      // This solves the common Meta 9007 (Media ID is not available) race condition error
      let statusFinished = false;
      let retries = 15; // 15 attempts
      const delayMs = 3000; // 3 seconds delay between polls

      console.log(`[instagram] Media container ${createRes.id} created, polling status to ensure it is ready...`);

      while (retries > 0 && !statusFinished) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        // Workaround for Meta Graph API regression (May 23, 2026): Hitting /{container-id} directly
        // with a Page Access Token returns an unexpected "Authorization Error" (code 100, subcode 33).
        // Using the root query with ?ids={container-id} successfully bypasses this permissions bug!
        const statusUrl = `${GRAPH_BASE}/?ids=${encodeURIComponent(createRes.id)}&fields=status_code&access_token=${encodeURIComponent(accessToken)}`;
        try {
          const statusRes = await graphRequest<Record<string, { status_code?: string }>>(statusUrl, {
            method: "GET",
          });
          
          const code = statusRes?.[createRes.id]?.status_code;
          console.log(`[instagram] Polled container ${createRes.id} status_code: ${code} (retries left: ${retries - 1})`);
          
          if (code === "FINISHED") {
            statusFinished = true;
          } else if (code === "ERROR") {
            throw new Error("Meta container processing failed (status_code: ERROR). The image dimensions, aspect ratio, or format may be invalid.");
          } else if (code === "EXPIRED") {
            throw new Error("Meta container expired during processing.");
          }
        } catch (pollErr) {
          const errMsg = pollErr instanceof Error ? pollErr.message : String(pollErr);
          // If we hit a terminal error from our graphRequest helper (like permission or expired), throw immediately
          if (errMsg.includes("code 190") || errMsg.includes("code 10") || errMsg.includes("code 200")) {
            throw pollErr;
          }
          console.warn(`[instagram] Polling container status attempt failed, retrying...`, pollErr);
        }
        retries--;
      }

      if (!statusFinished) {
        console.warn(`[instagram] Container ${createRes.id} still in processing state after 45 seconds, attempting fallback publish...`);
      }

      // Step 2: publish.
      const publishUrl = `${GRAPH_BASE}/${encodeURIComponent(igUserId)}/media_publish`;
      const publishBody = new URLSearchParams({
        creation_id: createRes.id,
        access_token: accessToken,
      });
      const publishRes = await graphRequest<{ id?: string }>(publishUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: publishBody.toString(),
      });

      if (!publishRes.id) {
        return { success: false, error: "Instagram publish returned no id" };
      }

      return { success: true, externalId: publishRes.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // CRIT-11: surface token expiry clearly so orchestrator + cron can act.
      const isTokenExpired = /code 190/i.test(msg);
      const error = isTokenExpired ? `TOKEN_EXPIRED — ${msg}` : msg;
      if (isTokenExpired) {
        console.error("[instagram] TOKEN_EXPIRED error 190 — pipeline blocked until token is refreshed");
      }
      return { success: false, error };
    }
  }
}
