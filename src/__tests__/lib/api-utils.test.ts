import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

import { ApiError, requireAuth } from "@/lib/api-utils";

describe("ApiError", () => {
  it("creates error with message and status code", () => {
    const error = new ApiError("Not found", 404);
    expect(error.message).toBe("Not found");
    expect(error.statusCode).toBe(404);
  });

  it("defaults to status 400", () => {
    const error = new ApiError("Bad request");
    expect(error.statusCode).toBe(400);
  });

  it("is an instance of Error", () => {
    const error = new ApiError("Test");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("requireAuth", () => {
  beforeEach(() => {
    mockGetServerSession.mockReset();
  });

  it("rejects invalidated sessions even when session.user exists", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      sessionInvalid: true,
      user: { email: "a@b.com", name: "User" },
    });
    await expect(requireAuth()).rejects.toThrow(/Unauthorized/);
  });

  it("rejects sessions missing user.id or user.role", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      sessionInvalid: false,
      user: { email: "a@b.com", name: "User" },
    });
    await expect(requireAuth()).rejects.toThrow(/Unauthorized/);
  });

  it("allows valid session with id and role", async () => {
    const valid = {
      sessionInvalid: false,
      user: { id: "u1", role: "EDITOR", email: "a@b.com", name: "User" },
    };
    mockGetServerSession.mockResolvedValueOnce(valid);
    await expect(requireAuth()).resolves.toEqual(valid);
  });
});
