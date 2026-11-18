/**
 * Safe JSON parser for browser `fetch()` responses from Next.js API routes.
 *
 * Upstream proxies (Nginx 60s `504`, Cloudflare 100s `524`, `502`, or login
 * redirects) return HTML bodies (`<html> <head>...`) instead of JSON. Calling
 * `res.json()` directly throws `SyntaxError: Unexpected token '<' ...`. This
 * helper reads text first and converts non-JSON responses into structured errors.
 */
export interface ApiJsonPayload<T = Record<string, unknown>> {
  success?: boolean;
  data?: T;
  error?: string;
}

export async function parseApiJson<T = Record<string, unknown>>(
  res: Response,
): Promise<ApiJsonPayload<T> | null> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as ApiJsonPayload<T>;
  } catch {
    if (res.redirected || res.status === 401) {
      return {
        success: false,
        error:
          "Sesi login telah berakhir. Silakan muat ulang halaman dan masuk kembali.",
      };
    }
    if (res.status === 504 || res.status === 524) {
      return {
        success: false,
        error: `Koneksi ke server timeout (HTTP ${res.status}). Silakan coba lagi.`,
      };
    }
    if (res.status === 502 || res.status === 503) {
      return {
        success: false,
        error: `Server sedang sibuk atau restart (HTTP ${res.status}). Coba beberapa detik lagi.`,
      };
    }
    return {
      success: false,
      error: `Respons server tidak valid (HTTP ${res.status}).`,
    };
  }
}
