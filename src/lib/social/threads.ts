/**
 * Threads publisher — wraps the two-step Meta Threads API v1.0 media create
 * + threads_publish flow.
 *
 * Requires a Threads access token and threadsUserId.
 */

import type { PreparedPost, PublishResult } from "./types";

const GRAPH_BASE = "https://graph.threads.net/v1.0";
const TIMEOUT_MS = 60_000;

interface ThreadsConfig {
  accessToken: string;
  threadsUserId: string;
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
      return "Access token expired or invalid (code 190). Regenerate Threads token.";
    case 100:
      return "Invalid parameter (code 100). Check image URL or caption.";
    case 4:
      return "Application request limit reached (code 4). Meta is rate-limiting the app. Please wait 15-30 minutes for the limit to reset, or check that your Meta App is set to Live Mode.";
    default:
      return code ? `Threads API error code ${code}` : "Unknown Threads API error";
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

export class ThreadsPublisher {
  constructor(private config: ThreadsConfig) {}

  /**
   * 2-step publish flow:
   * 1. POST /{threadsUserId}/threads         → container creation_id
   * 2. POST /{threadsUserId}/threads_publish → threads_media_id (externalId)
   */
  async publish(post: PreparedPost): Promise<PublishResult> {
    const { accessToken, threadsUserId } = this.config;
    if (!accessToken || !threadsUserId) {
      return { success: false, error: "Threads not configured (missing accessToken or threadsUserId)" };
    }

    try {
      // Step 1: create media container.
      const createUrl = `${GRAPH_BASE}/me/threads`;
      const params: Record<string, string> = {
        media_type: "IMAGE",
        image_url: post.imageUrl,
        text: post.caption,
        access_token: accessToken,
      };
      const createBody = new URLSearchParams(params);
      const createRes = await graphRequest<{ id?: string }>(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: createBody.toString(),
      });
      if (!createRes.id) {
        return { success: false, error: "Threads media container creation returned no id" };
      }

      // Wait for the container to finish processing (polling status_code)
      let statusFinished = false;
      let retries = 5; // 5 attempts
      const delayMs = 10000; // 10 seconds delay between polls

      console.log(`[threads] Media container ${createRes.id} created, polling status to ensure it is ready...`);

      while (retries > 0 && !statusFinished) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        const statusUrl = `${GRAPH_BASE}/${encodeURIComponent(createRes.id)}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`;
        try {
          const statusRes = await graphRequest<{ status_code?: string }>(statusUrl, {
            method: "GET",
          });
          
          const code = statusRes?.status_code;
          console.log(`[threads] Polled container ${createRes.id} status_code: ${code} (retries left: ${retries - 1})`);
          
          if (code === "FINISHED") {
            statusFinished = true;
          } else if (code === "ERROR") {
            throw new Error("Meta Threads container processing failed (status_code: ERROR). The image dimensions, aspect ratio, or format may be invalid.");
          } else if (code === "EXPIRED") {
            throw new Error("Meta Threads container expired during processing.");
          }
        } catch (pollErr) {
          const errMsg = pollErr instanceof Error ? pollErr.message : String(pollErr);
          // Use word-boundary regex to prevent false matches (like code 100 matching code 10)
          if (/\bcode 190\b/.test(errMsg) || /\bcode 10\b/.test(errMsg) || /\bcode 200\b/.test(errMsg)) {
            throw pollErr;
          }
          console.warn(`[threads] Polling Threads container status attempt failed, retrying...`, pollErr);
          
          // If status_code is not supported or returns a field access error, break immediately to attempt direct publishing
          if (errMsg.includes("nonexisting field") || errMsg.includes("status_code")) {
            console.log("[threads] status_code is not supported or accessible. Skipping polling and proceeding directly to publish fallback.");
            break;
          }
        }
        retries--;
      }

      if (!statusFinished) {
        console.warn(`[threads] Container ${createRes.id} still in processing state after 45 seconds, attempting fallback publish...`);
      }

      // Step 2: publish.
      const publishUrl = `${GRAPH_BASE}/me/threads_publish`;
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
        return { success: false, error: "Threads publish returned no id" };
      }

      return { success: true, externalId: publishRes.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTokenExpired = /code 190/i.test(msg);
      const error = isTokenExpired ? `TOKEN_EXPIRED — ${msg}` : msg;
      if (isTokenExpired) {
        console.error("[threads] TOKEN_EXPIRED error 190 — pipeline blocked until token is refreshed");
      }
      return { success: false, error };
    }
  }

  /**
   * Text-only publish (media_type=TEXT) with optional reply chaining — used by
   * the live-blog syndicator so each update threads under the opening post.
   * Unlike publish(), this needs no image and no container polling (text
   * containers are ready immediately); a short delay covers Meta's eventual
   * consistency before threads_publish.
   */
  async publishText(opts: {
    text: string;
    replyToId?: string;
  }): Promise<PublishResult> {
    const { accessToken, threadsUserId } = this.config;
    if (!accessToken || !threadsUserId) {
      return { success: false, error: "Threads not configured (missing accessToken or threadsUserId)" };
    }
    if (!opts.text.trim()) {
      return { success: false, error: "Threads text post requires non-empty text" };
    }

    try {
      const params: Record<string, string> = {
        media_type: "TEXT",
        text: opts.text,
        access_token: accessToken,
      };
      if (opts.replyToId) params.reply_to_id = opts.replyToId;

      const createRes = await graphRequest<{ id?: string }>(`${GRAPH_BASE}/me/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params).toString(),
      });
      if (!createRes.id) {
        return { success: false, error: "Threads text container creation returned no id" };
      }

      // Brief settle before publishing (text needs no full status polling).
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const publishRes = await graphRequest<{ id?: string }>(`${GRAPH_BASE}/me/threads_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          creation_id: createRes.id,
          access_token: accessToken,
        }).toString(),
      });

      if (!publishRes.id) {
        return { success: false, error: "Threads text publish returned no id" };
      }
      return { success: true, externalId: publishRes.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTokenExpired = /code 190/i.test(msg);
      const error = isTokenExpired ? `TOKEN_EXPIRED — ${msg}` : msg;
      if (isTokenExpired) {
        console.error("[threads] TOKEN_EXPIRED error 190 — live syndication blocked until token refreshed");
      }
      return { success: false, error };
    }
  }

  /**
   * Delete a post (Threads API does not support programmatic deletion currently; returns local deletion flag).
   */
  async deletePost(externalId: string): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }
}
