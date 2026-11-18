import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockRequireRole = vi.fn();
const mockLogAudit = vi.fn(async () => {});
const mockArticleFindUnique = vi.fn();
const mockArticleFindMany = vi.fn();
const mockGenerateSorotan = vi.fn();
const mockGetInFlight = vi.fn(() => [] as string[]);

vi.mock("@/lib/api-utils", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api-utils")>("@/lib/api-utils");
  return {
    ...actual,
    requireRole: (roles: string[]) => mockRequireRole(roles),
    logAudit: (...args: unknown[]) => mockLogAudit(...(args as [])),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: {
      findUnique: (args: unknown) => mockArticleFindUnique(args),
      findMany: (args: unknown) => mockArticleFindMany(args),
    },
  },
}));

vi.mock("@/lib/seo/sorotan-generator", () => ({
  SOROTAN_ANGLE_COUNT: 9,
  generateSorotan: (id: string, opts?: unknown) => mockGenerateSorotan(id, opts),
  getInFlightSorotanArticleIds: () => mockGetInFlight(),
}));

describe("parseApiJson resilience against HTML error/timeout responses", () => {
  it("converts Nginx/Cloudflare HTML 504/524/502/401 pages into structured errors instead of throwing SyntaxError", async () => {
    const { parseApiJson } = await import("@/lib/http-json");

    const html504 = new Response(
      "<html> <head><title>504 Gateway Time-out</title></head><body><h1>504 Gateway Time-out</h1></body></html>",
      { status: 504, headers: { "Content-Type": "text/html" } },
    );
    const parsed504 = await parseApiJson(html504);
    expect(parsed504?.success).toBe(false);
    expect(parsed504?.error).toContain("HTTP 504");

    const html524 = new Response("<html><head><title>524</title></head></html>", {
      status: 524,
    });
    const parsed524 = await parseApiJson(html524);
    expect(parsed524?.success).toBe(false);
    expect(parsed524?.error).toContain("HTTP 524");

    const html502 = new Response("<html> <head><title>502</title></head></html>", {
      status: 502,
    });
    const parsed502 = await parseApiJson(html502);
    expect(parsed502?.success).toBe(false);
    expect(parsed502?.error).toContain("HTTP 502");

    const html401 = new Response("<html><head><title>Login</title></head></html>", {
      status: 401,
    });
    const parsed401 = await parseApiJson(html401);
    expect(parsed401?.success).toBe(false);
    expect(parsed401?.error).toContain("Sesi login");

    const validJson = new Response(
      JSON.stringify({ success: true, data: { ok: 1 } }),
      { status: 200 },
    );
    expect(await parseApiJson(validJson)).toEqual({
      success: true,
      data: { ok: 1 },
    });

    const empty = new Response(null, { status: 204 });
    expect(await parseApiJson(empty)).toBeNull();

    const empty500 = new Response("", { status: 500 });
    expect(await parseApiJson(empty500)).toBeNull();
  });

  it("panel sorotan page never calls raw res.json()", () => {
    const pageSrc = fs.readFileSync(
      path.join(process.cwd(), "src/app/panel/sorotan/page.tsx"),
      "utf8",
    );
    expect(pageSrc).toContain("parseApiJson");
    expect(pageSrc).not.toMatch(/\.\s*json\s*\(/);
  });
});

describe("Async Sorotan job endpoints (single, batch, poll)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({
      user: { id: "editor-1", role: "EDITOR", name: "Editor Uji" },
    });
    mockGetInFlight.mockReturnValue([]);
  });

  it("POST /api/seo/generate-sorotan-single returns 404 when article does not exist", async () => {
    mockArticleFindUnique.mockResolvedValue(null);
    const { POST } = await import(
      "@/app/api/seo/generate-sorotan-single/route"
    );
    const req = new NextRequest(
      "http://localhost/api/seo/generate-sorotan-single",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: "missing-id" }),
      },
    );
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
  });

  it("POST /api/seo/generate-sorotan-single starts background job (202) and GET /api/seo/sorotan-job tracks completion", async () => {
    let resolveGen!: (v: unknown) => void;
    mockArticleFindUnique.mockResolvedValue({ id: "art-1", status: "DRAFT" });
    mockGenerateSorotan.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGen = resolve;
        }),
    );

    const { POST } = await import(
      "@/app/api/seo/generate-sorotan-single/route"
    );
    const { GET } = await import("@/app/api/seo/sorotan-job/route");

    const postRes = await POST(
      new NextRequest("http://localhost/api/seo/generate-sorotan-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: "art-1" }),
      }),
    );
    const postJson = await postRes.json();

    expect(postRes.status).toBe(202);
    expect(postJson.success).toBe(true);
    expect(postJson.data.async).toBe(true);
    expect(postJson.data.jobId).toBeTruthy();

    // Poll while running
    mockGetInFlight.mockReturnValue(["art-1"]);
    const pollRunningRes = await GET(
      new NextRequest(
        `http://localhost/api/seo/sorotan-job?jobId=${postJson.data.jobId}`,
      ),
    );
    const pollRunningJson = await pollRunningRes.json();
    expect(pollRunningJson.data.found).toBe(true);
    expect(pollRunningJson.data.job.status).toBe("running");
    expect(pollRunningJson.data.inFlightArticleIds).toEqual(["art-1"]);

    // Resolve background generation and poll again
    resolveGen({
      articleId: "art-1",
      created: 9,
      skipped: 0,
      errors: [],
      sorotanIds: ["s1"],
    });
    await new Promise((r) => setTimeout(r, 15));

    mockGetInFlight.mockReturnValue([]);
    const pollDoneRes = await GET(
      new NextRequest(
        `http://localhost/api/seo/sorotan-job?jobId=${postJson.data.jobId}`,
      ),
    );
    const pollDoneJson = await pollDoneRes.json();
    expect(pollDoneJson.data.found).toBe(true);
    expect(pollDoneJson.data.job.status).toBe("done");
    expect(pollDoneJson.data.job.totalCreated).toBe(9);
    expect(pollDoneJson.data.job.totalErrors).toBe(0);
    expect(mockGenerateSorotan).toHaveBeenCalledWith("art-1", {
      userId: "editor-1",
      userName: "Editor Uji",
    });
  });

  it("POST /api/seo/generate-sorotan returns async job (202) for batch and 200 when 0 pending", async () => {
    const { POST } = await import("@/app/api/seo/generate-sorotan/route");

    mockArticleFindMany.mockResolvedValue([]);
    const emptyRes = await POST(
      new NextRequest("http://localhost/api/seo/generate-sorotan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 5 }),
      }),
    );
    const emptyJson = await emptyRes.json();
    expect(emptyRes.status).toBe(200);
    expect(emptyJson.data.async).toBe(false);
    expect(emptyJson.data.targets).toBe(0);

    mockGenerateSorotan.mockResolvedValue({
      articleId: "a1",
      created: 9,
      skipped: 0,
      errors: [],
      sorotanIds: [],
    });
    const batchRes = await POST(
      new NextRequest("http://localhost/api/seo/generate-sorotan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleIds: ["a1", "a2", "a1"] }),
      }),
    );
    const batchJson = await batchRes.json();
    expect(batchRes.status).toBe(202);
    expect(batchJson.data.async).toBe(true);
    expect(batchJson.data.targets).toBe(2); // deduplicated
    expect(batchJson.data.articleIds).toEqual(["a1", "a2"]);
  });

  it("GET /api/seo/sorotan-job returns found=false for unknown jobId", async () => {
    const { GET } = await import("@/app/api/seo/sorotan-job/route");
    const res = await GET(
      new NextRequest("http://localhost/api/seo/sorotan-job?jobId=unknown-id"),
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.found).toBe(false);
    expect(json.data.job).toBeNull();
  });
});
