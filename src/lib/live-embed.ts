/**
 * Resolve a user-supplied live-stream URL into something safe to render on the
 * public live-blog page.
 *
 * v1 first-classes YouTube (the common case for news live video) into a real
 * embedded player. Any other host is returned as a plain "watch" link rather
 * than embedded — we deliberately do NOT drop arbitrary third-party origins
 * into an <iframe> on a public page (clickjacking / malicious-embed risk),
 * even though the URL is set by trusted staff. More providers (Vimeo, Twitch,
 * Facebook Live) can be added with explicit per-provider embed handling later.
 */

export type LiveEmbed =
  | { kind: "iframe"; src: string; provider: "youtube" }
  | { kind: "link"; href: string };

function youtubeId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    return u.pathname.slice(1).split("/")[0] || null;
  }
  if (
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtube-nocookie.com" ||
    host.endsWith(".youtube-nocookie.com")
  ) {
    if (u.pathname === "/watch") return u.searchParams.get("v");
    const m = u.pathname.match(/^\/(?:embed|live|shorts|v)\/([^/?#]+)/);
    if (m) return m[1];
  }
  return null;
}

export function resolveLiveEmbed(raw: string | null | undefined): LiveEmbed | null {
  const s = (raw || "").trim();
  if (!s) return null;

  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;

  const yt = youtubeId(u);
  if (yt && /^[\w-]{6,}$/.test(yt)) {
    // autoplay+mute so the live feed starts on load (browsers require mute for autoplay).
    const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}?rel=0&autoplay=1&mute=1&playsinline=1`;
    return { kind: "iframe", src, provider: "youtube" };
  }

  return { kind: "link", href: s };
}
