import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkSpam } from "../spam-filter";

describe("checkSpam — heuristic-only path (no Akismet)", () => {
  beforeEach(() => {
    vi.stubEnv("AKISMET_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("flags 'viagra' keyword as spam", async () => {
    const result = await checkSpam({
      content: "Buy cheap viagra here!",
      authorName: "John",
      authorEmail: "j@x.com",
    });
    expect(result.verdict).toBe("spam");
    expect(result.reason).toContain("viagra");
  });

  it("flags 'slot gacor' keyword as spam", async () => {
    const result = await checkSpam({
      content: "Mainkan slot gacor terbaik 2025",
      authorName: "User",
      authorEmail: "u@x.com",
    });
    expect(result.verdict).toBe("spam");
    expect(result.reason).toContain("slot gacor");
  });

  it("flags >2 URLs as spam (URL density)", async () => {
    const result = await checkSpam({
      content:
        "Check https://a.com and https://b.com and https://c.com and https://d.com for deals",
      authorName: "Bob",
      authorEmail: "b@x.com",
    });
    expect(result.verdict).toBe("spam");
    expect(result.reason).toMatch(/^urls:/);
  });

  it("flags ALL CAPS shouting as review", async () => {
    const result = await checkSpam({
      content: "I AM SHOUTING VERY LOUDLY AT EVERYONE READING THIS COMMENT NOW",
      authorName: "Caps",
      authorEmail: "c@x.com",
    });
    expect(result.verdict).toBe("review");
    expect(result.reason).toBe("shouting");
  });

  it("flags repeated chars as spam", async () => {
    const result = await checkSpam({
      content: "Wowwwwwwwwwwww what an article",
      authorName: "User",
      authorEmail: "u@x.com",
    });
    expect(result.verdict).toBe("spam");
    expect(result.reason).toBe("repeated-chars");
  });

  it("flags suspicious author name 'admin' as review", async () => {
    const result = await checkSpam({
      content: "Nice article, well done.",
      authorName: "admin",
      authorEmail: "a@x.com",
    });
    expect(result.verdict).toBe("review");
    expect(result.reason).toBe("suspicious-name");
  });

  it("returns ok for benign comment", async () => {
    const result = await checkSpam({
      content: "Terima kasih atas artikelnya, sangat informatif.",
      authorName: "Pembaca",
      authorEmail: "p@x.com",
    });
    expect(result.verdict).toBe("ok");
  });
});

describe("checkSpam — Akismet path", () => {
  beforeEach(() => {
    vi.stubEnv("AKISMET_API_KEY", "test-key");
    vi.stubEnv("AKISMET_BLOG_URL", "https://kartawarta.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("maps Akismet 'true' + pro-tip discard → spam", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      text: async () => "true",
      headers: {
        get: (k: string) => (k === "x-akismet-pro-tip" ? "discard" : null),
      },
    } as unknown as Response);

    const result = await checkSpam({
      content: "Comment that passes heuristics",
      authorName: "Normal",
      authorEmail: "n@x.com",
    });
    expect(result.verdict).toBe("spam");
    expect(result.reason).toContain("akismet");
  });

  it("maps Akismet 'true' (no pro-tip) → review", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      text: async () => "true",
      headers: { get: () => null },
    } as unknown as Response);

    const result = await checkSpam({
      content: "Borderline comment that passes heuristics",
      authorName: "Maybe",
      authorEmail: "m@x.com",
    });
    expect(result.verdict).toBe("review");
  });

  it("maps Akismet 'false' → ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      text: async () => "false",
      headers: { get: () => null },
    } as unknown as Response);

    const result = await checkSpam({
      content: "Genuine comment that passes heuristics",
      authorName: "User",
      authorEmail: "u@x.com",
    });
    expect(result.verdict).toBe("ok");
  });

  it("fails open (returns ok) on Akismet network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await checkSpam({
      content: "Genuine comment that passes heuristics",
      authorName: "User",
      authorEmail: "u@x.com",
    });
    expect(result.verdict).toBe("ok");
  });
});
