import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockFindUnique, mockRunReport, mockSearchQuery } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockRunReport: vi.fn(),
  mockSearchQuery: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    systemSetting: {
      findUnique: mockFindUnique,
    },
  },
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      JWT: vi.fn(function (opts: unknown) {
        return opts;
      }),
    },
    analyticsdata: vi.fn(() => ({
      properties: {
        runReport: mockRunReport,
      },
    })),
    searchconsole: vi.fn(() => ({
      searchanalytics: {
        query: mockSearchQuery,
      },
    })),
  },
}));

import {
  extractStatsPayload,
  parseServiceAccountCredentials,
  normalizeGA4PropertyId,
  getGA4Data,
  clearGA4Cache,
  type GA4Stats,
} from "../stats/google-analytics";
import {
  buildGscCandidateSiteUrls,
  getGSCData,
  clearGSCCache,
} from "../stats/google-search";
import {
  getCloudflareAnalytics,
  clearCloudflareCache,
} from "../stats/cloudflare";

describe("stats-tabs-fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearGA4Cache();
    clearGSCCache();
    clearCloudflareCache();
    delete process.env.GOOGLE_CREDENTIALS_JSON;
    delete process.env.GA4_PROPERTY_ID;
    delete process.env.GSC_SITE_URL;
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ZONE_ID;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("extractStatsPayload (response unwrapping & error surfacing)", () => {
    it("unwraps flat API response shape { success: true, data: <stats> }", () => {
      const json = {
        success: true,
        data: {
          pageviews: 1500,
          users: 800,
          sessions: 950,
          avgSessionDurationSec: 42,
          topPages: [{ path: "/berita/uji", pageviews: 500, users: 300 }],
          dailyTrend: [{ date: "2026-11-18", pageviews: 1500, users: 800 }],
        },
      };

      const res = extractStatsPayload<GA4Stats>(true, 200, json);
      expect(res.error).toBeNull();
      expect(res.data?.pageviews).toBe(1500);
      expect(res.data?.topPages).toHaveLength(1);
    });

    it("unwraps legacy double-nested { success: true, data: { data: <stats>, _partialError } }", () => {
      const json = {
        success: true,
        data: {
          _partialError: "Not configured: missing ga4_property_id",
          data: {
            pageviews: 0,
            users: 0,
            sessions: 0,
            avgSessionDurationSec: 0,
            topPages: [],
            dailyTrend: [],
            _error: "Not configured: missing ga4_property_id",
          },
          meta: { from: "2026-10-19", to: "2026-11-18", cacheHit: false, provider: "ga4" },
        },
      };

      const res = extractStatsPayload<GA4Stats>(true, 200, json);
      expect(res.error).toBe("Not configured: missing ga4_property_id");
      expect(res.data?.pageviews).toBe(0);
      expect(res.data?.topPages).toEqual([]);
    });

    it("surfaces top-level error when success is false", () => {
      const json = {
        success: false,
        error: "Cloudflare API HTTP 403",
        data: {
          requests: 0,
          bandwidth: 0,
          cachedRequests: 0,
          cacheHitRate: 0,
          threats: 0,
          dailyTrend: [],
        },
      };

      const res = extractStatsPayload(true, 200, json);
      expect(res.error).toBe("Cloudflare API HTTP 403");
    });
  });

  describe("parseServiceAccountCredentials & normalizeGA4PropertyId", () => {
    it("normalizes escaped \\n in PEM private_key and rejects masked placeholders", () => {
      const raw = JSON.stringify({
        type: "service_account",
        client_email: "  bot@lensaplus.iam.gserviceaccount.com ",
        private_key: "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBg\\n-----END PRIVATE KEY-----\\n",
      });

      const creds = parseServiceAccountCredentials(raw);
      expect(creds).not.toBeNull();
      expect(creds?.client_email).toBe("bot@lensaplus.iam.gserviceaccount.com");
      expect(creds?.private_key).toContain("-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg");
      expect(creds?.private_key).not.toContain("\\n");

      expect(parseServiceAccountCredentials("••••••••abcd")).toBeNull();
    });

    it("strips properties/ prefix and rejects G-XXXX Measurement ID in ga4_property_id", () => {
      expect(normalizeGA4PropertyId("properties/123456789")).toEqual({
        propertyId: "123456789",
      });
      expect(normalizeGA4PropertyId("  456789012  ")).toEqual({
        propertyId: "456789012",
      });

      const measurementErr = normalizeGA4PropertyId("G-ABC1234567");
      expect(measurementErr.propertyId).toBeNull();
      expect(measurementErr.error).toContain("Measurement ID");
    });
  });

  describe("buildGscCandidateSiteUrls & getGSCData fallback", () => {
    it("normalizes root URLs to include trailing slash and builds sc-domain fallback", () => {
      const fromUrl = buildGscCandidateSiteUrls("https://lensaplus.com");
      expect(fromUrl[0]).toBe("https://lensaplus.com/");
      expect(fromUrl).toContain("sc-domain:lensaplus.com");

      const fromDomain = buildGscCandidateSiteUrls("sc-domain:https://lensaplus.com/");
      expect(fromDomain[0]).toBe("sc-domain:lensaplus.com");
      expect(fromDomain).toContain("https://lensaplus.com/");

      const fromBare = buildGscCandidateSiteUrls("lensaplus.com");
      expect(fromBare[0]).toBe("sc-domain:lensaplus.com");
      expect(fromBare).toContain("https://lensaplus.com/");
    });

    it("retries with sc-domain:lensaplus.com when https://lensaplus.com/ returns 403 permission error", async () => {
      const validSa = JSON.stringify({
        type: "service_account",
        client_email: "bot@lensaplus.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----",
      });

      mockFindUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
        if (where.key === "google_credentials_json") return { key: where.key, value: validSa };
        if (where.key === "gsc_site_url") return { key: where.key, value: "https://lensaplus.com" };
        return null;
      });

      mockSearchQuery.mockImplementation(async ({ siteUrl }: { siteUrl: string }) => {
        if (siteUrl === "https://lensaplus.com/") {
          throw new Error(
            "User does not have sufficient permission for site 'https://lensaplus.com/'.",
          );
        }
        return {
          data: {
            rows: [{ keys: ["lensaplus"], impressions: 250, clicks: 25, ctr: 0.1, position: 3.2 }],
          },
        };
      });

      const stats = await getGSCData({ from: "2026-11-01", to: "2026-11-18", refresh: true });
      expect(stats._error).toBeUndefined();
      expect(stats.impressions).toBe(250);
      expect(stats.clicks).toBe(25);
    });
  });

  describe("getGA4Data", () => {
    it("falls back to GOOGLE_CREDENTIALS_JSON env when DB value is masked and queries properties/<id>", async () => {
      process.env.GOOGLE_CREDENTIALS_JSON = JSON.stringify({
        type: "service_account",
        client_email: "ga4@lensaplus.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\\nKEYDATA\\n-----END PRIVATE KEY-----",
      });

      mockFindUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
        if (where.key === "google_credentials_json") return { key: where.key, value: "••••••••json" };
        if (where.key === "ga4_property_id") return { key: where.key, value: "properties/987654321" };
        return null;
      });

      mockRunReport.mockResolvedValue({
        data: {
          rows: [
            {
              dimensionValues: [{ value: "20261118" }],
              metricValues: [
                { value: "420" },
                { value: "180" },
                { value: "210" },
                { value: "65.4" },
              ],
            },
          ],
        },
      });

      const stats = await getGA4Data({ from: "2026-11-01", to: "2026-11-18", refresh: true });
      expect(stats._error).toBeUndefined();
      expect(stats.pageviews).toBe(420);
      expect(stats.users).toBe(180);
      expect(stats.dailyTrend[0]?.date).toBe("2026-11-18");
      expect(mockRunReport).toHaveBeenCalledWith(
        expect.objectContaining({ property: "properties/987654321" }),
      );
    });
  });

  describe("getCloudflareAnalytics", () => {
    it("retries with clamped 28-day window when 31-day window hits Free-plan range error", async () => {
      mockFindUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
        if (where.key === "cloudflare_api_token") return { key: where.key, value: "Bearer cf_secret_token" };
        if (where.key === "cloudflare_zone_id") return { key: where.key, value: "zone_123" };
        return null;
      });

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
        const body = JSON.parse(String(init?.body ?? "{}"));
        if (body.variables?.start === "2026-10-18") {
          return new Response(
            JSON.stringify({
              data: null,
              errors: [{ message: "time range is too large: maximum lookback exceeded" }],
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            data: {
              viewer: {
                zones: [
                  {
                    httpRequests1dGroups: [
                      {
                        dimensions: { date: "2026-11-18" },
                        sum: {
                          requests: 1000,
                          bytes: 2048000,
                          cachedBytes: 1024000,
                          cachedRequests: 750,
                          threats: 3,
                        },
                      },
                    ],
                  },
                ],
              },
            },
          }),
          { status: 200 },
        );
      });

      const stats = await getCloudflareAnalytics({
        from: "2026-10-18",
        to: "2026-11-18",
        refresh: true,
      });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(stats._error).toBeUndefined();
      expect(stats.requests).toBe(1000);
      expect(stats.cacheHitRate).toBe(0.75);
      expect(stats.threats).toBe(3);
    });
  });
});
