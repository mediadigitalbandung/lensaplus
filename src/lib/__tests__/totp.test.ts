import { describe, it, expect } from "vitest";
import {
  generateTotpSecret,
  totpNow,
  verifyTotp,
  generateBackupCodes,
  hashBackupCodes,
  consumeBackupCode,
} from "../totp";

describe("TOTP", () => {
  it("verifies a freshly generated code", () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000; // fixed instant
    const code = totpNow(secret, now);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotp(secret, code, 1, now)).toBe(true);
  });

  it("rejects a wrong code", () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const wrong = totpNow(secret, now) === "000000" ? "111111" : "000000";
    expect(verifyTotp(secret, wrong, 1, now)).toBe(false);
  });

  it("accepts a code from the adjacent time step (drift window)", () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const prevStep = totpNow(secret, now - 30_000); // one period earlier
    expect(verifyTotp(secret, prevStep, 1, now)).toBe(true);
  });

  it("rejects a code two steps away (outside window)", () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const farStep = totpNow(secret, now - 90_000); // 3 periods earlier
    expect(verifyTotp(secret, farStep, 1, now)).toBe(false);
  });
});

describe("backup codes", () => {
  it("generates 10 codes and consumes one (single-use)", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
    const stored = hashBackupCodes(codes);

    const after = consumeBackupCode(stored, codes[0]);
    expect(after).not.toBeNull();
    // the consumed code no longer works against the reduced list
    expect(consumeBackupCode(after, codes[0])).toBeNull();
    // a different code still works
    expect(consumeBackupCode(after, codes[1])).not.toBeNull();
  });

  it("rejects an unknown backup code", () => {
    const stored = hashBackupCodes(generateBackupCodes());
    expect(consumeBackupCode(stored, "zzzz-zzzz")).toBeNull();
  });
});
