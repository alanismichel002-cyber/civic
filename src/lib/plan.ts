import type { ElectionOffice, OfficeLink, VoterInfo, VotingLocation } from "../../shared/types.ts";

export interface KeyDates {
  electionDay: string;
  earlyStart?: string;
  earlyEnd?: string;
  dropoffDeadline?: string;
}

const isDay = (s?: string): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function keyDates(info: Pick<VoterInfo, "election" | "earlyVoteSites" | "dropOffLocations">): KeyDates {
  const starts = info.earlyVoteSites.map((s) => s.startDate).filter(isDay).sort();
  const ends = info.earlyVoteSites.map((s) => s.endDate).filter(isDay).sort();
  const dropEnds = info.dropOffLocations.map((s) => s.endDate).filter(isDay).sort();
  return {
    electionDay: info.election.day,
    earlyStart: starts[0],
    earlyEnd: ends[ends.length - 1],
    dropoffDeadline: dropEnds[dropEnds.length - 1],
  };
}

export function primaryLocation(list: VotingLocation[]): VotingLocation | undefined {
  return list[0];
}

/** First link of a given kind, preferring the local office (more specific) then state. */
export function officeLink(offices: ElectionOffice[], key: OfficeLink["key"]): string | undefined {
  const ordered = [...offices.filter((o) => o.scope === "local"), ...offices.filter((o) => o.scope === "state")];
  for (const o of ordered) {
    const l = o.links.find((x) => x.key === key);
    if (l) return l.url;
  }
  return undefined;
}
