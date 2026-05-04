/**
 * Tests for single-device login enforcement in the JWT callback.
 *
 * Strategy:
 * - We mock `src/lib/prisma` so no real DB is touched.
 * - We exercise the jwt() callback directly via authOptions.callbacks.jwt.
 * - The SESSION_REVALIDATE_INTERVAL_MS constant (10 min) is controlled by
 *   setting token.lastValidatedAt to a past timestamp in each test.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Prisma mock ──────────────────────────────────────────────────────────────
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn().mockResolvedValue({});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock("../prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

// ── Module under test — imported AFTER mocks ─────────────────────────────────
import { authOptions, isSingleDeviceEnabled } from "../auth";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEN_MIN_MS = 10 * 60 * 1000;

/** Build a minimal JWT token (no user object = subsequent request). */
function makeToken(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    role: "JOURNALIST",
    name: "Test User",
    avatar: null,
    sessionId: "session-abc",
    lastValidatedAt: Date.now() - TEN_MIN_MS - 1000, // force revalidation by default
    sessionInvalid: false,
    ...overrides,
  };
}

/** DB user returned by mocked prisma.user.findUnique. */
function makeDbUser(overrides: Partial<{
  role: string;
  name: string;
  avatar: string | null;
  isActive: boolean;
  activeSessionId: string | null;
}> = {}) {
  return {
    role: "JOURNALIST",
    name: "Test User",
    avatar: null,
    isActive: true,
    activeSessionId: "session-abc",
    ...overrides,
  };
}

/** Call the jwt callback as if this is a subsequent request (no user object). */
async function callJwtSubsequent(token: Record<string, unknown>) {
  // @ts-expect-error — partial params; NextAuth doesn't enforce at runtime
  return authOptions.callbacks!.jwt!({ token, user: undefined, trigger: undefined });
}

/** Call the jwt callback as if this is an initial sign-in (user object present). */
async function callJwtSignIn(user: Record<string, unknown>, token: Record<string, unknown> = {}) {
  // @ts-expect-error — partial params
  return authOptions.callbacks!.jwt!({ token, user, trigger: "signIn" });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("isSingleDeviceEnabled()", () => {
  const original = process.env.SINGLE_DEVICE_ENFORCEMENT;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.SINGLE_DEVICE_ENFORCEMENT;
    } else {
      process.env.SINGLE_DEVICE_ENFORCEMENT = original;
    }
  });

  it("is enabled by default (env not set)", () => {
    delete process.env.SINGLE_DEVICE_ENFORCEMENT;
    expect(isSingleDeviceEnabled()).toBe(true);
  });

  it('is enabled when set to "true"', () => {
    process.env.SINGLE_DEVICE_ENFORCEMENT = "true";
    expect(isSingleDeviceEnabled()).toBe(true);
  });

  it('is disabled when set to "false"', () => {
    process.env.SINGLE_DEVICE_ENFORCEMENT = "false";
    expect(isSingleDeviceEnabled()).toBe(false);
  });
});

describe("JWT callback — initial sign-in", () => {
  it("populates token fields from user object and sets lastValidatedAt", async () => {
    const user = {
      id: "user-1",
      role: "EDITOR",
      name: "Editor One",
      avatar: "/avatar.png",
      sessionId: "session-new",
    };

    const result = await callJwtSignIn(user);

    expect(result.id).toBe("user-1");
    expect(result.role).toBe("EDITOR");
    expect(result.sessionId).toBe("session-new");
    expect(result.sessionInvalid).toBe(false);
    expect(typeof result.lastValidatedAt).toBe("number");
    // Should NOT hit DB on initial sign-in
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});

describe("JWT callback — cache window (within 10 min)", () => {
  it("skips DB query and returns token unchanged if within cache window", async () => {
    const token = makeToken({ lastValidatedAt: Date.now() - 5000 }); // 5 sec ago

    const result = await callJwtSubsequent(token);

    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(result.sessionInvalid).toBe(false);
    expect(result.role).toBe("JOURNALIST");
  });
});

describe("JWT callback — past cache window (re-validation from DB)", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
  });

  it("marks sessionInvalid when sessionId mismatches DB activeSessionId", async () => {
    mockFindUnique.mockResolvedValueOnce(
      makeDbUser({ activeSessionId: "session-OTHER" }) // different device logged in
    );

    const token = makeToken({ sessionId: "session-abc" });
    const result = await callJwtSubsequent(token);

    expect(mockFindUnique).toHaveBeenCalledOnce();
    expect(result.sessionInvalid).toBe(true);
  });

  it("allows valid session through when sessionIds match", async () => {
    mockFindUnique.mockResolvedValueOnce(
      makeDbUser({ activeSessionId: "session-abc", role: "SENIOR_JOURNALIST" })
    );

    const token = makeToken({ sessionId: "session-abc" });
    const result = await callJwtSubsequent(token);

    expect(result.sessionInvalid).toBe(false);
    expect(result.role).toBe("SENIOR_JOURNALIST"); // role refresh works
  });

  it("marks sessionInvalid when user is deactivated", async () => {
    mockFindUnique.mockResolvedValueOnce(makeDbUser({ isActive: false }));

    const token = makeToken();
    const result = await callJwtSubsequent(token);

    expect(result.sessionInvalid).toBe(true);
  });

  it("marks sessionInvalid when user record is not found", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const token = makeToken();
    const result = await callJwtSubsequent(token);

    expect(result.sessionInvalid).toBe(true);
  });

  it("refreshes lastValidatedAt after successful validation", async () => {
    const oldTs = Date.now() - TEN_MIN_MS - 1000;
    mockFindUnique.mockResolvedValueOnce(makeDbUser());

    const token = makeToken({ lastValidatedAt: oldTs });
    const result = await callJwtSubsequent(token);

    expect(result.lastValidatedAt).toBeGreaterThan(oldTs);
  });

  it("fails open (does not mark invalid) when DB throws", async () => {
    mockFindUnique.mockRejectedValueOnce(new Error("DB connection refused"));

    const token = makeToken();
    const result = await callJwtSubsequent(token);

    expect(result.sessionInvalid).toBe(false); // fail open
  });
});

describe("JWT callback — backward compat (token without sessionId)", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
  });

  it("skips session mismatch check when token has no sessionId (pre-feature sessions)", async () => {
    // DB has an activeSessionId but token is old and lacks sessionId field
    mockFindUnique.mockResolvedValueOnce(
      makeDbUser({ activeSessionId: "session-XYZ" })
    );

    const token = makeToken({ sessionId: undefined });
    const result = await callJwtSubsequent(token);

    expect(result.sessionInvalid).toBe(false); // no sessionId to compare — pass through
  });
});

describe("JWT callback — SINGLE_DEVICE_ENFORCEMENT=false", () => {
  const original = process.env.SINGLE_DEVICE_ENFORCEMENT;

  beforeEach(() => {
    process.env.SINGLE_DEVICE_ENFORCEMENT = "false";
    mockFindUnique.mockReset();
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.SINGLE_DEVICE_ENFORCEMENT;
    } else {
      process.env.SINGLE_DEVICE_ENFORCEMENT = original;
    }
  });

  it("allows session through even when sessionId mismatches DB", async () => {
    mockFindUnique.mockResolvedValueOnce(
      makeDbUser({ activeSessionId: "session-OTHER" })
    );

    const token = makeToken({ sessionId: "session-abc" });
    const result = await callJwtSubsequent(token);

    expect(result.sessionInvalid).toBe(false);
  });
});

describe("JWT callback — already-invalid token", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
  });

  it("skips DB query for tokens already marked sessionInvalid", async () => {
    const token = makeToken({
      sessionInvalid: true,
      lastValidatedAt: Date.now() - TEN_MIN_MS - 1000, // would normally trigger revalidation
    });

    const result = await callJwtSubsequent(token);

    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(result.sessionInvalid).toBe(true);
  });
});
