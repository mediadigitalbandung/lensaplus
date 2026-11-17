import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Mocks MUST be declared before importing the module under test ---

const mockAnthropicCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockAnthropicCreate,
      };
    },
  };
});

const mockSystemSettingFindUnique = vi.fn();
const mockAiUsageLogCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    systemSetting: {
      findUnique: (...args: unknown[]) => mockSystemSettingFindUnique(...args),
    },
    aIUsageLog: {
      create: (...args: unknown[]) => mockAiUsageLogCreate(...args),
    },
  },
}));

// The module under test imports prisma via relative path "./prisma" from src/lib.
// Also mock the relative path so both resolutions hit the same mock.
vi.mock("../prisma", () => ({
  prisma: {
    systemSetting: {
      findUnique: (...args: unknown[]) => mockSystemSettingFindUnique(...args),
    },
    aIUsageLog: {
      create: (...args: unknown[]) => mockAiUsageLogCreate(...args),
    },
  },
}));

// callAI's logUsage routes through recordAiUsage (ai-usage), which reads the
// USD→IDR rate from fx-rate. Mock it so the fire-and-forget telemetry never
// makes a live FX `fetch` during tests (which would corrupt fetch-call counts).
vi.mock("@/lib/fx-rate", () => ({ getUsdIdrRate: () => Promise.resolve(16500) }));
vi.mock("../fx-rate", () => ({ getUsdIdrRate: () => Promise.resolve(16500) }));

// Import AFTER mocks.
import { callAI, isRetryable } from "../ai-client";

describe("isRetryable", () => {
  it("returns false for 400 / Bad Request / invalid prompt errors", () => {
    expect(isRetryable(new Error("HTTP 400: Bad Request"))).toBe(false);
    expect(isRetryable(new Error("invalid prompt — message is empty"))).toBe(
      false,
    );
    expect(isRetryable(new Error("invalid_request_error"))).toBe(false);
  });

  it("returns true for network / 5xx / 429 / auth errors", () => {
    expect(isRetryable(new Error("ETIMEDOUT"))).toBe(true);
    expect(isRetryable(new Error("fetch failed"))).toBe(true);
    expect(isRetryable(new Error("HTTP 503 Service Unavailable"))).toBe(true);
    expect(isRetryable(new Error("HTTP 429 rate limit exceeded"))).toBe(true);
    expect(isRetryable(new Error("HTTP 401 Unauthorized"))).toBe(true);
    expect(isRetryable(new Error("AbortError"))).toBe(true);
  });

  it("returns true (conservative default) for unknown errors", () => {
    expect(isRetryable(new Error("something weird happened"))).toBe(true);
    expect(isRetryable("plain string error")).toBe(true);
  });
});

// Helper: make SystemSetting return given keys.
function mockKeys(opts: {
  anthropic?: string | null;
  deepseek?: string | null;
}) {
  mockSystemSettingFindUnique.mockImplementation(
    async ({ where }: { where: { key: string } }) => {
      if (where.key === "anthropic_api_key") {
        return opts.anthropic
          ? { key: where.key, value: opts.anthropic }
          : null;
      }
      if (where.key === "deepseek_api_key") {
        return opts.deepseek ? { key: where.key, value: opts.deepseek } : null;
      }
      return null;
    },
  );
}

describe("callAI", () => {
  beforeEach(() => {
    mockAnthropicCreate.mockReset();
    mockSystemSettingFindUnique.mockReset();
    mockAiUsageLogCreate.mockReset();
    mockAiUsageLogCreate.mockResolvedValue({});
    // Ensure env vars don't leak into tests.
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    // Reset fetch mock per test.
    vi.stubGlobal("fetch", vi.fn());
  });

  it("Test 1: Anthropic success returns provider='anthropic' with valid tokens", async () => {
    mockKeys({ anthropic: "sk-ant-test", deepseek: "ds-test" });
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "Halo dunia" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await callAI({
      feature: "test",
      userPrompt: "Halo",
    });

    expect(result.provider).toBe("anthropic");
    expect(result.text).toBe("Halo dunia");
    expect(result.inputTokens).toBe(10);
    expect(result.outputTokens).toBe(5);
    expect(result.totalTokens).toBe(15);
    expect(mockAnthropicCreate).toHaveBeenCalledOnce();
  });

  it("Test 2: Anthropic throws → DeepSeek fallback invoked → provider='deepseek'", async () => {
    mockKeys({ anthropic: "sk-ant-test", deepseek: "ds-test" });
    mockAnthropicCreate.mockRejectedValue(new Error("rate limit"));

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Fallback OK" } }],
        usage: { prompt_tokens: 8, completion_tokens: 4 },
      }),
    });

    const result = await callAI({
      feature: "test",
      userPrompt: "Halo",
    });

    expect(result.provider).toBe("deepseek");
    expect(result.text).toBe("Fallback OK");
    expect(result.inputTokens).toBe(8);
    expect(result.outputTokens).toBe(4);
    expect(result.totalTokens).toBe(12);
    expect(mockAnthropicCreate).toHaveBeenCalledOnce();
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it("Test 3: Anthropic and DeepSeek both fail → callAI throws with details", async () => {
    mockKeys({ anthropic: "sk-ant-test", deepseek: "ds-test" });
    mockAnthropicCreate.mockRejectedValue(new Error("anthropic down"));
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "deepseek down",
    });

    await expect(
      callAI({ feature: "test", userPrompt: "Halo" }),
    ).rejects.toThrow(/AI providers exhausted/);

    expect(mockAnthropicCreate).toHaveBeenCalledOnce();
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it("Test 4: forceProvider='deepseek' skips Anthropic entirely", async () => {
    mockKeys({ anthropic: "sk-ant-test", deepseek: "ds-test" });
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Forced DS" } }],
        usage: { prompt_tokens: 3, completion_tokens: 2 },
      }),
    });

    const result = await callAI({
      feature: "test",
      userPrompt: "Halo",
      forceProvider: "deepseek",
    });

    expect(result.provider).toBe("deepseek");
    expect(result.text).toBe("Forced DS");
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it("Test 5: no keys in DB and no env vars → throws", async () => {
    mockKeys({ anthropic: null, deepseek: null });

    await expect(
      callAI({ feature: "test", userPrompt: "Halo" }),
    ).rejects.toThrow(/AI providers exhausted/);

    expect(mockAnthropicCreate).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("Test 6: ai_primary_provider='deepseek' tries DeepSeek before Anthropic", async () => {
    mockSystemSettingFindUnique.mockImplementation(
      async ({ where }: { where: { key: string } }) => {
        const table: Record<string, string> = {
          anthropic_api_key: "sk-ant-test",
          deepseek_api_key: "ds-test",
          ai_primary_provider: "deepseek",
        };
        return table[where.key] ? { key: where.key, value: table[where.key] } : null;
      },
    );
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Primary DS" } }],
        usage: { prompt_tokens: 5, completion_tokens: 4 },
      }),
    });

    const result = await callAI({
      feature: "article_draft",
      userPrompt: "Buat berita",
    });

    expect(result.provider).toBe("deepseek");
    expect(result.text).toBe("Primary DS");
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it("Test 7: DeepSeek applies instructions, model, token cap, temperature, top_p, and frequency_penalty", async () => {
    mockSystemSettingFindUnique.mockImplementation(
      async ({ where }: { where: { key: string } }) => {
        const table: Record<string, string> = {
          deepseek_api_key: "ds-test",
          deepseek_model: "deepseek-chat",
          deepseek_instructions: "Gunakan lead 5W1H singkat.",
          deepseek_max_tokens: "1500",
          deepseek_temperature: "0.3",
          deepseek_top_p: "0.9",
          deepseek_frequency_penalty: "0.2",
        };
        return table[where.key] ? { key: where.key, value: table[where.key] } : null;
      },
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Artikel rapi" } }],
        usage: { prompt_tokens: 12, completion_tokens: 8 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await callAI({
      feature: "article_draft",
      forceProvider: "deepseek",
      systemPrompt: "Base system prompt",
      userPrompt: "Tulis berita",
      maxTokens: 2500,
    });

    expect(res.model).toBe("deepseek-chat");
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sentBody.model).toBe("deepseek-chat");
    expect(sentBody.max_tokens).toBe(1500);
    expect(sentBody.temperature).toBe(0.3);
    expect(sentBody.top_p).toBe(0.9);
    expect(sentBody.frequency_penalty).toBe(0.2);
    expect(sentBody.messages[0].content).toContain("Base system prompt");
    expect(sentBody.messages[0].content).toContain("Gunakan lead 5W1H singkat.");
  });

  it("Test 8: deepseek-reasoner omits sampling params and raises token floor on test probe", async () => {
    mockSystemSettingFindUnique.mockImplementation(
      async ({ where }: { where: { key: string } }) => {
        const table: Record<string, string> = {
          deepseek_api_key: "ds-test",
          deepseek_model: "deepseek-reasoner",
          deepseek_temperature: "0.3",
          deepseek_top_p: "0.9",
          deepseek_frequency_penalty: "0.2",
        };
        return table[where.key] ? { key: where.key, value: table[where.key] } : null;
      },
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "OK" } }],
        usage: { prompt_tokens: 4, completion_tokens: 20 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await callAI({
      feature: "test",
      forceProvider: "deepseek",
      userPrompt: "Reply OK",
      maxTokens: 10,
    });

    expect(res.model).toBe("deepseek-reasoner");
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sentBody.model).toBe("deepseek-reasoner");
    expect(sentBody.max_tokens).toBeGreaterThanOrEqual(512);
    expect(sentBody.temperature).toBeUndefined();
    expect(sentBody.top_p).toBeUndefined();
    expect(sentBody.frequency_penalty).toBeUndefined();
  });

  it("Test 9: deepseek_combo_enabled with allowCombo executes 2 stages and sums tokens", async () => {
    mockSystemSettingFindUnique.mockImplementation(
      async ({ where }: { where: { key: string } }) => {
        const table: Record<string, string> = {
          deepseek_api_key: "ds-test",
          deepseek_model: "deepseek-chat",
          deepseek_combo_enabled: "true",
          deepseek_research_model: "deepseek-reasoner",
        };
        return table[where.key] ? { key: where.key, value: table[where.key] } : null;
      },
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "- Fakta 1\n- Fakta 2" } }],
          usage: { prompt_tokens: 10, completion_tokens: 30 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "<p>Artikel final</p>" } }],
          usage: { prompt_tokens: 50, completion_tokens: 100 },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const res = await callAI({
      feature: "article_draft",
      forceProvider: "deepseek",
      userPrompt: "Parafrase berita",
      allowCombo: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body1 = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const body2 = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body1.model).toBe("deepseek-reasoner");
    expect(body2.model).toBe("deepseek-chat");
    expect(body2.messages[1].content).toContain("Fakta 1");
    expect(res.text).toBe("<p>Artikel final</p>");
    expect(res.inputTokens).toBe(60);
    expect(res.outputTokens).toBe(130);
    expect(res.totalTokens).toBe(190);
  });

  it("Test 10: enable_ai='false' blocks generation calls but permits feature='test'", async () => {
    mockSystemSettingFindUnique.mockImplementation(
      async ({ where }: { where: { key: string } }) => {
        const table: Record<string, string> = {
          enable_ai: "false",
          deepseek_api_key: "ds-test",
        };
        return table[where.key] ? { key: where.key, value: table[where.key] } : null;
      },
    );

    await expect(
      callAI({ feature: "article_draft", userPrompt: "Tulis", forceProvider: "deepseek" }),
    ).rejects.toThrow(/dinonaktifkan/i);
  });
});
