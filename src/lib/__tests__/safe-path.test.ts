import { describe, it, expect } from "vitest";
import path from "path";
import {
  PUBLIC_DIR,
  UPLOAD_DIR,
  extractSafeUploadKey,
  isSafeImageRef,
  resolvePublicSubpath,
  resolveUploadKeyPath,
} from "../safe-path";

describe("resolveUploadKeyPath", () => {
  it("resolves valid relative keys inside UPLOAD_DIR", () => {
    expect(resolveUploadKeyPath("photo.jpg")).toBe(path.resolve(UPLOAD_DIR, "photo.jpg"));
    expect(resolveUploadKeyPath("social/card.png")).toBe(
      path.resolve(UPLOAD_DIR, "social", "card.png"),
    );
  });

  it("rejects traversal, absolute paths, backslashes, and null bytes", () => {
    expect(() => resolveUploadKeyPath("../.env")).toThrow();
    expect(() => resolveUploadKeyPath("a/../../.env")).toThrow();
    expect(() => resolveUploadKeyPath("..\\secret.txt")).toThrow();
    expect(() => resolveUploadKeyPath("/etc/passwd")).toThrow();
    expect(() => resolveUploadKeyPath("C:\\Windows\\win.ini")).toThrow();
    expect(() => resolveUploadKeyPath("bad\0.png")).toThrow();
    expect(() => resolveUploadKeyPath("")).toThrow();
  });
});

describe("extractSafeUploadKey", () => {
  it("extracts key from /uploads/ relative and absolute URLs", () => {
    expect(extractSafeUploadKey("/uploads/123-abc.jpg")).toBe("123-abc.jpg");
    expect(extractSafeUploadKey("https://lensaplus.com/uploads/social/img.jpg")).toBe(
      "social/img.jpg",
    );
  });

  it("returns null for non-upload paths or traversal attempts", () => {
    expect(extractSafeUploadKey("/uploads/../../.env")).toBeNull();
    expect(extractSafeUploadKey("/uploads/%2e%2e/.env")).toBeNull();
    expect(extractSafeUploadKey("/images/logo.png")).toBeNull();
    expect(extractSafeUploadKey("javascript:alert(1)")).toBeNull();
    expect(extractSafeUploadKey(null)).toBeNull();
  });
});

describe("resolvePublicSubpath", () => {
  it("resolves valid paths strictly inside public/ or allowed subdir", () => {
    expect(resolvePublicSubpath("/uploads/social/abc.jpg", "uploads/social")).toBe(
      path.resolve(PUBLIC_DIR, "uploads", "social", "abc.jpg"),
    );
    expect(resolvePublicSubpath("public/uploads/foo.png")).toBe(
      path.resolve(PUBLIC_DIR, "uploads", "foo.png"),
    );
    expect(
      resolvePublicSubpath("https://lensaplus.com/uploads/social-reels/a.mp4", "uploads/social-reels"),
    ).toBe(path.resolve(PUBLIC_DIR, "uploads", "social-reels", "a.mp4"));
  });

  it("blocks traversal, wrong subdir, sibling prefix, and non-http schemes", () => {
    expect(resolvePublicSubpath("/uploads/social/../../.env", "uploads/social")).toBeNull();
    expect(resolvePublicSubpath("/uploads/social/%2e%2e/other.jpg", "uploads/social")).toBeNull();
    expect(resolvePublicSubpath("/uploads/social-extra/a.jpg", "uploads/social")).toBeNull();
    expect(resolvePublicSubpath("/uploads/other/a.jpg", "uploads/social")).toBeNull();
    expect(resolvePublicSubpath("file:///etc/passwd")).toBeNull();
    expect(resolvePublicSubpath("..\\..\\package.json")).toBeNull();
  });
});

describe("isSafeImageRef", () => {
  it("allows empty string, http(s) URLs, and safe single-slash local paths", () => {
    expect(isSafeImageRef("")).toBe(true);
    expect(isSafeImageRef("/uploads/foo.jpg")).toBe(true);
    expect(isSafeImageRef("https://lensaplus.com/uploads/foo.jpg")).toBe(true);
    expect(isSafeImageRef("http://cdn.example.com/a.png")).toBe(true);
  });

  it("rejects javascript:, data:, file:, protocol-relative //, and traversal", () => {
    expect(isSafeImageRef("javascript:alert(1)")).toBe(false);
    expect(isSafeImageRef("data:image/png;base64,AAAA")).toBe(false);
    expect(isSafeImageRef("file:///etc/passwd")).toBe(false);
    expect(isSafeImageRef("//evil.com/x.png")).toBe(false);
    expect(isSafeImageRef("/uploads/../../.env")).toBe(false);
    expect(isSafeImageRef("/uploads/%2e%2e/.env")).toBe(false);
    expect(isSafeImageRef("/uploads/a\0b.png")).toBe(false);
  });
});
