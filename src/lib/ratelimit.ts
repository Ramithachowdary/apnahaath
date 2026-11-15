/**
 * Small in-memory sliding-window rate limiter keyed by client IP (per serverless instance).
 * Good enough to stop one client hammering a route without ever locking out everyone else.
 */
const buckets = new Map<string, number[]>();

/** Best-effort client IP from proxy headers, used only as a rate-limit key. */
export function clientIp(req: Request): string {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || h.get("x-real-ip") || "unknown";
}

/** Returns true if the call is allowed; records it. */
export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return true;
}

/** Clear in-memory rate-limit counters (tests). */
export function resetRateLimits() {
  buckets.clear();
}
