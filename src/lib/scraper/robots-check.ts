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

import { userAgent } from "./fetch";

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

async function fetchRobots(origin: string): Promise<RobotsParsed | null> {
  const robotsUrl = `${origin}/robots.txt`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(robotsUrl, {
      signal: controller.signal,
      headers: { "User-Agent": userAgent() },
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const text = await res.text();
    return parseRobots(text);
  } catch {
    return null;
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
    robots = await fetchRobots(origin);
    cache.set(origin, { parsed: robots, expires: Date.now() + CACHE_TTL_MS });
  }
  if (!robots) return true; // robots unreachable / malformed → allow

  return isAllowed(robots, userAgent(), parsed.pathname + parsed.search);
}
