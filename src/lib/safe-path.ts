import path from "path";

const PUBLIC_DIR = path.resolve(/* turbopackIgnore: true */ process.cwd(), "public");
const UPLOAD_DIR = path.resolve(PUBLIC_DIR, "uploads");

/**
 * Resolve a storage key strictly inside `public/uploads/`.
 * Rejects null bytes, absolute paths, drive letters, backslashes, and any `..`
 * traversal escaping `UPLOAD_DIR`.
 */
export function resolveUploadKeyPath(key: string): string {
  if (!key || typeof key !== "string") {
    throw new Error("Invalid storage key: empty");
  }
  if (key.includes("\0") || key.includes("\\")) {
    throw new Error("Invalid storage key: forbidden character");
  }
  if (path.isAbsolute(key) || /^[a-zA-Z]:/.test(key) || key.startsWith("/")) {
    throw new Error("Invalid storage key: must be relative");
  }
  const segments = key.split("/");
  if (segments.some((s) => s === "" || s === "." || s === "..")) {
    throw new Error("Invalid storage key: invalid path segment");
  }

  const resolved = path.resolve(UPLOAD_DIR, ...segments);
  if (!resolved.startsWith(UPLOAD_DIR + path.sep)) {
    throw new Error("Path traversal detected in storage key");
  }
  return resolved;
}

/**
 * Extract a validated storage key from an `/uploads/<key>` path or full URL.
 * Returns `null` if the URL does not reference `/uploads/` or fails traversal checks.
 */
export function extractSafeUploadKey(urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath || typeof urlOrPath !== "string") return null;
  try {
    let pathname = urlOrPath.trim();
    if (/^https?:\/\//i.test(pathname)) {
      pathname = new URL(pathname).pathname;
    }
    const decoded = decodeURIComponent(pathname);
    if (!decoded.startsWith("/uploads/")) return null;
    const key = decoded.slice("/uploads/".length);
    resolveUploadKeyPath(key);
    return key;
  } catch {
    return null;
  }
}

/**
 * Resolve a local `/uploads/...` or `public/...` path (or http URL pointing to it)
 * strictly within `public/` (or `public/<allowedSubdir>/` when specified).
 * Returns the canonical filesystem path or `null` on invalid/traversal input.
 */
export function resolvePublicSubpath(
  urlOrPath: string | null | undefined,
  allowedSubdir?: string,
): string | null {
  if (!urlOrPath || typeof urlOrPath !== "string") return null;
  try {
    const raw = urlOrPath.trim();
    if (!raw || raw.includes("\0")) return null;

    let pathname = raw;
    if (/^https?:\/\//i.test(raw)) {
      pathname = new URL(raw).pathname;
    } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
      // Reject non-http schemes (file:, javascript:, data:, Windows drive C:, etc.)
      return null;
    }

    const decoded = decodeURIComponent(pathname).replace(/\\/g, "/");
    if (decoded.includes("\0")) return null;

    let rel = decoded.replace(/^\/+/, "");
    if (rel.startsWith("public/")) {
      rel = rel.slice("public/".length);
    }

    const segments = rel.split("/").filter((s) => s.length > 0);
    if (segments.length === 0 || segments.some((s) => s === "." || s === "..")) {
      return null;
    }

    const rootDir = allowedSubdir
      ? path.resolve(PUBLIC_DIR, ...allowedSubdir.replace(/^\/+|\/+$/g, "").split("/"))
      : PUBLIC_DIR;

    const resolved = path.resolve(PUBLIC_DIR, ...segments);
    if (!resolved.startsWith(rootDir + path.sep)) {
      return null;
    }
    return resolved;
  } catch {
    return null;
  }
}

/**
 * Validate an image reference accepted by article/template schemas:
 * allows empty string, `http(s)://...`, or a safe single-slash local path `/...`.
 * Rejects `javascript:`, `data:`, `file:`, protocol-relative `//...`, null bytes,
 * backslashes, and `..` segments.
 */
export function isSafeImageRef(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  if (trimmed.includes("\0") || trimmed.includes("\\")) return false;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  // Must be a single-leading-slash relative path (not protocol-relative //)
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return false;
  try {
    const decoded = decodeURIComponent(trimmed.split("?")[0]);
    if (decoded.includes("\0") || decoded.includes("\\")) return false;
    const segments = decoded.slice(1).split("/");
    return !segments.some((s) => s === ".." || s === ".");
  } catch {
    return false;
  }
}

export function isSafeHttpUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes("\0")) return false;
  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}

export { PUBLIC_DIR, UPLOAD_DIR };
