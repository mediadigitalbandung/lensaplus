/**
 * Telegram publisher — posts to a channel/group via the Bot API.
 *
 * Auth model is dead simple compared to Meta: a single bot token (from
 * @BotFather) + a chat id (channel @username or numeric "-100..." id). The bot
 * must be an admin of the target channel. No OAuth, no app review.
 *
 * Used by the live-blog syndicator: the opening post is sent once, then each
 * live update is sent as a reply to it so the channel shows one chronological
 * live thread. Telegram is the only integrated platform that can also EDIT an
 * existing post, which `editMessageText` exposes for a future "living post" UX.
 *
 * Docs: https://core.telegram.org/bots/api
 */

const API_BASE = "https://api.telegram.org";
const TIMEOUT_MS = 30_000;
// Telegram hard limit is 4096 chars for a text message.
export const TELEGRAM_TEXT_MAX = 4096;

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface TelegramResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
}

/**
 * Escape text destined for parse_mode=HTML. Telegram only honours a small tag
 * whitelist (b/i/u/s/a/code/pre/blockquote/tg-spoiler); everything else must be
 * escaped or it errors. Callers building HTML messages escape dynamic parts
 * with this, then wrap with the few tags they need.
 */
export function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export class TelegramPublisher {
  constructor(private config: TelegramConfig) {}

  private async call<T>(
    method: string,
    payload: Record<string, unknown>,
  ): Promise<TelegramApiResponse<T>> {
    const { botToken } = this.config;
    const url = `${API_BASE}/bot${botToken}/${method}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const text = await res.text();
      let body: TelegramApiResponse<T>;
      try {
        body = text ? JSON.parse(text) : { ok: false, description: "empty response" };
      } catch {
        body = { ok: false, description: text.slice(0, 200) };
      }
      return body;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Send a message. Retries once on 429 (rate-limit), honouring retry_after.
   */
  async sendMessage(opts: {
    text: string;
    parseMode?: "HTML" | "MarkdownV2";
    replyToMessageId?: number;
    disablePreview?: boolean;
  }): Promise<TelegramResult> {
    const { botToken, chatId } = this.config;
    if (!botToken || !chatId) {
      return { success: false, error: "Telegram not configured (missing botToken or chatId)" };
    }

    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text: opts.text.slice(0, TELEGRAM_TEXT_MAX),
    };
    if (opts.parseMode) payload.parse_mode = opts.parseMode;
    if (opts.replyToMessageId) payload.reply_to_message_id = opts.replyToMessageId;
    if (opts.disablePreview) {
      payload.link_preview_options = { is_disabled: true };
    }

    try {
      let res = await this.call<{ message_id: number }>("sendMessage", payload);
      if (!res.ok && res.error_code === 429 && res.parameters?.retry_after) {
        const waitMs = Math.min(res.parameters.retry_after, 30) * 1000;
        await new Promise((r) => setTimeout(r, waitMs));
        res = await this.call<{ message_id: number }>("sendMessage", payload);
      }
      if (!res.ok || !res.result) {
        return { success: false, error: this.describe(res) };
      }
      return { success: true, messageId: res.result.message_id };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async editMessageText(opts: {
    messageId: number;
    text: string;
    parseMode?: "HTML" | "MarkdownV2";
    disablePreview?: boolean;
  }): Promise<TelegramResult> {
    const { botToken, chatId } = this.config;
    if (!botToken || !chatId) {
      return { success: false, error: "Telegram not configured" };
    }
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      message_id: opts.messageId,
      text: opts.text.slice(0, TELEGRAM_TEXT_MAX),
    };
    if (opts.parseMode) payload.parse_mode = opts.parseMode;
    if (opts.disablePreview) payload.link_preview_options = { is_disabled: true };
    try {
      const res = await this.call<{ message_id: number }>("editMessageText", payload);
      if (!res.ok) return { success: false, error: this.describe(res) };
      return { success: true, messageId: opts.messageId };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async pinChatMessage(messageId: number): Promise<TelegramResult> {
    try {
      const res = await this.call<boolean>("pinChatMessage", {
        chat_id: this.config.chatId,
        message_id: messageId,
        disable_notification: true,
      });
      if (!res.ok) return { success: false, error: this.describe(res) };
      return { success: true, messageId };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async deleteMessage(messageId: number): Promise<TelegramResult> {
    try {
      const res = await this.call<boolean>("deleteMessage", {
        chat_id: this.config.chatId,
        message_id: messageId,
      });
      if (!res.ok) return { success: false, error: this.describe(res) };
      return { success: true, messageId };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Lightweight credential check via getMe. */
  async verify(): Promise<TelegramResult> {
    try {
      const res = await this.call<{ id: number; username?: string }>("getMe", {});
      if (!res.ok) return { success: false, error: this.describe(res) };
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private describe(res: TelegramApiResponse<unknown>): string {
    const code = res.error_code ? `(${res.error_code}) ` : "";
    return `Telegram API error ${code}${res.description || "unknown error"}`;
  }
}
