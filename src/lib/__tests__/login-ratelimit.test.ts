import { describe, it, expect } from "vitest";
import { isLoginBlocked, registerLoginFailure } from "../rate-limit";

// Brute-force login guard: blocks an IP after 8 FAILED attempts within the
// window, but never counts successful logins (so legit users aren't locked out).
describe("login brute-force guard", () => {
  it("does not block before the threshold and blocks after 8 failures", () => {
    const ip = "10.0.0.1"; // unique per test to avoid shared in-memory bleed
    for (let i = 0; i < 8; i++) {
      expect(isLoginBlocked(ip)).toBe(false);
      registerLoginFailure(ip);
    }
    expect(isLoginBlocked(ip)).toBe(true);
  });

  it("tracks each IP independently", () => {
    const a = "10.0.0.2";
    const b = "10.0.0.3";
    for (let i = 0; i < 8; i++) registerLoginFailure(a);
    expect(isLoginBlocked(a)).toBe(true);
    expect(isLoginBlocked(b)).toBe(false); // a different IP is unaffected
  });

  it("treats an unseen IP as not blocked", () => {
    expect(isLoginBlocked("10.0.0.99")).toBe(false);
  });
});
