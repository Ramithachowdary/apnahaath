import { afterEach, describe, expect, it } from "vitest";
import { clientIp, rateLimit, resetRateLimits } from "../src/lib/ratelimit";

afterEach(() => {
  resetRateLimits();
});

describe("clientIp", () => {
  it("uses the first x-forwarded-for hop", () => {
    const req = new Request("http://localhost", { headers: { "x-forwarded-for": " 1.1.1.1, 8.8.8.8 " } });
    expect(clientIp(req)).toBe("1.1.1.1");
  });

  it("falls back to x-real-ip and then unknown", () => {
    const real = new Request("http://localhost", { headers: { "x-real-ip": "9.9.9.9" } });
    expect(clientIp(real)).toBe("9.9.9.9");
    expect(clientIp(new Request("http://localhost"))).toBe("unknown");
  });
});

describe("rateLimit", () => {
  it("allows exactly max hits inside the window and blocks the next", () => {
    const now = 1_000_000;
    expect(rateLimit("k", 3, 1000, now)).toBe(true);
    expect(rateLimit("k", 3, 1000, now + 10)).toBe(true);
    expect(rateLimit("k", 3, 1000, now + 20)).toBe(true);
    expect(rateLimit("k", 3, 1000, now + 30)).toBe(false);
  });

  it("keeps keys independent", () => {
    const now = 1_000_000;
    expect(rateLimit("a", 1, 1000, now)).toBe(true);
    expect(rateLimit("a", 1, 1000, now)).toBe(false);
    expect(rateLimit("b", 1, 1000, now)).toBe(true);
  });

  it("slides the window so old hits expire", () => {
    const now = 1_000_000;
    expect(rateLimit("k", 1, 1000, now)).toBe(true);
    expect(rateLimit("k", 1, 1000, now + 999)).toBe(false);
    expect(rateLimit("k", 1, 1000, now + 1000)).toBe(true);
  });

  it("resetRateLimits clears every bucket", () => {
    expect(rateLimit("k", 1, 10_000, 1)).toBe(true);
    expect(rateLimit("k", 1, 10_000, 2)).toBe(false);
    resetRateLimits();
    expect(rateLimit("k", 1, 10_000, 3)).toBe(true);
  });
});
