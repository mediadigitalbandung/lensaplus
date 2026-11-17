import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSafePublicFetch, mockMkdir, mockWriteFile } = vi.hoisted(() => ({
  mockSafePublicFetch: vi.fn(),
  mockMkdir: vi.fn(async () => undefined),
  mockWriteFile: vi.fn(async () => undefined),
}));

vi.mock("../scraper/fetch", () => ({
  assertSafePublicUrl: vi.fn(async (u: string) => new URL(u)),
  safePublicFetch: (...a: unknown[]) => mockSafePublicFetch(...a),
  userAgent: () => "Lensaplus-Scraper/1.0 (+https://lensaplus.com/kontak)",
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    media: {
      create: vi.fn(async () => ({ id: "m1" })),
    },
  },
}));

vi.mock("fs/promises", () => ({
  default: {
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
  },
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
}));

import { downloadImageToUploads } from "../scraper/download-image";

const MINIMAL_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

function makeStreamResponse(
  status: number,
  headers: Record<string, string>,
  bytes?: Uint8Array,
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    body: bytes
      ? new ReadableStream({
          start(c) {
            c.enqueue(bytes);
            c.close();
          },
        })
      : { cancel: vi.fn(async () => {}) },
  };
}

describe("downloadImageToUploads resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retries with browser User-Agent + Referer when CDN returns 403 to bot UA", async () => {
    mockSafePublicFetch
      .mockResolvedValueOnce({
        response: makeStreamResponse(403, {}),
        finalUrl: "https://cdn.example.id/photo.jpg",
      })
      .mockResolvedValueOnce({
        response: makeStreamResponse(
          200,
          { "content-type": "image/jpeg" },
          MINIMAL_JPEG,
        ),
        finalUrl: "https://cdn.example.id/photo.jpg",
      });

    const out = await downloadImageToUploads("https://cdn.example.id/photo.jpg", {
      referer: "https://example.id/news/1",
      uploadedBy: "u1",
      uploaderName: "Editor",
    });

    expect(out.url).toMatch(/^\/uploads\/.+\.jpg$/);
    expect(out.contentType).toBe("image/jpeg");
    expect(mockSafePublicFetch).toHaveBeenCalledTimes(2);
    expect(mockSafePublicFetch.mock.calls[0][1].headers.Referer).toBe(
      "https://example.id/news/1",
    );
    expect(mockSafePublicFetch.mock.calls[1][1].headers["User-Agent"]).toContain(
      "Mozilla/5.0",
    );
  });

  it("accepts valid JPEG bytes served as application/octet-stream", async () => {
    mockSafePublicFetch.mockResolvedValueOnce({
      response: makeStreamResponse(
        200,
        { "content-type": "application/octet-stream" },
        MINIMAL_JPEG,
      ),
      finalUrl: "https://storage.example.id/img",
    });

    const out = await downloadImageToUploads("https://storage.example.id/img", {
      uploadedBy: "u1",
      uploaderName: "Editor",
    });

    expect(out.url).toMatch(/^\/uploads\/.+\.jpg$/);
    expect(out.contentType).toBe("image/jpeg");
  });
});
