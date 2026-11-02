// FR-18: "Who Represents Me".
//  - Districts: U.S. Census geocoder (free, no key) + Google divisionsByAddress (OCD-IDs).
//  - Federal members: @unitedstates/congress-legislators (public domain, no key).
//  - State legislators: OpenStates v3 (free key, optional; without it we show districts + a lookup link).
// Runs in a Netlify Function (Node). Never logs or stores the address.

import type { Channel, Source } from "../types.ts";
import { safeUrl } from "../normalize.ts";
import { TtlCache, sha256 } from "./cache.ts";
import { RateLimiter } from "./rateLimit.ts";
import { CIVIC_BASE, errorResponse, json, validateAddress } from "./handlers.ts";

export interface Official {
  id: string;
  name: string;
  office: string;
  level: "federal" | "state";
  chamber?: "senate" | "house" | "upper" | "lower";
  party?: string;
  district?: string;
  photoUrl?: string;
  url?: string;
  contactForm?: string;
  phone?: string;
  email?: string;
  address?: string;
  channels: Channel[];
  source: Source;
}

export interface Representatives {
  state?: string;
  districts: { congressional?: string; stateUpper?: string; stateLower?: string; county?: string };
  divisions: { id: string; name: string }[];
  officials: Official[];
  stateLegislatorsAvailable: boolean;
  findStateLegislatorsUrl: string;
}

export interface RepsEnv {
  googleKey: string | undefined;
  openStatesKey: string | undefined;
  ip: string;
  fetch?: typeof fetch;
}

const LEGISLATORS_URL = "https://unitedstates.github.io/congress-legislators/legislators-current.json";
const SOCIAL_URL = "https://unitedstates.github.io/congress-legislators/legislators-social-media.json";
const CENSUS_GEOGRAPHIES = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";
const OPENSTATES_GEO = "https://v3.openstates.org/people.geo";
const FIND_STATE_LEGISLATORS = "https://openstates.org/find_your_legislator/";

const repsCache = new TtlCache<Representatives>(6 * 60 * 60 * 1000, 1000);
const limiter = new RateLimiter(20, 60_000);

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = any;

interface Legislators {
  people: Raw[];
  social: Map<string, Raw>;
  loadedAt: number;
}
let legislators: Legislators | undefined;
let legislatorsLoading: Promise<Legislators> | undefined;

export function __resetRepsForTests() {
  legislators = undefined;
  legislatorsLoading = undefined;
  Object.assign(repsCache, new TtlCache<Representatives>(6 * 60 * 60 * 1000, 1000));
  Object.assign(limiter, new RateLimiter(20, 60_000));
}

async function loadLegislators(f: typeof fetch): Promise<Legislators> {
  if (legislators && Date.now() - legislators.loadedAt < 24 * 60 * 60 * 1000) return legislators;
  legislatorsLoading ??= (async () => {
    try {
      const [peopleRes, socialRes] = await Promise.all([
        f(LEGISLATORS_URL, { signal: AbortSignal.timeout(8000) }),
        f(SOCIAL_URL, { signal: AbortSignal.timeout(8000) }).catch(() => undefined),
      ]);
      if (!peopleRes.ok) throw new Error(`legislators ${peopleRes.status}`);
      const people = (await peopleRes.json()) as Raw[];
      const social = new Map<string, Raw>();
      if (socialRes?.ok) {
        for (const s of (await socialRes.json()) as Raw[]) if (s?.id?.bioguide) social.set(s.id.bioguide, s.social ?? {});
      }
      legislators = { people, social, loadedAt: Date.now() };
      return legislators;
    } finally {
      legislatorsLoading = undefined;
    }
  })();
  return legislatorsLoading;
}

interface Geo {
  lat: number;
  lng: number;
  state?: string;
  congressional?: string;
  stateUpper?: string;
  stateLower?: string;
  county?: string;
}

export function parseCensusGeographies(data: Raw): Geo | undefined {
  const m = data?.result?.addressMatches?.[0];
  if (!m?.coordinates) return undefined;
  const g = m.geographies ?? {};
  const pick = (re: RegExp) => {
    const key = Object.keys(g).find((k) => re.test(k));
    return key ? g[key]?.[0] : undefined;
  };
  const cd = pick(/Congressional Districts/i);
  const upper = pick(/State Legislative Districts - Upper/i);
  const lower = pick(/State Legislative Districts - Lower/i);
  const county = pick(/^Counties$/i);
  const cdNum = cd ? Number.parseInt(String(cd.BASENAME), 10) : NaN;
  return {
    lat: m.coordinates.y,
    lng: m.coordinates.x,
    state: m.addressComponents?.state || undefined,
    // At-large seats and DC's delegate have a non-numeric BASENAME; the legislators data uses district 0.
    congressional: cd ? (Number.isFinite(cdNum) ? String(cdNum) : "0") : undefined,
    stateUpper: upper?.NAME,
    stateLower: lower?.NAME,
    county: county?.NAME,
  };
}

function socialChannels(s: Raw): Channel[] {
  if (!s) return [];
  const out: Channel[] = [];
  if (s.twitter) out.push({ type: "X", id: `https://x.com/${encodeURIComponent(s.twitter)}` });
  if (s.facebook) out.push({ type: "Facebook", id: `https://www.facebook.com/${encodeURIComponent(s.facebook)}` });
  if (s.instagram) out.push({ type: "Instagram", id: `https://www.instagram.com/${encodeURIComponent(s.instagram)}` });
  if (s.youtube_id) out.push({ type: "YouTube", id: `https://www.youtube.com/channel/${encodeURIComponent(s.youtube_id)}` });
  else if (s.youtube) out.push({ type: "YouTube", id: `https://www.youtube.com/${encodeURIComponent(s.youtube)}` });
  return out;
}

const PARTY: Record<string, string> = { Democrat: "Democratic" };

export function federalOfficials(people: Raw[], social: Map<string, Raw>, state: string, cd?: string): Official[] {
  const source: Source = { name: "U.S. Congress (unitedstates/congress-legislators)", official: false };
  const out: Official[] = [];
  for (const p of people) {
    const term = p?.terms?.[p.terms.length - 1];
    if (!term || term.state !== state) continue;
    const isSen = term.type === "sen";
    if (!isSen && (cd === undefined || String(term.district ?? 0) !== cd)) continue;
    const bioguide: string | undefined = p.id?.bioguide;
    const name = p.name?.official_full ?? [p.name?.first, p.name?.last].filter(Boolean).join(" ");
    out.push({
      id: `us-${bioguide ?? name}`,
      name,
      office: isSen ? "U.S. Senator" : state === "DC" || ["PR", "GU", "VI", "AS", "MP"].includes(state) ? "Delegate to the U.S. House" : "U.S. Representative",
      level: "federal",
      chamber: isSen ? "senate" : "house",
      party: term.party ? (PARTY[term.party] ?? term.party) : undefined,
      district: isSen ? undefined : term.district ? String(term.district) : "At large",
      photoUrl: bioguide ? `https://unitedstates.github.io/images/congress/225x275/${bioguide}.jpg` : undefined,
      url: safeUrl(term.url),
      contactForm: safeUrl(term.contact_form),
      phone: term.phone,
      address: term.address,
      channels: bioguide ? socialChannels(social.get(bioguide)) : [],
      source,
    });
  }
  // Senators first (senior by start date), then the House member.
  return out.sort((a, b) => (a.chamber === b.chamber ? 0 : a.chamber === "senate" ? -1 : 1));
}

export function stateOfficials(data: Raw): Official[] {
  const results: Raw[] = Array.isArray(data?.results) ? data.results : [];
  const source: Source = { name: "Open States", official: false };
  return results
    .filter((p) => p?.jurisdiction?.classification === "state" || /state:/.test(p?.jurisdiction?.id ?? ""))
    .filter((p) => ["upper", "lower", "legislature"].includes(p?.current_role?.org_classification))
    .map((p) => {
      const role = p.current_role ?? {};
      const office = Array.isArray(p.offices) ? p.offices.find((o: Raw) => o?.voice) ?? p.offices[0] : undefined;
      const links: Raw[] = Array.isArray(p.links) ? p.links : [];
      return {
        id: `os-${p.id}`,
        name: String(p.name ?? ""),
        office: String(role.title ?? (role.org_classification === "upper" ? "State Senator" : "State Representative")),
        level: "state" as const,
        chamber: role.org_classification === "upper" ? ("upper" as const) : ("lower" as const),
        party: p.party,
        district: role.district ? String(role.district) : undefined,
        photoUrl: safeUrl(p.image),
        url: safeUrl(links[0]?.url) ?? safeUrl(p.openstates_url),
        phone: office?.voice,
        email: typeof p.email === "string" && p.email.includes("@") ? p.email : undefined,
        address: office?.address,
        channels: [],
        source,
      };
    })
    .sort((a, b) => (a.chamber === b.chamber ? 0 : a.chamber === "upper" ? -1 : 1));
}

export async function handleRepresentatives(req: Request, env: RepsEnv): Promise<Response> {
  if (req.method !== "POST") return errorResponse("bad_request", "Use POST with a JSON body.", 405, { allow: "POST" });
  const wait = limiter.check(env.ip);
  if (wait) {
    return errorResponse("rate_limited", "Too many requests. Please wait a moment and try again.", 429, {
      "retry-after": String(wait),
    });
  }
  let body: Raw;
  try {
    const text = await req.text();
    body = text.length <= 4096 ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  const address = validateAddress(body?.address);
  if (!address) return errorResponse("bad_request", "Enter a full street address, including city and state.", 400);

  const key = await sha256(`reps|${address.toLowerCase()}`);
  const cached = repsCache.get(key);
  if (cached) return json(cached, 200, { "x-cache": "HIT" });

  const f = env.fetch ?? fetch;
  const censusUrl = `${CENSUS_GEOGRAPHIES}?${new URLSearchParams({
    address,
    benchmark: "Public_AR_Current",
    vintage: "Current_Current",
    layers: "all",
    format: "json",
  })}`;
  const [censusRes, divisionsRes] = await Promise.all([
    f(censusUrl, { signal: AbortSignal.timeout(6000) }).catch(() => undefined),
    env.googleKey
      ? f(`${CIVIC_BASE}/divisionsByAddress?${new URLSearchParams({ key: env.googleKey, address })}`, {
          signal: AbortSignal.timeout(6000),
        }).catch(() => undefined)
      : Promise.resolve(undefined),
  ]);

  let geo: Geo | undefined;
  if (censusRes?.ok) {
    try {
      geo = parseCensusGeographies(await censusRes.json());
    } catch {
      geo = undefined;
    }
  }
  let divisions: { id: string; name: string }[] = [];
  let googleState: string | undefined;
  if (divisionsRes?.ok) {
    try {
      const d = await divisionsRes.json();
      googleState = d?.normalizedInput?.state || undefined;
      divisions = Object.entries(d?.divisions ?? {}).map(([id, v]) => ({ id, name: String((v as Raw)?.name ?? id) }));
    } catch {
      divisions = [];
    }
  }

  const state = (geo?.state ?? googleState)?.toUpperCase();
  if (!state) {
    if (!censusRes && !divisionsRes) {
      return errorResponse("upstream_error", "The district lookup service did not respond. Please try again.", 502);
    }
    return errorResponse("address_not_found", "We couldn't find that address. Check the street, city and state.", 422);
  }

  // Fall back to Google's OCD-ID for the congressional district if Census didn't match the address.
  let cd = geo?.congressional;
  if (cd === undefined) {
    const m = divisions.map((x) => /\/cd:(\d+)$/.exec(x.id)).find(Boolean);
    if (m) cd = String(Number(m[1]));
    else if (["AK", "DE", "ND", "SD", "VT", "WY", "DC"].includes(state)) cd = "0";
  }

  const officials: Official[] = [];
  try {
    const leg = await loadLegislators(f);
    officials.push(...federalOfficials(leg.people, leg.social, state, cd));
  } catch {
    console.error("[representatives] federal data unavailable");
  }

  let stateLegislatorsAvailable = false;
  if (env.openStatesKey && geo) {
    try {
      const params = new URLSearchParams({ lat: String(geo.lat), lng: String(geo.lng), apikey: env.openStatesKey });
      params.append("include", "offices");
      params.append("include", "links");
      const res = await f(`${OPENSTATES_GEO}?${params}`, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        officials.push(...stateOfficials(await res.json()));
        stateLegislatorsAvailable = true;
      } else {
        console.error(`[representatives] openstates ${res.status}`);
      }
    } catch {
      console.error("[representatives] openstates unavailable");
    }
  }

  const result: Representatives = {
    state,
    districts: {
      congressional: cd === undefined ? undefined : cd === "0" ? "At large" : cd,
      stateUpper: geo?.stateUpper,
      stateLower: geo?.stateLower,
      county: geo?.county,
    },
    divisions,
    officials,
    stateLegislatorsAvailable,
    findStateLegislatorsUrl: FIND_STATE_LEGISLATORS,
  };
  repsCache.set(key, result);
  return json(result, 200, { "x-cache": "MISS" });
}
