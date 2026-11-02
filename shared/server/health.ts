// /api/health: lightweight check for uptime monitoring. Calls Google's /elections (cheap, cached)
// to confirm the API key works. Never exposes the key or error details.
import { CIVIC_BASE, json } from "./handlers.ts";

let last: { at: number; body: Record<string, unknown>; status: number } | undefined;

export async function handleHealth(_req: Request, env: { apiKey: string | undefined; fetch?: typeof fetch }) {
  if (last && Date.now() - last.at < 60_000) return json(last.body, last.status);
  const checks: Record<string, string> = { apiKey: env.apiKey ? "present" : "missing", civicApi: "skipped" };
  if (env.apiKey) {
    try {
      const res = await (env.fetch ?? fetch)(`${CIVIC_BASE}/elections?key=${encodeURIComponent(env.apiKey)}`, {
        signal: AbortSignal.timeout(5000),
      });
      checks.civicApi = res.ok ? "ok" : `error ${res.status}`;
    } catch {
      checks.civicApi = "unreachable";
    }
  }
  const ok = checks.apiKey === "present" && checks.civicApi === "ok";
  const status = ok ? 200 : 503;
  const body = { status: ok ? "ok" : "degraded", checks, time: new Date().toISOString() };
  last = { at: Date.now(), body, status };
  return json(body, status);
}
