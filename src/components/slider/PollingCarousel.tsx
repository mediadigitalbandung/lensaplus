"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";

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

interface LegacyPoll {
  question: string;
  image?: string;
  options: { label: string; percentage: number }[];
  totalVotes: number;
}

interface Props {
  items?: LegacyPoll[];
  categorySlug?: string;
}

export default function PollingCarousel({ categorySlug }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votedPolls, setVotedPolls] = useState<Record<string, string>>({});
  const [voting, setVoting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const fetchPolls = useCallback(async () => {
    try {
      setLoading(true);
      const url = categorySlug ? `/api/polls?category=${categorySlug}` : "/api/polls";
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const json = await res.json();
      const fetchedPolls: Poll[] = json.data || [];
      setPolls(fetchedPolls);

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

  // Compute initial scroll-affordance state once polls + DOM are ready.
  // Updated on user scroll via the container's onScroll handler below.
  useEffect(() => {
    if (!scrollRef.current || polls.length === 0) return;
    const el = scrollRef.current;
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    };
    update();
    // Also re-check on viewport resize because card width is responsive.
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [polls]);

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

  function handleScroll() {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }

  function scrollByPage(direction: "left" | "right") {
    if (!scrollRef.current) return;
    const containerWidth = scrollRef.current.clientWidth;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -containerWidth : containerWidth,
      behavior: "smooth",
    });
  }

  if (loading) {
    return (
      <div className="flex gap-3 sm:gap-4 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="shrink-0 w-[calc(50%-6px)] md:w-[calc(33.333%-11px)] lg:w-[calc(25%-12px)] rounded-xl border border-border bg-surface-secondary p-3 sm:p-4 animate-pulse"
          >
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

  if (polls.length === 0) return null;

  return (
    <div className="relative group">
      {/* Prev arrow — only visible when there's content to scroll back to.
          Group hover used so arrow muncul saat hover container (desktop UX).
          Mobile: arrow tetap visible kalau bisa di-scroll (karena no hover). */}
      {canScrollLeft && (
        <button
          onClick={() => scrollByPage("left")}
          aria-label="Polling sebelumnya"
          className="absolute -left-2 sm:-left-3 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-surface shadow-lg border border-border text-txt-primary hover:bg-surface-secondary transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <ChevronLeft size={18} />
        </button>
      )}

      {canScrollRight && (
        <button
          onClick={() => scrollByPage("right")}
          aria-label="Polling berikutnya"
          className="absolute -right-2 sm:-right-3 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-surface shadow-lg border border-border text-txt-primary hover:bg-surface-secondary transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <ChevronRight size={18} />
        </button>
      )}

      {/*
        Strict 1-row carousel with snap. Card widths:
          - Mobile (<md):  2 cards visible — w = (100% - 1×gap) / 2 ≈ 50% − 6px
          - Tablet (md):   3 cards visible — w = (100% - 2×gap) / 3 ≈ 33.33% − 11px
          - Desktop (lg):  4 cards visible — w = (100% - 3×gap) / 4 ≈ 25% − 12px

        snap-x snap-mandatory + snap-start ensures swipe lands on card edge.
        scrollbar-hide untuk no native scrollbar (still scrollable touch + arrows).
      */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
      >
        {polls.map((poll) => {
          const hasVoted = !!votedPolls[poll.id];
          const votedOptionId = votedPolls[poll.id];
          const isVoting = voting === poll.id;
          const maxPercent = poll.totalVotes > 0
            ? Math.max(...poll.options.map((o) => o.percentage))
            : 0;

          return (
            <div
              key={poll.id}
              className="snap-start shrink-0 w-[calc(50%-6px)] md:w-[calc(33.333%-11px)] lg:w-[calc(25%-12px)] flex flex-col rounded-xl border border-border bg-surface-secondary overflow-hidden hover:shadow-card-hover transition-shadow"
            >
              {poll.image && (
                <div className="relative w-full aspect-[16/9]">
                  <Image
                    src={poll.image}
                    alt={poll.question}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
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
    </div>
  );
}
