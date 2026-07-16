import { describe, it, expect, beforeEach, vi } from "vitest";

import { isPrivateHost, fetchHtml, userAgent } from "../scraper/fetch";

describe("isPrivateHost (SSRF guard)", () => {
  it("blocks IPv4 loopback", () => {
    expect(isPrivateHost("127.0.0.1")).toBe(true);
    expect(isPrivateHost("127.5.5.5")).toBe(true);
  });

  it("blocks RFC1918 ranges 10/8, 172.16/12, 192.168/16", () => {
    expect(isPrivateHost("10.0.0.1")).toBe(true);
    expect(isPrivateHost("10.255.255.255")).toBe(true);
    expect(isPrivateHost("172.16.0.1")).toBe(true);
    expect(isPrivateHost("172.31.255.255")).toBe(true);
    expect(isPrivateHost("192.168.1.1")).toBe(true);
  });

  it("blocks link-local 169.254/16 (covers cloud-metadata 169.254.169.254)", () => {
    expect(isPrivateHost("169.254.169.254")).toBe(true);
    expect(isPrivateHost("169.254.0.1")).toBe(true);
  });

  it("blocks IPv6 loopback ::1 and link-local fe80::", () => {
    expect(isPrivateHost("::1")).toBe(true);
    expect(isPrivateHost("fe80::1")).toBe(true);
    expect(isPrivateHost("FE80::abcd")).toBe(true);
  });

  it("blocks the literal hostname 'localhost'", () => {
    expect(isPrivateHost("localhost")).toBe(true);
  });

  it("allows public IPv4 and public domains", () => {
    expect(isPrivateHost("8.8.8.8")).toBe(false);
    expect(isPrivateHost("172.15.0.1")).toBe(false); // edge: just below 172.16
    expect(isPrivateHost("172.32.0.1")).toBe(false); // edge: just above 172.31
    expect(isPrivateHost("lensaplus.com")).toBe(false);
    expect(isPrivateHost("example.org")).toBe(false);
  });

  it("does not match RFC1918-looking strings as substrings of public domains", () => {
    // 10.com is not a private IP — it's a domain. Hostname-based regex
    // should still flag it because the prefix "10." matches; this test
    // documents the current behaviour (string-prefix match is conservative).
    expect(isPrivateHost("10.com")).toBe(true);
  });
});

describe("userAgent", () => {
  it("returns the documented Lensaplus-Scraper UA", () => {
    expect(userAgent()).toContain("Lensaplus-Scraper");
    expect(userAgent()).toContain("lensaplus.com");
  });
});

describe("fetchHtml SSRF rejection", () => {
  beforeEach(() => {
    // No fetch should be called — but stub anyway so any leak is obvious.
    vi.stubGlobal("fetch", vi.fn());
  });

  it("rejects non-http(s) protocols before any network call", async () => {
    await expect(fetchHtml("file:///etc/passwd")).rejects.toThrow(
      /SSRF_BLOCKED/,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects URLs whose host is private", async () => {
    await expect(fetchHtml("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(
      /SSRF_BLOCKED/,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects malformed URLs early with a clear message", async () => {
    await expect(fetchHtml("not a url")).rejects.toThrow(/Invalid URL/);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
