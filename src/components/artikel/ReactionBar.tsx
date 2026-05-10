"use client";

import { useEffect, useState } from "react";

const REACTIONS = [
  { type: "LIKE", emoji: "👍", label: "Suka" },
  { type: "LOVE", emoji: "❤️", label: "Cinta" },
  { type: "SAD", emoji: "😢", label: "Sedih" },
  { type: "ANGRY", emoji: "😡", label: "Marah" },
  { type: "THINKING", emoji: "🤔", label: "Mikir" },
] as const;

/**
 * Article reaction emoji bar — quick engagement signal tanpa perlu sign-in.
 * Dedup via IP @ DB level (one reaction per IP per article per type).
 * Toggle: klik emoji yang sudah dipilih → unselect.
 */
export default function ReactionBar({ articleId }: { articleId: string }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [my, setMy] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    fetch(`/api/articles/${articleId}/reactions`)
      .then((r) => r.json())
      .then((json) => {
        if (cancel) return;
        if (json.success && json.data) {
          setCounts(json.data.counts ?? {});
          setMy(json.data.myReactions ?? []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [articleId]);

  async function react(type: string) {
    if (voting) return;
    setVoting(type);
    try {
      const res = await fetch(`/api/articles/${articleId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setCounts(json.data.counts ?? {});
        setMy(json.data.myReactions ?? []);
      }
    } catch {
      // Non-critical — diam saja
    } finally {
      setVoting(null);
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="my-8 rounded-2xl border border-border bg-surface-secondary p-4 sm:p-5">
      <p className="mb-3 text-xs font-semibold text-txt-primary sm:text-sm">
        Apa pendapat Anda tentang artikel ini?
      </p>
      <div className="flex flex-wrap gap-2 sm:gap-3">
        {REACTIONS.map((r) => {
          const count = counts[r.type] ?? 0;
          const isMine = my.includes(r.type);
          return (
            <button
              key={r.type}
              onClick={() => react(r.type)}
              disabled={loading || voting === r.type}
              aria-label={`${r.label} (${count})`}
              aria-pressed={isMine}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-all sm:px-4 ${
                isMine
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-surface text-txt-primary hover:border-primary hover:bg-primary-light"
              } ${voting === r.type ? "cursor-wait opacity-60" : ""}`}
            >
              <span className="text-lg">{r.emoji}</span>
              <span className="text-xs sm:text-sm">{count}</span>
            </button>
          );
        })}
      </div>
      {total > 0 && (
        <p className="mt-3 text-[10px] text-txt-muted sm:text-xs">
          {total.toLocaleString("id-ID")} reaksi total
        </p>
      )}
    </div>
  );
}
