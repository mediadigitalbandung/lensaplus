import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

// ── Shared hoisted mocks ─────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  logAudit: vi.fn().mockResolvedValue(undefined),
  startApproveDraft: vi.fn(),
  takedownPost: vi.fn(),
  prisma: {
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    article: {
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    liveBlog: {
      count: vi.fn(),
    },
    liveBlogEntry: {
      updateMany: vi.fn(),
    },
    membershipCard: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    notification: {
      deleteMany: vi.fn(),
    },
    tiktokAccount: {
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    tiktokContent: {
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    youtubeClipJob: {
      deleteMany: vi.fn(),
    },
    socialTemplate: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    targetKeyword: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("next-auth/jwt", () => ({
  getToken: (...a: unknown[]) => mocks.getToken(...a),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("../prisma", () => ({ prisma: mocks.prisma }));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...actual,
    requireAuth: (...a: unknown[]) => mocks.requireAuth(...a),
    requireRole: (...a: unknown[]) => mocks.requireRole(...a),
    logAudit: (...a: unknown[]) => mocks.logAudit(...a),
  };
});

vi.mock("@/lib/cloudflare-email", () => ({
  listEmailRules: vi.fn(async () => []),
  deleteEmailRule: vi.fn(async () => {}),
}));

vi.mock("@/lib/social/orchestrator", () => ({
  startApproveDraft: (...a: unknown[]) => mocks.startApproveDraft(...a),
  takedownPost: (...a: unknown[]) => mocks.takedownPost(...a),
}));

// Imports under test (AFTER mocks)
import { authOptions } from "@/lib/auth";
import { proxy } from "@/proxy";
import { ApiError } from "@/lib/api-utils";
import { POST as postScanAccounts } from "@/app/api/social/scan-accounts/route";
import { GET as getTiktokContent, PUT as putTiktokContent } from "@/app/api/tiktok/contents/[id]/route";
import { PATCH as patchTiktokAccount } from "@/app/api/tiktok/accounts/[id]/route";
import { PUT as putUserById, DELETE as deleteUserById } from "@/app/api/users/[id]/route";
import { DELETE as deleteMe } from "@/app/api/users/me/route";
import { GET as getVerifyCard } from "@/app/api/verify-card/[number]/route";
import { GET as getCardRender } from "@/app/api/users/me/card/render/route";
import { renderMembershipCard } from "@/lib/membership-card";
import { renderLayerSvg } from "@/lib/social/template-renderer";
import { POST as postSocialTemplate } from "@/app/api/social/templates/route";
import { POST as postApproveSocial } from "@/app/api/social/posts/[id]/approve/route";
import { POST as postTakedownSocial } from "@/app/api/social/posts/[id]/takedown/route";
import { GET as getTargetKeywords } from "@/app/api/target-keywords/route";

describe("[HIGH-01] Open Redirect Guard & Proxy callbackUrl", () => {
  const baseUrl = "https://lensaplus.com";
  const redirectCb = authOptions.callbacks!.redirect!;

  it("allows same-origin relative and absolute URLs", async () => {
    expect(await redirectCb({ url: "/panel/artikel?status=DRAFT", baseUrl })).toBe(
      "https://lensaplus.com/panel/artikel?status=DRAFT",
    );
    expect(await redirectCb({ url: "https://lensaplus.com/panel/dashboard", baseUrl })).toBe(
      "https://lensaplus.com/panel/dashboard",
    );
  });

  it("rejects protocol-relative, backslash, prefix-spoof, userinfo, and javascript URLs", async () => {
    const attacks = [
      "//evil.com/phish",
      "/\\evil.com/phish",
      "\\\\evil.com/phish",
      "https://lensaplus.com.evil.com/login",
      "https://lensaplus.com@evil.com/login",
      "http://lensaplus.com/panel",
      "javascript:alert(1)",
      "https://evil.com",
    ];
    for (const url of attacks) {
      expect(await redirectCb({ url, baseUrl }), `should block ${url}`).toBe(baseUrl);
    }
  });

  it("proxy preserves pathname + search in callbackUrl and enforces new role gates", async () => {
    mocks.getToken.mockResolvedValueOnce(null);
    const unauthReq = new NextRequest(
      "https://lensaplus.com/panel/artikel?status=IN_REVIEW&page=2",
    );
    const unauthRes = await proxy(unauthReq);
    expect(unauthRes.status).toBe(307);
    const loc = new URL(unauthRes.headers.get("location")!);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("callbackUrl")).toBe("/panel/artikel?status=IN_REVIEW&page=2");

    // EDITOR blocked from /panel/live-blogs/pengaturan (SUPER_ONLY)
    mocks.getToken.mockResolvedValueOnce({ role: "EDITOR" });
    const editorLiveSettings = await proxy(
      new NextRequest("https://lensaplus.com/panel/live-blogs/pengaturan"),
    );
    expect(editorLiveSettings.status).toBe(307);
    expect(new URL(editorLiveSettings.headers.get("location")!).pathname).toBe("/panel/dashboard");

    // EDITOR blocked from /panel/artikel/duplikat (MANAGEMENT)
    mocks.getToken.mockResolvedValueOnce({ role: "EDITOR" });
    const editorDup = await proxy(
      new NextRequest("https://lensaplus.com/panel/artikel/duplikat"),
    );
    expect(editorDup.status).toBe(307);
    expect(new URL(editorDup.headers.get("location")!).pathname).toBe("/panel/dashboard");

    // CHIEF_EDITOR allowed on /panel/artikel/duplikat
    mocks.getToken.mockResolvedValueOnce({ role: "CHIEF_EDITOR" });
    const chiefDup = await proxy(
      new NextRequest("https://lensaplus.com/panel/artikel/duplikat"),
    );
    expect(chiefDup.status).toBe(200);

    // CHIEF_EDITOR blocked from /panel/live-blogs/pengaturan
    mocks.getToken.mockResolvedValueOnce({ role: "CHIEF_EDITOR" });
    const chiefLiveSettings = await proxy(
      new NextRequest("https://lensaplus.com/panel/live-blogs/pengaturan"),
    );
    expect(chiefLiveSettings.status).toBe(307);

    // SUPER_ADMIN allowed on /panel/live-blogs/pengaturan
    mocks.getToken.mockResolvedValueOnce({ role: "SUPER_ADMIN" });
    const superLiveSettings = await proxy(
      new NextRequest("https://lensaplus.com/panel/live-blogs/pengaturan"),
    );
    expect(superLiveSettings.status).toBe(200);
  });
});

describe("[HIGH-02] OAuth Token Projection, Scan-Accounts & Crypto Key Guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("TikTok content GET/PUT and account PATCH select explicit fields without accessToken/refreshToken", async () => {
    mocks.requireAuth.mockResolvedValue({
      user: { id: "ed-1", role: "EDITOR", name: "Editor" },
    });
    mocks.prisma.tiktokContent.findUnique.mockResolvedValueOnce({
      id: "tc-1",
      createdById: "ed-1",
      title: "Video",
      account: { id: "ta-1", username: "lensaplus" },
    });

    const getRes = await getTiktokContent(
      new NextRequest("http://localhost/api/tiktok/contents/tc-1"),
      { params: Promise.resolve({ id: "tc-1" }) },
    );
    expect(getRes.status).toBe(200);
    const getCall = mocks.prisma.tiktokContent.findUnique.mock.calls[0][0];
    expect(getCall.include.account).toHaveProperty("select");
    expect(getCall.include.account.select).not.toHaveProperty("accessToken");
    expect(getCall.include.account.select).not.toHaveProperty("refreshToken");

    mocks.prisma.tiktokContent.findUnique.mockResolvedValueOnce({
      id: "tc-1",
      createdById: "ed-1",
      title: "Video",
    });
    mocks.prisma.tiktokContent.update.mockResolvedValueOnce({
      id: "tc-1",
      title: "Video Updated",
      account: { id: "ta-1", username: "lensaplus" },
    });
    const putRes = await putTiktokContent(
      new NextRequest("http://localhost/api/tiktok/contents/tc-1", {
        method: "PUT",
        body: JSON.stringify({ title: "Video Updated" }),
      }),
      { params: Promise.resolve({ id: "tc-1" }) },
    );
    expect(putRes.status).toBe(200);
    const putCall = mocks.prisma.tiktokContent.update.mock.calls[0][0];
    expect(putCall.include.account).toHaveProperty("select");
    expect(putCall.include.account.select).not.toHaveProperty("accessToken");
    expect(putCall.include.account.select).not.toHaveProperty("refreshToken");

    mocks.prisma.tiktokAccount.findUnique.mockResolvedValueOnce({
      id: "ta-1",
      ownerId: "ed-1",
      displayName: "Old",
      avatarUrl: null,
    });
    mocks.prisma.tiktokAccount.update.mockResolvedValueOnce({
      id: "ta-1",
      username: "lensaplus",
      displayName: "New",
    });
    const patchRes = await patchTiktokAccount(
      new NextRequest("http://localhost/api/tiktok/accounts/ta-1", {
        method: "PATCH",
        body: JSON.stringify({ displayName: "New" }),
      }),
      { params: Promise.resolve({ id: "ta-1" }) },
    );
    expect(patchRes.status).toBe(200);
    const patchCall = mocks.prisma.tiktokAccount.update.mock.calls[0][0];
    expect(patchCall.select).toBeDefined();
    expect(patchCall.select).not.toHaveProperty("accessToken");
    expect(patchCall.select).not.toHaveProperty("refreshToken");
  });

  it("POST /api/social/scan-accounts rejects empty/masked tokens with 400 instead of decrypting DB token", async () => {
    mocks.requireRole.mockResolvedValue({
      user: { id: "sa-1", role: "SUPER_ADMIN" },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    for (const token of ["", "   ", "(tidak berubah)", "EAAB...1234", "••••••••1234", "****"]) {
      const req = new NextRequest("http://localhost/api/social/scan-accounts", {
        method: "POST",
        body: JSON.stringify({ accessToken: token }),
      });
      const res = await postScanAccounts(req);
      expect(res.status, `token "${token}" should return 400`).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("crypto-secrets accepts 64-char hex key fallback and encrypts/decrypts round-trip", async () => {
    const prevKey = process.env.SETTINGS_ENCRYPTION_KEY;
    try {
      process.env.SETTINGS_ENCRYPTION_KEY = "a".repeat(64);
      const { encryptSecret, decryptSecret } = await import("@/lib/crypto-secrets");
      const enc = encryptSecret("secret-payload");
      expect(enc.startsWith("v1:")).toBe(true);
      expect(decryptSecret(enc)).toBe("secret-payload");
    } finally {
      if (prevKey === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY;
      else process.env.SETTINGS_ENCRYPTION_KEY = prevKey;
    }
  });
});

describe("[HIGH-07] User Management & KTA Integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (cb: (tx: typeof mocks.prisma) => Promise<unknown>) =>
      cb(mocks.prisma),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("DELETE /api/users/[id] returns 409 when user owns articles/liveBlogs and cleans up non-FK rows when deletable", async () => {
    mocks.requireRole.mockResolvedValue({ user: { id: "sa-1", role: "SUPER_ADMIN" } });
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "u-2",
      name: "Budi",
      email: "budi@lensaplus.com",
      role: "JOURNALIST",
      isActive: true,
    });
    mocks.prisma.article.count.mockResolvedValueOnce(3);
    mocks.prisma.liveBlog.count.mockResolvedValueOnce(0);

    const blockedRes = await deleteUserById(
      new NextRequest("http://localhost/api/users/u-2", { method: "DELETE" }),
      { params: Promise.resolve({ id: "u-2" }) },
    );
    expect(blockedRes.status).toBe(409);
    expect(mocks.prisma.user.delete).not.toHaveBeenCalled();

    // Deletable user: cleans up non-FK rows + revokes card + deletes user
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "u-3",
      name: "Siti",
      email: "siti@lensaplus.com",
      role: "CONTRIBUTOR",
      isActive: true,
    });
    mocks.prisma.article.count.mockResolvedValueOnce(0);
    mocks.prisma.liveBlog.count.mockResolvedValueOnce(0);
    mocks.prisma.user.delete.mockResolvedValueOnce({ id: "u-3" });

    const okRes = await deleteUserById(
      new NextRequest("http://localhost/api/users/u-3", { method: "DELETE" }),
      { params: Promise.resolve({ id: "u-3" }) },
    );
    expect(okRes.status).toBe(204);
    expect(mocks.prisma.tiktokAccount.deleteMany).toHaveBeenCalledWith({ where: { ownerId: "u-3" } });
    expect(mocks.prisma.tiktokContent.deleteMany).toHaveBeenCalledWith({ where: { createdById: "u-3" } });
    expect(mocks.prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: "u-3" } });
    expect(mocks.prisma.membershipCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u-3" },
        data: expect.objectContaining({ status: "REVOKED" }),
      }),
    );
  });

  it("PUT /api/users/[id] revokes MembershipCard when deactivating a user", async () => {
    mocks.requireRole.mockResolvedValue({ user: { id: "sa-1", role: "SUPER_ADMIN" } });
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "u-2",
      name: "Budi",
      email: "budi@lensaplus.com",
      role: "JOURNALIST",
      isActive: true,
    });
    mocks.prisma.user.update.mockResolvedValueOnce({
      id: "u-2",
      name: "Budi",
      email: "budi@lensaplus.com",
      role: "JOURNALIST",
      specialization: null,
      isActive: false,
    });

    const res = await putUserById(
      new NextRequest("http://localhost/api/users/u-2", {
        method: "PUT",
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ id: "u-2" }) },
    );
    expect(res.status).toBe(200);
    expect(mocks.prisma.membershipCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u-2", status: { not: "REVOKED" } },
        data: expect.objectContaining({ status: "REVOKED" }),
      }),
    );
  });

  it("DELETE /api/users/me blocks last active SUPER_ADMIN (409) and revokes + anonymizes KTA on self-delete", async () => {
    mocks.requireAuth.mockResolvedValue({ user: { id: "sa-1", role: "SUPER_ADMIN" } });
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "sa-1",
      role: "SUPER_ADMIN",
      isActive: true,
    });
    mocks.prisma.user.count.mockResolvedValueOnce(1);

    const blockedRes = await deleteMe(new NextRequest("http://localhost/api/users/me", { method: "DELETE" }));
    expect(blockedRes.status).toBe(409);
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();

    // Non-last user self-delete
    mocks.requireAuth.mockResolvedValue({ user: { id: "u-5", role: "JOURNALIST" } });
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: "u-5",
      role: "JOURNALIST",
      isActive: true,
    });
    const okRes = await deleteMe(new NextRequest("http://localhost/api/users/me", { method: "DELETE" }));
    expect(okRes.status).toBe(200);
    expect(mocks.prisma.membershipCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u-5" },
        data: expect.objectContaining({
          status: "REVOKED",
          holderName: null,
          holderPhoto: null,
        }),
      }),
    );
  });

  it("GET /api/verify-card/[number] catches malformed URIError (400) and invalidates cards of inactive users", async () => {
    const badRes = await getVerifyCard(
      new NextRequest("http://localhost/api/verify-card/%ZZ", { headers: { "x-real-ip": "198.51.100.11" } }),
      { params: Promise.resolve({ number: "%ZZ" }) },
    );
    expect(badRes.status).toBe(400);

    mocks.prisma.membershipCard.findUnique.mockResolvedValueOnce({
      number: "LP-2026-0001",
      status: "ACTIVE",
      issuedAt: new Date("2026-01-01"),
      expiresAt: new Date("2031-01-01"),
      holderName: "Nama Lama",
      user: { name: "[Dihapus]", role: "JOURNALIST", isActive: false },
    });
    const inactiveRes = await getVerifyCard(
      new NextRequest("http://localhost/api/verify-card/LP-2026-0001", {
        headers: { "x-real-ip": "198.51.100.12" },
      }),
      { params: Promise.resolve({ number: "LP-2026-0001" }) },
    );
    expect(inactiveRes.status).toBe(200);
    const json = await inactiveRes.json();
    expect(json.data.valid).toBe(false);
    expect(json.data.status).toBe("REVOKED");
    expect(json.data.name).toBe("[Dihapus]");
  });

  it("GET /api/users/me/card/render denies non-ACTIVE or inactive-user cards with HTTP 403", async () => {
    mocks.requireAuth.mockResolvedValue({ user: { id: "u-1", role: "JOURNALIST" } });

    for (const card of [
      { status: "DRAFT", expiresAt: null, user: { isActive: true } },
      { status: "REVOKED", expiresAt: null, user: { isActive: true } },
      { status: "ACTIVE", expiresAt: new Date("2020-01-01"), user: { isActive: true } },
      { status: "ACTIVE", expiresAt: new Date("2035-01-01"), user: { isActive: false } },
    ]) {
      mocks.prisma.membershipCard.findUnique.mockResolvedValueOnce(card);
      const res = await getCardRender(new NextRequest("http://localhost/api/users/me/card/render?pdf=1"));
      expect(res.status).toBe(403);
    }
  });

  it("membership-card loadImage blocks origin-prefix SSRF bypass and passes redirect: error", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await renderMembershipCard({
      number: "LP-2026-0009",
      holderName: "Test Jurnalis",
      role: "Jurnalis",
      status: "ACTIVE",
      issuedAt: new Date("2026-01-01"),
      expiresAt: new Date("2031-01-01"),
      photoUrl: "https://lensaplus.com.evil.com/ssrf.png",
      directorName: "Dir",
      directorSignature: "https://lensaplus.com@127.0.0.1/sig.png",
      pwiChairmanName: "Ketua",
      pwiChairmanSignature: null,
      cardLogo: null,
      verifyUrl: "https://lensaplus.com/verifikasi/LP-2026-0009",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("[HIGH-09] SVG Escaping, Canvas Zod Caps, Role Alignment & /panel Redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderLayerSvg XML-escapes font-weight, color, font-family, and text", () => {
    const svg = renderLayerSvg(
      {
        text: "Judul",
        x: 10,
        y: 20,
        width: 500,
        height: 100,
        fontSize: 40,
        weight: '700" onload="alert(1)',
        color: '#fff"><script>',
        fontFamily: 'Arial" onclick="x',
      },
      "Berita <Penting> & \"Resmi\"",
    );

    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('" onload="');
    expect(svg).toContain('font-weight="700&quot; onload=&quot;alert(1)"');
    expect(svg).toContain('fill="#fff&quot;&gt;&lt;script&gt;"');
    expect(svg).toContain("Berita &lt;Penting&gt; &amp; &quot;Resmi&quot;");
  });

  it("POST /api/social/templates enforces SUPER_ADMIN and rejects canvas/layer dims > 4096", async () => {
    mocks.requireRole.mockResolvedValue({ user: { id: "sa-1", role: "SUPER_ADMIN" } });

    const oversizedReq = new NextRequest("http://localhost/api/social/templates", {
      method: "POST",
      body: JSON.stringify({
        name: "DoS Template",
        platform: "INSTAGRAM",
        backgroundUrl: "/uploads/bg.png",
        textLayers: [
          { text: "{{canvas_metadata}}", x: 50000, y: 50000, width: 0, height: 0, fontSize: 0 },
        ],
      }),
    });
    const oversizedRes = await postSocialTemplate(oversizedReq);
    expect(oversizedRes.status).toBe(400);
    expect(mocks.requireRole).toHaveBeenCalledWith(["SUPER_ADMIN"]);

    // Valid UI payload with {{canvas_metadata}} + {{photo}} + text layer succeeds
    mocks.prisma.socialTemplate.create.mockResolvedValueOnce({
      id: "tpl-1",
      name: "Valid Template",
      platform: "INSTAGRAM",
    });
    const validReq = new NextRequest("http://localhost/api/social/templates", {
      method: "POST",
      body: JSON.stringify({
        name: "Valid Template",
        platform: "INSTAGRAM",
        backgroundUrl: "/uploads/bg.png",
        textLayers: [
          { text: "{{canvas_metadata}}", x: 1080, y: 1350, width: 0, height: 0, fontSize: 0 },
          { text: "{{photo}}", x: 0, y: 0, width: 1080, height: 680, fontSize: 0 },
          { text: "{{title}}", x: 60, y: 800, width: 960, height: 200, fontSize: 64, weight: "Bold" },
        ],
      }),
    });
    const validRes = await postSocialTemplate(validReq);
    expect(validRes.status).toBe(201);
  });

  it("social approve/takedown and target-keywords require SUPER_ADMIN matching proxy.ts", async () => {
    mocks.requireRole.mockRejectedValue(new ApiError("Forbidden", 403));

    const approveRes = await postApproveSocial(
      new NextRequest("http://localhost/api/social/posts/p1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "p1" }) },
    );
    expect(approveRes.status).toBe(403);
    expect(mocks.requireRole).toHaveBeenLastCalledWith(["SUPER_ADMIN"]);

    const takedownRes = await postTakedownSocial(
      new NextRequest("http://localhost/api/social/posts/p1/takedown", { method: "POST" }),
      { params: Promise.resolve({ id: "p1" }) },
    );
    expect(takedownRes.status).toBe(403);
    expect(mocks.requireRole).toHaveBeenLastCalledWith(["SUPER_ADMIN"]);

    const kwRes = await getTargetKeywords(new NextRequest("http://localhost/api/target-keywords"));
    expect(kwRes.status).toBe(403);
    expect(mocks.requireRole).toHaveBeenLastCalledWith(["SUPER_ADMIN"]);

    // Verify /panel/page.tsx exists as a server component redirecting to /panel/dashboard
    const panelPage = fs.readFileSync(path.join(process.cwd(), "src/app/panel/page.tsx"), "utf8");
    expect(panelPage).not.toMatch(/^["']use client["']/);
    expect(panelPage).toContain('redirect("/panel/dashboard")');
  });
});
