import { ApiError } from "./api-utils";
import { extractSafeUploadKey, isSafeHttpUrl, isSafeImageRef } from "./safe-path";
import { isPrivateHost } from "./scraper/fetch";

/**
 * Validate a media slot or BGM URL/path:
 * - Allows safe relative paths under `/uploads/...` (no traversal)
 * - Or safe public `http(s)://` URLs (rejects `javascript:`, `data:`, `file:`, and private/loopback SSRF hosts)
 */
export function isSafeMediaUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2000) return false;
  if (!isSafeImageRef(trimmed)) return false;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return isSafeHttpUrl(trimmed) && !isPrivateHost(parsed.hostname);
    } catch {
      return false;
    }
  }

  return extractSafeUploadKey(trimmed) !== null;
}

/**
 * Optional BGM URL validator: allows empty string or a valid `isSafeMediaUrl`.
 */
export function isSafeOptionalBgmUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  return isSafeMediaUrl(trimmed);
}

/**
 * Parse JSON request body safely, mapping malformed JSON SyntaxError to HTTP 400
 * `ApiError` instead of an unhandled 500.
 */
export async function readJsonBody<T = unknown>(req: Request): Promise<T> {
  try {
    const parsed = await req.json();
    if (parsed === null || typeof parsed !== "object") {
      throw new ApiError("Payload JSON harus berupa objek", 400);
    }
    return parsed as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError("Payload JSON tidak valid", 400);
  }
}

export function getPrismaErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return null;
}

export function rethrowMappedPrismaError(
  error: unknown,
  messages?: {
    unique?: string;
    notFound?: string;
    foreignKey?: string;
  },
): never {
  const code = getPrismaErrorCode(error);
  if (code === "P2002") {
    throw new ApiError(messages?.unique || "Data sudah digunakan (duplikat)", 409);
  }
  if (code === "P2025") {
    throw new ApiError(messages?.notFound || "Data tidak ditemukan", 404);
  }
  if (code === "P2003") {
    throw new ApiError(messages?.foreignKey || "Referensi data tidak valid", 400);
  }
  throw error;
}
