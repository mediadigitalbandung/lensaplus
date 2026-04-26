import { localFsDriver } from "./local-fs";
import type { StorageDriver } from "./types";

export type { StorageDriver, PutObjectInput, PutObjectResult } from "./types";

/**
 * Pluggable storage driver for media uploads.
 *
 * Default driver writes to /public/uploads/ on the local Next.js process
 * filesystem. This is fragile when uploads happen from a workstation whose
 * DATABASE_URL points to production (the file lands on the laptop, the DB
 * record on the server, and production cannot serve the URL).
 *
 * To migrate to Cloudflare R2 or another S3-compatible object store, add an
 * implementation file (e.g., r2.ts) that exports a StorageDriver and wire it
 * up here behind an env-flag check. Keep the API surface narrow — only `put`
 * is exposed. The url returned is what gets stored in Media.url and
 * Article.featuredImage.
 */
export function getStorageDriver(): StorageDriver {
  return localFsDriver;
}
