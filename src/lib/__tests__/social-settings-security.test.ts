import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockIgUpsert = vi.fn();
const mockFbUpsert = vi.fn();
const mockThreadsUpsert = vi.fn();
const mockTgUpsert = vi.fn();
const mockSettingFindUnique = vi.fn();
const mockSettingUpsert = vi.fn();
const mockLogAudit = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instagramSettings: { upsert: (...a: unknown[]) => mockIgUpsert(...a) },
    facebookSettings: { upsert: (...a: unknown[]) => mockFbUpsert(...a) },
    threadsSettings: { upsert: (...a: unknown[]) => mockThreadsUpsert(...a) },
    telegramSettings: { upsert: (...a: unknown[]) => mockTgUpsert(...a) },
    systemSetting: {
      findUnique: (...a: unknown[]) => mockSettingFindUnique(...a),
      upsert: (...a: unknown[]) => mockSettingUpsert(...a),
    },
  },
}));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...actual,
    requireRole: vi.fn().mockResolvedValue({
      user: { id: "admin-1", role: "SUPER_ADMIN", email: "admin@lensaplus.com", name: "Admin" },
    }),
    logAudit: (...a: unknown[]) => mockLogAudit(...a),
  };
});

import { PUT as putSocialSettings } from "@/app/api/social/settings/route";
import { PUT as putSystemSetting } from "@/app/api/settings/route";
import { decryptSecret } from "@/lib/crypto-secrets";

const KEY_B64 = Buffer.alloc(32, 0xcd).toString("base64");

describe("Social & system settings token protection", () => {
  const prevKey = process.env.SETTINGS_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.SETTINGS_ENCRYPTION_KEY = KEY_B64;
    mockIgUpsert.mockReset();
    mockFbUpsert.mockReset();
    mockThreadsUpsert.mockReset();
    mockTgUpsert.mockReset();
    mockSettingFindUnique.mockReset();
    mockSettingUpsert.mockReset();
    mockLogAudit.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { expires_at: 0 } }),
      }),
    );
  });

  afterEach(() => {
    if (prevKey === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY;
    else process.env.SETTINGS_ENCRYPTION_KEY = prevKey;
  });

  it("PUT /api/social/settings does NOT overwrite stored token when masked placeholder is sent", async () => {
    mockIgUpsert.mockResolvedValueOnce({
      id: "global",
      igUserId: "12345",
      enabled: true,
      accessToken: "v1:existing",
    });

    for (const placeholder of ["EAAB...abcd", "(tidak berubah)", "••••••••1234", "***", ""]) {
      mockIgUpsert.mockResolvedValueOnce({
        id: "global",
        igUserId: "12345",
        enabled: true,
        accessToken: null,
      });
      const req = new NextRequest("http://localhost/api/social/settings", {
        method: "PUT",
        body: JSON.stringify({
          scope: "instagram",
          data: { accessToken: placeholder, igUserId: "12345", enabled: true },
        }),
      });
      const res = await putSocialSettings(req);
      expect(res.status).toBe(200);
      const callArg = mockIgUpsert.mock.calls.at(-1)?.[0];
      expect(callArg.update).not.toHaveProperty("accessToken");
      expect(callArg.create).not.toHaveProperty("accessToken");
    }
  });

  it("PUT /api/social/settings encrypts new token at rest and returns masked token in response", async () => {
    const rawToken = "EAAB_REAL_SECRET_TOKEN_987654321";
    mockFbUpsert.mockImplementationOnce(async ({ update }: { update: { accessToken: string } }) => ({
      id: "global",
      pageId: "999",
      postMode: "link",
      enabled: true,
      accessToken: update.accessToken,
    }));

    const req = new NextRequest("http://localhost/api/social/settings", {
      method: "PUT",
      body: JSON.stringify({
        scope: "facebook",
        data: { accessToken: rawToken, pageId: "999", enabled: true },
      }),
    });
    const res = await putSocialSettings(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    const written = mockFbUpsert.mock.calls[0][0].update.accessToken as string;
    expect(written.startsWith("v1:")).toBe(true);
    expect(decryptSecret(written)).toBe(rawToken);
    expect(json.data.accessToken).toBe("EAAB...4321");
    expect(json.data.hasAccessToken).toBe(true);
  });

  it("PUT /api/settings preserves existing secret when masked bullet placeholder is submitted", async () => {
    mockSettingFindUnique.mockResolvedValueOnce({
      key: "anthropic_api_key",
      value: "v1:cipher",
    });

    const req = new NextRequest("http://localhost/api/settings", {
      method: "PUT",
      body: JSON.stringify({ key: "anthropic_api_key", value: "••••••••1234" }),
    });
    const res = await putSystemSetting(req);
    expect(res.status).toBe(200);
    expect(mockSettingUpsert).not.toHaveBeenCalled();
  });

  it("PUT /api/settings rejects masked placeholder when no secret exists yet", async () => {
    mockSettingFindUnique.mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/settings", {
      method: "PUT",
      body: JSON.stringify({ key: "anthropic_api_key", value: "••••••••1234" }),
    });
    const res = await putSystemSetting(req);
    expect(res.status).toBe(400);
    expect(mockSettingUpsert).not.toHaveBeenCalled();
  });
});
