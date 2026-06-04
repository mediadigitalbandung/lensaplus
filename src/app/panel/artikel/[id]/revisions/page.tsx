"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import DOMPurify from "isomorphic-dompurify";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  History,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  FileText,
  AlertCircle,
  X,
  GitCompareArrows,
} from "lucide-react";

interface Revision {
  id: string;
  title: string;
  content: string;
  changedBy: string;
  createdAt: string;
}

interface DiffSegment {
  type: "equal" | "added" | "removed";
  text: string;
}

/**
 * Simple word-by-word diff using Longest Common Subsequence (LCS).
 * Compares oldText vs newText and returns segments marked as equal/added/removed.
 */
function diffStrings(oldText: string, newText: string): DiffSegment[] {
  // Strip HTML tags for text comparison
  const stripHtml = (html: string) =>
    html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

  const oldWords = stripHtml(oldText).split(" ").filter(Boolean);
  const newWords = stripHtml(newText).split(" ").filter(Boolean);

  // Build LCS table (optimized for reasonable lengths)
  const maxLen = 2000;
  const oldSlice = oldWords.slice(0, maxLen);
  const newSlice = newWords.slice(0, maxLen);
  const m = oldSlice.length;
  const n = newSlice.length;

  // Use two rows instead of full matrix to save memory
  let prev = new Array(n + 1).fill(0);
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldSlice[i - 1] === newSlice[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    prev = [...curr];
    curr = new Array(n + 1).fill(0);
  }

  // We need the full table for backtracking, so rebuild it
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldSlice[i - 1] === newSlice[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find diff
  const segments: DiffSegment[] = [];
  let i = m;
  let j = n;

  const raw: { type: DiffSegment["type"]; text: string }[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldSlice[i - 1] === newSlice[j - 1]) {
      raw.push({ type: "equal", text: oldSlice[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.push({ type: "added", text: newSlice[j - 1] });
      j--;
    } else {
      raw.push({ type: "removed", text: oldSlice[i - 1] });
      i--;
    }
  }

  raw.reverse();

  // Merge consecutive segments of the same type
  for (const seg of raw) {
    const last = segments[segments.length - 1];
    if (last && last.type === seg.type) {
      last.text += " " + seg.text;
    } else {
      segments.push({ ...seg });
    }
  }

  // If content was truncated, add a note
  if (oldWords.length > maxLen || newWords.length > maxLen) {
    segments.push({
      type: "equal",
      text: " ... [konten dipotong untuk performa]",
    });
  }

  return segments;
}

function DiffView({
  segments,
  side,
}: {
  segments: DiffSegment[];
  side: "old" | "new";
}) {
  return (
    <div className="text-sm leading-relaxed">
      {segments.map((seg, i) => {
        if (seg.type === "equal") {
          return (
            <span key={i} className="text-txt-secondary">
              {seg.text}{" "}
            </span>
          );
        }
        if (seg.type === "removed" && side === "old") {
          return (
            <span
              key={i}
              className="rounded-lg px-0.5 bg-red-900/40 text-red-400 line-through"
            >
              {seg.text}{" "}
            </span>
          );
        }
        if (seg.type === "added" && side === "new") {
          return (
            <span
              key={i}
              className="rounded-lg px-0.5 bg-emerald-900/40 text-emerald-400"
            >
              {seg.text}{" "}
            </span>
          );
        }
        // Hide added on old side, removed on new side (show as space)
        if (
          (seg.type === "added" && side === "old") ||
          (seg.type === "removed" && side === "new")
        ) {
          return null;
        }
        return null;
      })}
    </div>
  );
}

function CompareModal({
  revisionA,
  revisionB,
  labelA,
  labelB,
  onClose,
}: {
  revisionA: Revision;
  revisionB: Revision;
  labelA: string;
  labelB: string;
  onClose: () => void;
}) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const segments = diffStrings(revisionA.content, revisionB.content);

  // Scroll sync
  const handleScroll = (source: "left" | "right") => {
    if (syncing.current) return;
    syncing.current = true;
    const from = source === "left" ? leftRef.current : rightRef.current;
    const to = source === "left" ? rightRef.current : leftRef.current;
    if (from && to) {
      to.scrollTop = from.scrollTop;
    }
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  };

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-6xl flex-col rounded-lg border border-border bg-surface shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <GitCompareArrows size={20} className="text-primary" />
            <h2 className="text-base font-bold text-txt-primary">
              Perbandingan Revisi
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost flex items-center gap-1 rounded-[8px] px-3 py-1.5 text-sm"
          >
            <X size={16} />
            Tutup
          </button>
        </div>

        {/* Title comparison */}
        {revisionA.title !== revisionB.title && (
          <div className="border-b border-border px-5 py-3">
            <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-2">
              Perubahan Judul
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-[8px] bg-red-900/20 border border-red-900/30 px-3 py-2">
                <p className="text-xs text-red-400 mb-1">{labelA}</p>
                <p className="text-sm text-txt-primary">{revisionA.title}</p>
              </div>
              <div className="rounded-[8px] bg-emerald-900/20 border border-emerald-900/30 px-3 py-2">
                <p className="text-xs text-emerald-400 mb-1">{labelB}</p>
                <p className="text-sm text-txt-primary">{revisionB.title}</p>
              </div>
            </div>
          </div>
        )}

        {/* Column headers */}
        <div className="grid grid-cols-1 md:grid-cols-2 border-b border-border">
          <div className="px-5 py-2 border-b md:border-b-0 md:border-r border-border">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">
              {labelA}
            </p>
          </div>
          <div className="px-5 py-2">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              {labelB}
            </p>
          </div>
        </div>

        {/* Diff content */}
        <div className="grid grid-cols-1 md:grid-cols-2 flex-1 min-h-0 overflow-hidden">
          <div
            ref={leftRef}
            onScroll={() => handleScroll("left")}
            className="overflow-y-auto border-b md:border-b-0 md:border-r border-border px-5 py-4 max-h-[60vh]"
          >
            <DiffView segments={segments} side="old" />
          </div>
          <div
            ref={rightRef}
            onScroll={() => handleScroll("right")}
            className="overflow-y-auto px-5 py-4 max-h-[60vh]"
          >
            <DiffView segments={segments} side="new" />
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 border-t border-border px-5 py-3">
          <span className="flex items-center gap-1.5 text-xs text-txt-muted">
            <span className="inline-block h-3 w-3 rounded-lg bg-red-900/40 border border-red-800" />
            Dihapus
          </span>
          <span className="flex items-center gap-1.5 text-xs text-txt-muted">
            <span className="inline-block h-3 w-3 rounded-lg bg-emerald-900/40 border border-emerald-800" />
            Ditambahkan
          </span>
          <span className="flex items-center gap-1.5 text-xs text-txt-muted">
            <span className="inline-block h-3 w-3 rounded-lg bg-surface-secondary border border-border" />
            Tidak berubah
          </span>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse">
      <div className="mb-6">
        <div className="h-4 w-32 rounded-lg bg-surface-tertiary" />
        <div className="mt-2 h-7 w-64 rounded-lg bg-surface-tertiary" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="mb-4 rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-surface-tertiary" />
              <div>
                <div className="h-4 w-48 rounded-lg bg-surface-tertiary" />
                <div className="mt-1 h-3 w-32 rounded-lg bg-surface-secondary" />
              </div>
            </div>
            <div className="h-8 w-24 rounded-[8px] bg-surface-tertiary" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RevisionsPage() {
  const router = useRouter();
  const params = useParams();
  const articleId = params.id as string;
  useSession();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [articleTitle, setArticleTitle] = useState("");
  const [currentContent, setCurrentContent] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareData, setCompareData] = useState<{
    revisionA: Revision;
    revisionB: Revision;
    labelA: string;
    labelB: string;
  } | null>(null);

  const fetchRevisions = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [revRes, articleRes] = await Promise.all([
        fetch(`/api/articles/${articleId}/revisions`),
        fetch(`/api/articles/${articleId}`),
      ]);

      if (!revRes.ok) {
        setError("Gagal memuat riwayat revisi.");
        return;
      }

      const revJson = await revRes.json();
      setRevisions(revJson.data || []);

      if (articleRes.ok) {
        const articleJson = await articleRes.json();
        setArticleTitle(articleJson.data?.title || "");
        setCurrentContent(articleJson.data?.content || "");
      }
    } catch {
      setError("Terjadi kesalahan saat memuat data.");
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    fetchRevisions();
  }, [fetchRevisions]);

  const handleCompareWithCurrent = (rev: Revision, versionLabel: string) => {
    setCompareData({
      revisionA: rev,
      revisionB: {
        id: "current",
        title: articleTitle,
        content: currentContent,
        changedBy: "",
        createdAt: new Date().toISOString(),
      },
      labelA: versionLabel,
      labelB: "Versi Saat Ini",
    });
  };

  const handleCompareWithPrevious = (
    rev: Revision,
    prevRev: Revision,
    vLabel: string,
    prevLabel: string
  ) => {
    setCompareData({
      revisionA: prevRev,
      revisionB: rev,
      labelA: prevLabel,
      labelB: vLabel,
    });
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push(`/panel/artikel/${articleId}/edit`)}
          className="mb-1 flex items-center gap-1 text-xs text-txt-secondary hover:text-txt-primary"
        >
          <ArrowLeft size={14} /> Kembali ke Editor
        </button>
        <h1 className="flex items-center gap-2 text-lg sm:text-2xl font-bold text-txt-primary">
          <History size={24} className="text-primary" />
          Riwayat Revisi
        </h1>
        {articleTitle && (
          <p className="mt-1 text-sm text-txt-secondary">
            Artikel: <span className="font-medium text-txt-primary">{articleTitle}</span>
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {revisions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface p-12 text-center">
          <FileText size={48} className="mb-4 text-txt-muted" />
          <h2 className="text-lg font-semibold text-txt-primary">Belum Ada Revisi</h2>
          <p className="mt-1 text-sm text-txt-secondary">
            Riwayat revisi akan muncul setelah artikel diedit.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {revisions.map((rev, index) => {
            const isExpanded = expandedId === rev.id;
            const revDate = new Date(rev.createdAt);
            const versionNum = revisions.length - index;
            const versionLabel = `v${versionNum}`;
            const prevRev = index < revisions.length - 1 ? revisions[index + 1] : null;

            return (
              <div
                key={rev.id}
                className="rounded-lg border border-border bg-surface shadow-card overflow-hidden"
              >
                {/* Revision header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : rev.id)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-surface-secondary transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary">
                      {versionLabel}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-txt-primary">
                        {rev.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-txt-muted mt-0.5">
                        <span className="flex items-center gap-1">
                          <User size={11} />
                          {rev.changedBy}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          {revDate.toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-3 shrink-0">
                    {isExpanded ? (
                      <ChevronUp size={18} className="text-txt-muted" />
                    ) : (
                      <ChevronDown size={18} className="text-txt-muted" />
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border px-5 py-4">
                    {/* Compare buttons */}
                    <div className="mb-3 flex flex-wrap gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCompareWithCurrent(rev, versionLabel);
                        }}
                        className="btn-primary flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-xs font-medium"
                      >
                        <GitCompareArrows size={14} />
                        Bandingkan dengan Versi Saat Ini
                      </button>
                      {prevRev && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCompareWithPrevious(
                              rev,
                              prevRev,
                              versionLabel,
                              `v${revisions.length - (index + 1)}`
                            );
                          }}
                          className="btn-secondary flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-xs font-medium"
                        >
                          <GitCompareArrows size={14} />
                          Bandingkan dengan v{revisions.length - (index + 1)}
                        </button>
                      )}
                    </div>

                    <label className="mb-2 block text-xs font-semibold text-txt-muted uppercase tracking-wider">
                      Konten pada revisi ini
                    </label>
                    <div
                      className="prose prose-sm max-w-none text-txt-primary text-justify rounded-[8px] border border-border bg-surface-secondary p-4 max-h-[500px] overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rev.content) }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Compare modal */}
      {compareData && (
        <CompareModal
          revisionA={compareData.revisionA}
          revisionB={compareData.revisionB}
          labelA={compareData.labelA}
          labelB={compareData.labelB}
          onClose={() => setCompareData(null)}
        />
      )}
    </div>
  );
}
