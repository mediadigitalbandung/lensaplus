import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockDnsLookup } = vi.hoisted(() => ({
  mockDnsLookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

vi.mock("node:dns/promises", () => ({
  default: { lookup: mockDnsLookup },
  lookup: mockDnsLookup,
}));

import { isAllowedByRobots } from "../scraper/robots-check";

function mockFetchOnce(body: string, ok = true) {
  (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 404,
    headers: new Headers(),
    text: async () => body,
  });
}

describe("isAllowedByRobots", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    mockDnsLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
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

  it("caps oversized robots.txt (>512 KB) and fails open without OOM", async () => {
    const cancelSpy = vi.fn().mockResolvedValue(undefined);
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": String(2 * 1024 * 1024) }),
      body: { cancel: cancelSpy },
      text: async () => "User-agent: *\nDisallow: /\n",
    });
    const result = await isAllowedByRobots(
      "https://robots-oversize.test/private/item",
    );
    expect(result).toBe(true);
    expect(cancelSpy).toHaveBeenCalled();
  });
});
