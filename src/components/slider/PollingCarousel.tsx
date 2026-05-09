"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle, ArrowRight } from "lucide-react";

interface PollOption {
  id: string;
  label: string;
  votes: number;
  percentage: number;
}

interface Poll {
  id: string;
  question: string;
  image?: string | null;
  options: PollOption[];
  totalVotes: number;
}

// Legacy support for hardcoded polls
interface LegacyPoll {
  question: string;
  image?: string;
  options: { label: string; percentage: number }[];
  totalVotes: number;
}

interface Props {
  items?: LegacyPoll[];
  categorySlug?: string;
  /** Maximum cards to render in the grid. Sisanya disembunyikan di balik
   *  link "Lihat semua polling →". Default 4 — cocok untuk 1 baris di
   *  desktop lg (4 cols). Di mobile (2 cols) jadi 2 baris × 2 cards. */
  limit?: number;
}

export default function PollingCarousel({ categorySlug, limit = 4 }: Props) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votedPolls, setVotedPolls] = useState<Record<string, string>>({}); // pollId → optionId
  const [voting, setVoting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPolls = useCallback(async () => {
    try {
      setLoading(true);
      const url = categorySlug ? `/api/polls?category=${categorySlug}` : "/api/polls";
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const json = await res.json();
      const fetchedPolls: Poll[] = json.data || [];
      setPolls(fetchedPolls);

      // Check which polls user already voted on
      const voteChecks = await Promise.all(
        fetchedPolls.map(async (p) => {
          try {
            const r = await fetch(`/api/polls/${p.id}/vote`);
            if (r.ok) {
              const j = await r.json();
              return { pollId: p.id, votedOptionId: j.data?.votedOptionId };
            }
          } catch {}
          return { pollId: p.id, votedOptionId: null };
        })
      );
      const voted: Record<string, string> = {};
      for (const v of voteChecks) {
        if (v.votedOptionId) voted[v.pollId] = v.votedOptionId;
      }
      setVotedPolls(voted);
    } catch {
      // Fallback to empty
    } finally {
      setLoading(false);
    }
  }, [categorySlug]);

  useEffect(() => { fetchPolls(); }, [fetchPolls]);

  async function handleVote(pollId: string, optionId: string) {
    if (votedPolls[pollId] || voting) return;
    try {
      setVoting(pollId);
      const res = await fetch(`/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        // Update poll with new results
        setPolls((prev) =>
          prev.map((p) =>
            p.id === pollId
              ? { ...p, totalVotes: json.data.totalVotes, options: json.data.options }
              : p
          )
        );
        setVotedPolls((prev) => ({ ...prev, [pollId]: optionId }));
      }
    } catch {}
    finally {
      setVoting(null);
    }
  }

  // Cap to `limit` cards. Sisanya bisa diakses via /polling listing page.
  const displayPolls = polls.slice(0, limit);
  const hasMore = polls.length > limit;

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-surface-secondary p-3 sm:p-4 animate-pulse">
            <div className="h-3 w-3/4 rounded bg-surface-tertiary mb-3" />
            <div className="space-y-2">
              {[1, 2, 3].map((j) => (
                <div key={j}>
                  <div className="h-2 w-full rounded bg-surface-tertiary" />
                  <div className="h-1 rounded-full bg-surface-tertiary mt-1" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (displayPolls.length === 0) return null;

  return (
    <div>
      {/* Grid layout — split jadi 2 cols di mobile, 3 di tablet, 4 di desktop.
          Drop horizontal carousel: lebih readable + scan-friendly + tidak boros
          horizontal space saat poll cuma 2-3 buah. */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {displayPolls.map((poll) => {
          const hasVoted = !!votedPolls[poll.id];
          const votedOptionId = votedPolls[poll.id];
          const isVoting = voting === poll.id;
          const maxPercent = poll.totalVotes > 0
            ? Math.max(...poll.options.map((o) => o.percentage))
            : 0;

          return (
            <div
              key={poll.id}
              className="flex flex-col rounded-xl border border-border bg-surface-secondary overflow-hidden hover:shadow-card-hover transition-shadow"
            >
              {poll.image && (
                <div className="relative w-full aspect-[16/9]">
                  <Image
                    src={poll.image}
                    alt={poll.question}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                </div>
              )}
              <div className="flex flex-col flex-1 p-3 sm:p-4">
                <p className="text-xs sm:text-sm font-semibold text-txt-primary mb-3 leading-snug line-clamp-3">
                  {poll.question}
                </p>

                <div className="space-y-1.5 sm:space-y-2 flex-1">
                  {poll.options.map((opt) => {
                    const isTop = opt.percentage === maxPercent && poll.totalVotes > 0;
                    const isSelected = votedOptionId === opt.id;

                    return hasVoted ? (
                      // After voting — show results
                      <div key={opt.id}>
                        <div className="flex items-center justify-between gap-1 text-xs mb-0.5 sm:mb-1">
                          <span className={`text-[11px] sm:text-xs flex items-center gap-1 truncate ${isSelected ? "font-bold text-primary" : "text-txt-primary"}`}>
                            {isSelected && <CheckCircle size={10} className="shrink-0" />}
                            <span className="truncate">{opt.label}</span>
                          </span>
                          <span className={`shrink-0 font-bold text-[11px] sm:text-xs ${isTop ? "text-primary" : "text-txt-primary"}`}>
                            {opt.percentage}%
                          </span>
                        </div>
                        <div className="h-1.5 sm:h-2 rounded-full bg-border overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${isSelected ? "bg-primary" : isTop ? "bg-primary/60" : "bg-primary/30"}`}
                            style={{ width: `${opt.percentage}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      // Before voting — clickable options
                      <button
                        key={opt.id}
                        onClick={() => handleVote(poll.id, opt.id)}
                        disabled={isVoting}
                        className={`w-full text-left rounded-md sm:rounded-lg border px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium transition-all line-clamp-2 ${
                          isVoting
                            ? "opacity-50 cursor-not-allowed border-border text-txt-muted"
                            : "border-border text-txt-primary hover:border-primary hover:bg-primary-light/30 hover:text-primary active:scale-[0.98]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <p className="text-[10px] sm:text-xs text-txt-muted mt-2 sm:mt-3">
                  {poll.totalVotes.toLocaleString("id-ID")} suara
                  {hasVoted && <span className="text-primary ml-1">✓</span>}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* "Lihat semua" CTA hanya muncul kalau ada poll lebih dari `limit` */}
      {hasMore && (
        <div className="mt-5 sm:mt-6 flex justify-center">
          <Link
            href="/polling"
            className="group inline-flex items-center gap-2 rounded-full bg-secondary/10 px-5 py-2 text-label-sm font-bold uppercase tracking-wider text-secondary transition-all hover:bg-secondary hover:text-white"
          >
            Lihat Semua Polling
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
