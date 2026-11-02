// Runtime-agnostic API handlers (Web-standard Request -> Response).
// Used by the Netlify Edge Functions in production and by the Vite dev server
// middleware locally. They never log or persist the voter's address.

import type { AddressSuggestion, ApiErrorCode, ElectionsResponse, VoterInfo } from "../types.ts";
import { normalizeElections, normalizeVoterInfo } from "../normalize.ts";
import { RateLimiter } from "./rateLimit.ts";
import { TtlCache, sha256 } from "./cache.ts";

export const CIVIC_BASE = "https://www.googleapis.com/civicinfo/v2";
const CENSUS_GEOCODER = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const PHOTON = "https://photon.komoot.io/api/";

export interface HandlerEnv {
  apiKey: string | undefined;
  /** Client IP, for rate limiting only. */
  ip: string;
  fetch?: typeof fetch;
}

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  // Responses describe one voter's address; never let shared caches keep them.
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } });
}

export function errorResponse(code: ApiErrorCode, message: string, status: number, extra?: Record<string, string>) {
  return json({ error: { code, message } }, status, extra);
}

// ---- Module-level state (lives as long as the edge isolate) ----
const voterInfoCache = new TtlCache<VoterInfo>(15 * 60 * 1000, 1000);
const electionsCache = new TtlCache<ElectionsResponse>(60 * 60 * 1000, 4);
const suggestCache = new TtlCache<AddressSuggestion[]>(60 * 60 * 1000, 2000);
const voterInfoLimiter = new RateLimiter(20, 60_000);
const electionsLimiter = new RateLimiter(60, 60_000);
const suggestLimiter = new RateLimiter(90, 60_000);

/** Test hook: reset module state between tests. */
export function __resetForTests() {
  Object.assign(voterInfoCache, new TtlCache<VoterInfo>(15 * 60 * 1000, 1000));
  Object.assign(electionsCache, new TtlCache<ElectionsResponse>(60 * 60 * 1000, 4));
  Object.assign(suggestCache, new TtlCache<AddressSuggestion[]>(60 * 60 * 1000, 2000));
  Object.assign(voterInfoLimiter, new RateLimiter(20, 60_000));
  Object.assign(electionsLimiter, new RateLimiter(60, 60_000));
  Object.assign(suggestLimiter, new RateLimiter(90, 60_000));
}

function rateLimited(retryAfter: number) {
  return errorResponse("rate_limited", "Too many requests. Please wait a moment and try again.", 429, {
    "retry-after": String(retryAfter),
  });
}

async function readJsonBody(req: Request): Promise<Record<string, unknown> | undefined> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > 4096) return undefined;
  try {
    const text = await req.text();
    if (text.length > 4096) return undefined;
    const body = JSON.parse(text);
    return body && typeof body === "object" && !Array.isArray(body) ? body : undefined;
  } catch {
    return undefined;
  }
}

export function validateAddress(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const a = v.replace(/\s+/g, " ").trim();
  if (a.length < 5 || a.length > 200) return undefined;
  if (!/[a-z]/i.test(a)) return undefined;
  return a;
}

export function validateElectionId(v: unknown): string | undefined | null {
  if (v === undefined || v === null || v === "") return undefined;
  const s = String(v);
  return /^\d{1,10}$/.test(s) ? s : null; // null = invalid
}

/** Best-effort US Census geocode, used only to sort locations by distance. */
async function geocode(address: string, f: typeof fetch): Promise<{ lat: number; lng: number } | undefined> {
  try {
    const url = `${CENSUS_GEOCODER}?${new URLSearchParams({ address, benchmark: "Public_AR_Current", format: "json" })}`;
    const res = await f(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return undefined;
    const data = await res.json();
    const c = data?.result?.addressMatches?.[0]?.coordinates;
    if (typeof c?.x === "number" && typeof c?.y === "number") return { lat: c.y, lng: c.x };
  } catch {
    // Geocoding is optional; fall through.
  }
  return undefined;
}

async function readGoogleError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return String(data?.error?.message ?? "");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------- /api/voterinfo

export async function handleVoterInfo(req: Request, env: HandlerEnv): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse("bad_request", "Use POST with a JSON body.", 405, { allow: "POST" });
  }
  const wait = voterInfoLimiter.check(env.ip);
  if (wait) return rateLimited(wait);
  if (!env.apiKey) return errorResponse("not_configured", "The server is missing its API key.", 500);

  const body = await readJsonBody(req);
  const address = validateAddress(body?.address);
  if (!address) {
    return errorResponse("bad_request", "Enter a full street address, including city and state.", 400);
  }
  const electionId = validateElectionId(body?.electionId);
  if (electionId === null) return errorResponse("bad_request", "Invalid election.", 400);

  const result = await lookupVoterInfo(address, electionId, env.apiKey, env.fetch ?? fetch);
  if (!result.ok) return result.response;
  return json(result.info, 200, { "x-cache": result.cached ? "HIT" : "MISS" });
}

export type VoterInfoLookup =
  | { ok: true; info: VoterInfo; cached: boolean }
  | { ok: false; response: Response };

/**
 * Cached Google voterinfo lookup + geocode + normalization. Shared by /api/voterinfo and
 * by server features that need the same data (e.g. measure summaries).
 */
export async function lookupVoterInfo(
  address: string,
  electionId: string | undefined,
  apiKey: string,
  f: typeof fetch,
): Promise<VoterInfoLookup> {
  const cacheKey = await sha256(`${address.toLowerCase()}|${electionId ?? ""}`);
  const cached = voterInfoCache.get(cacheKey);
  if (cached) return { ok: true, info: cached, cached: true };

  const params = new URLSearchParams({ key: apiKey, address });
  if (electionId) params.set("electionId", electionId);

  let googleRes: Response;
  const geoPromise = geocode(address, f);
  try {
    googleRes = await f(`${CIVIC_BASE}/voterinfo?${params}`, { signal: AbortSignal.timeout(8000) });
  } catch {
    return fail("upstream_error", "The election data service did not respond. Please try again.", 502);
  }

  if (!googleRes.ok) {
    const message = (await readGoogleError(googleRes)).toLowerCase();
    if (googleRes.status === 400 && message.includes("parse address")) {
      return fail(
        "address_not_found",
        "We couldn't find that address. Check the street, city and state, and use your residential (registered) address.",
        422,
      );
    }
    if ((googleRes.status === 400 || googleRes.status === 404) && message.includes("election")) {
      return fail("no_election_data", "No election data is available for this address right now.", 404);
    }
    if (googleRes.status === 429 || message.includes("quota") || message.includes("rate")) {
      return fail("upstream_error", "The election data service is busy. Please try again shortly.", 503);
    }
    // Includes invalid/misconfigured API key. Details stay server-side.
    console.error(`[voterinfo] upstream ${googleRes.status}`);
    return fail("upstream_error", "The election data service returned an error.", 502);
  }

  let raw: unknown;
  try {
    raw = await googleRes.json();
  } catch {
    return fail("upstream_error", "The election data service returned an unreadable response.", 502);
  }
  const origin = await geoPromise;
  const info = normalizeVoterInfo(raw, origin);
  if (!info) return fail("no_election_data", "No election data is available for this address right now.", 404);
  voterInfoCache.set(cacheKey, info);
  return { ok: true, info, cached: false };
}

function fail(code: ApiErrorCode, message: string, status: number): VoterInfoLookup {
  return { ok: false, response: errorResponse(code, message, status) };
}

// ---------------------------------------------------------------- /api/elections

export async function handleElections(req: Request, env: HandlerEnv): Promise<Response> {
  if (req.method !== "GET") return errorResponse("bad_request", "Use GET.", 405, { allow: "GET" });
  const wait = electionsLimiter.check(env.ip);
  if (wait) return rateLimited(wait);
  if (!env.apiKey) return errorResponse("not_configured", "The server is missing its API key.", 500);

  const includeTest = new URL(req.url).searchParams.get("includeTest") === "1";
  const key = includeTest ? "test" : "public";
  const cached = electionsCache.get(key);
  // The election list is the same for everyone, so a short public cache is fine.
  const pub = { "cache-control": "public, max-age=300" };
  if (cached) return json(cached, 200, { ...pub, "x-cache": "HIT" });

  const f = env.fetch ?? fetch;
  try {
    const res = await f(`${CIVIC_BASE}/elections?${new URLSearchParams({ key: env.apiKey })}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`[elections] upstream ${res.status}`);
      return errorResponse("upstream_error", "The election data service returned an error.", 502);
    }
    const body: ElectionsResponse = { elections: normalizeElections(await res.json(), includeTest) };
    electionsCache.set(key, body);
    return json(body, 200, { ...pub, "x-cache": "MISS" });
  } catch {
    return errorResponse("upstream_error", "The election data service did not respond. Please try again.", 502);
  }
}

// ---------------------------------------------------------------- /api/autocomplete

/** US address suggestions from Photon (OpenStreetMap). Proxied so the browser talks only to us. */
export async function handleAutocomplete(req: Request, env: HandlerEnv): Promise<Response> {
  if (req.method !== "POST") return errorResponse("bad_request", "Use POST.", 405, { allow: "POST" });
  const wait = suggestLimiter.check(env.ip);
  if (wait) return rateLimited(wait);

  const body = await readJsonBody(req);
  const q = typeof body?.q === "string" ? body.q.replace(/\s+/g, " ").trim() : "";
  if (q.length < 4 || q.length > 120) return json({ suggestions: [] });

  const cacheKey = await sha256(q.toLowerCase());
  const cached = suggestCache.get(cacheKey);
  if (cached) return json({ suggestions: cached });

  const f = env.fetch ?? fetch;
  const params = new URLSearchParams({ q, limit: "8", lang: "en", bbox: "-179.9,17.5,-64.5,71.6" });
  params.append("layer", "house");
  params.append("layer", "street");
  try {
    const res = await f(`${PHOTON}?${params}`, {
      signal: AbortSignal.timeout(2500),
      headers: { "user-agent": "Civic voting plan app" },
    });
    if (!res.ok) return json({ suggestions: [] });
    const data = await res.json();
    const suggestions = toSuggestions(data);
    suggestCache.set(cacheKey, suggestions);
    return json({ suggestions });
  } catch {
    return json({ suggestions: [] });
  }
}

const STATE_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO",
  Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY",
  Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN",
  Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH",
  "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
  Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
  "Puerto Rico": "PR", Guam: "GU", "U.S. Virgin Islands": "VI", "American Samoa": "AS",
  "Northern Mariana Islands": "MP",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export function toSuggestions(data: any): AddressSuggestion[] {
  const features: any[] = Array.isArray(data?.features) ? data.features : [];
  const out: AddressSuggestion[] = [];
  for (const f of features) {
    const p = f?.properties ?? {};
    const coords = f?.geometry?.coordinates;
    if (p.countrycode !== "US" || !Array.isArray(coords)) continue;
    const street = p.street ?? (p.type === "street" ? p.name : undefined);
    if (!street) continue;
    const line1 = p.housenumber ? `${p.housenumber} ${street}` : street;
    const city = p.city ?? p.town ?? p.village ?? p.district ?? p.county;
    const state = STATE_ABBR[p.state] ?? p.state;
    const label = [line1, city, [state, p.postcode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    if (!out.some((s) => s.label === label)) out.push({ label, lat: coords[1], lng: coords[0] });
    if (out.length >= 5) break;
  }
  return out;
}
