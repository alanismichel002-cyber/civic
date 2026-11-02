// App-level types. The frontend only ever sees these, never raw Google Civic
// API responses, so another data provider can be swapped in behind the proxy.

export interface Source {
  name: string;
  official: boolean;
}

export interface PostalAddress {
  name?: string;
  line1?: string;
  line2?: string;
  line3?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface Election {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  day: string;
}

export type LocationKind = "polling" | "early" | "dropoff";

export interface VotingLocation {
  id: string;
  kind: LocationKind;
  name?: string;
  address: PostalAddress;
  hours?: string;
  notes?: string;
  voterServices?: string;
  /** YYYY-MM-DD */
  startDate?: string;
  /** YYYY-MM-DD */
  endDate?: string;
  lat?: number;
  lng?: number;
  /** Distance from the voter's address in miles, when it could be computed. */
  distanceMiles?: number;
  sources: Source[];
}

export type ContestLevel =
  | "federal"
  | "state"
  | "county"
  | "city"
  | "school"
  | "judicial"
  | "special"
  | "other";

export const CONTEST_LEVEL_ORDER: ContestLevel[] = [
  "federal",
  "state",
  "county",
  "city",
  "school",
  "judicial",
  "special",
  "other",
];

export interface Channel {
  type: string;
  id: string;
}

export interface Candidate {
  name: string;
  party?: string;
  photoUrl?: string;
  url?: string;
  phone?: string;
  email?: string;
  channels: Channel[];
  orderOnBallot?: number;
}

export interface Measure {
  title: string;
  subtitle?: string;
  summary?: string;
  fullText?: string;
  pro?: string;
  con?: string;
  passageThreshold?: string;
  effectOfAbstain?: string;
  url?: string;
  responses: string[];
}

export interface Contest {
  /** Stable within an election; used to key saved ballot choices. */
  id: string;
  kind: "candidate" | "measure";
  title: string;
  subtitle?: string;
  level: ContestLevel;
  district?: string;
  type?: string;
  ballotPlacement?: number;
  numberElected?: number;
  numberVotingFor?: number;
  candidates: Candidate[];
  measure?: Measure;
  sources: Source[];
}

export interface OfficeLink {
  key:
    | "info"
    | "registration"
    | "registrationCheck"
    | "absentee"
    | "locationFinder"
    | "ballotInfo"
    | "rules";
  url: string;
}

export interface ElectionOfficial {
  name?: string;
  title?: string;
  phone?: string;
  fax?: string;
  email?: string;
}

export interface ElectionOffice {
  scope: "state" | "local";
  jurisdiction: string;
  name?: string;
  links: OfficeLink[];
  address?: PostalAddress;
  hours?: string;
  officials: ElectionOfficial[];
  sources: Source[];
}

export interface VoterInfo {
  election: Election;
  otherElections: Election[];
  /** City/state/zip as the API understood the address. Never the street line. */
  normalizedArea: { city?: string; state?: string; zip?: string };
  /** Approximate geocode of the voter's address, used for map centering. */
  origin?: { lat: number; lng: number };
  mailOnly: boolean;
  pollingLocations: VotingLocation[];
  earlyVoteSites: VotingLocation[];
  dropOffLocations: VotingLocation[];
  /** Totals before trimming the lists to the nearest locations. */
  totals: { polling: number; early: number; dropoff: number };
  contests: Contest[];
  offices: ElectionOffice[];
  /** Every distinct source referenced anywhere in the response. */
  sources: Source[];
  /**
   * True when the API returned an election but no locations or contests for it,
   * e.g. data is not yet published or two elections share the same day.
   */
  isEmpty: boolean;
}

export type ApiErrorCode =
  | "bad_request"
  | "address_not_found"
  | "no_election_data"
  | "rate_limited"
  | "not_configured"
  | "upstream_error"
  | "not_found"
  | "feature_disabled"
  | "summary_unavailable";

export interface ApiError {
  error: { code: ApiErrorCode; message: string };
}

export interface ElectionsResponse {
  elections: Election[];
}

export interface AddressSuggestion {
  label: string;
  lat: number;
  lng: number;
}
