"use client";

import { useEffect } from "react";
import { trackRead } from "@/lib/personalization/tracker";

/**
 * Mount di /berita/[slug] page. Track artikel yang lagi dibuka.
 * Trigger setelah 5 detik dwell time supaya tidak record bounce.
 */
export default function ReadTracker({
  slug,
  categorySlug,
}: {
  slug: string;
  categorySlug: string;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      trackRead(slug, categorySlug);
    }, 5000);
    return () => clearTimeout(timer);
  }, [slug, categorySlug]);
  return null; // no UI
}
