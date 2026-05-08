import { describe, it, expect } from "vitest";

import {
  PLATFORM_DIMENSIONS,
  CAPTION_MAX_LENGTH,
} from "../social/types";

describe("PLATFORM_DIMENSIONS", () => {
  it("Instagram is 4:5 portrait at 1080x1350", () => {
    expect(PLATFORM_DIMENSIONS.INSTAGRAM).toEqual({
      width: 1080,
      height: 1350,
    });
    // Aspect 4:5 → height/width = 1.25
    expect(
      PLATFORM_DIMENSIONS.INSTAGRAM.height / PLATFORM_DIMENSIONS.INSTAGRAM.width,
    ).toBeCloseTo(1.25, 2);
  });

  it("Facebook is ~1.91:1 link-card landscape at 1200x630", () => {
    expect(PLATFORM_DIMENSIONS.FACEBOOK).toEqual({ width: 1200, height: 630 });
    expect(
      PLATFORM_DIMENSIONS.FACEBOOK.width / PLATFORM_DIMENSIONS.FACEBOOK.height,
    ).toBeCloseTo(1.905, 2);
  });

  it("Twitter is 16:9 at 1200x675", () => {
    expect(PLATFORM_DIMENSIONS.TWITTER).toEqual({ width: 1200, height: 675 });
    expect(
      PLATFORM_DIMENSIONS.TWITTER.width / PLATFORM_DIMENSIONS.TWITTER.height,
    ).toBeCloseTo(16 / 9, 2);
  });
});

describe("CAPTION_MAX_LENGTH", () => {
  it("matches platform-published limits (IG 2200, FB 63206, Twitter 280)", () => {
    expect(CAPTION_MAX_LENGTH.INSTAGRAM).toBe(2200);
    expect(CAPTION_MAX_LENGTH.FACEBOOK).toBe(63_206);
    expect(CAPTION_MAX_LENGTH.TWITTER).toBe(280);
  });

  it("Twitter is the strictest cap by an order of magnitude", () => {
    expect(CAPTION_MAX_LENGTH.TWITTER).toBeLessThan(CAPTION_MAX_LENGTH.INSTAGRAM);
    expect(CAPTION_MAX_LENGTH.INSTAGRAM).toBeLessThan(CAPTION_MAX_LENGTH.FACEBOOK);
  });
});
