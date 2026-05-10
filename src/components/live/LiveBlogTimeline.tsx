"use client";

import { useState, useEffect, useCallback } from "react";
import { Pin, Zap, Image as ImageIcon, Play } from "lucide-react";

export interface LiveBlogEntry {
  id: string;
  content: string;
  postedAt: string;
  authorId: string | null;
  isPinned: boolean;
  isHighlight: boolean;
  imageUrl: string | null;
  videoUrl: string | null;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function EntryCard({ entry }: { entry: LiveBlogEntry }) {
  return (
    <article
      className={`relative flex gap-4 pb-6 ${entry.isPinned ? "bg-primary-light/30 -mx-4 px-4 rounded-md" : ""}`}
    >
      {/* Timeline spine */}
      <div className="flex flex-col items-center shrink-0 pt-1">
        <div
          className={`h-3 w-3 rounded-full border-2 mt-0.5 shrink-0 ${
            entry.isHighlight
              ? "bg-secondary border-secondary"
              : entry.isPinned
                ? "bg-primary border-primary"
                : "bg-border border-border"
          }`}
        />
        <div className="w-px flex-1 bg-border mt-1" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <time
            dateTime={entry.postedAt}
            className="text-label-sm font-semibold text-primary tabular-nums"
          >
            {formatTime(entry.postedAt)}
          </time>
          {entry.isPinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-label-sm text-primary font-medium">
              <Pin size={10} />
              Disematkan
            </span>
          )}
          {entry.isHighlight && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-label-sm text-secondary font-medium">
              <Zap size={10} />
              Highlight
            </span>
          )}
        </div>

        <div
          className="article-content text-body-md text-on-surface prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: entry.content }}
        />

        {/* Media */}
        {entry.imageUrl && (
          <div className="mt-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entry.imageUrl}
              alt="Media update"
              className="rounded-md max-h-64 object-cover"
              loading="lazy"
            />
          </div>
        )}
        {entry.videoUrl && (
          <div className="mt-3">
            <a
              href={entry.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-body-sm text-primary hover:underline"
            >
              <Play size={14} />
              Tonton video
            </a>
          </div>
        )}
      </div>
    </article>
  );
}

export default function LiveBlogTimeline({
  slug,
  initialEntries,
  isLive,
}: {
  slug: string;
  initialEntries: LiveBlogEntry[];
  isLive: boolean;
}) {
  const [entries, setEntries] = useState<LiveBlogEntry[]>(initialEntries);
  const [isPolling, setIsPolling] = useState(isLive);
  const [newCount, setNewCount] = useState(0);
  const [lastPollError, setLastPollError] = useState(false);

  const fetchNewEntries = useCallback(async () => {
    if (!isPolling) return;
    const latestId = entries[0]?.id;
    if (!latestId) return;

    try {
      const res = await fetch(
        `/api/live-blogs/${slug}/entries?since=${latestId}&limit=20`
      );
      if (!res.ok) {
        setLastPollError(true);
        return;
      }
      const json = await res.json();
      const newEntries: LiveBlogEntry[] = json.data?.entries || [];
      const blogStatus: string = json.data?.blogStatus || "LIVE";

      if (newEntries.length > 0) {
        setEntries((prev) => [...newEntries, ...prev]);
        setNewCount((c) => c + newEntries.length);
      }

      setLastPollError(false);

      // Stop polling if live blog ended
      if (blogStatus === "ENDED" || blogStatus === "CANCELLED") {
        setIsPolling(false);
      }
    } catch {
      setLastPollError(true);
    }
  }, [slug, entries, isPolling]);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(fetchNewEntries, 12000);
    return () => clearInterval(interval);
  }, [isLive, fetchNewEntries]);

  // Separate pinned entries for top display
  const pinnedEntries = entries.filter((e) => e.isPinned);
  const regularEntries = entries.filter((e) => !e.isPinned);

  // Group regular entries by date
  const grouped: { date: string; entries: LiveBlogEntry[] }[] = [];
  for (const entry of regularEntries) {
    const dateStr = formatDate(entry.postedAt);
    const last = grouped[grouped.length - 1];
    if (last && last.date === dateStr) {
      last.entries.push(entry);
    } else {
      grouped.push({ date: dateStr, entries: [entry] });
    }
  }

  return (
    <div className="space-y-6">
      {/* Live status + new entries banner */}
      {isPolling && (
        <div className="flex items-center gap-2 rounded-md bg-secondary/10 px-4 py-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-secondary" />
          </span>
          <span className="text-body-sm font-medium text-secondary">
            Siaran Langsung — diperbarui otomatis setiap 12 detik
          </span>
          {newCount > 0 && (
            <span className="ml-auto text-label-sm text-secondary font-semibold">
              +{newCount} update baru
            </span>
          )}
        </div>
      )}

      {lastPollError && (
        <p className="text-label-sm text-txt-muted text-center">
          Gagal memuat update terbaru. Mencoba kembali...
        </p>
      )}

      {/* Pinned entries */}
      {pinnedEntries.length > 0 && (
        <section aria-label="Update disematkan">
          <h3 className="mb-3 text-label-md font-semibold uppercase tracking-wider text-txt-muted flex items-center gap-2">
            <Pin size={14} />
            Disematkan
          </h3>
          <div className="space-y-0">
            {pinnedEntries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {/* Timeline grouped by date */}
      {grouped.length === 0 && entries.length === 0 && (
        <div className="py-12 text-center text-txt-muted">
          <ImageIcon size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-body-md">Belum ada update. Pantau terus!</p>
        </div>
      )}

      {grouped.map((group) => (
        <section key={group.date} aria-label={group.date}>
          <div className="mb-4 flex items-center gap-3">
            <span className="text-label-sm font-semibold uppercase tracking-wider text-txt-muted">
              {group.date}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-0">
            {group.entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
