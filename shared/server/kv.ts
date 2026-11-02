// Tiny key-value interface so server features can use Netlify Blobs in production
// and an in-memory map in tests/local dev.

export interface KV {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

export class MemoryKV implements KV {
  private map = new Map<string, string>();
  async get<T>(key: string) {
    const v = this.map.get(key);
    return v === undefined ? undefined : (JSON.parse(v) as T);
  }
  async set(key: string, value: unknown) {
    this.map.set(key, JSON.stringify(value));
  }
  async delete(key: string) {
    this.map.delete(key);
  }
  async list(prefix = "") {
    return [...this.map.keys()].filter((k) => k.startsWith(prefix));
  }
}
