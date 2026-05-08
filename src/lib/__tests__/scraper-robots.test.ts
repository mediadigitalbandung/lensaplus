import { describe, it, expect, beforeEach, vi } from "vitest";

import { isAllowedByRobots } from "../scraper/robots-check";

function mockFetchOnce(body: string, ok = true) {
  (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    text: async () => body,
  });
}

describe("isAllowedByRobots", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("allows when robots.txt is unreachable (fail-open)", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("ECONNREFUSED"),
    );
    // Use a unique origin so the in-module cache miss triggers a fetch.
    const result = await isAllowedByRobots(
      "https://robots-fail-open.test/article",
    );
    expect(result).toBe(true);
  });

  it("disallows a path explicitly blocked for *", async () => {
    mockFetchOnce("User-agent: *\nDisallow: /private/\n");
    const result = await isAllowedByRobots(
      "https://robots-disallow.test/private/secret",
    );
    expect(result).toBe(false);
  });

  it("allows paths outside the disallowed prefix", async () => {
    mockFetchOnce("User-agent: *\nDisallow: /admin/\n");
    const result = await isAllowedByRobots(
      "https://robots-allow-public.test/articles/123",
    );
    expect(result).toBe(true);
  });

  it("treats malformed URLs as allowed (fail-open early)", async () => {
    const result = await isAllowedByRobots("not a url");
    expect(result).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("respects the longest-match rule: Allow overrides Disallow when more specific", async () => {
    mockFetchOnce(
      "User-agent: *\nDisallow: /\nAllow: /public/\n",
    );
    const result = await isAllowedByRobots(
      "https://robots-longest.test/public/page",
    );
    expect(result).toBe(true);
  });
});
