// Netlify Blobs implementation of the KV interface (used by Netlify Functions).
import { getStore } from "@netlify/blobs";
import type { KV } from "../../shared/server/kv.ts";

export function blobsKV(name: string): KV {
  const store = getStore({ name, consistency: "strong" });
  return {
    async get<T>(key: string) {
      const v = await store.get(key, { type: "json" });
      return (v ?? undefined) as T | undefined;
    },
    async set(key, value) {
      await store.setJSON(key, value);
    },
    async delete(key) {
      await store.delete(key);
    },
    async list(prefix = "") {
      const { blobs } = await store.list({ prefix });
      return blobs.map((b) => b.key);
    },
  };
}

export const env = (name: string): string | undefined => {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
};

/** Public site URL: SITE_URL if set, else Netlify's built-in URL for the production deploy. */
export const siteUrl = () => (env("SITE_URL") ?? env("URL") ?? "http://localhost:8888").replace(/\/+$/, "");
