import { afterEach, describe, expect, it } from "vitest";
import { clientIp, rateLimit, resetRateLimits } from "../src/lib/ratelimit";

afterEach(() => {
  resetRateLimits();
});

describe("clientIp", () => {
  it("uses the first x-forwarded-for hop", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": " 1.1.1.1, 2.2.2.2", "x-real-ip": "9.9.9.9" },
    });
    expect(clientIp(req)).toBe("1.1.1.1");
  });

  it("falls back to x-real-ip when x-forwarded-for is missing", () => {
    const req = new Request("http://x", { headers: { "x-real-ip": "8.8.8.8" } });
    expect(clientIp(req)).toBe("8.8.8.8");
  });

  it("returns unknown when no IP headers are present", () => {
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});

describe("rateLimit", () => {
  it("allows up to max hits in the window and then blocks", () => {
    const now = 1_000_000;
    expect(rateLimit("k", 3, 1000, now)).toBe(true);
    expect(rateLimit("k", 3, 1000, now + 10)).toBe(true);
    expect(rateLimit("k", 3, 1000, now + 20)).toBe(true);
    expect(rateLimit("k", 3, 1000, now + 30)).toBe(false);
    expect(rateLimit("k", 3, 1000, now + 30)).toBe(false);
  });

  it("expires old hits once the window has passed", () => {
    const now = 2_000_000;
    expect(rateLimit("w", 1, 1000, now)).toBe(true);
    expect(rateLimit("w", 1, 1000, now + 999)).toBe(false);
    expect(rateLimit("w", 1, 1000, now + 1000)).toBe(true);
  });

  it("keeps keys independent", () => {
    expect(rateLimit("a", 1, 60_000, 1)).toBe(true);
    expect(rateLimit("a", 1, 60_000, 2)).toBe(false);
    expect(rateLimit("b", 1, 60_000, 2)).toBe(true);
  });

  it("evicts idle keys when the map grows past 5000 entries", () => {
    const now = 3_000_000;
    for (let i = 0; i < 5000; i++) rateLimit(`old:${i}`, 1, 100, now);
    // All of those hits are stale at now+200. The next insert trips eviction.
    expect(rateLimit("fresh", 1, 100, now + 200)).toBe(true);
    // A stale key should have been evicted and so is allowed again.
    expect(rateLimit("old:0", 1, 100, now + 200)).toBe(true);
  });

  it("resetRateLimits clears every bucket", () => {
    expect(rateLimit("z", 1, 60_000, 1)).toBe(true);
    expect(rateLimit("z", 1, 60_000, 2)).toBe(false);
    resetRateLimits();
    expect(rateLimit("z", 1, 60_000, 3)).toBe(true);
  });
});
