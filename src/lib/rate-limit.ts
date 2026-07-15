/**
 * Tiny in-memory sliding-window rate limiter. Per-process (resets on redeploy,
 * not shared across instances) — enough to curb accidental spam and runaway AI
 * cost on the kids endpoints without adding a Redis dependency. Identity is the
 * caller's server-derived learner id, so it can't be spoofed.
 */
const buckets = new Map<string, number[]>();

/** Returns true if the action is allowed, false if the key is over its limit. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}
