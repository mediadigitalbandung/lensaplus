import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// --- Mocks MUST be declared before importing module under test ---

const mockSystemSettingFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    systemSetting: {
      findUnique: (...args: unknown[]) => mockSystemSettingFindUnique(...args),
    },
  },
}));

vi.mock("../prisma", () => ({
  prisma: {
    systemSetting: {
      findUnique: (...args: unknown[]) => mockSystemSettingFindUnique(...args),
    },
  },
}));

// Mock node:fs/promises so the public/indexnow-key.txt read is controllable.
const mockReadFile = vi.fn();
vi.mock("node:fs/promises", () => ({
  default: {
    readFile: (...args: unknown[]) => mockReadFile(...args),
  },
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

describe("pingIndexNow", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockReadFile.mockReset();
    mockSystemSettingFindUnique.mockReset();
    delete process.env.INDEXNOW_KEY;
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lensaplus.com");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns success on HTTP 200", async () => {
    mockReadFile.mockResolvedValue("test-key-123");
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      text: async () => "",
    });
    const { pingIndexNow } = await import("../seo/indexnow");
    const result = await pingIndexNow(["https://lensaplus.com/berita/x"]);
    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  it("returns success on HTTP 202", async () => {
    mockReadFile.mockResolvedValue("test-key-123");
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 202,
      text: async () => "",
    });
    const { pingIndexNow } = await import("../seo/indexnow");
    const result = await pingIndexNow(["https://lensaplus.com/berita/x"]);
    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(202);
  });

  it("returns error on non-2xx HTTP status", async () => {
    mockReadFile.mockResolvedValue("test-key-123");
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 422,
      text: async () => "Bad URL",
    });
    const { pingIndexNow } = await import("../seo/indexnow");
    const result = await pingIndexNow(["https://lensaplus.com/berita/x"]);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(422);
    expect(result.error).toMatch(/HTTP 422/);
  });

  it("returns gracefully (no throw) when key is missing everywhere", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    mockSystemSettingFindUnique.mockResolvedValue(null);
    const { pingIndexNow } = await import("../seo/indexnow");
    const result = await pingIndexNow(["https://lensaplus.com/berita/x"]);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/IndexNow key not configured/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns success without calling fetch on empty url list", async () => {
    const { pingIndexNow } = await import("../seo/indexnow");
    const result = await pingIndexNow([]);
    expect(result.success).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("falls back to env INDEXNOW_KEY when file and DB miss", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    mockSystemSettingFindUnique.mockResolvedValue(null);
    vi.stubEnv("INDEXNOW_KEY", "env-fallback-key");

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      text: async () => "",
    });
    const { pingIndexNow } = await import("../seo/indexnow");
    const result = await pingIndexNow(["https://lensaplus.com/berita/y"]);
    expect(result.success).toBe(true);
  });
});
