// Fixed-window rate limiter keyed by client IP. Per edge isolate, in memory.

export class RateLimiter {
  private hits = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private limit: number,
    private windowMs: number,
    private now: () => number = Date.now,
  ) {}

  /** Returns 0 when allowed, or the number of seconds until the client may retry. */
  check(key: string): number {
    const t = this.now();
    const entry = this.hits.get(key);
    if (!entry || t - entry.windowStart >= this.windowMs) {
      if (this.hits.size > 10_000) this.prune(t);
      this.hits.set(key, { count: 1, windowStart: t });
      return 0;
    }
    entry.count += 1;
    if (entry.count <= this.limit) return 0;
    return Math.max(1, Math.ceil((entry.windowStart + this.windowMs - t) / 1000));
  }

  private prune(t: number) {
    for (const [k, v] of this.hits) if (t - v.windowStart >= this.windowMs) this.hits.delete(k);
  }
}
