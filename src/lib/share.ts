// FR-14: shareable Voting Plan links. The plan is encoded into the URL hash,
// so nothing is stored on a server and the voter's home address is never included.

import type { Election, PostalAddress, VoterInfo, VotingLocation } from "../../shared/types.ts";
import { keyDates, officeLink } from "./plan.ts";

export interface SharedLocation {
  n?: string; // name
  a: PostalAddress; // the polling place's public address
  h?: string; // hours
  s?: string; // start date
  e?: string; // end date
  la?: number;
  ln?: number;
}

export interface SharedPlan {
  v: 1;
  el: Election;
  area?: string; // "City, ST" only
  mo?: boolean; // mail only
  p?: SharedLocation; // polling place
  ev?: SharedLocation; // nearest early vote
  dr?: SharedLocation; // nearest drop-off
  es?: string; // early start
  dd?: string; // drop-off deadline
  reg?: string; // registration check URL
  info?: string; // election info URL
}

function toShared(l: VotingLocation | undefined): SharedLocation | undefined {
  if (!l) return undefined;
  return { n: l.name, a: l.address, h: l.hours, s: l.startDate, e: l.endDate, la: l.lat, ln: l.lng };
}

export function planFromVoterInfo(info: VoterInfo): SharedPlan {
  const dates = keyDates(info);
  const area = [info.normalizedArea.city, info.normalizedArea.state].filter(Boolean).join(", ");
  return {
    v: 1,
    el: info.election,
    area: area || undefined,
    mo: info.mailOnly || undefined,
    p: toShared(info.pollingLocations[0]),
    ev: toShared(info.earlyVoteSites[0]),
    dr: toShared(info.dropOffLocations[0]),
    es: dates.earlyStart,
    dd: dates.dropoffDeadline,
    reg: officeLink(info.offices, "registrationCheck"),
    info: officeLink(info.offices, "info"),
  };
}

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodePlan(plan: SharedPlan): string {
  return toBase64Url(JSON.stringify(plan));
}

const isStr = (v: unknown) => v === undefined || typeof v === "string";
const isHttp = (v: unknown) => v === undefined || (typeof v === "string" && /^https?:\/\//i.test(v));

function validLocation(l: unknown): l is SharedLocation | undefined {
  if (l === undefined) return true;
  if (!l || typeof l !== "object") return false;
  const o = l as SharedLocation;
  if (!o.a || typeof o.a !== "object") return false;
  return [o.n, o.h, o.s, o.e, ...Object.values(o.a)].every(isStr);
}

/** Decodes and validates untrusted link data. Returns undefined if anything is off. */
export function decodePlan(encoded: string): SharedPlan | undefined {
  if (!encoded || encoded.length > 8000) return undefined;
  try {
    const p = JSON.parse(fromBase64Url(encoded)) as SharedPlan;
    if (p?.v !== 1 || !p.el || typeof p.el.id !== "string" || typeof p.el.name !== "string") return undefined;
    if (!isStr(p.el.day) || !isStr(p.area) || !isStr(p.es) || !isStr(p.dd)) return undefined;
    if (!isHttp(p.reg) || !isHttp(p.info)) return undefined;
    if (!validLocation(p.p) || !validLocation(p.ev) || !validLocation(p.dr)) return undefined;
    return p;
  } catch {
    return undefined;
  }
}

export function shareUrl(plan: SharedPlan, origin = window.location.origin): string {
  return `${origin}/#/shared/${encodePlan(plan)}`;
}
