"use client";

import { useEffect, useState } from "react";

type Format = "relative" | "short" | "long" | "weekday-long";

interface Props {
  date: Date | string | null | undefined;
  format?: Format;
  /** Auto-refresh relative format every 60s. Ignored for static formats. */
  live?: boolean;
}

function render(d: Date, format: Format): string {
  if (format === "short") {
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  }
  if (format === "long") {
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  }
  if (format === "weekday-long") {
    return d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  // relative
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins}m lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}j lalu`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

/**
 * Renders a date as text with output that can vary between server and
 * client. To avoid React hydration mismatches (#418/423/425), this
 * component renders an empty string on the server and the first client
 * pass, then populates the formatted text inside `useEffect`.
 *
 * Use whenever a "use client" component needs to display a date —
 * server components can call Date methods inline since they only render
 * once.
 */
export default function ClientDate({ date, format = "relative", live = true }: Props) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!date) {
      setText("");
      return;
    }
    const d = new Date(date);
    setText(render(d, format));
    if (format === "relative" && live) {
      const i = setInterval(() => setText(render(d, format)), 60_000);
      return () => clearInterval(i);
    }
  }, [date, format, live]);

  return <>{text}</>;
}
