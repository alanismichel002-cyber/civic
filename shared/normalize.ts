// Converts raw Google Civic Information API responses into the app's own types.
// Raw shapes are typed loosely on purpose: coverage varies by state, and any
// field may be missing.

import type {
  Candidate,
  Contest,
  ContestLevel,
  Election,
  ElectionOffice,
  ElectionOfficial,
  LocationKind,
  OfficeLink,
  PostalAddress,
  Source,
  VoterInfo,
  VotingLocation,
} from "./types.ts";
import { CONTEST_LEVEL_ORDER } from "./types.ts";
import { distanceMiles } from "./geo.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = any;

/** Maximum number of locations of each kind sent to the browser. */
export const MAX_LOCATIONS_PER_KIND = 25;

const str = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
};

const num = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

/** Only http(s) URLs may become links. Blocks javascript:, data:, etc. */
export function safeUrl(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeSources(raw: Raw): Source[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s: Raw) => ({ name: str(s?.name) ?? "Unknown source", official: s?.official === true }))
    .filter((s, i, all) => all.findIndex((o) => o.name === s.name && o.official === s.official) === i);
}

export function normalizeAddress(raw: Raw): PostalAddress {
  if (!raw || typeof raw !== "object") return {};
  return {
    name: str(raw.locationName),
    line1: str(raw.line1),
    line2: str(raw.line2),
    line3: str(raw.line3),
    city: str(raw.city),
    state: str(raw.state),
    zip: str(raw.zip),
  };
}

export function normalizeElection(raw: Raw): Election | undefined {
  const id = str(raw?.id);
  if (!id) return undefined;
  return { id, name: str(raw.name) ?? `Election ${id}`, day: str(raw.electionDay) ?? "" };
}

function normalizeLocations(
  raw: Raw,
  kind: LocationKind,
  origin: { lat: number; lng: number } | undefined,
): { items: VotingLocation[]; total: number } {
  if (!Array.isArray(raw)) return { items: [], total: 0 };
  const items: VotingLocation[] = raw.map((l: Raw, i: number) => {
    const address = normalizeAddress(l?.address);
    const lat = num(l?.latitude);
    const lng = num(l?.longitude);
    const loc: VotingLocation = {
      id: `${kind}-${i}`,
      kind,
      name: str(l?.name) ?? address.name,
      address,
      hours: str(l?.pollingHours),
      notes: str(l?.notes),
      voterServices: str(l?.voterServices),
      startDate: str(l?.startDate),
      endDate: str(l?.endDate),
      lat,
      lng,
      sources: normalizeSources(l?.sources),
    };
    if (origin && lat !== undefined && lng !== undefined) {
      loc.distanceMiles = Math.round(distanceMiles(origin, { lat, lng }) * 10) / 10;
    }
    return loc;
  });
  if (origin) {
    // Stable sort: locations without coordinates keep API order, after the rest.
    items.sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity));
  }
  return { items: items.slice(0, MAX_LOCATIONS_PER_KIND), total: items.length };
}

const LEVEL_FROM_API: Record<string, ContestLevel> = {
  international: "other",
  country: "federal",
  administrativearea1: "state",
  regional: "special",
  administrativearea2: "county",
  locality: "city",
  sublocality1: "city",
  sublocality2: "city",
  special: "special",
};

const LEVEL_FROM_SCOPE: Record<string, ContestLevel> = {
  national: "federal",
  congressional: "federal",
  statewide: "state",
  stateupper: "state",
  statelower: "state",
  countywide: "county",
  countycouncil: "county",
  citywide: "city",
  citycouncil: "city",
  ward: "city",
  township: "city",
  schoolboard: "school",
  judicial: "judicial",
  special: "special",
};

const JUDICIAL_RE = /\b(judge|justice|court|judicial|magistrate)\b/i;
const SCHOOL_RE = /\b(school|education|college|university|unified|isd|usd)\b/i;
const FEDERAL_RE = /\b(president(ial)?|u\.?\s?s\.? (senate|senator|representative|house)|united states|congress(ional)?)\b/i;
const STATE_RE = /\b(state (measure|proposition|question|amendment|senate|senator|assembly|representative)|governor|secretary of state|attorney general)\b/i;

/**
 * Picks the ballot section a contest belongs in. Judicial and school races are
 * grouped by subject even when they are county- or city-level, because those
 * are the races voters most often look for by name.
 */
export function classifyContest(raw: Raw): ContestLevel {
  const roles: string[] = Array.isArray(raw?.roles) ? raw.roles.map((r: unknown) => String(r).toLowerCase()) : [];
  const levels: string[] = Array.isArray(raw?.level) ? raw.level.map((l: unknown) => String(l).toLowerCase()) : [];
  const scope = String(raw?.district?.scope ?? "").toLowerCase();
  const text = [raw?.office, raw?.ballotTitle, raw?.district?.name].filter(Boolean).join(" ");

  if (roles.includes("judge") || roles.includes("highestcourtjudge") || scope === "judicial") return "judicial";
  if (roles.includes("schoolboard") || scope === "schoolboard") return "school";
  if (levels.length && LEVEL_FROM_API[levels[0]]) {
    const lvl = LEVEL_FROM_API[levels[0]];
    if (lvl !== "federal" && JUDICIAL_RE.test(text)) return "judicial";
    if (lvl !== "federal" && SCHOOL_RE.test(text)) return "school";
    return lvl;
  }
  if (JUDICIAL_RE.test(text)) return "judicial";
  if (SCHOOL_RE.test(text)) return "school";
  // Some feeds tag every contest with the county's scope; trust unambiguous titles first.
  if (FEDERAL_RE.test(text)) return "federal";
  if (STATE_RE.test(text)) return "state";
  if (scope && LEVEL_FROM_SCOPE[scope]) return LEVEL_FROM_SCOPE[scope];
  return "other";
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeCandidate(raw: Raw): Candidate {
  return {
    name: str(raw?.name) ?? "Unnamed candidate",
    party: str(raw?.party),
    photoUrl: safeUrl(raw?.photoUrl),
    url: safeUrl(raw?.candidateUrl),
    phone: str(raw?.phone),
    email: str(raw?.email),
    channels: Array.isArray(raw?.channels)
      ? raw.channels
          .map((c: Raw) => ({ type: str(c?.type) ?? "", id: str(c?.id) ?? "" }))
          .filter((c: { type: string; id: string }) => c.type && c.id)
      : [],
    orderOnBallot: num(raw?.orderOnBallot),
  };
}

function isMeasure(raw: Raw): boolean {
  const type = String(raw?.type ?? "").toLowerCase();
  return type === "referendum" || type === "ballot-measure" || !!str(raw?.referendumTitle);
}

export function normalizeContests(raw: Raw): Contest[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Map<string, number>();
  const contests = raw.map((c: Raw, index: number) => {
    const measure = isMeasure(c);
    const title =
      (measure ? str(c?.referendumTitle) : undefined) ?? str(c?.ballotTitle) ?? str(c?.office) ?? "Untitled contest";
    const district = str(c?.district?.name);
    let id = slug(`${title}-${district ?? ""}`) || `contest-${index}`;
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n > 0) id = `${id}-${n + 1}`;

    const candidates = Array.isArray(c?.candidates) ? c.candidates.map(normalizeCandidate) : [];
    // Official ballot order only. If orderOnBallot is present, honor it; otherwise keep API order.
    if (candidates.some((x: Candidate) => x.orderOnBallot !== undefined)) {
      candidates.sort((a: Candidate, b: Candidate) => (a.orderOnBallot ?? Infinity) - (b.orderOnBallot ?? Infinity));
    }

    const contest: Contest = {
      id,
      kind: measure ? "measure" : "candidate",
      title,
      subtitle: measure ? str(c?.referendumSubtitle) : str(c?.ballotTitle) !== title ? str(c?.ballotTitle) : undefined,
      level: classifyContest(c),
      district,
      type: str(c?.type),
      ballotPlacement: num(c?.ballotPlacement),
      numberElected: num(c?.numberElected),
      numberVotingFor: num(c?.numberVotingFor),
      candidates,
      sources: normalizeSources(c?.sources),
    };
    if (measure) {
      contest.measure = {
        title,
        subtitle: str(c?.referendumSubtitle),
        summary: str(c?.referendumBrief),
        fullText: str(c?.referendumText),
        pro: str(c?.referendumProStatement),
        con: str(c?.referendumConStatement),
        passageThreshold: str(c?.referendumPassageThreshold),
        effectOfAbstain: str(c?.referendumEffectOfAbstain),
        url: safeUrl(c?.referendumUrl),
        responses: Array.isArray(c?.referendumBallotResponses)
          ? c.referendumBallotResponses.map((r: unknown) => String(r))
          : ["Yes", "No"],
      };
    }
    return { contest, index };
  });

  // Group by level, then official ballot placement; API order breaks ties.
  contests.sort((a, b) => {
    const la = CONTEST_LEVEL_ORDER.indexOf(a.contest.level);
    const lb = CONTEST_LEVEL_ORDER.indexOf(b.contest.level);
    if (la !== lb) return la - lb;
    const pa = a.contest.ballotPlacement ?? Infinity;
    const pb = b.contest.ballotPlacement ?? Infinity;
    if (pa !== pb) return pa - pb;
    return a.index - b.index;
  });
  return contests.map((c) => c.contest);
}

const LINK_FIELDS: [OfficeLink["key"], string][] = [
  ["registration", "electionRegistrationUrl"],
  ["registrationCheck", "electionRegistrationConfirmationUrl"],
  ["absentee", "absenteeVotingInfoUrl"],
  ["locationFinder", "votingLocationFinderUrl"],
  ["ballotInfo", "ballotInfoUrl"],
  ["rules", "electionRulesUrl"],
  ["info", "electionInfoUrl"],
];

function normalizeOffice(
  body: Raw,
  scope: "state" | "local",
  jurisdiction: string,
  sources: Raw,
): ElectionOffice | undefined {
  if (!body || typeof body !== "object") return undefined;
  const links: OfficeLink[] = [];
  for (const [key, field] of LINK_FIELDS) {
    const url = safeUrl(body[field]);
    if (url && !links.some((l) => l.url === url && l.key === key)) links.push({ key, url });
  }
  const officials: ElectionOfficial[] = Array.isArray(body.electionOfficials)
    ? body.electionOfficials.map((o: Raw) => ({
        name: str(o?.name),
        title: str(o?.title),
        phone: str(o?.officePhoneNumber),
        fax: str(o?.faxNumber),
        email: str(o?.emailAddress),
      }))
    : [];
  const physical = normalizeAddress(body.physicalAddress);
  const mailing = normalizeAddress(body.correspondenceAddress);
  const address = physical.line1 ? physical : mailing.line1 ? mailing : undefined;
  return {
    scope,
    jurisdiction,
    name: str(body.name),
    links,
    address,
    hours: str(body.hoursOfOperation),
    officials,
    sources: normalizeSources(sources),
  };
}

export function normalizeOffices(rawState: Raw): ElectionOffice[] {
  if (!Array.isArray(rawState)) return [];
  const out: ElectionOffice[] = [];
  for (const s of rawState) {
    const stateName = str(s?.name) ?? "State";
    const st = normalizeOffice(s?.electionAdministrationBody, "state", stateName, s?.sources);
    if (st) out.push(st);
    const local = s?.local_jurisdiction;
    if (local) {
      const lo = normalizeOffice(
        local.electionAdministrationBody,
        "local",
        str(local.name) ?? "Local",
        local.sources ?? s?.sources,
      );
      if (lo) out.push(lo);
    }
  }
  return out;
}

export function normalizeVoterInfo(raw: Raw, origin?: { lat: number; lng: number }): VoterInfo | undefined {
  const election = normalizeElection(raw?.election);
  if (!election) return undefined;
  const polling = normalizeLocations(raw.pollingLocations, "polling", origin);
  const early = normalizeLocations(raw.earlyVoteSites, "early", origin);
  const dropoff = normalizeLocations(raw.dropOffLocations, "dropoff", origin);
  const contests = normalizeContests(raw.contests);
  const offices = normalizeOffices(raw.state);

  const allSources = [
    ...polling.items.flatMap((l) => l.sources),
    ...early.items.flatMap((l) => l.sources),
    ...dropoff.items.flatMap((l) => l.sources),
    ...contests.flatMap((c) => c.sources),
    ...offices.flatMap((o) => o.sources),
  ];
  const sources = allSources.filter(
    (s, i) => allSources.findIndex((o) => o.name === s.name && o.official === s.official) === i,
  );

  const otherElections = (Array.isArray(raw.otherElections) ? raw.otherElections : [])
    .map(normalizeElection)
    .filter((e: Election | undefined): e is Election => !!e && e.id !== election.id);

  return {
    election,
    otherElections,
    normalizedArea: {
      city: str(raw.normalizedInput?.city),
      state: str(raw.normalizedInput?.state),
      zip: str(raw.normalizedInput?.zip),
    },
    origin,
    mailOnly: raw.mailOnly === true,
    pollingLocations: polling.items,
    earlyVoteSites: early.items,
    dropOffLocations: dropoff.items,
    totals: { polling: polling.total, early: early.total, dropoff: dropoff.total },
    contests,
    offices,
    sources,
    isEmpty: polling.total + early.total + dropoff.total + contests.length === 0,
  };
}

/** Test elections the API always lists; hidden from voters, still queryable by id. */
export const TEST_ELECTION_IDS = new Set(["2000", "1001"]);

export function normalizeElections(raw: Raw, includeTest = false): Election[] {
  const list = Array.isArray(raw?.elections) ? raw.elections : [];
  return list
    .map(normalizeElection)
    .filter((e: Election | undefined): e is Election => !!e && (includeTest || !TEST_ELECTION_IDS.has(e.id)))
    .sort((a: Election, b: Election) => a.day.localeCompare(b.day));
}
