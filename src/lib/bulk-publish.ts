/**
 * Shared types and user-facing message builders for bulk article publication.
 * Pure TypeScript (no server-only imports) so both API routes and Client
 * Components share a single source of truth for skip classification and copy.
 */

export const BULK_PUBLISHABLE_STATUSES = [
  "APPROVED",
  "DRAFT",
  "IN_REVIEW",
  "REJECTED",
] as const;

export type BulkPublishableStatus = (typeof BULK_PUBLISHABLE_STATUSES)[number];

const BULK_PUBLISHABLE_STATUS_SET: ReadonlySet<string> = new Set(
  BULK_PUBLISHABLE_STATUSES,
);

export function isBulkPublishableStatus(
  status: string,
): status is BulkPublishableStatus {
  return BULK_PUBLISHABLE_STATUS_SET.has(status);
}

export type BulkPublishSkipCode =
  | "QUALITY_GATE"
  | "ALREADY_PUBLISHED"
  | "ARCHIVED"
  | "NOT_FOUND"
  | "CONCURRENT_STATUS_CHANGE";

export interface BulkPublishSkippedItem {
  id: string;
  title: string;
  status: string | null;
  code: BulkPublishSkipCode;
  reason: string;
}

export interface BulkPublishSkippedSummary {
  qualityGate: number;
  alreadyPublished: number;
  archived: number;
  notFound: number;
  other: number;
}

export interface BulkPublishResponseData {
  count: number;
  requested: number;
  skippedCount: number;
  skipped: BulkPublishSkippedItem[];
  skippedSummary: BulkPublishSkippedSummary;
  action: "publish";
  seoChain?: string;
}

export function summarizeBulkPublishSkipped(
  skipped: readonly BulkPublishSkippedItem[],
): BulkPublishSkippedSummary {
  const summary: BulkPublishSkippedSummary = {
    qualityGate: 0,
    alreadyPublished: 0,
    archived: 0,
    notFound: 0,
    other: 0,
  };
  for (const item of skipped) {
    switch (item.code) {
      case "QUALITY_GATE":
        summary.qualityGate += 1;
        break;
      case "ALREADY_PUBLISHED":
        summary.alreadyPublished += 1;
        break;
      case "ARCHIVED":
        summary.archived += 1;
        break;
      case "NOT_FOUND":
        summary.notFound += 1;
        break;
      default:
        summary.other += 1;
        break;
    }
  }
  return summary;
}

export function formatSkippedReasonSummary(
  summary: BulkPublishSkippedSummary,
): string {
  const parts: string[] = [];
  if (summary.qualityGate > 0) {
    parts.push(`${summary.qualityGate} belum memenuhi syarat publikasi`);
  }
  if (summary.alreadyPublished > 0) {
    parts.push(`${summary.alreadyPublished} sudah PUBLISHED`);
  }
  if (summary.archived > 0) {
    parts.push(`${summary.archived} berstatus ARCHIVED`);
  }
  if (summary.notFound > 0) {
    parts.push(`${summary.notFound} tidak ditemukan`);
  }
  if (summary.other > 0) {
    parts.push(`${summary.other} berubah status saat diproses`);
  }
  return parts.join(", ");
}

function truncateTitle(title: string, maxLen = 70): string {
  const clean = title.trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trimEnd()}…`;
}

export function buildZeroPublishedErrorMessage(
  skipped: readonly BulkPublishSkippedItem[],
  summary?: BulkPublishSkippedSummary,
): string {
  if (skipped.length === 0) {
    return "Tidak ada artikel yang dapat dipublikasikan.";
  }

  const s = summary ?? summarizeBulkPublishSkipped(skipped);

  if (skipped.length === 1) {
    const item = skipped[0];
    if (item.code === "NOT_FOUND") {
      return "Tidak ada artikel yang dipublikasikan: artikel tidak ditemukan atau sudah dihapus.";
    }
    return `Tidak ada artikel yang dipublikasikan. "${truncateTitle(item.title)}" — ${item.reason}`;
  }

  if (s.alreadyPublished === skipped.length) {
    return `Tidak ada artikel yang dipublikasikan: semua ${skipped.length} artikel yang dipilih sudah berstatus PUBLISHED.`;
  }
  if (s.archived === skipped.length) {
    return `Tidak ada artikel yang dipublikasikan: semua ${skipped.length} artikel yang dipilih berstatus ARCHIVED (kembalikan ke draf terlebih dahulu).`;
  }
  if (s.notFound === skipped.length) {
    return `Tidak ada artikel yang dipublikasikan: semua ${skipped.length} artikel tidak ditemukan atau sudah dihapus.`;
  }

  const breakdown = formatSkippedReasonSummary(s);
  const firstQuality = skipped.find((item) => item.code === "QUALITY_GATE");
  const sample = firstQuality ?? skipped[0];
  const sampleText =
    sample.code === "NOT_FOUND"
      ? sample.reason
      : `"${truncateTitle(sample.title)}" — ${sample.reason}`;

  return `Tidak ada artikel yang dipublikasikan (${breakdown}). Contoh: ${sampleText}`;
}

export function formatBulkPublishToastMessage(params: {
  count: number;
  requested: number;
  skipped?: readonly BulkPublishSkippedItem[];
  skippedSummary?: BulkPublishSkippedSummary;
}): { type: "success" | "warning" | "error"; message: string } {
  const { count, requested } = params;
  const skipped = params.skipped ?? [];
  const summary = params.skippedSummary ?? summarizeBulkPublishSkipped(skipped);
  const skippedTotal = skipped.length > 0 ? skipped.length : Math.max(0, requested - count);

  if (count === requested && skippedTotal === 0) {
    return {
      type: "success",
      message: `${count} artikel berhasil dipublikasikan.`,
    };
  }

  if (count === 0) {
    return {
      type: "error",
      message: buildZeroPublishedErrorMessage(skipped, summary),
    };
  }

  if (skipped.length === 1) {
    const item = skipped[0];
    const detail =
      item.code === "NOT_FOUND"
        ? item.reason
        : `"${truncateTitle(item.title)}" — ${item.reason}`;
    return {
      type: "warning",
      message: `${count} dari ${requested} artikel dipublikasikan. 1 dilewati: ${detail}`,
    };
  }

  const breakdown = formatSkippedReasonSummary(summary);
  if (breakdown) {
    return {
      type: "warning",
      message: `${count} dari ${requested} artikel dipublikasikan (${skippedTotal} dilewati: ${breakdown}).`,
    };
  }

  return {
    type: "warning",
    message: `${count} dari ${requested} artikel dipublikasikan (${skippedTotal} artikel dilewati).`,
  };
}

export function formatBulkPublishAuditDetail(
  count: number,
  requested: number,
  skipped: readonly BulkPublishSkippedItem[],
  summary?: BulkPublishSkippedSummary,
): string {
  if (skipped.length === 0) {
    return `Bulk publish ${count} dari ${requested} artikel`;
  }
  const breakdown = formatSkippedReasonSummary(
    summary ?? summarizeBulkPublishSkipped(skipped),
  );
  return `Bulk publish ${count} dari ${requested} artikel (${skipped.length} dilewati${breakdown ? `: ${breakdown}` : ""})`;
}
