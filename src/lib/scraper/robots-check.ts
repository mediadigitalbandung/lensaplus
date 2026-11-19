/**
 * Minimal robots.txt parser. We only need to answer:
 *   "Is the bot named X allowed to fetch path P on host H?"
 *
 * Spec implemented: User-agent + Disallow / Allow rules. Sitemap and
 * Crawl-delay are ignored. We respect the LONGEST-MATCH rule from
 * Google's interpretation (longer path beats shorter regardless of
 * rule type).
 *
 * Falls open on any failure: if robots.txt is unreachable or malformed,
 * we treat the URL as allowed. The polite alternative would be to
 * block — but most Indonesian press sites ship broken robots and we
 * already self-identify with a contactable user agent.
 */

import { safePublicFetch, userAgent } from "./fetch";

interface RobotsRule {
  type: "allow" | "disallow";
  /** Original pattern (may include `*` and `$`). */
  pattern: string;
}

interface RobotsParsed {
  /** Map from user-agent (lowercased, "*" included) → rule list. */
  groups: Map<string, RobotsRule[]>;
}

const cache = new Map<string, { parsed: RobotsParsed | null; expires: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_ROBOTS_CACHE_ENTRIES = 500;
const MAX_ROBOTS_BYTES = 512 * 1024; // 512 KB cap (RFC 9309)

async function readRobotsTextWithCap(res: Response, maxBytes: number): Promise<string | null> {
  const lenHeader = res.headers?.get?.("content-length");
  if (lenHeader) {
    const declared = Number.parseInt(lenHeader, 10);
    if (Number.isFinite(declared) && declared > maxBytes) {
      await res.body?.cancel?.().catch(() => {});
      return null;
    }
  }

  const reader = res.body?.getReader?.();
  if (!reader) {
    const text = await res.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      return null;
    }
    return text;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          return null;
        }
        chunks.push(value);
      }
    }
  } catch {
    await reader.cancel().catch(() => {});
    return null;
  }
  return Buffer.concat(chunks, total).toString("utf8");
}

function setRobotsCache(origin: string, parsed: RobotsParsed | null, now: number): void {
  for (const [k, v] of cache.entries()) {
    if (v.expires <= now) cache.delete(k);
  }
  if (cache.has(origin)) cache.delete(origin);
  while (cache.size >= MAX_ROBOTS_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  cache.set(origin, { parsed, expires: now + CACHE_TTL_MS });
}

async function fetchRobots(origin: string): Promise<RobotsParsed | null> {
  const robotsUrl = `${origin}/robots.txt`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const { response: res } = await safePublicFetch(robotsUrl, {
      signal: controller.signal,
      headers: { "User-Agent": userAgent() },
    });
    if (!res.ok) {
      await res.body?.cancel?.().catch(() => {});
      return null;
    }
    const text = await readRobotsTextWithCap(res, MAX_ROBOTS_BYTES);
    if (text === null) return null;
    return parseRobots(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseRobots(text: string): RobotsParsed {
  const groups = new Map<string, RobotsRule[]>();
  let currentAgents: string[] = [];
  let collectingNewGroup = true;

  for (const rawLine of text.split(/\r?\n/)) {
    // Strip comments, trim
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (key === "user-agent") {
      // A blank line or non-user-agent directive ended the previous group;
      // start fresh.
      if (collectingNewGroup) {
        currentAgents = [];
      }
      currentAgents.push(value.toLowerCase());
      collectingNewGroup = false;
      for (const ua of currentAgents) {
        if (!groups.has(ua)) groups.set(ua, []);
      }
    } else if (key === "disallow" || key === "allow") {
      collectingNewGroup = true;
      for (const ua of currentAgents) {
        const list = groups.get(ua) ?? [];
        list.push({ type: key, pattern: value });
        groups.set(ua, list);
      }
    } else {
      collectingNewGroup = true;
    }
  }
  return { groups };
}

function patternToRegex(pattern: string): RegExp {
  // Escape regex special chars except * and $
  let body = pattern.replace(/[.+?^=!:${}()|[\]\\]/g, "\\$&");
  body = body.replace(/\*/g, ".*");
  // Anchor to start; the "$" suffix anchors to end if present (already preserved).
  return new RegExp(`^${body}`);
}

function matchesPattern(pattern: string, path: string): {
  matches: boolean;
  /** Length of the matching prefix, used for longest-match tiebreak. */
  length: number;
} {
  if (pattern === "") return { matches: true, length: 0 };
  try {
    const regex = patternToRegex(pattern);
    const match = path.match(regex);
    if (match) {
      return { matches: true, length: match[0].length };
    }
  } catch {
    // bad regex — ignore rule
  }
  return { matches: false, length: 0 };
}

function isAllowed(parsed: RobotsParsed, ua: string, path: string): boolean {
  const lcUa = ua.toLowerCase();
  // Pick the most specific user-agent group that matches our UA prefix
  let group: RobotsRule[] | undefined;
  let bestUaLength = -1;
  for (const [agent, rules] of parsed.groups.entries()) {
    if (agent === "*" || lcUa.includes(agent)) {
      if (agent.length > bestUaLength) {
        group = rules;
        bestUaLength = agent.length;
      }
    }
  }
  if (!group || group.length === 0) return true;

  let bestRule: RobotsRule | null = null;
  let bestLength = -1;
  for (const rule of group) {
    if (rule.pattern === "" && rule.type === "disallow") continue; // empty disallow = allow all
    const { matches, length } = matchesPattern(rule.pattern, path);
    if (matches && length > bestLength) {
      bestRule = rule;
      bestLength = length;
    }
  }
  if (!bestRule) return true;
  return bestRule.type === "allow";
}

/**
 * Returns true if our scraper user-agent can fetch `url`.
 * Falls open (allow) on any error.
 */
export async function isAllowedByRobots(url: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true; // malformed URL — let downstream fail
  }

  const origin = `${parsed.protocol}//${parsed.host}`;
  const cached = cache.get(origin);
  let robots: RobotsParsed | null;
  if (cached && cached.expires > Date.now()) {
    robots = cached.parsed;
  } else {
    const now = Date.now();
    robots = await fetchRobots(origin);
    setRobotsCache(origin, robots, now);
  }
  if (!robots) return true; // robots unreachable / malformed → allow

  return isAllowed(robots, userAgent(), parsed.pathname + parsed.search);
}
