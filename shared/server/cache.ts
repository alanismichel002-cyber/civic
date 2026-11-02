// Small in-memory TTL cache. On Netlify each edge isolate has its own copy,
// which is enough to absorb bursts of identical lookups and stay within quota.

export class TtlCache<V> {
  private store = new Map<string, { value: V; expires: number }>();

  constructor(
    private ttlMs: number,
    private maxEntries = 500,
    private now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V): void {
    if (this.store.size >= this.maxEntries) {
      // Evict expired entries first, then the oldest insertion.
      const t = this.now();
      for (const [k, v] of this.store) if (v.expires <= t) this.store.delete(k);
      if (this.store.size >= this.maxEntries) {
        const oldest = this.store.keys().next().value;
        if (oldest !== undefined) this.store.delete(oldest);
      }
    }
    this.store.set(key, { value, expires: this.now() + this.ttlMs });
  }

  get size(): number {
    return this.store.size;
  }
}

/**
 * SHA-256 hex digest. Cache keys are hashed so raw addresses are never kept as
 * map keys (they could otherwise show up in heap snapshots or debug output).
 */
export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
