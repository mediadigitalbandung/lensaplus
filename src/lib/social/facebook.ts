/**
 * Facebook Page publisher — supports both link-share and photo post modes,
 * plus post deletion (takedown).
 *
 * Requires a Page access token with `pages_manage_posts` + `pages_read_engagement`.
 */

import type { PreparedPost, PublishResult } from "./types";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";
const TIMEOUT_MS = 60_000;
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";

export type FacebookPostMode = "link" | "photo";

interface FacebookConfig {
  accessToken: string;
  pageId: string;
  postMode: FacebookPostMode;
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
      return "Page access token expired or invalid (code 190). Regenerate a long-lived Page token.";
    case 100:
      return "Invalid parameter (code 100). Check URL / caption / page id.";
    case 200:
      return "Permission denied (code 200). Missing pages_manage_posts scope?";
    case 368:
      return "Temporarily blocked by Meta spam filter (code 368).";
    case 506:
      return "Duplicate status (code 506). Facebook rejects identical posts within short window.";
    default:
      return code ? `Meta Graph error code ${code}` : "Unknown Meta Graph error";
  }
}

async function graphRequest<T>(url: string, init: RequestInit): Promise<T> {
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

export interface PreparedFacebookPost extends PreparedPost {
  linkUrl?: string;
}

export class FacebookPublisher {
  constructor(private config: FacebookConfig) {}

  async publishLinkShare(
    post: PreparedFacebookPost & { linkUrl: string },
  ): Promise<PublishResult> {
    const { accessToken, pageId } = this.config;
    if (!accessToken || !pageId) {
      return { success: false, error: "Facebook not configured (missing accessToken or pageId)" };
    }
    try {
      const url = `${GRAPH_BASE}/${encodeURIComponent(pageId)}/feed`;
      const body = new URLSearchParams({
        message: post.caption,
        link: post.linkUrl,
        access_token: accessToken,
      });
      const res = await graphRequest<{ id?: string }>(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!res.id) {
        return { success: false, error: "Facebook feed post returned no id" };
      }
      return { success: true, externalId: res.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTokenExpired = /code 190/i.test(msg);
      const error = isTokenExpired ? `TOKEN_EXPIRED — ${msg}` : msg;
      if (isTokenExpired) {
        console.error("[facebook] TOKEN_EXPIRED error 190 — pipeline blocked until token is refreshed");
      }
      return { success: false, error };
    }
  }

  async publishPhoto(post: PreparedPost): Promise<PublishResult> {
    const { accessToken, pageId } = this.config;
    if (!accessToken || !pageId) {
      return { success: false, error: "Facebook not configured (missing accessToken or pageId)" };
    }
    try {
      const url = `${GRAPH_BASE}/${encodeURIComponent(pageId)}/photos`;
      const body = new URLSearchParams({
        url: post.imageUrl,
        caption: post.caption,
        access_token: accessToken,
      });
      const res = await graphRequest<{ id?: string; post_id?: string }>(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const externalId = res.post_id || res.id;
      if (!externalId) {
        return { success: false, error: "Facebook photo post returned no id" };
      }
      return { success: true, externalId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTokenExpired = /code 190/i.test(msg);
      const error = isTokenExpired ? `TOKEN_EXPIRED — ${msg}` : msg;
      if (isTokenExpired) {
        console.error("[facebook] TOKEN_EXPIRED error 190 — pipeline blocked until token is refreshed");
      }
      return { success: false, error };
    }
  }

  /**
   * Dispatcher that chooses between link and photo based on config.postMode.
   * If a linkUrl is not provided for link mode, one is derived from the
   * article slug by callers (orchestrator does this).
   */
  async publish(post: PreparedFacebookPost): Promise<PublishResult> {
    if (this.config.postMode === "link") {
      const linkUrl =
        post.linkUrl ||
        `${SITE_URL.replace(/\/+$/, "")}/berita/${post.articleId}`;
      return this.publishLinkShare({ ...post, linkUrl });
    }
    return this.publishPhoto(post);
  }

  /**
   * Delete a previously-published post by its externalId.
   * Graph API: DELETE /{post_id}?access_token=...
   */
  async deletePost(externalId: string): Promise<{ success: boolean; error?: string }> {
    const { accessToken } = this.config;
    if (!accessToken) {
      return { success: false, error: "Facebook not configured (missing accessToken)" };
    }
    try {
      const url = `${GRAPH_BASE}/${encodeURIComponent(externalId)}?access_token=${encodeURIComponent(
        accessToken,
      )}`;
      const res = await graphRequest<{ success?: boolean }>(url, {
        method: "DELETE",
      });
      return { success: res.success !== false };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
