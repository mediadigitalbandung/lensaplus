"use client";

import { useState, useEffect } from "react";
import { Bookmark } from "lucide-react";

function readBookmarks(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem("bookmarks") || "[]");
    return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export default function BookmarkButton({ slug }: { slug: string }) {
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    setBookmarked(readBookmarks().includes(slug));
  }, [slug]);

  function toggleBookmark() {
    const stored = readBookmarks();
    const updated = stored.includes(slug)
      ? stored.filter((s) => s !== slug)
      : [...stored, slug];
    try {
      localStorage.setItem("bookmarks", JSON.stringify(updated));
    } catch {
      /* storage quota / disabled */
    }
    setBookmarked(!bookmarked);
  }

  return (
    <button
      type="button"
      onClick={toggleBookmark}
      className={`btn-ghost min-h-[44px] rounded-md px-4 py-2.5 text-xs flex items-center gap-1.5 transition-colors active:scale-95 ${
        bookmarked
          ? "border border-primary/40 text-primary font-bold"
          : "text-txt-secondary hover:text-primary"
      }`}
      title={bookmarked ? "Hapus bookmark" : "Simpan bookmark"}
      aria-label={bookmarked ? "Hapus bookmark artikel ini" : "Simpan artikel ke bookmark"}
      aria-pressed={bookmarked}
    >
      <Bookmark
        size={16}
        className={bookmarked ? "fill-primary" : ""}
      />
      {bookmarked ? "Disimpan" : "Bookmark"}
    </button>
  );
}
